const axios = require('axios');

const BASE = 'https://finnhub.io/api/v1';
const token = () => process.env.FINNHUB_API_KEY;

async function getCompanyNews(symbol) {
  try {
    const today = new Date();
    const week = new Date(today - 7 * 24 * 60 * 60 * 1000);
    const from = week.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    const { data } = await axios.get(`${BASE}/company-news`, { params: { symbol, from, to, token: token() } });
    return (data || []).slice(0, 10).map((n) => ({
      headline: n.headline,
      summary: n.summary?.slice(0, 200),
      source: n.source,
      datetime: new Date(n.datetime * 1000).toISOString(),
      url: n.url,
    }));
  } catch (err) {
    console.error(`[Finnhub] Haber hatası ${symbol}:`, err.message);
    return [];
  }
}

async function getNewsSentiment(symbol) {
  try {
    const { data } = await axios.get(`${BASE}/news-sentiment`, { params: { symbol, token: token() } });
    if (!data || !data.sentiment) return null;
    return {
      bullishPercent: data.sentiment.bullishPercent,
      bearishPercent: data.sentiment.bearishPercent,
      score: data.companyNewsScore,
      buzz: data.buzz?.buzz,
      weeklyAverage: data.buzz?.weeklyAverage,
    };
  } catch (err) {
    console.error(`[Finnhub] Sentiment hatası ${symbol}:`, err.message);
    return null;
  }
}

async function getInsiderTransactions(symbol) {
  try {
    const { data } = await axios.get(`${BASE}/stock/insider-transactions`, { params: { symbol, token: token() } });
    return (data?.data || []).slice(0, 5).map((t) => ({
      name: t.name,
      share: t.share,
      change: t.change,
      transactionDate: t.transactionDate,
      transactionCode: t.transactionCode,
    }));
  } catch (err) {
    console.error(`[Finnhub] Insider hatası ${symbol}:`, err.message);
    return [];
  }
}

async function getRecommendationTrends(symbol) {
  try {
    const { data } = await axios.get(`${BASE}/stock/recommendation`, { params: { symbol, token: token() } });
    return (data || []).slice(0, 2);
  } catch (err) {
    console.error(`[Finnhub] Öneri hatası ${symbol}:`, err.message);
    return [];
  }
}

module.exports = { getCompanyNews, getNewsSentiment, getInsiderTransactions, getRecommendationTrends };
