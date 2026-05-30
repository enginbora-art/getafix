const cron = require('node-cron');
const { runBistForecast } = require('./forecast/bist');
const { runUsForecast } = require('./forecast/us');
const { sendErrorEmail } = require('./email');
const { isBistOpen, isNyseOpen } = require('../lib/marketCalendar');

async function safeRun(label, fn, isClosing, marketOpen) {
  if (!marketOpen()) {
    console.log(`[scheduler] ${label} atlandı (tatil/hafta sonu)`);
    return;
  }
  console.log(`[scheduler] ${label} başlatılıyor...`);
  try {
    await fn(isClosing);
  } catch (err) {
    console.error(`[scheduler] ${label} HATA:`, err.message);
    const market = label.includes('BIST') ? 'BIST' : 'US';
    await sendErrorEmail(err.message, market);
  }
}

function initScheduler() {
  // BIST sabah forecast — 00:15 İstanbul
  cron.schedule('15 0 * * 1-5', () => safeRun('BIST Sabah Forecast', runBistForecast, false, isBistOpen), {
    timezone: 'Europe/Istanbul',
  });

  // BIST kapanış raporu — 18:15 İstanbul
  cron.schedule('15 18 * * 1-5', () => safeRun('BIST Kapanış', runBistForecast, true, isBistOpen), {
    timezone: 'Europe/Istanbul',
  });

  // US sabah forecast — 15:10 İstanbul
  cron.schedule('10 15 * * 1-5', () => safeRun('US Sabah Forecast', runUsForecast, false, isNyseOpen), {
    timezone: 'Europe/Istanbul',
  });

  // US kapanış raporu — 23:15 İstanbul
  cron.schedule('15 23 * * 1-5', () => safeRun('US Kapanış', runUsForecast, true, isNyseOpen), {
    timezone: 'Europe/Istanbul',
  });

  // US Market Scanner (Katman B) — 22:00 İstanbul (16:00 EST, kapanmadan 1 saat önce)
  cron.schedule('0 22 * * 1-5', async () => {
    if (!isNyseOpen(new Date())) {
      console.log('[scheduler] Scanner: NYSE kapalı, atlandı');
      return;
    }
    const { runUsScanner } = require('./forecast/scanner');
    try {
      await runUsScanner();
    } catch (err) {
      console.error('[scheduler] Scanner HATA:', err.message);
    }
  }, { timezone: 'Europe/Istanbul' });

  console.log('[scheduler] Tüm zamanlamalar aktif');
}

module.exports = { initScheduler };
