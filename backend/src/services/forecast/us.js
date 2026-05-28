const yahooFinance = require('../../lib/yf');
const { callAgent, callAgentWithWebSearch, summarizeForPeer } = require('./agents');
const { prefilterUs, getUsFilters } = require('./screener');
const { sendForecastEmail } = require('../email');
const prisma = require('../../lib/prisma');
const { logUsage, calculateCost } = require('../../lib/costTracker');
const { checkPortfolioAlerts, parseAndSaveKapNotices } = require('./alertChecker');
const { getCompanyNews, getNewsSentiment, getInsiderTransactions, getRecommendationTrends } = require('../../lib/finnhub');

// S&P 500 Core + S&P 400 Mid Cap + Russell Liquid — sp500_russell.txt ile senkronize
const US_WATCHLIST = [
  // S&P 500 Core
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META',  'GOOGL', 'AVGO', 'LLY',  'JPM',  'V',
  'UNH',  'XOM',  'MA',   'JNJ',  'PG',    'HD',    'COST', 'MRK',  'ABBV', 'CVX',
  'BAC',  'KO',   'PEP',  'WMT',  'CRM',   'NFLX',  'TMO',  'ACN',  'MCD',  'CSCO',
  'ABT',  'LIN',  'DHR',  'TXN',  'NEE',   'PM',    'ADBE', 'NKE',  'ORCL', 'QCOM',
  'WFC',  'RTX',  'BMY',  'AMGN', 'LOW',   'SPGI',  'UNP',  'HON',  'CAT',  'SBUX',
  'GE',   'AXP',  'BA',   'DE',   'BLK',   'GILD',  'VRTX', 'ISRG', 'MDT',  'REGN',
  'ZTS',  'SYK',  'ETN',  'EMR',  'ITW',   'GD',    'NOC',  'LMT',  'CTAS', 'ADP',
  'ICE',  'CME',  'MCO',  'MSCI', 'CARR',  'AMD',   'INTC', 'MU',   'AMAT', 'LRCX',
  'KLAC', 'MRVL', 'CDNS', 'SNPS', 'FTNT',  'PANW',  'CRWD', 'ZS',   'DDOG', 'NET',
  'SNOW', 'PLTR', 'APP',  'HOOD', 'COIN',  'MSTR',
  // S&P 400 Mid Cap
  'GLOB', 'SM',   'CHRD', 'RRC',  'AR',    'EQT',   'CNX',  'MTDR', 'FANG', 'VNOM',
  'CTRA', 'OVV',  'CRC',  'MGY',  'TALO',  'BATL',  'WTTR', 'NINE', 'KLXE', 'OIS',
  'PUMP', 'RES',  'STEP', 'FWRD', 'SAIA',  'ODFL',  'XPO',  'JBHT', 'WERN', 'KNX',
  'CHRW', 'EXPD', 'LSTR', 'HUBG', 'MRTN',  'HTLD',  'ARCB', 'RADX', 'GXO',  'RXO',
  'STNG', 'HAFN', 'TNK',  'INSW', 'DHT',   'FRO',   'TK',   'NMM',  'TRMD', 'CCO',
  'SFL',  'CMRE', 'ESEA', 'TOPS',
  // Russell Liquid Small/Mid Cap
  'RIOT', 'MARA', 'HUT',  'BITF', 'CIFR',  'WULF',  'IREN', 'CLSK', 'BTBT', 'HIVE',
  'HIMS', 'ACHR', 'JOBY', 'RKLB', 'ASTS',  'LUNR',  'RDDT', 'SNAP', 'PINS', 'BMBL',
  'MTCH', 'IAC',  'ZG',   'OPEN', 'UWMC',  'RKT',   'PFSI', 'ESNT', 'NMI',  'RDN',
  'FICO', 'PRGS', 'ALKT', 'PCTY', 'PAYC',  'TMDX',  'AXSM', 'SRRK', 'KROS', 'IMVT',
  'PTGX', 'RCUS', 'AGEN', 'CLOV', 'DKNG',  'PENN',  'RSI',  'GENI', 'EVEX', 'NUVL',
  'RXRX', 'BEAM', 'EDIT', 'NTLA', 'CRSP',  'FATE',  'ALLO', 'SANA', 'FOLD', 'RARE',
  'ACAD', 'INVA', 'PRTA', 'HRMY',
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

async function batchedFetch(items, fetchFn, batchSize = 10, label = '') {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fetchFn));
    const failures = batchResults
      .map((r, idx) => r.status === 'rejected' ? `${batch[idx]}(${r.reason?.message || r.reason})` : null)
      .filter(Boolean);
    if (failures.length > 0) {
      console.warn(`[batchedFetch${label ? ':' + label : ''}] Batch ${Math.floor(i / batchSize) + 1} — ${failures.length} hata: ${failures.join(', ')}`);
    }
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return results;
}

async function fetchTechnicalSnapshot(tickers) {
  const results = await batchedFetch(tickers, async (ticker) => {
    const data = await yahooFinance.chart(ticker, {
      period1: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      interval: '1d',
    });
    const quotes = data.quotes.filter((q) => q.close);
    if (quotes.length < 20) return null;

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

    return {
      ticker,
      data: {
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
      },
    };
  }, 10, 'US-teknik');

  const result = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      result[r.value.ticker] = r.value.data;
    }
  }
  return result;
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
    const mc = sd.marketCap;
    const mcSeg = mc > 10e9 ? 'large' : mc > 2e9 ? 'mid' : 'small';

    const safe = (v, mult = 1) => (v != null ? Math.round(v * mult * 100) / 100 : null);

    return {
      ticker,
      data: {
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
      },
    };
  }, 10, 'US-temel');

  const result = {};
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      result[r.value.ticker] = r.value.data;
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

function buildUsTechPrompt(stockBlock, todayStr) {
  return `Today is ${todayStr}. Analyze these US stocks:\n\n${stockBlock}\n\nFor each stock: BUY / WAIT / AVOID + one-line reason.`;
}

function buildUsFundPrompt(stockBlock, todayStr) {
  return `Today is ${todayStr}. Evaluate these US stocks fundamentally:\n\n${stockBlock}\n\nFor each stock: story intact or broken? One sentence verdict.`;
}

function buildUsSentPrompt(stockBlock, todayStr) {
  return `Today is ${todayStr}. Find news, catalysts, and sentiment for:\n\n${stockBlock}\n\nFor each stock: IGNITION / NEUTRAL / HEADWIND + specific catalyst. Mark unverified info as RUMOR.\n\nIMPORTANT: If you find significant filings or events for any stock in the last 7 days (SEC filings, earnings announcements, insider buying/selling, major contracts, M&A activity, management changes, dividend declarations, guidance updates), append this block at the END of your report:\n\n\`\`\`kap\n[\n  {\n    "ticker": "AAPL",\n    "title": "Q2 Earnings Beat Expectations",\n    "summary": "Apple reported Q2 EPS of $1.53 vs $1.43 expected. Revenue grew 5% YoY driven by services.",\n    "impact": "POZITIF",\n    "sourceDate": "2026-05-24"\n  }\n]\n\`\`\`\n\nimpact values: "POZITIF" | "NEGATIF" | "NOTR". Only include material events. Skip routine or immaterial filings.`;
}

async function fetchFinnhubData(tickers) {
  if (!process.env.FINNHUB_API_KEY) return {};
  const results = {};
  for (const ticker of tickers) {
    try {
      const [news, sentiment, insider, recommendations] = await Promise.all([
        getCompanyNews(ticker),
        getNewsSentiment(ticker),
        getInsiderTransactions(ticker),
        getRecommendationTrends(ticker),
      ]);
      results[ticker] = { news, sentiment, insider, recommendations };
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`[Finnhub] ${ticker} hatası:`, err.message);
      results[ticker] = null;
    }
  }
  return results;
}

function buildUsSentPromptWithFinnhub(stockBlock, todayStr, finnhubData) {
  let section = '\n\n## FINNHUB STRUCTURED DATA\n';
  for (const [ticker, data] of Object.entries(finnhubData)) {
    if (!data) continue;
    section += `\n### ${ticker}\n`;
    if (data.sentiment?.bullishPercent != null) {
      section += `Sentiment: Bullish ${(data.sentiment.bullishPercent * 100).toFixed(0)}% / Bearish ${(data.sentiment.bearishPercent * 100).toFixed(0)}%\n`;
      if (data.sentiment.buzz != null) section += `Buzz score: ${data.sentiment.buzz.toFixed(2)}\n`;
    }
    if (data.news?.length > 0) {
      section += `Recent news (${data.news.length}):\n`;
      data.news.slice(0, 5).forEach((n) => { section += `- [${n.source}] ${n.headline}\n`; });
    }
    if (data.insider?.length > 0) {
      const buys = data.insider.filter((t) => t.transactionCode === 'P');
      const sells = data.insider.filter((t) => t.transactionCode === 'S');
      if (buys.length > 0) section += `Insider buying: ${buys.length} transactions\n`;
      if (sells.length > 0) section += `Insider selling: ${sells.length} transactions\n`;
    }
    if (data.recommendations?.length > 0) {
      const r = data.recommendations[0];
      section += `Analyst consensus: Buy=${r.buy} Hold=${r.hold} Sell=${r.sell}\n`;
    }
  }
  return buildUsSentPrompt(stockBlock, todayStr) + section;
}

async function importFinnhubKapNotices(finnhubData, reportId) {
  for (const [ticker, data] of Object.entries(finnhubData)) {
    if (!data?.news) continue;
    const important = data.news.filter((n) =>
      /earnings|upgrade|downgrade|insider|acquire|merger|fda|approval/i.test(n.headline),
    );
    for (const news of important.slice(0, 2)) {
      try {
        const existing = await prisma.kapNotice.findFirst({ where: { ticker, market: 'US', title: news.headline } });
        if (!existing) {
          await prisma.kapNotice.create({
            data: { ticker, market: 'US', title: news.headline, summary: news.summary || news.headline, impact: 'NOTR', sourceDate: new Date(news.datetime), reportId },
          });
        }
      } catch (err) {
        console.error(`[Finnhub] KAP kayıt hatası ${ticker}:`, err.message);
      }
    }
  }
}

async function runUsForecast(isClosing = false, isManual = false) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const t0 = Date.now();
  console.log(`[US] Forecast başladı — ${todayStr} isClosing=${isClosing}`);
  console.log(`[US] Watchlist yüklendi: ${US_WATCHLIST.length} hisse`);

  const filters = await getUsFilters();
  const spyReturns = await fetchSpyReturns();

  console.log('[US] Teknik veri çekiliyor...');
  const techFull = await fetchTechnicalSnapshot(US_WATCHLIST);
  const techSuccess = Object.keys(techFull).length;
  const techFail = US_WATCHLIST.length - techSuccess;
  console.log(`[US] Teknik veri tamamlandı: ${techSuccess} başarılı, ${techFail} hata`);

  console.log('[US] Temel veri çekiliyor...');
  const fundFull = await fetchFundamentalSnapshot(Object.keys(techFull));
  const fundSuccess = Object.keys(fundFull).length;
  const fundFail = techSuccess - fundSuccess;
  console.log(`[US] Temel veri tamamlandı: ${fundSuccess} başarılı, ${fundFail} hata`);

  const { candidates, segmentContext } = prefilterUs(techFull, fundFull, spyReturns, filters);
  console.log(`[US] Prefilter: top ${candidates.length} hisse seçildi — ${candidates.join(', ')}`);

  const stockBlock = compressForAgent(
    Object.fromEntries(candidates.map((t) => [t, techFull[t]])),
    Object.fromEntries(candidates.map((t) => [t, fundFull[t] || {}])),
    spyReturns,
  );

  console.log('[US] Ajan 1 (teknik) başlıyor...');
  const r1tech = await callAgent('US', 'technical', buildUsTechPrompt(stockBlock, todayStr), 2500);
  console.log(`[US] Ajan 1 (teknik) tamamlandı (${r1tech.inputTokens} in / ${r1tech.outputTokens} out token)`);
  await logUsage({ requestType: 'scheduled', market: 'US', agentName: 'technical', inputTokens: r1tech.inputTokens, outputTokens: r1tech.outputTokens });

  console.log('[US] Ajan 2 (temel) başlıyor...');
  const r1fund = await callAgent('US', 'fundamental', buildUsFundPrompt(stockBlock, todayStr), 2500);
  console.log(`[US] Ajan 2 (temel) tamamlandı (${r1fund.inputTokens} in / ${r1fund.outputTokens} out token)`);
  await logUsage({ requestType: 'scheduled', market: 'US', agentName: 'fundamental', inputTokens: r1fund.inputTokens, outputTokens: r1fund.outputTokens });

  console.log('[US] Finnhub verisi çekiliyor...');
  const finnhubData = await fetchFinnhubData(candidates);
  console.log(`[US] Finnhub verisi tamamlandı (${Object.keys(finnhubData).length} hisse)`);

  console.log('[US] Ajan 3 (sentiment/web) başlıyor...');
  const sentPrompt = Object.keys(finnhubData).length > 0
    ? buildUsSentPromptWithFinnhub(stockBlock, todayStr, finnhubData)
    : buildUsSentPrompt(stockBlock, todayStr);
  const r1sent = await callAgentWithWebSearch('US', 'sentiment', sentPrompt);
  console.log(`[US] Ajan 3 (sentiment/web) tamamlandı (${r1sent.inputTokens} in / ${r1sent.outputTokens} out token)`);
  await logUsage({ requestType: 'scheduled', market: 'US', agentName: 'sentiment', inputTokens: r1sent.inputTokens, outputTokens: r1sent.outputTokens });

  console.log('[US] Tartışma turu başlıyor...');
  const [r2tech, r2fund] = await Promise.all([
    callAgent('US', 'technical', buildUsTechPrompt(stockBlock, todayStr) + `\n\nOTHER ANALYSTS' VIEWS:\n[Fundamental]\n${summarizeForPeer(r1fund.text)}\n\n[Sentiment]\n${summarizeForPeer(r1sent.text)}\n\nUpdate your assessment considering these views. Reinforce agreements, clarify disagreements with technical rationale.`, 2500),
    callAgent('US', 'fundamental', buildUsFundPrompt(stockBlock, todayStr) + `\n\nOTHER ANALYSTS' VIEWS:\n[Technical]\n${summarizeForPeer(r1tech.text)}\n\n[Sentiment]\n${summarizeForPeer(r1sent.text)}\n\nIf technical looks good but fundamentals are weak, say so clearly. And vice versa.`, 2500),
  ]);
  console.log(`[US] Tartışma turu tamamlandı (teknik: ${r2tech.outputTokens} / temel: ${r2fund.outputTokens} out token)`);
  await Promise.all([
    logUsage({ requestType: 'scheduled', market: 'US', agentName: 'technical_peer', inputTokens: r2tech.inputTokens, outputTokens: r2tech.outputTokens }),
    logUsage({ requestType: 'scheduled', market: 'US', agentName: 'fundamental_peer', inputTokens: r2fund.inputTokens, outputTokens: r2fund.outputTokens }),
  ]);

  const sum1 = summarizeForPeer(r2tech.text, 1200);
  const sum2 = summarizeForPeer(r2fund.text, 1200);
  const sum3 = summarizeForPeer(r1sent.text, 1200);

  const managerPrompt = buildUsManagerPrompt(candidates, segmentContext, sum1, sum2, sum3, stockBlock, todayStr);
  console.log('[US] Yönetici sentez başlıyor...');
  const rManager = await callAgent('US', 'manager', managerPrompt, 3000);
  console.log(`[US] Yönetici sentez tamamlandı (${rManager.inputTokens} in / ${rManager.outputTokens} out token)`);
  await logUsage({ requestType: 'scheduled', market: 'US', agentName: 'manager', inputTokens: rManager.inputTokens, outputTokens: rManager.outputTokens });

  const managerOut = rManager.text;
  const rec = parseForecastJson(managerOut);

  const report = await prisma.report.create({
    data: {
      market: 'US',
      type: isManual ? 'MANUAL' : 'SCHEDULED',
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
  console.log(`[US] Rapor kaydedildi — ID: ${report.id}`);
  await checkPortfolioAlerts('US', report);
  await parseAndSaveKapNotices(r1sent.text, 'US', report.id);
  if (Object.keys(finnhubData).length > 0) await importFinnhubKapNotices(finnhubData, report.id);

  if (!isManual) {
    await sendForecastEmail(managerOut, 'US', now);
  }
  console.log(`[US] Tamamlandı — toplam süre: ${Math.round((Date.now() - t0) / 1000)}s`);
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
| **Yıl Sonu Beklentisi** | $XXX |
| **Risk seviyesi** | Düşük / Orta / Yüksek |

> Yıl Sonu Beklentisi: Mevcut makro koşullar ve şirket fundamentalleri devam ederse yıl sonunda (31 Aralık 2026) beklenen fiyat seviyesi.
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
  "year_end": 0.00,
  "risk_level": "Düşük/Orta/Yüksek",
  "thesis_summary": "Tez özeti."
}
\`\`\``;
}

async function runManualAnalysis(ticker, onStep = null, context = {}) {
  const { userId, requestId, scenario } = context;
  const todayStr = new Date().toISOString().split('T')[0];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  await onStep?.('Veri çekiliyor...');
  const spyReturns = await fetchSpyReturns();
  const techFull = await fetchTechnicalSnapshot([ticker]);
  const fundFull = await fetchFundamentalSnapshot([ticker]);

  const currentPrice = techFull[ticker]?.price ?? null;
  const stockBlock = compressForAgent(techFull, fundFull, spyReturns);

  await onStep?.('Ajan 1 — Teknik analiz yapılıyor...');
  const r1tech = await callAgent('US', 'technical', buildUsTechPrompt(stockBlock, todayStr), 2500);
  totalInputTokens += r1tech.inputTokens; totalOutputTokens += r1tech.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'technical', inputTokens: r1tech.inputTokens, outputTokens: r1tech.outputTokens, ticker });

  await onStep?.('Ajan 2 — Temel analiz yapılıyor...');
  const r1fund = await callAgent('US', 'fundamental', buildUsFundPrompt(stockBlock, todayStr), 2500);
  totalInputTokens += r1fund.inputTokens; totalOutputTokens += r1fund.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'fundamental', inputTokens: r1fund.inputTokens, outputTokens: r1fund.outputTokens, ticker });

  await onStep?.('Ajan 3 — Haberler ve piyasa duygusu taranıyor...');
  const finnhubDataManual = await fetchFinnhubData([ticker]);
  const sentPromptManual = finnhubDataManual[ticker]
    ? buildUsSentPromptWithFinnhub(stockBlock, todayStr, finnhubDataManual)
    : buildUsSentPrompt(stockBlock, todayStr);
  const r1sent = await callAgentWithWebSearch('US', 'sentiment', sentPromptManual);
  totalInputTokens += r1sent.inputTokens; totalOutputTokens += r1sent.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'sentiment', inputTokens: r1sent.inputTokens, outputTokens: r1sent.outputTokens, ticker });

  await onStep?.('Tartışma turu — Ajanlar görüş alışverişi yapıyor...');
  const [r2tech, r2fund] = await Promise.all([
    callAgent('US', 'technical', buildUsTechPrompt(stockBlock, todayStr) + `\n\nOTHER ANALYSTS' VIEWS:\n[Fundamental]\n${summarizeForPeer(r1fund.text)}\n\n[Sentiment]\n${summarizeForPeer(r1sent.text)}\n\nUpdate your assessment considering these views. Reinforce agreements, clarify disagreements with technical rationale.`, 2500),
    callAgent('US', 'fundamental', buildUsFundPrompt(stockBlock, todayStr) + `\n\nOTHER ANALYSTS' VIEWS:\n[Technical]\n${summarizeForPeer(r1tech.text)}\n\n[Sentiment]\n${summarizeForPeer(r1sent.text)}\n\nIf technical looks good but fundamentals are weak, say so clearly. And vice versa.`, 2500),
  ]);
  totalInputTokens += r2tech.inputTokens + r2fund.inputTokens;
  totalOutputTokens += r2tech.outputTokens + r2fund.outputTokens;
  await Promise.all([
    logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'technical_peer', inputTokens: r2tech.inputTokens, outputTokens: r2tech.outputTokens, ticker }),
    logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'fundamental_peer', inputTokens: r2fund.inputTokens, outputTokens: r2fund.outputTokens, ticker }),
  ]);

  await onStep?.('Yönetici sentez yapıyor...');
  const fund = fundFull[ticker] || {};
  const segmentContext = `${ticker}: ${fund.market_cap_segment || 'unknown'}cap, ${fund.sector || 'Unknown'} sector`;
  const sum1 = summarizeForPeer(r2tech.text, 1200);
  const sum2 = summarizeForPeer(r2fund.text, 1200);
  const sum3 = summarizeForPeer(r1sent.text, 1200);
  let managerPrompt = buildUsManagerPrompt([ticker], segmentContext, sum1, sum2, sum3, stockBlock, todayStr);
  if (scenario) {
    managerPrompt += `\n\n━━━━━━━━━━━━━━━━━━━━━━\nKULLANICI SENARYOSU — Bu senaryoyu analizine dahil et:\n"${scenario}"\nBu senaryo doğruysa nasıl bir etki olur? Pozisyonu etkiler mi? Açıkça belirt.\n━━━━━━━━━━━━━━━━━━━━━━`;
  }
  const rManager = await callAgent('US', 'manager', managerPrompt, 3000);
  totalInputTokens += rManager.inputTokens; totalOutputTokens += rManager.outputTokens;
  await logUsage({ userId, requestType: 'manual', market: 'US', agentName: 'manager', inputTokens: rManager.inputTokens, outputTokens: rManager.outputTokens, ticker });

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

  const now = new Date();
  const rec = parseForecastJson(rManager.text);
  let reportId = null;
  try {
    const savedReport = await prisma.report.create({
      data: {
        market: 'US',
        type: 'MANUAL',
        date: now,
        content: rManager.text,
        jsonData: rec || undefined,
        ticker: rec?.ticker || ticker,
        entryLow: rec?.entry_low || null,
        entryHigh: rec?.entry_high || null,
        stopLoss: rec?.stop_loss || null,
        targetShort: rec?.target_short_low || null,
        targetMid: rec?.target_mid_low || null,
        riskLevel: rec?.risk_level || null,
        isClosing: false,
      },
    });
    reportId = savedReport.id;
    if (finnhubDataManual[ticker]) await importFinnhubKapNotices(finnhubDataManual, savedReport.id);
  } catch (err) {
    console.error('[US] Manuel rapor yazılamadı:', err.message);
  }

  return { result: rManager.text, currentPrice, reportId };
}

module.exports = { runUsForecast, runManualAnalysis };
