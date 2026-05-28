const BIST_HOLIDAYS_2026 = {
  '2026-01-01': 'Yılbaşı',
  '2026-03-20': 'Ramazan Bayramı',
  '2026-03-21': 'Ramazan Bayramı',
  '2026-03-22': 'Ramazan Bayramı',
  '2026-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': 'Emek ve Dayanışma Bayramı',
  '2026-05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2026-05-27': 'Kurban Bayramı',
  '2026-05-28': 'Kurban Bayramı',
  '2026-05-29': 'Kurban Bayramı',
  '2026-05-30': 'Kurban Bayramı',
  '2026-07-15': 'Demokrasi ve Millî Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-29': 'Cumhuriyet Bayramı',
};

const NYSE_HOLIDAYS_2026 = {
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King Jr. Day',
  '2026-02-16': "Presidents' Day",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving',
  '2026-11-27': 'Day after Thanksgiving',
  '2026-12-25': 'Christmas',
};

// Day-only check — used by scheduler (cron already handles timing)
function isBistOpen(date = new Date()) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !(date.toISOString().split('T')[0] in BIST_HOLIDAYS_2026);
}

function isNyseOpen(date = new Date()) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !(date.toISOString().split('T')[0] in NYSE_HOLIDAYS_2026);
}

// Full status: trading day + hours check + holiday reason
function getBistStatus(date = new Date()) {
  const day = date.getDay();
  if (day === 0 || day === 6) return { isOpen: false, reason: null };
  const dateStr = date.toISOString().split('T')[0];
  const holiday = BIST_HOLIDAYS_2026[dateStr];
  if (holiday) return { isOpen: false, reason: holiday };
  // BIST: 10:00–18:00 Istanbul = 07:00–15:00 UTC
  const t = date.getUTCHours() * 60 + date.getUTCMinutes();
  return { isOpen: t >= 420 && t < 900, reason: null };
}

function getNyseStatus(date = new Date()) {
  const day = date.getDay();
  if (day === 0 || day === 6) return { isOpen: false, reason: null };
  const dateStr = date.toISOString().split('T')[0];
  const holiday = NYSE_HOLIDAYS_2026[dateStr];
  if (holiday) return { isOpen: false, reason: holiday };
  // NYSE: 9:30–16:00 ET = 13:30–20:00 UTC
  const t = date.getUTCHours() * 60 + date.getUTCMinutes();
  return { isOpen: t >= 810 && t < 1200, reason: null };
}

module.exports = { isBistOpen, isNyseOpen, getBistStatus, getNyseStatus };
