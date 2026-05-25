const express = require('express');
const authMiddleware = require('../middleware/auth');
const { generatePdf } = require('../services/pdf');
const prisma = require('../lib/prisma');

const router = express.Router();

// GET /api/reports?market=BIST&limit=30
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { market, limit = 30, page = 1, isClosing } = req.query;
    const where = {};
    if (market) where.market = market;
    if (isClosing !== undefined) where.isClosing = isClosing === 'true';

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
          date: true,
          ticker: true,
          entryLow: true,
          entryHigh: true,
          stopLoss: true,
          targetShort: true,
          targetMid: true,
          riskLevel: true,
          isClosing: true,
          createdAt: true,
        },
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ reports, total, page: parseInt(page), limit: take });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/portfolio
router.get('/portfolio', authMiddleware, async (req, res) => {
  try {
    const yf = require('../lib/yf');
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const reports = await prisma.report.findMany({
      where: { createdAt: { gte: since }, ticker: { not: null } },
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

      const returnShort =
        r.targetShort != null && r.currentPrice != null
          ? parseFloat(((r.targetShort - r.currentPrice) / r.currentPrice * 100).toFixed(2))
          : null;

      const returnMid =
        r.targetMid != null && r.currentPrice != null
          ? parseFloat(((r.targetMid - r.currentPrice) / r.currentPrice * 100).toFixed(2))
          : null;

      return {
        reportId: r.id,
        ticker: r.ticker,
        market: r.market,
        reportDate: r.createdAt,
        bias: parseBias(r.content),
        entryPrice,
        effectiveEntry,
        userEntryPrice: r.userEntryPrice,
        target1: r.targetShort,
        target2: r.targetMid,
        stopLoss: r.stopLoss,
        riskLevel: r.riskLevel,
        currentPrice: r.currentPrice ?? null,
        returnShort,
        returnMid,
      };
    });

    res.json({ positions });
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
