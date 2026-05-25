const prisma = require('../../lib/prisma');

function parseBias(content) {
  const m = content?.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i);
  return m?.[1]?.toUpperCase() || null;
}

async function checkPortfolioAlerts(market, newReport) {
  try {
    const newTicker = newReport.ticker;
    if (!newTicker) return;

    const newBias = parseBias(newReport.content);
    if (!newBias) return;

    const prevReport = await prisma.report.findFirst({
      where: { market, ticker: newTicker, id: { not: newReport.id } },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });

    if (!prevReport) return;

    const prevBias = parseBias(prevReport.content);
    if (!prevBias || prevBias === newBias) return;

    const nedenMatch = newReport.content.match(/## Neden\?([\s\S]*?)(?=##|$)/);
    const summary = nedenMatch
      ? nedenMatch[1].trim().slice(0, 500)
      : newReport.content.slice(0, 500);

    await prisma.portfolioAlert.create({
      data: { ticker: newTicker, market, previousBias: prevBias, newBias, summary, reportId: newReport.id },
    });

    console.log(`[ALERT] ${newTicker}: ${prevBias} → ${newBias}`);
  } catch (err) {
    console.error('[ALERT] checkPortfolioAlerts hatası:', err.message);
  }
}

module.exports = { checkPortfolioAlerts };
