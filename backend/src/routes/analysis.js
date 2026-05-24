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

// GET /api/analysis/requests  (?clear=true → delete all)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    if (req.query.clear === 'true') {
      await prisma.manualRequest.deleteMany({ where: { userId: req.user.id } });
      return res.json([]);
    }
    const requests = await prisma.manualRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/analysis/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { market, ticker } = req.body;
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

    const request = await prisma.manualRequest.create({
      data: { userId: req.user.id, market, ticker: tickerUpper, status },
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
    const { result, currentPrice } = await runManualAnalysis(req.ticker, onStep);

    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'DONE', result, currentStep: 'Tamamlandı', currentPrice: currentPrice ?? null },
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

module.exports = router;
