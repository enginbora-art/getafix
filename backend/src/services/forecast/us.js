const yahooFinance = require('yahoo-finance2').default;
const { callAgent, summarizeForPeer } = require('./agents');
const { prefilterUs, getUsFilters } = require('./screener');
const { sendForecastEmail } = require('../email');
const prisma = require('../../lib/prisma');

// S&P 500 core + mid/small liquid universe (subset for demo)
const US_WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'LLY', 'JPM',
  'V', 'MA', 'XOM', 'UNH', 'JNJ', 'PG', 'HD', 'MRK', 'ABBV', 'COST',
  'NFLX', 'AMD', 'CRM', 'ORCL', 'AMAT', 'KLAC', 'LRCX', 'MRVL', 'MU', 'SMCI',
  'APP', 'CRWD', 'DDOG', 'NET', 'SNOW', 'PLTR', 'HOOD', 'COIN', 'MSTR', 'IONQ',
  'GEV', 'CEG', 'VST', 'EXE', 'GDDY', 'AXON', 'DECK', 'LULU', 'CELH', 'RKLB',
];

function computeRsi(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) avgGain += d; else avgLoss += -d;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < prices.length - 1; i++) {
    const d = prices[i + 1] - prices[i];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
}

function computeAtr(highs, lows, closes, period = 14) {
  const trs = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

async function fetchSpyReturns() {
  try {
    const result = await yahooFinance.chart('SPY', {
      period1: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      interval: '1d',
    });
    const closes = result.quotes.map((q) => q.close).filter(Boolean);
    const now = closes[closes.length - 1];
    const pct = (days) => {
      if (closes.length < days) return 0;
      return Math.round(((now / closes[closes.length - days] - 1) * 100) * 100) / 100;
    };
    return { '1m': pct(21), '3m': pct(63), '6m': pct(126) };
  } catch {
    return { '1m': 0, '3m': 0, '6m': 0 };
  }
}

async function fetchTechnicalSnapshot(tickers) {
  const result = {};
  for (const ticker of tickers) {
    try {
      const data = await yahooFinance.chart(ticker, {
        period1: new Date(Date.now() - 365 * 24 * 3600 * 1000),
        interval: '1d',
      });
      const quotes = data.quotes.filter((q) => q.close);
      if (quotes.length < 20) continue;

      const closes = quotes.map((q) => q.close);
      const highs = quotes.map((q) => q.high);
      const lows = quotes.map((q) => q.low);
      const volumes = quotes.map((q) => q.volume || 0);
      const n = closes.length;
      const price = closes[n - 1];

      const sma = (arr, period) => {
        if (arr.length < period) return null;
        return arr.slice(-period).reduce((a, b) => a + b, 0) / period;
      };

      const sma20 = sma(closes, 20);
      const sma50 = sma(closes, 50);
      const sma200 = sma(closes, 200);
      const rsi14 = computeRsi(closes);
      const atr14 = computeAtr(highs, lows, closes);
      const atrRatio = Math.round((atr14 / price) * 100 * 100) / 100;

      const pct = (days) => n >= days ? Math.round(((price / closes[n - days] - 1) * 100) * 100) / 100 : 0;
      const vol20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      const vol5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

      result[ticker] = {
        price: Math.round(price * 10000) / 10000,
        sma20: sma20 ? Math.round(sma20 * 10000) / 10000 : null,
        sma50: sma50 ? Math.round(sma50 * 10000) / 10000 : null,
        sma200: sma200 ? Math.round(sma200 * 10000) / 10000 : null,
        rsi14,
        atr14: Math.round(atr14 * 10000) / 10000,
        atr_ratio: atrRatio,
        change_5d_pct: pct(5),
        change_1m_pct: pct(21),
        change_3m_pct: pct(63),
        change_6m_pct: pct(126),
        vs_sma50_pct: sma50 ? Math.round(((price / sma50 - 1) * 100) * 100) / 100 : null,
        vs_sma200_pct: sma200 ? Math.round(((price / sma200 - 1) * 100) * 100) / 100 : null,
        golden_cross: !!(sma50 && sma200 && sma50 > sma200),
        avg_volume_20d: Math.round(vol20),
        avg_volume_dollar: Math.round(vol20 * price),
        volume_trend: vol5 > vol20 * 1.1 ? 'artan' : vol5 < vol20 * 0.9 ? 'azalan' : 'yatay',
      };
    } catch {
      // skip
    }
  }
  return result;
}

async function fetchFundamentalSnapshot(tickers) {
  const result = {};
  for (const ticker of tickers) {
    try {
      const info = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'assetProfile'],
      });
      const sd = info.summaryDetail || {};
      const ks = info.defaultKeyStatistics || {};
      const fd = info.financialData || {};
      const ap = info.assetProfile || {};
      const mc = sd.marketCap;
      const mcSeg = mc > 10e9 ? 'large' : mc > 2e9 ? 'mid' : 'small';

      const safe = (v, mult = 1) => (v != null ? Math.round(v * mult * 100) / 100 : null);

      result[ticker] = {
        sector: ap.sector || 'Unknown',
        industry: ap.industry || 'Unknown',
        market_cap: mc || null,
        market_cap_segment: mcSeg,
        pe_trailing: safe(sd.trailingPE),
        pe_forward: safe(sd.forwardPE),
        pb_ratio: safe(ks.priceToBook),
        revenue_growth_pct: safe(fd.revenueGrowth, 100),
        earnings_growth_pct: safe(fd.earningsGrowth, 100),
        profit_margin_pct: safe(fd.profitMargins, 100),
        roe_pct: safe(fd.returnOnEquity, 100),
        beta: safe(ks.beta),
        debt_to_equity: safe(fd.debtToEquity),
      };
    } catch {
      // skip
    }
  }
  return result;
}

function compressForAgent(techSubset, fundSubset, spyReturns) {
  const lines = [];
  for (const [ticker, tech] of Object.entries(techSubset)) {
    const fund = fundSubset[ticker] || {};
    const c1m = tech.change_1m_pct || 0;
    const c3m = tech.change_3m_pct || 0;
    const rs1m = Math.round((c1m - (spyReturns['1m'] || 0)) * 10) / 10;
    const rs3m = Math.round((c3m - (spyReturns['3m'] || 0)) * 10) / 10;
    lines.push(
      `[${ticker}] $${tech.price} | RSI=${tech.rsi14} ATR%=${tech.atr_ratio} | ` +
      `5d=${tech.change_5d_pct}% 1M=${c1m}% 3M=${c3m}% | ` +
      `vsSMA50=${tech.vs_sma50_pct}% GX=${tech.golden_cross ? 'Y' : 'N'} Vol=${tech.volume_trend} | ` +
      `RS_SPY_1M=${rs1m} RS_SPY_3M=${rs3m} | ` +
      `${fund.market_cap_segment}cap ${fund.sector} | ` +
      `PE_fwd=${fund.pe_forward ?? 'N/A'} RevGr=${fund.revenue_growth_pct ?? 'N/A'}% Beta=${fund.beta ?? 'N/A'}`,
    );
  }
  lines.push(`\nSPY: 1M=${spyReturns['1m']}%  3M=${spyReturns['3m']}%  6M=${spyReturns['6m']}%`);
  return lines.join('\n');
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

async function runUsForecast(isClosing = false) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  console.log(`[US] Forecast başladı — ${todayStr} isClosing=${isClosing}`);

  const filters = await getUsFilters();
  const spyReturns = await fetchSpyReturns();

  console.log('[US] Teknik veri çekiliyor...');
  const techFull = await fetchTechnicalSnapshot(US_WATCHLIST);
  console.log('[US] Temel veri çekiliyor...');
  const fundFull = await fetchFundamentalSnapshot(Object.keys(techFull));

  const { candidates, segmentContext } = prefilterUs(techFull, fundFull, spyReturns, filters);
  console.log(`[US] Adaylar: ${candidates.join(', ')}`);

  const stockBlock = compressForAgent(
    Object.fromEntries(candidates.map((t) => [t, techFull[t]])),
    Object.fromEntries(candidates.map((t) => [t, fundFull[t] || {}])),
    spyReturns,
  );

  console.log('[US] Ajanlar çalışıyor...');
  const [agent1Out, agent2Out, agent3Out] = await Promise.all([
    callAgent('US', 'technical', `Today is ${todayStr}. Analyze these US stocks:\n\n${stockBlock}\n\nFor each stock: BUY / WAIT / AVOID + one-line reason.`, 2500),
    callAgent('US', 'fundamental', `Today is ${todayStr}. Evaluate these US stocks fundamentally:\n\n${stockBlock}\n\nFor each stock: story intact or broken? One sentence verdict.`, 2500),
    callAgent('US', 'sentiment', `Today is ${todayStr}. Find news, catalysts, and sentiment for:\n\n${stockBlock}\n\nFor each stock: IGNITION / NEUTRAL / HEADWIND + specific catalyst. Mark unverified info as RUMOR.`, 2500),
  ]);

  console.log('[US] Yönetici sentez yapıyor...');
  const sum1 = summarizeForPeer(agent1Out, 1200);
  const sum2 = summarizeForPeer(agent2Out, 1200);
  const sum3 = summarizeForPeer(agent3Out, 1200);

  const managerPrompt = buildUsManagerPrompt(candidates, segmentContext, sum1, sum2, sum3, stockBlock, todayStr);
  const managerOut = await callAgent('US', 'manager', managerPrompt, 3000);

  const rec = parseForecastJson(managerOut);

  const report = await prisma.report.create({
    data: {
      market: 'US',
      date: now,
      content: managerOut,
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

  await sendForecastEmail(managerOut, 'US', now);
  console.log(`[US] Tamamlandı. Report ID: ${report.id}`);
  return managerOut;
}

function buildUsManagerPrompt(candidates, segmentContext, sum1, sum2, sum3, stockBlock, todayStr) {
  return `Today is ${todayStr}. Stocks under analysis: ${candidates.join(', ')}

MARKET SEGMENT CONTEXT:
${segmentContext}

${sum1}

${sum2}

${sum3}

Raw quantitative data:
${stockBlock}

GÖREV — Aşağıdaki FORMATI BİREBİR kullanarak TÜRKÇE Markdown rapor yaz:

---RAPOR BAŞLANGICI---

# US Momentum Günlük Öneri — ${todayStr}

## ⚡ KARAR: [AL veya SAT veya BEKLE]

| | |
|---|---|
| **Hisse** | TICKER ([segment] cap, [sector]) |
| **Giriş bandı** | $XXX – $XXX |
| **Stop-loss** | $XXX |
| **Hedef 1 (kısa vade, 1-5 gün)** | $XXX |
| **Hedef 2 (orta vade, 1-4 hafta)** | $XXX |
| **Risk seviyesi** | Düşük / Orta / Yüksek |
| **Risk/Getiri** | 1:X.X |

---

## Neden?
[Bu hisseyi seçme gerekçesi — max 3 cümle. Neden bu hisse, neden şimdi, segment bağlamıyla açıkla.]

## Teknik Görüş
[RSI, ATR, MA, hacim, SPY'a göre güç — 2-3 cümle]

## Temel Görüş
[Büyüme hikayesi, değerleme, kazanç — 2-3 cümle]

## Piyasa Duygusu
[Haberler, katalizörler, makro — 2-3 cümle]

## Risk
Bu öneri ne zaman yanlış olur? [Tek cümle]

---
> Yatırım tavsiyesi değildir.

---RAPOR SONU---

Raporun TAMAMEN SONUNA şu JSON bloğunu ekle (kullanıcıya gösterilmeyecek):

\`\`\`json
{
  "date": "${todayStr}",
  "ticker": "TICKER",
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
}

async function runManualAnalysis(ticker) {
  const spyReturns = await fetchSpyReturns();
  const techFull = await fetchTechnicalSnapshot([ticker]);
  const fundFull = await fetchFundamentalSnapshot([ticker]);
  const stockBlock = compressForAgent(techFull, fundFull, spyReturns);
  const todayStr = new Date().toISOString().split('T')[0];

  const prompt = `Today is ${todayStr}. Analyze this US stock: ${ticker}

${stockBlock}

GÖREV — Aşağıdaki FORMATI BİREBİR kullanarak TÜRKÇE Markdown rapor yaz:

# ${ticker} Analiz — ${todayStr}

## ⚡ KARAR: [AL veya SAT veya BEKLE]

| | |
|---|---|
| **Giriş bandı** | $XXX – $XXX |
| **Stop-loss** | $XXX |
| **Hedef 1 (kısa vade, 1-5 gün)** | $XXX |
| **Hedef 2 (orta vade, 1-4 hafta)** | $XXX |
| **Risk seviyesi** | Düşük / Orta / Yüksek |
| **Risk/Getiri** | 1:X.X |

---

## Neden?
[Max 3 cümle]

## Teknik Görüş
[RSI, ATR, MA, hacim, SPY göreceli güç — 2-3 cümle]

## Temel Görüş
[Büyüme, değerleme — 2-3 cümle]

## Piyasa Duygusu
[Haberler, katalizörler — 2-3 cümle]

## Risk
Bu öneri ne zaman yanlış olur? [1 cümle]

---
> Yatırım tavsiyesi değildir.

\`\`\`json
{
  "date": "${todayStr}",
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
  return callAgent('US', 'manager', prompt, 2000);
}

module.exports = { runUsForecast, runManualAnalysis };
