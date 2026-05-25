import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

const IMPACT_CONFIG = {
  POZITIF: { label: 'POZİTİF', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.3)' },
  NEGATIF: { label: 'NEGATİF', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  NOTR:    { label: 'NÖTR',    color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' },
}

const LIMIT = 10

export default function KapNotices() {
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
      const params = new URLSearchParams({ page: p, limit: LIMIT })
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
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">KAP Bildirimleri</h1>
        <p className="text-sm text-slate-500 mt-1">Günlük analizde tespit edilen önemli gelişmeler</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1.5">
          {['ALL', 'BIST', 'US'].map((m) => (
            <button
              key={m}
              onClick={() => handleMarket(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                marketFilter === m
                  ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
              }`}
            >
              {m === 'ALL' ? 'Tümü' : m}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-2">
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

      {/* Content */}
      {loading && !notices.length ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notices.length === 0 ? (
        <div className="glass p-10 text-center">
          <p className="text-slate-400 text-sm">Henüz KAP bildirimi kaydedilmedi.</p>
          <p className="text-slate-600 text-xs mt-1">Günlük analiz çalıştığında burada görünecek.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => {
            const cfg = IMPACT_CONFIG[n.impact] || IMPACT_CONFIG.NOTR
            return (
              <div
                key={n.id}
                className="glass p-4"
                style={{ borderLeft: `3px solid ${cfg.border}` }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-teal-400 font-bold text-sm">{n.ticker}</span>
                    <span
                      style={{
                        background: cfg.bg,
                        border: `0.5px solid ${cfg.border}`,
                        color: cfg.color,
                        borderRadius: 5,
                        padding: '2px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-600">
                      {n.market}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {n.sourceDate
                      ? format(new Date(n.sourceDate), 'd MMM yyyy', { locale: tr })
                      : format(new Date(n.createdAt), 'd MMM yyyy', { locale: tr })}
                  </span>
                </div>
                <p className="text-white text-sm font-medium leading-snug mb-1">{n.title}</p>
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">{n.summary}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} /> Önceki
          </button>
          <span className="text-sm text-slate-500">
            Sayfa {page} / {totalPages}
            <span className="ml-2 text-slate-600">({total} kayıt)</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Sonraki <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
