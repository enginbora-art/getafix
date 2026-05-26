const express = require('express');
const authMiddleware = require('../middleware/auth');
const { generatePdf } = require('../services/pdf');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/reports?market=BIST&limit=30
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { market, limit = 30, page = 1, isClosing, type } = req.query;
    const where = {};
    if (market) where.market = market;
    if (isClosing !== undefined) where.isClosing = isClosing === 'true';
    if (type === 'MANUAL' || type === 'SCHEDULED') where.type = type;

    const take = Math.min(parseInt(limit), 100);
    const skip = (parseInt(page) - 1) * take;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          market: true,
          type: true,
          date: true,
          ticker: true,
          entryLow: true,
          entryHigh: true,
          stopLoss: true,
          targetShort: true,
          targetMid: true,
          riskLevel: true,
          isClosing: true,
          inPortfolio: true,
          createdAt: true,
        },
      }),
      prisma.report.count({ where }),
    ]);

    // For MANUAL reports, look up the submitting user via ManualRequest
    const manualReportIds = reports.filter((r) => r.type === 'MANUAL').map((r) => r.id);
    const userNameMap = {};
    if (manualReportIds.length > 0) {
      const reqs = await prisma.manualRequest.findMany({
        where: { reportId: { in: manualReportIds } },
        select: { reportId: true, user: { select: { name: true } } },
      });
      reqs.forEach((r) => { if (r.reportId) userNameMap[r.reportId] = r.user?.name || null; });
    }

    const enriched = reports.map((r) => ({ ...r, userName: userNameMap[r.id] || null }));
    res.json({ reports: enriched, total, page: parseInt(page), limit: take, totalPages: Math.ceil(total / take) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/portfolio
router.get('/portfolio', authMiddleware, async (req, res) => {
  try {
    const yf = require('../lib/yf');

    const reports = await prisma.report.findMany({
      where: { inPortfolio: true, ticker: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, market: true, createdAt: true, ticker: true,
        entryLow: true, entryHigh: true, stopLoss: true,
        targetShort: true, targetMid: true, riskLevel: true,
        userEntryPrice: true, content: true,
      },
    });

    // Keep only the latest report per ticker
    const seen = new Set();
    const unique = reports.filter((r) => {
      if (seen.has(r.ticker)) return false;
      seen.add(r.ticker);
      return true;
    });

    const parseBias = (content) => {
      const m = content?.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i);
      return m?.[1]?.toUpperCase() || null;
    };

    const parseYearEnd = (content) => {
      const m = content?.match(/Yıl Sonu Beklentisi[^|]*\|([^|]+)\|/);
      return m ? m[1].trim() : null;
    };

    const withPrices = await Promise.allSettled(
      unique.map(async (r) => {
        const symbol = r.market === 'BIST' ? `${r.ticker}.IS` : r.ticker;
        try {
          const quote = await yf.quote(symbol, { fields: ['regularMarketPrice'] });
          return { ...r, currentPrice: quote.regularMarketPrice ?? null };
        } catch {
          return { ...r, currentPrice: null };
        }
      }),
    );

    const positions = withPrices.map((result) => {
      const r = result.status === 'fulfilled' ? result.value : { ...result.value, currentPrice: null };

      const entryPrice =
        r.entryLow != null && r.entryHigh != null
          ? (r.entryLow + r.entryHigh) / 2
          : (r.entryLow ?? r.entryHigh ?? null);

      const effectiveEntry = r.userEntryPrice || entryPrice;

      const returnPct =
        effectiveEntry && r.currentPrice != null
          ? parseFloat(((r.currentPrice - effectiveEntry) / effectiveEntry * 100).toFixed(2))
          : null;

      return {
        reportId: r.id,
        ticker: r.ticker,
        market: r.market,
        reportDate: r.createdAt,
        bias: parseBias(r.content),
        yearEnd: parseYearEnd(r.content),
        entryPrice,
        effectiveEntry,
        userEntryPrice: r.userEntryPrice,
        target1: r.targetShort,
        target2: r.targetMid,
        stopLoss: r.stopLoss,
        riskLevel: r.riskLevel,
        currentPrice: r.currentPrice ?? null,
        returnPct,
      };
    });

    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/alerts/count
router.get('/alerts/count', authMiddleware, async (req, res) => {
  try {
    const count = await prisma.portfolioAlert.count({ where: { isRead: false } });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/alerts
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const alerts = await prisma.portfolioAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/kap-notices?market=BIST|US&page=1&limit=10
router.get('/kap-notices', authMiddleware, async (req, res) => {
  try {
    const { market, page = 1, limit = 10 } = req.query;
    const where = {};
    if (market && ['BIST', 'US'].includes(market)) where.market = market;
    const take = Math.min(parseInt(limit), 50);
    const skip = (parseInt(page) - 1) * take;
    const [total, notices] = await Promise.all([
      prisma.kapNotice.count({ where }),
      prisma.kapNotice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    res.json({ total, page: parseInt(page), totalPages: Math.ceil(total / take), notices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reports/alerts/read-all
router.put('/alerts/read-all', authMiddleware, async (req, res) => {
  try {
    await prisma.portfolioAlert.updateMany({ where: { isRead: false }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reports/alerts/:id/read
router.put('/alerts/:id/read', authMiddleware, async (req, res) => {
  try {
    await prisma.portfolioAlert.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/portfolio — takibe al
router.post('/:id/portfolio', authMiddleware, async (req, res) => {
  try {
    const currentCount = await prisma.report.count({ where: { inPortfolio: true } });
    if (currentCount >= 20) {
      return res.status(400).json({ error: 'Genel tabloda maksimum 20 hisse takip edilebilir.' });
    }
    await prisma.report.update({ where: { id: req.params.id }, data: { inPortfolio: true } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/reports/:id/portfolio — takipten çıkar
router.delete('/:id/portfolio', authMiddleware, async (req, res) => {
  try {
    await prisma.report.update({ where: { id: req.params.id }, data: { inPortfolio: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/reports/:id/entry
router.put('/:id/entry', authMiddleware, async (req, res) => {
  try {
    const { entryPrice } = req.body;
    const val = parseFloat(entryPrice);
    if (!entryPrice || isNaN(val) || val <= 0) {
      return res.status(400).json({ error: 'Geçerli bir fiyat girin.' });
    }
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { userEntryPrice: val },
    });
    res.json({ ok: true, userEntryPrice: report.userEntryPrice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id/pdf
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });

    const pdfBuffer = await generatePdf(report.content, {
      market: report.market,
      date: report.date,
      ticker: report.ticker,
    });

    const filename = `getafix-${report.market}-${report.id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
