const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware, requireAdmin);

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
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
    const { email, name, password, role = 'USER' } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, isim ve şifre zorunlu' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Bu email zaten kayıtlı' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, name, password: hashed, role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', async (req, res) => {
  try {
    const { isActive, role } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = isActive;
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

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Kullanıcı silindi' });
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
