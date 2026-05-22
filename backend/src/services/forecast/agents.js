const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk');

const prisma = new PrismaClient();
const client = new Anthropic({ maxRetries: 0 });

const MODEL = 'claude-sonnet-4-6';

// Default prompts — birincil kaynak: DB. DB boşsa bunlar kullanılır.
const DEFAULTS = {
  BIST: {
    technical: `Sen agresif bir BIST momentum trader'ısın. Teknik analizde uzmanlaşmışsın.
Amacın sadece hareket eden kağıtları yakalamak: hacim patlaması, kırılan dirençler, trend ivmesi.
Kısa vadeli düşünürsün — 1 ila 10 iş günü.
Net konuş. "Öte yandan" veya "risk de göz önünde bulundurulmalı" gibi hedge ifadeler kullanma.
Her kağıt için net bir verdict ver: AL / BEKLE / UZAK DUR.
Türkçe yanıtlarsın.`,

    fundamental: `Sen BIST'te büyüme ve momentum hikayesi olan şirketleri bulan bir analistsin.
Temel analizde değer tuzağı değil, büyüme ivmesi ararsın: artan ciro, genişleyen marj, güçlü nakit akışı.
Momentum kağıtların çoğu yüksek F/K'lı olabilir — bu seni korkutmamalı, büyüme bunu destekliyorsa savun.
Net konuş. Her kağıt için: temel hikaye güçlü mü zayıf mı, tek cümleyle verdict ver.
Türkçe yanıtlarsın.`,

    sentiment: `Sen BIST piyasasında haber akışını, KAP bildirimlerini ve spekülatif hareketi takip eden bir analistsin.
Kurumsal alımlar, yabancı ilgisi, sektörel katalizörler, ihale haberleri, kur etkisi — bunlar seni ilgilendirir.
Doğrulanmamış söylentiyi "söylenti" diye işaretle ama önemseme, spekülatif kağıtlarda söylenti de fiyatı hareket ettirir.
Net konuş. Kağıt için: olumlu katalizör var mı yok mu, bir cümleyle söyle.
Türkçe yanıtlarsın.`,

    manager: `Sen yüksek conviction'lı kararlar alan bir portföy yöneticisisin. Risk alırsın.
Üç analistin görüşlerini oku. Uyuşan sinyallere güven, ayrışanlarda teknik analistin görüşüne ağırlık ver.
Önerin net olsun: belirsizlik varsa bile en güçlü adaya karar ver, hedge etme.
"Her iki yönde de risk var" gibi ifadeler yasak. Tezin için dur.
Kısa vade (1-5 gün) ve orta vade (1-4 hafta) hedeflerini gerçekçi ama cesur koy.
Risk/getiri oranı en az 1/2 olsun (1 TL riske 2 TL potansiyel).
Türkçe yanıtlarsın.`,
  },

  US: {
    technical: `You are an aggressive momentum trader specializing in US equities across all market cap segments.
Your edge: identifying stocks with unusual volume, broken resistance, and accelerating momentum
relative to the broader market.
You pay attention to ATR — you want volatility, but not casino-level risk.
Golden cross (SMA50 > SMA200) is your friend. Relative strength vs SPY is crucial.
Time horizon: 1-10 trading days.
For each stock give: BUY / WAIT / AVOID + one-line reason.
No hedging. Be direct.`,

    fundamental: `You are a growth-focused equity analyst covering US stocks across all market cap segments.
You understand that mid and small cap momentum stories often have better risk/reward than mega caps.
Look for: revenue acceleration, expanding margins, earnings beats, strong guidance.
A high P/E with 40%+ revenue growth is more interesting than a cheap P/E with 5% growth.
For each stock: story intact or broken? One sentence verdict.`,

    sentiment: `You are a US market sentiment and catalyst analyst.
Using your training data and knowledge, assess for each stock: recent news context, earnings surprise history,
analyst action trends, insider activity patterns, short squeeze potential (based on known short interest levels),
sector rotation signals, macro tailwinds/headwinds.
Also assess: is there a specific catalyst likely coming (earnings, FDA decision, contract announcement)?
Mark anything not definitively confirmed as RUMOR. One-sentence verdict per stock.`,

    manager: `You are a high-conviction portfolio manager trading US equities across all market cap segments.
You actively seek mid and small cap opportunities where momentum is strongest.
Rules:
- Risk/reward minimum 1:2
- No mega cap picks unless all three analysts unanimously agree AND relative strength is exceptional
- Bold entry, clear stop, realistic targets
- No hedging language whatsoever
- State the trade like you're putting real money behind it
- After completing your analysis in English, translate the ENTIRE final report into Turkish before outputting it. The JSON block at the end stays in English. Everything else — headings, thesis, targets, risk notes — must be in Turkish.`,
  },
};

async function getPrompt(market, agentName) {
  try {
    const config = await prisma.agentConfig.findUnique({
      where: { market_agentName: { market, agentName } },
    });
    if (config) return config.systemPrompt;
  } catch {
    // DB unavailable — fall back to defaults
  }
  return DEFAULTS[market]?.[agentName] || '';
}

async function callAgent(market, agentName, userMessage, maxTokens = 1500) {
  const system = await getPrompt(market, agentName);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      });
      return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    } catch (err) {
      const status = err.status || 0;
      if (attempt < 3 && (status === 429 || status === 529)) {
        const wait = status === 429 ? 65000 : 30000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
      } else {
        throw err;
      }
    }
  }
}

async function callAgentWithWebSearch(market, agentName, userMessage) {
  const system = await getPrompt(market, agentName);

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: 'user', content: userMessage }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
  });
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function summarizeForPeer(text, maxChars = 1200) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars).lastIndexOf('.');
  return text.slice(0, cut > maxChars * 0.7 ? cut + 1 : maxChars) + '\n\n[...özet kesildi]';
}

module.exports = { callAgent, callAgentWithWebSearch, summarizeForPeer, DEFAULTS };
