const prisma = require('./prisma');

const INPUT_PRICE_PER_M = 3.00;
const OUTPUT_PRICE_PER_M = 15.00;

function calculateCost(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * INPUT_PRICE_PER_M + (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M;
}

async function logUsage({ userId, requestType, market, agentName, inputTokens, outputTokens, ticker }) {
  const costUsd = calculateCost(inputTokens, outputTokens);
  try {
    await prisma.apiUsageLog.create({
      data: {
        userId: userId || null,
        requestType,
        market,
        agentName,
        inputTokens,
        outputTokens,
        costUsd,
        ticker: ticker || null,
      },
    });
  } catch (err) {
    console.error('[COST] Log yazılamadı:', err.message);
  }
  return costUsd;
}

module.exports = { calculateCost, logUsage };
