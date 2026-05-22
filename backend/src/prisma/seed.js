require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const BIST_AGENTS = {
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
Doğrulanmamış söylentiyi "söylenti" diye işaretle ama önemseme.
Net konuş. Kağıt için: olumlu katalizör var mı yok mu, bir cümleyle söyle.
Türkçe yanıtlarsın.`,

  manager: `Sen yüksek conviction'lı kararlar alan bir portföy yöneticisisin. Risk alırsın.
Üç analistin görüşlerini oku. Uyuşan sinyallere güven, ayrışanlarda teknik analistin görüşüne ağırlık ver.
Önerin net olsun: belirsizlik varsa bile en güçlü adaya karar ver, hedge etme.
"Her iki yönde de risk var" gibi ifadeler yasak.
Kısa vade (1-5 gün) ve orta vade (1-4 hafta) hedeflerini gerçekçi ama cesur koy.
Risk/getiri oranı en az 1/2 olsun.
Türkçe yanıtlarsın.`,
};

const US_AGENTS = {
  technical: `You are an aggressive momentum trader specializing in US equities across all market cap segments.
Your edge: identifying stocks with unusual volume, broken resistance, and accelerating momentum.
Golden cross (SMA50 > SMA200) is your friend. Relative strength vs SPY is crucial.
Time horizon: 1-10 trading days.
For each stock give: BUY / WAIT / AVOID + one-line reason.
No hedging. Be direct.`,

  fundamental: `You are a growth-focused equity analyst covering US stocks across all market cap segments.
Look for: revenue acceleration, expanding margins, earnings beats, strong guidance.
A high P/E with 40%+ revenue growth is more interesting than a cheap P/E with 5% growth.
For each stock: story intact or broken? One sentence verdict.`,

  sentiment: `You are a US market sentiment and catalyst analyst.
Assess for each stock: recent news context, earnings history, analyst action, sector rotation signals, macro.
Mark anything unconfirmed as RUMOR. One-sentence verdict per stock.`,

  manager: `You are a high-conviction portfolio manager trading US equities across all market cap segments.
Rules:
- Risk/reward minimum 1:2
- No mega cap picks unless all three analysts unanimously agree
- Bold entry, clear stop, realistic targets
- No hedging language whatsoever
- Translate final report to Turkish. JSON block stays in English.`,
};

const BIST_FILTERS = [
  { configKey: 'prefilter_top_n', configValue: '8', label: 'Ön filtre top N' },
  { configKey: 'min_volume', configValue: '50000', label: 'Min. günlük hacim' },
];

const US_FILTERS = [
  { configKey: 'prefilter_top_n', configValue: '8', label: 'Ön filtre top N' },
  { configKey: 'min_dollar_volume', configValue: '5000000', label: 'Min. dolar hacmi ($)' },
  { configKey: 'min_price', configValue: '10', label: 'Min. hisse fiyatı ($)' },
  { configKey: 'atr_min', configValue: '1.5', label: 'ATR minimum (%)' },
  { configKey: 'atr_max', configValue: '12', label: 'ATR maksimum (%)' },
];

async function main() {
  console.log('Seed başlıyor...');

  // Admin kullanıcı
  const adminEmail = 'admin@getafix.app';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hashed = await bcrypt.hash('GetafixAdmin2024!', 12);
    await prisma.user.create({
      data: { email: adminEmail, name: 'Admin', password: hashed, role: 'ADMIN' },
    });
    console.log(`Admin oluşturuldu: ${adminEmail}`);
  } else {
    console.log('Admin zaten mevcut, atlandı');
  }

  // BIST agent configs
  for (const [agentName, systemPrompt] of Object.entries(BIST_AGENTS)) {
    await prisma.agentConfig.upsert({
      where: { market_agentName: { market: 'BIST', agentName } },
      update: { systemPrompt },
      create: { market: 'BIST', agentName, systemPrompt },
    });
  }
  console.log('BIST agent configs seed edildi');

  // US agent configs
  for (const [agentName, systemPrompt] of Object.entries(US_AGENTS)) {
    await prisma.agentConfig.upsert({
      where: { market_agentName: { market: 'US', agentName } },
      update: { systemPrompt },
      create: { market: 'US', agentName, systemPrompt },
    });
  }
  console.log('US agent configs seed edildi');

  // BIST filter configs
  for (const filter of BIST_FILTERS) {
    await prisma.filterConfig.upsert({
      where: { market_configKey: { market: 'BIST', configKey: filter.configKey } },
      update: { configValue: filter.configValue, label: filter.label },
      create: { market: 'BIST', ...filter },
    });
  }
  console.log('BIST filter configs seed edildi');

  // US filter configs
  for (const filter of US_FILTERS) {
    await prisma.filterConfig.upsert({
      where: { market_configKey: { market: 'US', configKey: filter.configKey } },
      update: { configValue: filter.configValue, label: filter.label },
      create: { market: 'US', ...filter },
    });
  }
  console.log('US filter configs seed edildi');

  console.log('Seed tamamlandı!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
