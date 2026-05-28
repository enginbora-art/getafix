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
          const quote = await yf.quote(symbol, { fields: ['regularMarketPrice', 'preMarketPrice', 'postMarketPrice'] });
          const currentPrice = quote.postMarketPrice || quote.preMarketPrice || quote.regularMarketPrice || null;
          const priceType = quote.postMarketPrice ? 'after-hours' : quote.preMarketPrice ? 'pre-market' : 'regular';
          return { ...r, currentPrice, priceType };
        } catch {
          return { ...r, currentPrice: null, priceType: 'regular' };
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
        priceType: r.priceType || 'regular',
        returnPct,
      };
    });

    res.json({ positions, total: positions.length, totalPages: 1 });
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

// GET /api/reports/closed?market=BIST|US&page=1&limit=10
router.get('/closed', authMiddleware, async (req, res) => {
  try {
    const { market, page = 1 } = req.query;
    const take = Math.min(parseInt(req.query.limit) || 10, 200);
    const where = { isClosed: true };
    if (market && ['BIST', 'US'].includes(market)) where.market = market;
    const skip = (parseInt(page) - 1) * take;

    const parseBiasLocal = (content) => {
      const m = content?.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i);
      return m?.[1]?.toUpperCase() || null;
    };

    const [total, reports, allForStats] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        orderBy: { exitDate: 'desc' },
        skip,
        take,
        select: {
          id: true, ticker: true, market: true, type: true,
          userEntryPrice: true, entryLow: true, entryHigh: true,
          exitPrice: true, exitDate: true,
          profitLoss: true, profitLossPct: true,
          reachedH1: true, reachedH2: true,
          targetShort: true, targetMid: true, stopLoss: true,
          createdAt: true, content: true,
        },
      }),
      prisma.report.findMany({ where, select: { profitLossPct: true } }),
    ]);

    const enriched = reports.map((r) => {
      const entryPrice = r.userEntryPrice != null
        ? r.userEntryPrice
        : r.entryLow != null && r.entryHigh != null
          ? (r.entryLow + r.entryHigh) / 2
          : (r.entryLow ?? r.entryHigh ?? null);
      return {
        id: r.id,
        ticker: r.ticker,
        market: r.market,
        type: r.type,
        entryPrice,
        exitPrice: r.exitPrice,
        exitDate: r.exitDate,
        profitLoss: r.profitLoss,
        profitLossPct: r.profitLossPct != null ? parseFloat(r.profitLossPct.toFixed(2)) : null,
        reachedH1: r.reachedH1,
        reachedH2: r.reachedH2,
        target1: r.targetShort,
        target2: r.targetMid,
        stopLoss: r.stopLoss,
        createdAt: r.createdAt,
        bias: parseBiasLocal(r.content),
      };
    });

    const totalCount = allForStats.length;
    const successCount = allForStats.filter((r) => (r.profitLossPct ?? 0) > 0).length;
    const sumReturn = allForStats.reduce((s, r) => s + (r.profitLossPct ?? 0), 0);
    const stats = {
      totalCount,
      successRate: totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '0.0',
      avgReturn: totalCount > 0 ? (sumReturn / totalCount).toFixed(2) : '0.00',
    };

    res.json({ total, totalPages: Math.ceil(total / take), positions: enriched, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/market-news?ticker=AAPL
router.get('/market-news', authMiddleware, async (req, res) => {
  if (!process.env.FINNHUB_API_KEY) {
    return res.json({ hasApiKey: false });
  }
  const { ticker } = req.query;
  if (!ticker) return res.json({ hasApiKey: true, news: [], sentiment: null });
  try {
    const { getCompanyNews, getNewsSentiment } = require('../lib/finnhub');
    const [news, sentiment] = await Promise.all([
      getCompanyNews(ticker.toUpperCase()),
      getNewsSentiment(ticker.toUpperCase()),
    ]);
    res.json({ hasApiKey: true, news, sentiment });
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

// DELETE /api/reports/:id/closed-position — kapalı pozisyon kaydını sil
router.delete('/:id/closed-position', authMiddleware, async (req, res) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report || !report.isClosed) {
      return res.status(400).json({ error: 'Kapalı pozisyon bulunamadı.' });
    }
    await prisma.report.update({
      where: { id: req.params.id },
      data: {
        isClosed: false,
        exitPrice: null,
        exitDate: null,
        profitLoss: null,
        profitLossPct: null,
        reachedH1: false,
        reachedH2: false,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/:id/close — pozisyonu kapat
router.post('/:id/close', authMiddleware, async (req, res) => {
  try {
    const { exitPrice } = req.body;
    const val = parseFloat(exitPrice);
    if (!exitPrice || isNaN(val) || val <= 0) {
      return res.status(400).json({ error: 'Geçerli bir çıkış fiyatı girin.' });
    }

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Rapor bulunamadı.' });
    if (!report.inPortfolio) return res.status(400).json({ error: 'Bu rapor portföyde değil.' });
    if (report.isClosed) return res.status(400).json({ error: 'Bu pozisyon zaten kapatılmış.' });

    const entryPrice = report.userEntryPrice != null
      ? report.userEntryPrice
      : report.entryLow != null && report.entryHigh != null
        ? (report.entryLow + report.entryHigh) / 2
        : (report.entryLow ?? report.entryHigh ?? null);

    const profitLossPct = entryPrice ? ((val - entryPrice) / entryPrice) * 100 : null;
    const profitLoss = entryPrice ? val - entryPrice : null;
    const reachedH1 = report.targetShort ? val >= report.targetShort : false;
    const reachedH2 = report.targetMid ? val >= report.targetMid : false;

    await prisma.report.update({
      where: { id: req.params.id },
      data: {
        exitPrice: val,
        exitDate: new Date(),
        isClosed: true,
        inPortfolio: false,
        profitLoss,
        profitLossPct,
        reachedH1,
        reachedH2,
      },
    });

    res.json({ ok: true, profitLossPct: profitLossPct != null ? parseFloat(profitLossPct.toFixed(2)) : null });
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
