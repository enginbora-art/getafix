const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { generatePdf } = require('../services/pdf');

const router = express.Router();
const prisma = new PrismaClient();

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
