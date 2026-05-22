const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Default filtre değerleri
const FILTER_DEFAULTS = {
  BIST: {
    prefilter_top_n: '8',
    min_volume: '50000',
  },
  US: {
    prefilter_top_n: '8',
    min_dollar_volume: '5000000',
    min_price: '10',
    atr_min: '1.5',
    atr_max: '12',
  },
};

async function getFilterValue(market, key) {
  try {
    const config = await prisma.filterConfig.findUnique({
      where: { market_configKey: { market, configKey: key } },
    });
    if (config) return config.configValue;
  } catch {
    // DB unavailable
  }
  return FILTER_DEFAULTS[market]?.[key] || null;
}

async function getBistFilters() {
  const [topN, minVol] = await Promise.all([
    getFilterValue('BIST', 'prefilter_top_n'),
    getFilterValue('BIST', 'min_volume'),
  ]);
  return {
    topN: parseInt(topN || '8'),
    minVolume: parseInt(minVol || '50000'),
  };
}

async function getUsFilters() {
  const [topN, minDolVol, minPrice, atrMin, atrMax] = await Promise.all([
    getFilterValue('US', 'prefilter_top_n'),
    getFilterValue('US', 'min_dollar_volume'),
    getFilterValue('US', 'min_price'),
    getFilterValue('US', 'atr_min'),
    getFilterValue('US', 'atr_max'),
  ]);
  return {
    topN: parseInt(topN || '8'),
    minDollarVolume: parseInt(minDolVol || '5000000'),
    minPrice: parseFloat(minPrice || '10'),
    atrMin: parseFloat(atrMin || '1.5'),
    atrMax: parseFloat(atrMax || '12'),
  };
}

function prefilterBist(tech, fund, filters) {
  const { topN, minVolume } = filters;
  const scored = [];

  for (const [ticker, t] of Object.entries(tech)) {
    const f = fund[ticker] || {};
    let score = 0;

    if ((t.avg_volume_20d || 0) < minVolume) continue;

    if (t.volume_trend === 'artan') score += 4.0;
    else if (t.volume_trend === 'yatay') score += 0.5;
    else if (t.volume_trend === 'azalan') score -= 1.5;
    if ((t.avg_volume_20d || 0) > 5_000_000) score += 1.0;

    const ch5 = t.change_5d_pct || 0;
    const ch30 = t.change_30d_pct || 0;

    if (ch5 > 5) score += 3.0;
    else if (ch5 > 2) score += 2.0;
    else if (ch5 > 0) score += 1.0;
    else if (ch5 < -8) score -= 3.0;
    else if (ch5 < -4) score -= 1.5;

    if (ch30 > 20) score += 2.5;
    else if (ch30 > 10) score += 1.5;
    else if (ch30 > 0) score += 0.5;
    else if (ch30 < -20) score -= 2.0;

    const rsi = t.rsi14 || 50;
    if (rsi >= 55 && rsi <= 70) score += 3.0;
    else if (rsi >= 45 && rsi < 55) score += 1.5;
    else if (rsi >= 35 && rsi < 45) score += 0.5;
    else if (rsi < 35) score -= 0.5;
    else if (rsi > 70 && rsi <= 78) score += 1.0;
    else if (rsi > 78) score -= 1.5;

    const vs20 = t.vs_sma20_pct || 0;
    const vs50 = t.vs_sma50_pct || 0;
    if (vs20 > 3) score += 2.0;
    else if (vs20 > 0) score += 1.0;
    else if (vs20 < -5) score -= 2.0;
    if (vs50 > 5) score += 1.5;
    else if (vs50 > 0) score += 0.5;
    else if (vs50 < -10) score -= 1.5;

    const pe = f.pe_trailing;
    if (pe && pe > 0 && pe < 15) score += 0.5;
    else if (pe && pe > 60) score -= 0.5;

    const revG = f.revenue_growth_pct;
    if (revG && revG > 30) score += 1.0;
    else if (revG && revG > 10) score += 0.5;

    const sector = (f.sector || '').toLowerCase();
    if (['financial services', 'banks', 'insurance'].includes(sector)) score -= 2.0;

    scored.push([ticker, Math.round(score * 100) / 100]);
  }

  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, topN).map(([t]) => t);
}

function prefilterUs(tech, fund, spyReturns, filters) {
  const { topN, minDollarVolume, minPrice, atrMin, atrMax } = filters;
  const scored = [];

  for (const [ticker, t] of Object.entries(tech)) {
    const f = fund[ticker] || {};
    const price = t.price || 0;
    const atrRatio = t.atr_ratio || 0;
    const avgVolDollar = t.avg_volume_dollar || 0;

    // Hard filters
    if (avgVolDollar < minDollarVolume) continue;
    if (price < minPrice) continue;
    if (atrRatio < atrMin || atrRatio > atrMax) continue;

    let score = 0;
    const goldenCross = t.golden_cross || false;
    const sma50 = t.sma50;
    const sma200 = t.sma200;
    const volTrend = t.volume_trend || 'yatay';
    const ch1m = t.change_1m_pct || 0;
    const ch3m = t.change_3m_pct || 0;
    const ch6m = t.change_6m_pct || 0;
    const beta = f.beta || 1.0;
    const revGrowth = f.revenue_growth_pct || 0;
    const epsGrowth = f.earnings_growth_pct || 0;

    if (goldenCross) score += 2.0;
    if (sma50 && price > sma50) score += 1.5;
    if (sma200 && price > sma200) score += 1.0;
    else if (sma200 && price < sma200) score -= 2.0;

    if (ch1m > 10) score += 3.0;
    else if (ch1m > 5) score += 2.0;
    else if (ch1m > 0) score += 1.0;
    else if (ch1m < -10) score -= 2.0;

    if (ch3m > 20) score += 3.5;
    else if (ch3m > 10) score += 2.5;
    else if (ch3m > 0) score += 1.0;
    else if (ch3m < -15) score -= 2.0;

    if (ch6m > 40) score += 3.0;
    else if (ch6m > 20) score += 2.0;
    else if (ch6m > 0) score += 1.0;
    else if (ch6m < -20) score -= 2.0;

    const rs1m = ch1m - (spyReturns['1m'] || 0);
    const rs3m = ch3m - (spyReturns['3m'] || 0);
    const rs6m = ch6m - (spyReturns['6m'] || 0);
    const rsScore = rs1m * 0.2 + rs3m * 0.35 + rs6m * 0.45;
    if (rsScore > 15) score += 3.0;
    else if (rsScore > 5) score += 2.0;
    else if (rsScore > 0) score += 1.0;
    else if (rsScore < -10) score -= 2.0;

    if (volTrend === 'artan') score += 2.0;
    else if (volTrend === 'azalan') score -= 1.0;

    if (atrRatio > 2.0 && atrRatio < 5.0) score += 1.5;
    else if (atrRatio >= 5.0 && atrRatio <= 8.0) score += 0.5;

    if (beta > 1.5) score += 1.0;
    if (revGrowth > 20) score += 1.0;
    if (epsGrowth > 20) score += 0.5;

    scored.push({ ticker, score: Math.round(score * 1000) / 1000, rsScore });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);

  // Segment context
  const segScores = { large: [], mid: [], small: [] };
  for (const s of top) {
    const seg = fund[s.ticker]?.market_cap_segment || 'unknown';
    if (segScores[seg]) segScores[seg].push(s.score);
  }
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const avgs = Object.fromEntries(Object.entries(segScores).map(([k, v]) => [k, avg(v)]));
  const dominant = Object.entries(avgs).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  const segmentContext =
    `Market momentum distribution today:\n` +
    ` Large cap: ${segScores.large.length} stocks, avg score: ${avgs.large.toFixed(1)}\n` +
    ` Mid cap:   ${segScores.mid.length} stocks, avg score: ${avgs.mid.toFixed(1)}\n` +
    ` Small cap: ${segScores.small.length} stocks, avg score: ${avgs.small.toFixed(1)}\n` +
    ` → Dominant momentum: ${dominant} cap`;

  return { candidates: top.map((s) => s.ticker), segmentContext };
}

module.exports = { prefilterBist, prefilterUs, getBistFilters, getUsFilters };
