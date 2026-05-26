const express = require('express');
const yahooFinance = require('../lib/yf');
const authMiddleware = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

async function validateTicker(market, ticker) {
  const symbol = market === 'BIST' ? `${ticker}.IS` : ticker;
  try {
    const result = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      interval: '1d',
    });
    const closes = (result?.quotes || []).map((q) => q.close).filter(Boolean);
    return closes.length > 0;
  } catch (err) {
    const msg = err.message || '';
    if (
      msg.includes('Not Found') ||
      msg.includes('No data') ||
      msg.includes('404') ||
      err.type === 'invalid_symbol'
    ) {
      return false;
    }
    // Network/timeout hatası → geçerli say, analiz başlasın
    return true;
  }
}

// GET /api/analysis/requests  (?clear=true → delete own)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    if (req.query.clear === 'true') {
      await prisma.manualRequest.deleteMany({ where: { userId: req.user.id } });
      return res.json([]);
    }
    const isAdmin = req.user.role === 'ADMIN';
    const manualWhere = isAdmin ? {} : { userId: req.user.id };
    const systemWhere = isAdmin ? {} : { userId: req.user.id };

    const [requests, systemRuns] = await Promise.all([
      prisma.manualRequest.findMany({
        where: manualWhere,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.systemRun.findMany({
        where: systemWhere,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    ]);

    // Backfill reportId for old DONE requests that predate the column
    const doneNoReport = requests.filter((r) => r.status === 'DONE' && !r.reportId && r.ticker);
    const backfillMap = {};
    if (doneNoReport.length > 0) {
      const minDate = doneNoReport.reduce((d, r) => (r.createdAt < d ? r.createdAt : d), doneNoReport[0].createdAt);
      const manualReports = await prisma.report.findMany({
        where: {
          type: 'MANUAL',
          ticker: { in: [...new Set(doneNoReport.map((r) => r.ticker))] },
          market: { in: [...new Set(doneNoReport.map((r) => r.market))] },
          createdAt: { gte: minDate },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, market: true, ticker: true, createdAt: true },
      });
      doneNoReport.forEach((r) => {
        const match = manualReports.find(
          (rep) => rep.market === r.market && rep.ticker === r.ticker && rep.createdAt >= r.createdAt,
        );
        if (match) backfillMap[r.id] = match.id;
      });
    }

    const allReportIds = requests.map((r) => backfillMap[r.id] ?? r.reportId).filter(Boolean);
    let inPortfolioMap = {};
    if (allReportIds.length > 0) {
      const rpts = await prisma.report.findMany({
        where: { id: { in: allReportIds } },
        select: { id: true, inPortfolio: true },
      });
      rpts.forEach((r) => { inPortfolioMap[r.id] = r.inPortfolio; });
    }

    const enrichedManual = requests.map((r) => {
      const effectiveReportId = r.reportId ?? backfillMap[r.id] ?? null;
      return {
        ...r,
        type: 'MANUAL',
        reportId: effectiveReportId,
        inPortfolio: effectiveReportId ? (inPortfolioMap[effectiveReportId] ?? false) : false,
      };
    });

    const enrichedSystemRuns = systemRuns.map((sr) => ({
      id: sr.id,
      type: 'SYSTEM_RUN',
      market: sr.market,
      ticker: null,
      status: sr.status === 'RUNNING' ? 'PROCESSING' : sr.status === 'DONE' ? 'DONE' : 'FAILED',
      currentStep: sr.status === 'RUNNING' ? 'Sistem analizi çalışıyor...' : null,
      createdAt: sr.startedAt,
      completedAt: sr.endedAt,
      result: null,
      currentPrice: null,
      inPortfolio: false,
      reportId: null,
      isSystemRun: true,
      user: sr.user || null,
    }));

    const merged = [...enrichedManual, ...enrichedSystemRuns]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50);

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/requests/:id
router.get('/requests/:id', authMiddleware, async (req, res) => {
  try {
    const request = await prisma.manualRequest.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!request) return res.status(404).json({ error: 'İstek bulunamadı.' });
    if (request.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Erişim reddedildi.' });
    }
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analysis/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { market, ticker, scenario } = req.body;
    if (!market || !ticker) return res.status(400).json({ error: 'Market ve ticker zorunlu' });
    if (!['BIST', 'US'].includes(market)) return res.status(400).json({ error: 'Geçersiz market' });

    const tickerUpper = ticker.trim().toUpperCase();
    if (tickerUpper.length === 0 || tickerUpper.length > 20) {
      return res.status(400).json({ error: 'Geçersiz hisse kodu.' });
    }

    const activeCount = await prisma.manualRequest.count({
      where: { userId: req.user.id, status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] } },
    });
    if (activeCount >= 3) {
      return res.status(429).json({ error: 'Maksimum 3 aktif analiz isteğiniz olabilir. Mevcut analizler tamamlanınca tekrar deneyin.' });
    }

    const valid = await validateTicker(market, tickerUpper);
    if (!valid) {
      return res.status(422).json({
        error: 'TICKER_NOT_FOUND',
        message: `${tickerUpper} hissesi bulunamadı. Lütfen geçerli bir hisse kodu girin.`,
      });
    }

    const hasActive = await prisma.manualRequest.count({
      where: { userId: req.user.id, status: { in: ['PENDING', 'PROCESSING'] } },
    });

    const status = hasActive > 0 ? 'QUEUED' : 'PENDING';

    const scenarioClean = typeof scenario === 'string' ? scenario.trim().slice(0, 500) || null : null;
    const request = await prisma.manualRequest.create({
      data: { userId: req.user.id, market, ticker: tickerUpper, status, scenario: scenarioClean },
    });

    if (status === 'PENDING') {
      processManualRequest(request.id).catch(console.error);
    }

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function updateStep(requestId, step) {
  await prisma.manualRequest.update({
    where: { id: requestId },
    data: { currentStep: step },
  });
}

async function startNextQueued(userId) {
  const next = await prisma.manualRequest.findFirst({
    where: { userId, status: 'QUEUED' },
    orderBy: { createdAt: 'asc' },
  });
  if (next) {
    await prisma.manualRequest.update({ where: { id: next.id }, data: { status: 'PENDING' } });
    processManualRequest(next.id).catch(console.error);
  }
}

async function processManualRequest(requestId) {
  let userId;
  try {
    const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
    userId = req.userId;

    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING', currentStep: 'Veri çekiliyor...' },
    });

    const { runManualAnalysis } =
      req.market === 'BIST'
        ? require('../services/forecast/bist')
        : require('../services/forecast/us');

    const onStep = (step) => updateStep(requestId, step);
    const { result, currentPrice, reportId } = await runManualAnalysis(req.ticker, onStep, { userId, requestId, scenario: req.scenario });

    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'DONE', result, currentStep: 'Tamamlandı', currentPrice: currentPrice ?? null, reportId: reportId ?? null },
    });
  } catch (err) {
    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'FAILED', result: err.message, currentStep: null },
    });
  } finally {
    if (userId) await startNextQueued(userId).catch(console.error);
  }
}

// POST /api/analysis/run-system
router.post('/run-system', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Sadece admin çalıştırabilir.' });
    }
    const { market } = req.body;
    if (!['BIST', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Geçersiz market.' });
    }

    const existing = await prisma.systemRun.findFirst({
      where: { market, status: 'RUNNING' },
    });
    if (existing) {
      return res.status(409).json({ error: 'Sistem zaten çalışıyor.' });
    }

    const systemRun = await prisma.systemRun.create({
      data: { market, status: 'RUNNING', userId: req.user.id },
    });

    res.json({ ok: true, runId: systemRun.id, message: 'Sistem başlatıldı.' });

    const { runBistForecast } = require('../services/forecast/bist');
    const { runUsForecast } = require('../services/forecast/us');
    const run = market === 'BIST' ? runBistForecast : runUsForecast;

    run(true).then(() => {
      const endedAt = new Date();
      const duration = Math.round((endedAt.getTime() - new Date(systemRun.startedAt).getTime()) / 1000);
      return prisma.systemRun.update({
        where: { id: systemRun.id },
        data: { status: 'DONE', endedAt, duration },
      });
    }).catch((err) => {
      const endedAt = new Date();
      const duration = Math.round((endedAt.getTime() - new Date(systemRun.startedAt).getTime()) / 1000);
      return prisma.systemRun.update({
        where: { id: systemRun.id },
        data: { status: 'FAILED', error: err.message, endedAt, duration },
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analysis/system-status?market=BIST|US
router.get('/system-status', authMiddleware, async (req, res) => {
  try {
    const { market } = req.query;
    if (!['BIST', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Geçersiz market.' });
    }

    const run = await prisma.systemRun.findFirst({
      where: { market },
      orderBy: { startedAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!run) return res.json({ status: null });

    const duration = run.duration ??
      (run.endedAt ? Math.round((new Date(run.endedAt) - new Date(run.startedAt)) / 1000) : null);

    res.json({
      status: run.status,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      duration,
      triggeredBy: run.user,
      error: run.error,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
