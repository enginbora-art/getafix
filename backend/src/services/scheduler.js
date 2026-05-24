const cron = require('node-cron');
const { runBistForecast } = require('./forecast/bist');
const { runUsForecast } = require('./forecast/us');
const { sendErrorEmail } = require('./email');

function isWeekday() {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

async function safeRun(label, fn, isClosing = false) {
  if (!isWeekday()) {
    console.log(`[scheduler] ${label} atlandı (hafta sonu)`);
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
  cron.schedule('15 0 * * 1-5', () => safeRun('BIST Sabah Forecast', runBistForecast, false), {
    timezone: 'Europe/Istanbul',
  });

  // BIST kapanış raporu — 18:15 İstanbul
  cron.schedule('15 18 * * 1-5', () => safeRun('BIST Kapanış', runBistForecast, true), {
    timezone: 'Europe/Istanbul',
  });

  // US sabah forecast — 15:10 İstanbul
  cron.schedule('10 15 * * 1-5', () => safeRun('US Sabah Forecast', runUsForecast, false), {
    timezone: 'Europe/Istanbul',
  });

  // US kapanış raporu — 23:15 İstanbul
  cron.schedule('15 23 * * 1-5', () => safeRun('US Kapanış', runUsForecast, true), {
    timezone: 'Europe/Istanbul',
  });

  console.log('[scheduler] Tüm zamanlamalar aktif');
}

module.exports = { initScheduler };
