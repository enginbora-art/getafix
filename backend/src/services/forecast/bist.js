const yahooFinance = require('yahoo-finance2').default;
const { callAgent, callAgentWithWebSearch, summarizeForPeer } = require('./agents');
const { prefilterBist, getBistFilters } = require('./screener');
const { sendForecastEmail, sendErrorEmail } = require('../email');
const prisma = require('../../lib/prisma');

// BIST 100 listesi — hardcoded fallback, production'da bist100.txt okunabilir
const BIST_WATCHLIST = [
  'AKBNK', 'ARCLK', 'ASELS', 'ASTOR', 'BIMAS', 'DOHOL', 'EREGL', 'FROTO',
  'GARAN', 'GUBRF', 'HALKB', 'HEKTS', 'ISCTR', 'KCHOL', 'KONTR', 'KOZAL',
  'KRDMD', 'LOGO', 'MGROS', 'NETAS', 'ODAS', 'OTKAR', 'OYAKC', 'PETKM',
  'PGSUS', 'RLYH', 'SAHOL', 'SASA', 'SISE', 'SKBNK', 'SOKM', 'TAVHL',
  'TCELL', 'THYAO', 'TKFEN', 'TSKB', 'TTKOM', 'TTRAK', 'TUPRS', 'VAKBN',
  'VESBE', 'VESTL', 'YKBNK', 'ZOREN',
].map((c) => `${c}.IS`);

function computeRsi(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  const deltas = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = deltas.map((d) => (d > 0 ? d : 0));
  const losses = deltas.map((d) => (d < 0 ? -d : 0));

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

async function fetchTechnicalSnapshot(tickers) {
  const snapshot = {};
  for (const ticker of tickers) {
    try {
      const result = await yahooFinance.chart(ticker, {
        period1: new Date(Date.now() - 180 * 24 * 3600 * 1000),
        interval: '1d',
      });
      const quotes = result.quotes || [];
      if (quotes.length < 50) continue;

      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      const sma = (arr, n) => {
        const slice = arr.slice(-n);
        return slice.length === n ? slice.reduce((a, b) => a + b, 0) / n : null;
      };

      const close = closes[closes.length - 1];
      const sma20 = sma(closes, 20);
      const sma50 = sma(closes, 50);
      const rsi14 = computeRsi(closes);
      const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

      snapshot[ticker] = {
        price: Math.round(close * 100) / 100,
        sma20: sma20 ? Math.round(sma20 * 100) / 100 : null,
        sma50: sma50 ? Math.round(sma50 * 100) / 100 : null,
        rsi14,
        change_5d_pct: Math.round(((close / closes[closes.length - 5] - 1) * 100) * 100) / 100,
        change_30d_pct: Math.round(((close / closes[closes.length - 30] - 1) * 100) * 100) / 100,
        vs_sma20_pct: sma20 ? Math.round(((close / sma20 - 1) * 100) * 100) / 100 : null,
        vs_sma50_pct: sma50 ? Math.round(((close / sma50 - 1) * 100) * 100) / 100 : null,
        avg_volume_20d: Math.round(vol20),
        volume_trend: vol5 > vol20 * 1.1 ? 'artan' : vol5 < vol20 * 0.9 ? 'azalan' : 'yatay',
      };
    } catch {
      // skip
    }
  }
  return snapshot;
}

async function fetchFundamentalSnapshot(tickers) {
  const snapshot = {};
  for (const ticker of tickers) {
    try {
      const info = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
      });
      const sd = info.summaryDetail || {};
      const ks = info.defaultKeyStatistics || {};
      const fd = info.financialData || {};
      const ap = info.assetProfile || {};

      snapshot[ticker] = {
        sector: ap.sector || null,
        market_cap_try: sd.marketCap || null,
        pe_trailing: sd.trailingPE || null,
        pe_forward: sd.forwardPE || null,
        pb_ratio: ks.priceToBook || null,
        dividend_yield_pct: sd.dividendYield ? sd.dividendYield * 100 : null,
        profit_margin_pct: fd.profitMargins ? fd.profitMargins * 100 : null,
        revenue_growth_pct: fd.revenueGrowth ? fd.revenueGrowth * 100 : null,
        earnings_growth_pct: fd.earningsGrowth ? fd.earningsGrowth * 100 : null,
        debt_to_equity: fd.debtToEquity || null,
        roe_pct: fd.returnOnEquity ? fd.returnOnEquity * 100 : null,
      };
    } catch {
      // skip
    }
  }
  return snapshot;
}

function compressForAgent(tech, fund) {
  const compressed = {};
  for (const [ticker, t] of Object.entries(tech)) {
    const f = fund[ticker] || {};
    const code = ticker.replace('.IS', '');
    const entry = {};
    for (const key of ['price', 'sma20', 'sma50', 'rsi14', 'change_5d_pct', 'change_30d_pct', 'vs_sma20_pct', 'volume_trend']) {
      if (t[key] !== undefined) entry[key] = typeof t[key] === 'number' ? Math.round(t[key] * 10) / 10 : t[key];
    }
    for (const key of ['sector', 'pe_trailing', 'pb_ratio', 'revenue_growth_pct', 'roe_pct', 'profit_margin_pct']) {
      if (f[key] != null) entry[key] = typeof f[key] === 'number' ? Math.round(f[key] * 10) / 10 : f[key];
    }
    compressed[code] = entry;
  }
  return compressed;
}

function parseForecastJson(text) {
  const match = text.match(/```json\s*(\{.*?\})\s*```/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function runBistForecast(isClosing = false) {
  const now = new Date();
  console.log(`[BIST] Forecast başladı — ${now.toISOString()} isClosing=${isClosing}`);

  const filters = await getBistFilters();

  console.log('[BIST] Teknik veri çekiliyor...');
  const techFull = await fetchTechnicalSnapshot(BIST_WATCHLIST);
  console.log('[BIST] Temel veri çekiliyor...');
  const fundFull = await fetchFundamentalSnapshot(BIST_WATCHLIST);

  const candidates = prefilterBist(techFull, fundFull, filters);
  console.log(`[BIST] Adaylar: ${candidates.join(', ')}`);

  const techData = compressForAgent(
    Object.fromEntries(candidates.filter((t) => techFull[t]).map((t) => [t, techFull[t]])),
    Object.fromEntries(candidates.filter((t) => fundFull[t]).map((t) => [t, fundFull[t]])),
  );
  const fundData = compressForAgent(
    Object.fromEntries(candidates.filter((t) => techFull[t]).map((t) => [t, techFull[t]])),
    Object.fromEntries(candidates.filter((t) => fundFull[t]).map((t) => [t, fundFull[t]])),
  );

  const dateStr = now.toLocaleDateString('tr-TR');
  const techPrompt = `Aşağıdaki ön filtrelenmiş BIST kağıtlarının teknik snapshot'ı verilmiştir.\nTarih: ${dateStr}\n\nVERİ:\n${JSON.stringify(techData, null, 2)}\n\nGörev:\n1. Her kağıt için trend, momentum, RSI yorumu, hacim okuması\n2. TOP 3 teknik açıdan en iyi kağıdı seç ve gerekçelendir\n3. Her TOP 3 için risk seviyesi (1-10)\n\nÖzlü ol.`;

  const fundPrompt = `Aşağıdaki ön filtrelenmiş BIST kağıtlarının temel veri snapshot'ı verilmiştir.\nTarih: ${dateStr}\n\nVERİ:\n${JSON.stringify(fundData, null, 2)}\n\nGörev:\n1. Her kağıt için değerleme, bilanço sağlığı, büyüme profili\n2. TOP 3 temel analiz açısından en cazip kağıdı seç\n\nÖzlü ol.`;

  const bistCodes = candidates.map((t) => t.replace('.IS', ''));
  const sentPrompt = `Bugün ${dateStr} tarihi itibariyle aşağıdaki BIST kağıtları için piyasa sentiment ve haber araştırması yap:\n\nKAĞITLAR: ${bistCodes.join(', ')}\n\nGörev:\n1. Her kağıt için son 7 gün önemli haberler / KAP açıklamaları\n2. Sentiment ve katalizörler\n3. TOP 3 sentiment olarak en pozitif kağıt\n\nSöylentiyi açıkça "söylenti" olarak işaretle.`;

  console.log('[BIST] Ajanlar çalışıyor...');
  const [techV1, fundV1, sentV1] = await Promise.all([
    callAgent('BIST', 'technical', techPrompt),
    callAgent('BIST', 'fundamental', fundPrompt),
    callAgentWithWebSearch('BIST', 'sentiment', sentPrompt),
  ]);

  console.log('[BIST] Tartışma turu...');
  const [techV2, fundV2] = await Promise.all([
    callAgent('BIST', 'technical', techPrompt + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Temel]\n${summarizeForPeer(fundV1)}\n\n[Sentiment]\n${summarizeForPeer(sentV1)}`),
    callAgent('BIST', 'fundamental', fundPrompt + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Teknik]\n${summarizeForPeer(techV1)}\n\n[Sentiment]\n${summarizeForPeer(sentV1)}`),
  ]);

  const managerPrompt = buildManagerPrompt(techV2, fundV2, sentV1, dateStr, bistCodes);
  console.log('[BIST] Yönetici sentez yapıyor...');
  const finalReport = await callAgent('BIST', 'manager', managerPrompt, 3000);

  const rec = parseForecastJson(finalReport);

  const report = await prisma.report.create({
    data: {
      market: 'BIST',
      date: now,
      content: finalReport,
      jsonData: rec || undefined,
      ticker: rec?.ticker || null,
      entryLow: rec?.entry_low || null,
      entryHigh: rec?.entry_high || null,
      stopLoss: rec?.stop_loss || null,
      targetShort: rec?.target_short_low || null,
      targetMid: rec?.target_mid_low || null,
      riskLevel: rec?.risk_level || null,
      isClosing,
    },
  });

  await sendForecastEmail(finalReport, 'BIST', now);
  console.log(`[BIST] Tamamlandı. Report ID: ${report.id}`);
  return finalReport;
}

function buildManagerPrompt(techView, fundView, sentView, dateStr, bistCodes) {
  const today = new Date().toISOString().split('T')[0];
  return `Üç uzman ajanın final değerlendirmeleri aşağıdadır.

═══ AJAN 1 — TEKNİK ANALİZ ═══
${techView}

═══ AJAN 2 — TEMEL ANALİZ ═══
${fundView}

═══ AJAN 3 — SENTIMENT / HABER ═══
${sentView}

GÖREV — Aşağıdaki FORMATI BİREBİR kullanarak Markdown rapor yaz:

---RAPOR BAŞLANGICI---

# BIST Günlük Öneri — ${dateStr}

## ⚡ KARAR: [AL veya SAT veya BEKLE]

| | |
|---|---|
| **Giriş bandı** | XXX – XXX TL |
| **Stop-loss** | XXX TL |
| **Hedef 1 (kısa vade, 1-5 gün)** | XXX TL |
| **Hedef 2 (orta vade, 1-4 hafta)** | XXX TL |
| **Risk seviyesi** | Düşük / Orta / Yüksek |
| **Risk/Getiri** | 1:X.X |

---

## Neden?
[Bu kağıdı seçme gerekçesi — max 3 cümle, somut ve net. Neden bu kağıt, neden şimdi.]

## Teknik Görüş
[Momentum, RSI, hacim, MA pozisyonu — 2-3 cümle]

## Temel Görüş
[Büyüme hikayesi, değerleme, bilanço — 2-3 cümle]

## Piyasa Duygusu
[Haberler, katalizörler, sektör — 2-3 cümle]

## Risk
Bu öneri ne zaman yanlış olur? [Tek cümle — en kritik risk faktörü]

---
> Yatırım tavsiyesi değildir. Karar destek aracıdır.

---RAPOR SONU---

Raporun TAMAMEN SONUNA (raporun dışına) şu JSON bloğunu ekle — bu blok kullanıcıya gösterilmeyecek, sadece sistem tarafından okunacak:

\`\`\`json
{
  "date": "${today}",
  "ticker": "BIST_KODU",
  "entry_low": 0.00,
  "entry_high": 0.00,
  "stop_loss": 0.00,
  "target_short_low": 0.00,
  "target_short_high": 0.00,
  "target_mid_low": 0.00,
  "target_mid_high": 0.00,
  "risk_level": "Düşük/Orta/Yüksek",
  "thesis_summary": "Tez özeti, maksimum 2 cümle."
}
\`\`\``;
}

async function runManualAnalysis(ticker) {
  const tickerYf = `${ticker}.IS`;
  const techFull = await fetchTechnicalSnapshot([tickerYf]);
  const fundFull = await fetchFundamentalSnapshot([tickerYf]);

  const compressed = compressForAgent(techFull, fundFull);
  const dateStr = new Date().toLocaleDateString('tr-TR');
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Aşağıdaki BIST kağıdı için kapsamlı analiz yap.
Tarih: ${dateStr} | Kağıt: ${ticker}

VERİ:
${JSON.stringify(compressed, null, 2)}

RAPOR FORMATI — BİREBİR UY:

# ${ticker} Analiz — ${dateStr}

## ⚡ KARAR: [AL veya SAT veya BEKLE]

| | |
|---|---|
| **Giriş bandı** | XXX – XXX TL |
| **Stop-loss** | XXX TL |
| **Hedef 1 (kısa vade, 1-5 gün)** | XXX TL |
| **Hedef 2 (orta vade, 1-4 hafta)** | XXX TL |
| **Risk seviyesi** | Düşük / Orta / Yüksek |
| **Risk/Getiri** | 1:X.X |

---

## Neden?
[Max 3 cümle — neden bu karar, ne görüyorsun]

## Teknik Görüş
[RSI, MA, hacim, momentum — 2-3 cümle]

## Temel Görüş
[Değerleme, büyüme, bilanço — 2-3 cümle]

## Piyasa Duygusu
[Son haberler, KAP bildirimleri, katalizörler — web araması yap]

## Risk
Bu öneri ne zaman yanlış olur? [1 cümle]

---
> Yatırım tavsiyesi değildir.

\`\`\`json
{
  "date": "${today}",
  "ticker": "${ticker}",
  "entry_low": 0.00,
  "entry_high": 0.00,
  "stop_loss": 0.00,
  "target_short_low": 0.00,
  "target_short_high": 0.00,
  "target_mid_low": 0.00,
  "target_mid_high": 0.00,
  "risk_level": "Düşük/Orta/Yüksek",
  "thesis_summary": "Tez özeti."
}
\`\`\``;

  const result = await callAgentWithWebSearch('BIST', 'manager', prompt);
  return result;
}

module.exports = { runBistForecast, runManualAnalysis };
