const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/analysis/requests
router.get('/requests', authMiddleware, async (req, res) => {
  try {
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
    if (!market || !ticker) {
      return res.status(400).json({ error: 'Market ve ticker zorunlu' });
    }
    if (!['BIST', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Geçersiz market' });
    }

    const pending = await prisma.manualRequest.count({
      where: { userId: req.user.id, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (pending >= 3) {
      return res.status(429).json({ error: 'Maksimum 3 bekleyen istek olabilir' });
    }

    const request = await prisma.manualRequest.create({
      data: {
        userId: req.user.id,
        market,
        ticker: ticker.toUpperCase(),
        status: 'PENDING',
      },
    });

    // Fire-and-forget: process async
    processManualRequest(request.id).catch(console.error);

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function processManualRequest(requestId) {
  await prisma.manualRequest.update({
    where: { id: requestId },
    data: { status: 'PROCESSING' },
  });

  try {
    const req = await prisma.manualRequest.findUnique({ where: { id: requestId } });
    const { runManualAnalysis } =
      req.market === 'BIST'
        ? require('../services/forecast/bist')
        : require('../services/forecast/us');

    const result = await runManualAnalysis(req.ticker);
    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'DONE', result },
    });
  } catch (err) {
    await prisma.manualRequest.update({
      where: { id: requestId },
      data: { status: 'FAILED', result: err.message },
    });
  }
}

module.exports = router;
