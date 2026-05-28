const finnhub = require('finnhub');

// DefaultApi constructor accepts the API key directly
const client = new finnhub.DefaultApi(process.env.FINNHUB_API_KEY || '');

function promisify(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

async function getCompanyNews(symbol) {
  try {
    const today = new Date();
    const week = new Date(today - 7 * 24 * 60 * 60 * 1000);
    const from = week.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    const news = await promisify(client.companyNews.bind(client), symbol, from, to);
    return (news || []).slice(0, 10).map((n) => ({
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
    const data = await promisify(client.newsSentiment.bind(client), symbol);
    return {
      bullishPercent: data?.sentiment?.bullishPercent,
      bearishPercent: data?.sentiment?.bearishPercent,
      score: data?.companyNewsScore,
      buzz: data?.buzz?.buzz,
      weeklyAverage: data?.buzz?.weeklyAverage,
    };
  } catch (err) {
    console.error(`[Finnhub] Sentiment hatası ${symbol}:`, err.message);
    return null;
  }
}

async function getInsiderTransactions(symbol) {
  try {
    const data = await promisify(client.insiderTransactions.bind(client), symbol, '', '');
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
    const data = await promisify(client.recommendationTrends.bind(client), symbol);
    return (data || []).slice(0, 2);
  } catch (err) {
    console.error(`[Finnhub] Öneri hatası ${symbol}:`, err.message);
    return [];
  }
}

module.exports = { getCompanyNews, getNewsSentiment, getInsiderTransactions, getRecommendationTrends };
