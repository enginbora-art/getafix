const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const prisma = require('../lib/prisma');
const { sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Geçerli bir email ve şifre girin.' });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Email veya şifre hatalı' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email veya şifre hatalı' });
    }
    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: now,
        firstLoginAt: user.firstLoginAt ?? now,
      },
    });

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const { id, email, name, role, mustChangePassword } = req.user;
  res.json({ id, email, name, role, mustChangePassword });
});

function validatePassword(password) {
  if (!password || password.length < 8) return 'Şifre en az 8 karakter olmalıdır';
  if (!/[A-Z]/.test(password)) return 'En az 1 büyük harf içermelidir';
  if (!/[0-9]/.test(password)) return 'En az 1 rakam içermelidir';
  return null;
}

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    }
    const validationError = validatePassword(newPassword);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed, mustChangePassword: false },
    });
    res.json({ message: 'Şifre güncellendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Geçerli bir email adresi girin.' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      return res.json({ message: 'Şifre sıfırlama bağlantısı email adresinize gönderildi.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ to: email, name: user.name, resetUrl });

    res.json({ message: 'Şifre sıfırlama bağlantısı email adresinize gönderildi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token ve yeni şifre zorunlu.' });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link.' });
    }

    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null,
        mustChangePassword: false,
      },
    });

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
