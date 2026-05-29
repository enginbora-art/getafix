import React, { useState } from 'react'

const SECTIONS = {
  BIST: [
    {
      title: '1. Veri Katmanı',
      content: '97 BIST hissesi için Yahoo Finance\'den günlük OHLCV verisi, 52 haftalık min/max, EMA20/50, RSI14, Bollinger Bands ve hacim ortalaması çekilir. Temel veriler (PD/DD, F/K, net marj, ROE, borç/özsermaye) de alınır. Tüm çekişler 10\'lu batch\'lerle paralel yapılır; başarısız olanlar loglanır ama akışı durdurmaz.',
    },
    {
      title: '2. Momentum Ön Filtresi',
      content: 'Teknik puan hesaplaması: EMA20 > EMA50 (+2), RSI 40–70 arası (+1), son kapanış 52W düşüğünden %10 üstte (+1), hacim ortalamasının 1.5x üzerinde (+2), BB orta bandı üstünde (+1). Toplam 7 üzerinden puanlama. Admin panelinden her kriter ayrı ayrı açılıp kapatılabilir ve eşik değeri ayarlanabilir. Top 8 hisse bir sonraki aşamaya geçer.',
    },
    {
      title: '3. Üç Uzman Ajan',
      paragraphs: [
        'Teknik Ajan: RSI, EMA, Bollinger Bands, hacim ve momentum verilerini yorumlar. Giriş aralığı, stop ve hedef seviyeleri önerir.',
        'Temel Ajan: F/K, PD/DD, ROE, marj ve büyüme verilerini değerlendirir. Şirketin finansal sağlığını ölçer.',
        'Sentiment Ajan: Web araması ile son haberleri, analist görüşlerini ve piyasa algısını tarar.',
        'İkinci turda teknik ve temel ajanlar birbirinin özetini okuyarak görüşlerini günceller (peer-review). Ortak görüş pekişir, çelişki açıkça belirtilir.',
      ],
    },
    {
      title: '4. Yönetici & Teslimat',
      content: 'Üç ajanın çıktısını alan Yönetici Ajan nihai kararı verir: AL / SAT / BEKLE. Markdown formatında yapılandırılmış rapor + gömülü JSON bloğu üretir. JSON\'dan entry_low/high, stop_loss, target_short/mid ve risk_level alanları veritabanına ayrıştırılır. Rapor e-posta ile gönderilir, dashboard\'da listelenir ve Genel Tablo\'ya eklenebilir. Karar değişikliğinde PortfolioAlert oluşturulur.',
    },
  ],
  US: [
    {
      title: '1. Veri Katmanı',
      content: '214 ABD hissesi için Yahoo Finance\'den günlük OHLCV verisi, EMA20/50, RSI14, Bollinger Bands, 52 haftalık min/max ve hacim ortalaması çekilir. Temel veriler: piyasa değeri segmenti (small/mid/large cap), sektör, F/K, PD/DD, EPS büyümesi, brüt marj, borç/özsermaye. S&P 500 (SPY) son 20 günlük getirisi piyasa bağlamı olarak eklenir.',
    },
    {
      title: '2. Momentum Ön Filtresi',
      content: 'Teknik ve temel verilerden oluşan çok katmanlı puanlama sistemi. Golden cross (+2.0), SMA50 üstü (+1.5), 1M/3M/6M momentum (+3.5\'e kadar), SPY\'a göre relatif güç (+3.0\'e kadar), hacim trendi (+2.0), ATR volatilite bandı (+1.5). Temel katman: beta > 1.5 (+1.0), gelir büyümesi > %20 (+1.0), EPS büyümesi > %20 (+0.5). Short squeeze katmanı: short float > %20 (+2.0), short float > %30 (+1.5 ek), short ratio > 5 gün (+1.0). En yüksek puanlı top N hisse seçilir; cap segment dağılımı segmentContext olarak ajanlara iletilir.',
    },
    {
      title: '3. Üç Uzman Ajan',
      paragraphs: [
        'Teknik Ajan: Fiyat hareketi, momentum ve volatilite analizi. Kısa vadeli giriş/çıkış stratejisi.',
        'Temel Ajan: Değerleme çarpanları, bilanço sağlığı ve sektör karşılaştırması. Cap segment\'e göre beklentiler farklı kurgulanır (small cap büyüme odaklı, large cap istikrar odaklı).',
        'Sentiment Ajan: İngilizce haber araması, analist revizyonları ve makro korelasyon.',
        'Peer-review turu BIST ile aynı mekanizma. Tüm çıktılar İngilizce prompt\'larla üretilir, nihai rapor Türkçe yazılır.',
      ],
    },
    {
      title: '4. Yönetici & Teslimat',
      content: 'BIST ile aynı yapı: AL / SAT / BEKLE kararı, Markdown rapor, gömülü JSON ve veritabanı kaydı. Fiyat birimi USD\'dir; Genel Tablo\'da "$" ile gösterilir. E-posta teslimatı BIST ile aynı. PortfolioAlert sistemi bias değişimlerini otomatik izler.',
    },
  ],
}

export default function SystemDocs() {
  const [activeTab, setActiveTab] = useState('BIST')
  const sections = SECTIONS[activeTab]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-white mb-2">Sistem Dökümantasyonu</h1>
      <p className="text-sm text-slate-500 mb-6">Forecast sisteminin nasıl çalıştığına dair teknik genel bakış.</p>

      <div className="flex gap-2 mb-6">
        {['BIST', 'US'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {sections.map(({ title, content, paragraphs }) => (
          <div key={title} className="glass p-5">
            <h2 className="text-base font-semibold text-teal-400 mb-3">{title}</h2>
            <div className="text-sm text-slate-300 leading-relaxed space-y-2">
              {paragraphs
                ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
                : <p>{content}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
