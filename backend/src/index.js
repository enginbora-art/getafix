require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const analysisRoutes = require('./routes/analysis');
const adminRoutes = require('./routes/admin');
const { initScheduler } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://getafix-web.onrender.com',
    'https://getafix.com.tr',
    'https://www.getafix.com.tr',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası' });
});

app.listen(PORT, () => {
  console.log(`[getafix] API çalışıyor → http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    initScheduler();
  }
});

module.exports = app;
