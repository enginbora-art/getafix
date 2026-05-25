const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const prisma = require('../lib/prisma');
const { sendActivationEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const VALID_ROLES = ['ADMIN', 'USER'];
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));

router.use(authMiddleware, requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, firstLoginAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { email, name, role = 'USER' } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email ve isim zorunlu' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Geçerli bir email adresi girin.' });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Geçersiz rol.' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Bu email zaten kayıtlı' });

    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tempHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const user = await prisma.user.create({
      data: {
        email, name, password: tempHash, role, isActive: true, mustChangePassword: true,
        resetToken: activationToken, resetTokenExpiry: expiry,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });

    const activationUrl = `${process.env.FRONTEND_URL}/reset-password?token=${activationToken}&activation=true`;
    sendActivationEmail({ to: email, name, activationUrl }).catch((err) =>
      console.error('[admin] Aktivasyon maili gönderilemedi:', err.message),
    );

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    const { isActive, role } = req.body;
    if (role !== undefined && req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Kendi rolünüzü değiştiremezsiniz.' });
    }
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Geçersiz rol.' });
    }
    const data = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (role !== undefined) data.role = role;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { resetToken: token, resetTokenExpiry: expiry, mustChangePassword: true },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    sendPasswordResetEmail({ to: target.email, name: target.name, resetUrl }).catch((err) =>
      console.error('[admin] Şifre sıfırlama maili gönderilemedi:', err.message),
    );

    res.json({ ok: true, message: 'Şifre sıfırlama linki gönderildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { role: true },
    });
    if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Son admin kullanıcı silinemez.' });
      }
    }

    await prisma.$transaction([
      prisma.manualRequest.deleteMany({ where: { userId: req.params.id } }),
      prisma.user.delete({ where: { id: req.params.id } }),
    ]);

    res.json({ message: 'Kullanıcı silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/agents
router.get('/agents', async (req, res) => {
  try {
    const agents = await prisma.agentConfig.findMany({ orderBy: [{ market: 'asc' }, { agentName: 'asc' }] });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/agents/:market/:name
router.put('/agents/:market/:name', async (req, res) => {
  try {
    const { systemPrompt } = req.body;
    const market = req.params.market.toUpperCase();
    const agentName = req.params.name;

    const agent = await prisma.agentConfig.upsert({
      where: { market_agentName: { market, agentName } },
      update: { systemPrompt, updatedBy: req.user.email },
      create: { market, agentName, systemPrompt, updatedBy: req.user.email },
    });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/criteria
router.get('/criteria', async (req, res) => {
  try {
    const criteria = await prisma.filterConfig.findMany({
      orderBy: [{ market: 'asc' }, { configKey: 'asc' }],
    });
    res.json(criteria);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/criteria/:market/:key
router.put('/criteria/:market/:key', async (req, res) => {
  try {
    const { configValue } = req.body;
    const market = req.params.market.toUpperCase();
    const configKey = req.params.key;

    const config = await prisma.filterConfig.upsert({
      where: { market_configKey: { market, configKey } },
      update: { configValue: String(configValue) },
      create: { market, configKey, configValue: String(configValue), label: configKey },
    });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/costs
router.get('/costs', async (req, res) => {
  try {
    const [totals, byMarket, byUser, byDay] = await Promise.all([
      prisma.apiUsageLog.aggregate({
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      prisma.apiUsageLog.groupBy({
        by: ['market'],
        _sum: { costUsd: true, inputTokens: true, outputTokens: true },
        _count: { id: true },
      }),
      prisma.$queryRaw`
        SELECT u.id, u.email, u.name,
               COALESCE(SUM(a."costUsd"), 0)::float AS "totalCostUsd",
               COALESCE(SUM(a."inputTokens"), 0)::int AS "totalInputTokens",
               COALESCE(SUM(a."outputTokens"), 0)::int AS "totalOutputTokens",
               COUNT(a.id)::int AS "callCount"
        FROM "User" u
        LEFT JOIN "ApiUsageLog" a ON a."userId" = u.id
        GROUP BY u.id, u.email, u.name
        ORDER BY "totalCostUsd" DESC
      `,
      prisma.$queryRaw`
        SELECT DATE("createdAt") AS day,
               market,
               COALESCE(SUM("costUsd"), 0)::float AS "costUsd",
               COALESCE(SUM("inputTokens"), 0)::int AS "inputTokens",
               COALESCE(SUM("outputTokens"), 0)::int AS "outputTokens"
        FROM "ApiUsageLog"
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY day, market
        ORDER BY day ASC
      `,
    ]);

    res.json({
      totals: {
        costUsd: totals._sum.costUsd || 0,
        inputTokens: totals._sum.inputTokens || 0,
        outputTokens: totals._sum.outputTokens || 0,
        callCount: totals._count.id || 0,
      },
      byMarket,
      byUser,
      byDay,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/forecast/run
router.post('/forecast/run', async (req, res) => {
  try {
    const { market } = req.body;
    if (!['BIST', 'US'].includes(market)) {
      return res.status(400).json({ error: 'Geçersiz market' });
    }

    res.json({ message: `${market} forecast başlatıldı` });

    const { runBistForecast } = require('../services/forecast/bist');
    const { runUsForecast } = require('../services/forecast/us');

    if (market === 'BIST') {
      runBistForecast(false).catch(console.error);
    } else {
      runUsForecast(false).catch(console.error);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
