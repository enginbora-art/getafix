import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Search, ExternalLink, Newspaper, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

const IMPACT_CONFIG = {
  POZITIF: { label: 'POZİTİF', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)' },
  NEGATIF: { label: 'NEGATİF', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  NOTR:    { label: 'NÖTR',    color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' },
}

const KAP_LIMIT = 10

function SentimentBar({ bullish, bearish }) {
  if (bullish == null) return null
  const b = Math.round(bullish * 100)
  const be = Math.round(bearish * 100)
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
        <span style={{ color: '#4ade80' }}>Yükseliş %{b}</span>
        <span style={{ color: '#f87171' }}>Düşüş %{be}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(248,113,113,0.3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${b}%`, background: '#4ade80', borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function FinnhubPanel() {
  const [ticker, setTicker] = useState('')
  const [input, setInput] = useState('')
  const [news, setNews] = useState([])
  const [sentiment, setSentiment] = useState(null)
  const [hasApiKey, setHasApiKey] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const fetchNews = useCallback(async (sym) => {
    if (!sym) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/reports/market-news?ticker=${encodeURIComponent(sym)}`)
      if (!res.data.hasApiKey) { setHasApiKey(false); return }
      setHasApiKey(true)
      setNews(res.data.news || [])
      setSentiment(res.data.sentiment || null)
    } catch {
      setError('Haberler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    api.get('/reports/market-news').then((r) => {
      if (!r.data.hasApiKey) setHasApiKey(false)
    }).catch(() => {})
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    const sym = input.trim().toUpperCase()
    if (!sym) return
    setTicker(sym)
    fetchNews(sym)
  }

  if (!hasApiKey) {
    return (
      <div className="glass p-8 flex flex-col items-center justify-center gap-3 text-center h-64">
        <AlertCircle size={28} className="text-slate-500" />
        <p className="text-slate-400 text-sm font-medium">Finnhub API key yapılandırılmamış</p>
        <p className="text-slate-600 text-xs">FINNHUB_API_KEY ortam değişkeni ayarlanmadığı için canlı haber verisi kullanılamıyor.</p>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Ticker girin (ör. AAPL, TSLA)"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '8px 10px 8px 32px',
              fontSize: 13,
              color: '#f1f5f9',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            background: 'rgba(20,184,166,0.15)',
            border: '1px solid rgba(20,184,166,0.3)',
            color: '#2dd4bf',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Ara
        </button>
      </form>

      {ticker && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#2dd4bf' }}>{ticker}</span>
          {sentiment?.bullishPercent != null && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Sentiment</span>
          )}
        </div>
      )}

      {sentiment?.bullishPercent != null && (
        <SentimentBar bullish={sentiment.bullishPercent} bearish={sentiment.bearishPercent} />
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="glass p-6 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      ) : news.length === 0 && ticker ? (
        <div className="glass p-8 text-center">
          <p className="text-slate-400 text-sm">{ticker} için haber bulunamadı.</p>
        </div>
      ) : news.length === 0 ? (
        <div className="glass p-8 text-center">
          <Newspaper size={28} style={{ color: '#334155', margin: '0 auto 8px' }} />
          <p className="text-slate-500 text-sm">Ticker arayarak haberleri görüntüleyin.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {news.map((n, i) => (
            <div key={i} className="glass p-4">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{n.source}</span>
                  <span style={{ fontSize: 11, color: '#475569' }}>
                    {format(new Date(n.datetime), 'd MMM yyyy', { locale: tr })}
                  </span>
                </div>
                {n.url && (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4b5563', flexShrink: 0 }}>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>{n.headline}</p>
              {n.summary && (
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {n.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KapPanel() {
  const [notices, setNotices] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [marketFilter, setMarketFilter] = useState('ALL')
  const [impactFilter, setImpactFilter] = useState('ALL')

  const fetchNotices = useCallback(async (p, market, impact) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p, limit: KAP_LIMIT })
      if (market !== 'ALL') params.set('market', market)
      const res = await api.get(`/reports/kap-notices?${params}`)
      let data = res.data.notices || []
      if (impact !== 'ALL') data = data.filter((n) => n.impact === impact)
      setNotices(data)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages || 1)
    } catch {
      setNotices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotices(page, marketFilter, impactFilter)
  }, [fetchNotices, page, marketFilter, impactFilter])

  const handleMarket = (m) => { setMarketFilter(m); setPage(1) }
  const handleImpact = (i) => { setImpactFilter(i); setPage(1) }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {['ALL', 'BIST', 'US'].map((m) => (
            <button
              key={m}
              onClick={() => handleMarket(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                marketFilter === m
                  ? 'bg-teal-600/20 text-teal-400 border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-white/10'
              }`}
            >
              {m === 'ALL' ? 'Tümü' : m}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'ALL', label: 'Tüm Etkiler' },
            { key: 'POZITIF', label: 'Pozitif' },
            { key: 'NEGATIF', label: 'Negatif' },
            { key: 'NOTR', label: 'Nötr' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleImpact(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                impactFilter === key
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-slate-500 border-transparent hover:border-white/10 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && !notices.length ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notices.length === 0 ? (
        <div className="glass p-8 text-center">
          <p className="text-slate-400 text-sm">Henüz bildirim kaydedilmedi.</p>
          <p className="text-slate-600 text-xs mt-1">Günlük analiz çalıştığında burada görünecek.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => {
            const cfg = IMPACT_CONFIG[n.impact] || IMPACT_CONFIG.NOTR
            return (
              <div key={n.id} className="glass p-4" style={{ borderLeft: `3px solid ${cfg.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2dd4bf' }}>{n.ticker}</span>
                    <span style={{ background: cfg.bg, border: `0.5px solid ${cfg.border}`, color: cfg.color, borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 600 }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{n.market}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>
                    {format(new Date(n.sourceDate || n.createdAt), 'd MMM yyyy', { locale: tr })}
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4, marginBottom: 4 }}>{n.title}</p>
                <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.summary}</p>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Önceki
          </button>
          <span style={{ fontSize: 12, color: '#475569' }}>
            {page} / {totalPages}
            <span style={{ marginLeft: 6, color: '#334155' }}>({total})</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Sonraki <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export default function News() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Haberler</h1>
        <p className="text-sm text-slate-500 mt-1">Canlı piyasa haberleri ve analiz bildirimleri</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Canlı Haberler
          </h2>
          <FinnhubPanel />
        </div>

        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Analiz Bildirimleri
          </h2>
          <KapPanel />
        </div>
      </div>
    </div>
  )
}
