const yahooFinance = require('../../lib/yf');
const { callAgent, callAgentWithWebSearch, summarizeForPeer } = require('./agents');
const { prefilterBist, getBistFilters } = require('./screener');
const { sendForecastEmail, sendErrorEmail } = require('../email');
const prisma = require('../../lib/prisma');
const { logUsage, calculateCost } = require('../../lib/costTracker');

// BIST 100 — bist100.txt ile senkronize (97 hisse)
const BIST_WATCHLIST = [
  'AEFES', 'AGHOL', 'AKBNK', 'AKCNS', 'AKFGY', 'AKSA',  'AKSEN', 'ALARK',
  'ALBRK', 'ANSGR', 'ARCLK', 'ASELS', 'ASTOR', 'ASUZU', 'AYGAZ', 'BERA',
  'BIMAS', 'BIOEN', 'BJKAS', 'BRISA', 'BRSAN', 'BRYAT', 'BUCIM', 'CCOLA',
  'CIMSA', 'CWENE', 'DOAS',  'DOHOL', 'ECILC', 'ECZYT', 'EGEEN', 'EKGYO',
  'ENERY', 'ENJSA', 'ENKAI', 'EREGL', 'EUPWR', 'EUREN', 'FROTO', 'GARAN',
  'GENIL', 'GESAN', 'GUBRF', 'HALKB', 'HEKTS', 'ISCTR', 'ISGYO', 'ISMEN',
  'IZMDC', 'KARSN', 'KCAER', 'KCHOL', 'KLSER', 'KMPUR', 'KONTR', 'KONYA',
  'KORDS', 'KRDMD', 'KZBGY', 'LOGO',  'MAVI',  'MGROS', 'MIATK', 'ODAS',
  'OTKAR', 'OYAKC', 'PETKM', 'PGSUS', 'PNSUT', 'QUAGR', 'REEDR', 'SAHOL',
  'SASA',  'SDTTR', 'SELEC', 'SISE',  'SKBNK', 'SMRTG', 'SOKM',  'TABGD',
  'TAVHL', 'TCELL', 'THYAO', 'TKFEN', 'TOASO', 'TSKB',  'TTKOM', 'TTRAK',
  'TUPRS', 'TUREX', 'ULKER', 'VAKBN', 'VESBE', 'VESTL', 'YKBNK', 'YYLGD',
  'ZOREN',
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

async function batchedFetch(items, fetchFn, batchSize = 10) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fetchFn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return results;
}

async function fetchTechnicalSnapshot(tickers) {
  const results = await batchedFetch(tickers, async (ticker) => {
    const result = await yahooFinance.chart(ticker, {
      period1: new Date(Date.now() - 180 * 24 * 3600 * 1000),
      interval: '1d',
    });
    const quotes = result.quotes || [];
    if (quotes.length < 50) return null;

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

    return {
      ticker,
      data: {
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
      },
    };
  });

  const snapshot = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      snapshot[r.value.ticker] = r.value.data;
    }
  }
  return snapshot;
}

async function fetchFundamentalSnapshot(tickers) {
  const results = await batchedFetch(tickers, async (ticker) => {
    const info = await yahooFinance.quoteSummary(ticker, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
    });
    const sd = info.summaryDetail || {};
    const ks = info.defaultKeyStatistics || {};
    const fd = info.financialData || {};
    const ap = info.assetProfile || {};

    return {
      ticker,
      data: {
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
      },
    };
  });

  const snapshot = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      snapshot[r.value.ticker] = r.value.data;
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

function buildTechPrompt(data, dateStr) {
  return `Aşağıdaki ön filtrelenmiş BIST kağıtlarının teknik snapshot'ı verilmiştir.\nTarih: ${dateStr}\n\nVERİ:\n${JSON.stringify(data, null, 2)}\n\nGörev:\n1. Her kağıt için trend, momentum, RSI yorumu, hacim okuması\n2. SMA20/SMA50 kesişimleri ve fiyat-MA pozisyonunu yorumla\n3. Aşırı alım/satım uyarıları\n4. TOP 3 teknik açıdan en iyi kağıdı seç ve gerekçelendir\n5. Her TOP 3 kağıt için risk seviyesi (1-10)\n\nÖzlü ol, gevezelik etme.`;
}

function buildFundPrompt(data, dateStr) {
  return `Aşağıdaki ön filtrelenmiş BIST kağıtlarının temel veri snapshot'ı verilmiştir.\nTarih: ${dateStr}\n\nVERİ:\n${JSON.stringify(data, null, 2)}\n\nGörev:\n1. Her kağıt için değerleme (ucuz/normal/pahalı), bilanço sağlığı, büyüme profili\n2. Sektör emsallerine göre konum\n3. Risk faktörleri (yüksek borç, düşük marj vb.)\n4. TOP 3 temel analiz açısından en cazip kağıdı seç ve gerekçelendir\n\nÖzlü ol.`;
}

function buildSentPrompt(codes, dateStr) {
  return `Bugün ${dateStr} tarihi itibariyle aşağıdaki BIST kağıtları için piyasa sentiment ve haber/söylenti araştırması yap:\n\nKAĞITLAR: ${codes.join(', ')}\n\nGörev:\n1. Web araması ile her kağıt için son 7 gün içindeki önemli haberler / KAP açıklamaları\n2. Sosyal medya / forum / yatırımcı kanallarındaki sentiment\n3. Global makro konjonktür etkisi (Fed faiz, dolar/TL, emtia, jeopolitik)\n4. Sektörel rüzgar\n5. Doğrulanmamış spekülasyonu açıkça "söylenti" olarak işaretle\n6. TOP 3 sentiment olarak en pozitif kağıt — gerekçeleriyle\n\nÖnemli: Doğrulanmış haberi söylenti ile karıştırma.`;
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
  const bistCodes = candidates.map((t) => t.replace('.IS', ''));
  const techPrompt = buildTechPrompt(techData, dateStr);
  const fundPrompt = buildFundPrompt(fundData, dateStr);
  const sentPrompt = buildSentPrompt(bistCodes, dateStr);

  console.log('[BIST] Ajanlar çalışıyor...');
  const [r1tech, r1fund, r1sent] = await Promise.all([
    callAgent('BIST', 'technical', techPrompt),
    callAgent('BIST', 'fundamental', fundPrompt),
    callAgentWithWebSearch('BIST', 'sentiment', sentPrompt),
  ]);
  await Promise.all([
    logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'technical', inputTokens: r1tech.inputTokens, outputTokens: r1tech.outputTokens }),
    logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'fundamental', inputTokens: r1fund.inputTokens, outputTokens: r1fund.outputTokens }),
    logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'sentiment', inputTokens: r1sent.inputTokens, outputTokens: r1sent.outputTokens }),
  ]);

  console.log('[BIST] Tartışma turu...');
  const [r2tech, r2fund] = await Promise.all([
    callAgent('BIST', 'technical', techPrompt + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Temel analist özeti]\n${summarizeForPeer(r1fund.text)}\n\n[Sentiment özeti]\n${summarizeForPeer(r1sent.text)}\n\nBu görüşleri okuyup değerlendirmeni güncelle. Çelişkili noktalarda teknik gerekçeni daha net koy, ortak görüşte pekiştir.`),
    callAgent('BIST', 'fundamental', fundPrompt + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Teknik analist özeti]\n${summarizeForPeer(r1tech.text)}\n\n[Sentiment özeti]\n${summarizeForPeer(r1sent.text)}\n\nTeknik tablo iyi ama temelde zayıf bir kağıt varsa açıkça belirt. Tersi de geçerli.`),
  ]);
  await Promise.all([
    logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'technical_peer', inputTokens: r2tech.inputTokens, outputTokens: r2tech.outputTokens }),
    logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'fundamental_peer', inputTokens: r2fund.inputTokens, outputTokens: r2fund.outputTokens }),
  ]);

  const managerPrompt = buildManagerPrompt(r2tech.text, r2fund.text, r1sent.text, dateStr, bistCodes);
  console.log('[BIST] Yönetici sentez yapıyor...');
  const rManager = await callAgent('BIST', 'manager', managerPrompt, 3000);
  await logUsage({ requestType: 'scheduled', market: 'BIST', agentName: 'manager', inputTokens: rManager.inputTokens, outputTokens: rManager.outputTokens });

  const finalReport = rManager.text;
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

async function runManualAnalysis(ticker, onStep = null, context = {}) {
  const { userId, requestId, scenario } = context;
  const tickerYf = `${ticker}.IS`;
  const dateStr = new Date().toLocaleDateString('tr-TR');
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  await onStep?.('Veri çekiliyor...');
  const techFull = await fetchTechnicalSnapshot([tickerYf]);
  const fundFull = await fetchFundamentalSnapshot([tickerYf]);

  const currentPrice = techFull[tickerYf]?.price ?? null;
  const compressed = compressForAgent(techFull, fundFull);

  await onStep?.('Ajan 1 — Teknik analiz yapılıyor...');
  const r1tech = await callAgent('BIST', 'technical', buildTechPrompt(compressed, dateStr));
  totalInputTokens += r1tech.inputTokens; totalOutputTokens += r1tech.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'technical', inputTokens: r1tech.inputTokens, outputTokens: r1tech.outputTokens, ticker });

  await onStep?.('Ajan 2 — Temel analiz yapılıyor...');
  const r1fund = await callAgent('BIST', 'fundamental', buildFundPrompt(compressed, dateStr));
  totalInputTokens += r1fund.inputTokens; totalOutputTokens += r1fund.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'fundamental', inputTokens: r1fund.inputTokens, outputTokens: r1fund.outputTokens, ticker });

  await onStep?.('Ajan 3 — Haberler ve piyasa duygusu taranıyor...');
  const r1sent = await callAgentWithWebSearch('BIST', 'sentiment', buildSentPrompt([ticker], dateStr));
  totalInputTokens += r1sent.inputTokens; totalOutputTokens += r1sent.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'sentiment', inputTokens: r1sent.inputTokens, outputTokens: r1sent.outputTokens, ticker });

  await onStep?.('Tartışma turu — Ajanlar görüş alışverişi yapıyor...');
  const [r2tech, r2fund] = await Promise.all([
    callAgent('BIST', 'technical', buildTechPrompt(compressed, dateStr) + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Temel analist özeti]\n${summarizeForPeer(r1fund.text)}\n\n[Sentiment özeti]\n${summarizeForPeer(r1sent.text)}\n\nBu görüşleri okuyup değerlendirmeni güncelle. Çelişkili noktalarda teknik gerekçeni daha net koy, ortak görüşte pekiştir.`),
    callAgent('BIST', 'fundamental', buildFundPrompt(compressed, dateStr) + `\n\nDİĞER AJANLARIN GÖRÜŞLERİ:\n[Teknik analist özeti]\n${summarizeForPeer(r1tech.text)}\n\n[Sentiment özeti]\n${summarizeForPeer(r1sent.text)}\n\nTeknik tablo iyi ama temelde zayıf bir kağıt varsa açıkça belirt. Tersi de geçerli.`),
  ]);
  totalInputTokens += r2tech.inputTokens + r2fund.inputTokens;
  totalOutputTokens += r2tech.outputTokens + r2fund.outputTokens;
  await Promise.all([
    logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'technical_peer', inputTokens: r2tech.inputTokens, outputTokens: r2tech.outputTokens, ticker }),
    logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'fundamental_peer', inputTokens: r2fund.inputTokens, outputTokens: r2fund.outputTokens, ticker }),
  ]);

  await onStep?.('Yönetici sentez yapıyor...');
  let managerPrompt = buildManagerPrompt(r2tech.text, r2fund.text, r1sent.text, dateStr, [ticker]);
  if (scenario) {
    managerPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━\nKULLANICI SENARYOSU — Bu senaryoyu analizine dahil et:\n"${scenario}"\nBu senaryo doğruysa nasıl bir etki olur? Pozisyonu etkiler mi? Açıkça belirt.\n━━━━━━━━━━━━━━━━━━━━━━`;
  }
  const rManager = await callAgent('BIST', 'manager', managerPrompt, 3000);
  totalInputTokens += rManager.inputTokens; totalOutputTokens += rManager.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'BIST', agentName: 'manager', inputTokens: rManager.inputTokens, outputTokens: rManager.outputTokens, ticker });

  if (requestId) {
    await prisma.manualRequest.update({
      where: { id: requestId },
      data: {
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd: calculateCost(totalInputTokens, totalOutputTokens),
      },
    }).catch((err) => console.error('[COST] ManualRequest güncellenemedi:', err.message));
  }

  return { result: rManager.text, currentPrice };
}

module.exports = { runBistForecast, runManualAnalysis };
