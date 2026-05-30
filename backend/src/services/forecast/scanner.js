const yf = require('../../lib/yf');
const prisma = require('../../lib/prisma');
const { US_WATCHLIST } = require('./us');

const SIGNAL_PRIORITY = {
  SHORT_SQUEEZE: 4,
  YUKARI_KIVRILMA: 3,
  GUCLU_HAREKET: 2,
  HACIM_PATLAMASI: 1,
};

async function runUsScanner() {
  console.log(`[Scanner] Başlıyor — ${US_WATCHLIST.length} hisse taranıyor...`);

  try {
    const found = [];
    const batchSize = 10;

    for (let i = 0; i < US_WATCHLIST.length; i += batchSize) {
      const batch = US_WATCHLIST.slice(i, i + batchSize);
      const quotes = await Promise.allSettled(
        batch.map((ticker) =>
          yf.quote(ticker, {
            fields: [
              'regularMarketPrice',
              'regularMarketChangePercent',
              'regularMarketVolume',
              'averageDailyVolume3Month',
              'shortPercentOfFloat',
              'marketCap',
              'shortName',
            ],
          }),
        ),
      );

      quotes.forEach((result, idx) => {
        if (result.status !== 'fulfilled' || !result.value) return;
        const q = result.value;
        const ticker = batch[idx];

        const changePct = q.regularMarketChangePercent || 0;
        const volume = q.regularMarketVolume || 0;
        const avgVolume = q.averageDailyVolume3Month || 1;
        const volumeRatio = avgVolume > 0 ? volume / avgVolume : 0;
        const shortFloat = q.shortPercentOfFloat || 0;

        let signal = null;
        let score = 0;

        if (shortFloat > 0.20 && changePct > 5) {
          signal = 'SHORT_SQUEEZE';
          score = 10 + changePct + volumeRatio;
        } else if (volumeRatio > 3 && changePct > 3) {
          signal = 'YUKARI_KIVRILMA';
          score = 8 + changePct + volumeRatio;
        } else if (Math.abs(changePct) > 5) {
          signal = 'GUCLU_HAREKET';
          score = 6 + Math.abs(changePct);
        } else if (volumeRatio > 3) {
          signal = 'HACIM_PATLAMASI';
          score = 4 + volumeRatio;
        }

        if (signal) {
          found.push({
            ticker,
            market: 'US',
            price: q.regularMarketPrice || 0,
            changePct,
            volumeRatio,
            marketCap: q.marketCap || null,
            score: Math.round(score * 100) / 100,
            name: q.shortName || ticker,
            signal,
          });
        }
      });

      await new Promise((r) => setTimeout(r, 300));
    }

    if (found.length === 0) {
      console.log('[Scanner] Sinyal bulunamadı.');
      return [];
    }

    found.sort((a, b) => {
      const pd = (SIGNAL_PRIORITY[b.signal] || 0) - (SIGNAL_PRIORITY[a.signal] || 0);
      return pd !== 0 ? pd : b.score - a.score;
    });

    console.log(`[Scanner] ${found.length} sinyal bulundu:`);
    found.slice(0, 10).forEach((r) =>
      console.log(`  [${r.signal}] ${r.ticker}: %${r.changePct.toFixed(1)} | x${r.volumeRatio.toFixed(1)} hacim`),
    );

    await prisma.scannerResult.createMany({ data: found.map((r) => ({ ...r, scannedAt: new Date() })) });
    console.log('[Scanner] DB\'ye kaydedildi. Tamamlandı.');
    return found;
  } catch (err) {
    console.error('[Scanner] Hata:', err.message);
    return [];
  }
}

module.exports = { runUsScanner };
