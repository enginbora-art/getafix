import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Clock, CheckCircle, XCircle, Loader, Trash2, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const parseResultJson = (content) => {
  if (!content) return null
  const m = content.match(/```json\s*([\s\S]*?)```/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

const normalizeTicker = (val) => val.toUpperCase()
  .replace(/İ/g, 'I').replace(/Ğ/g, 'G').replace(/Ü/g, 'U')
  .replace(/Ş/g, 'S').replace(/Ö/g, 'O').replace(/Ç/g, 'C')
  .replace(/ı/g, 'I').replace(/ğ/g, 'G').replace(/ü/g, 'U')
  .replace(/ş/g, 'S').replace(/ö/g, 'O').replace(/ç/g, 'C')
  .replace(/[^A-Z0-9.-]/g, '')

const STATUS_CONFIG = {
  PENDING:    { label: 'Bekliyor',   color: 'text-yellow-400', Icon: Clock },
  QUEUED:     { label: 'Kuyrukta',   color: 'text-orange-400', Icon: Clock },
  PROCESSING: { label: 'İşleniyor', color: 'text-blue-400',   Icon: Loader },
  DONE:       { label: 'Tamamlandı', color: 'text-green-400', Icon: CheckCircle },
  FAILED:     { label: 'Başarısız',  color: 'text-red-400',   Icon: XCircle },
}

const MARKET_META = {
  BIST: { count: '97',  label: 'BIST' },
  US:   { count: '214', label: 'US' },
}

const BIAS_STYLE = {
  AL:    'bg-green-500/20 text-green-400 border-green-500/30',
  SAT:   'bg-red-500/20 text-red-400 border-red-500/30',
  BEKLE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function PdfBtn({ reportId, market }) {
  const [dlState, setDlState] = useState(null)
  const handlePdf = async () => {
    if (dlState === 'loading') return
    setDlState('loading')
    try {
      const res = await api.get(`/reports/${reportId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `getafix-${market}-${reportId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setDlState('done')
      setTimeout(() => setDlState(null), 2000)
    } catch {
      setDlState(null)
      alert('PDF indirilemedi.')
    }
  }
  return (
    <button
      onClick={handlePdf}
      disabled={dlState === 'loading'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
        color: dlState === 'done' ? '#4ade80' : '#94a3b8',
        opacity: dlState === 'loading' ? 0.6 : 1,
      }}
    >
      {dlState === 'loading'
        ? <><Loader size={11} className="animate-spin" /> İndiriliyor...</>
        : dlState === 'done'
        ? <><CheckCircle size={11} /> İndirildi</>
        : <><Download size={11} /> PDF</>}
    </button>
  )
}

function PortfolioBtn({ isInPortfolio, onClick }) {
  const [hovered, setHovered] = useState(false)
  const showExit = isInPortfolio && hovered
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
        background: showExit ? 'rgba(239,68,68,0.15)' : isInPortfolio ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.06)',
        border: `0.5px solid ${showExit ? '#ef4444' : isInPortfolio ? '#2dd4bf' : 'rgba(255,255,255,0.12)'}`,
        color: showExit ? '#ef4444' : isInPortfolio ? '#2dd4bf' : '#94a3b8',
      }}
    >
      {showExit ? 'Çıkar' : isInPortfolio ? '✓ Takipte' : '+ Takibe Al'}
    </button>
  )
}

// ─── System Run Section ───────────────────────────────────────────
function SystemRunSection({ market, isAdmin }) {
  const { count, label } = MARKET_META[market]
  const [sysStatus, setSysStatus] = useState(undefined)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/analysis/system-status?market=${market}`)
      setSysStatus(res.data)
    } catch (err) {
      console.error('[SystemRun] status fetch failed:', err.message)
      setSysStatus(null)
    }
  }, [market])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (sysStatus?.status !== 'RUNNING') { setElapsed(0); return }
    const update = () => setElapsed(
      Math.round((Date.now() - new Date(sysStatus.startedAt)) / 1000)
    )
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [sysStatus?.status, sysStatus?.startedAt])

  useEffect(() => {
    if (sysStatus?.status !== 'RUNNING') {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = setInterval(fetchStatus, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [sysStatus?.status, fetchStatus])

  const handleRun = async () => {
    if (!confirm(
      `${label} sistemini başlatmak istiyor musunuz?\nBu işlem ~10 dakika sürer ve API maliyeti oluşturur.`
    )) return
    setRunning(true)
    try {
      await api.post('/analysis/run-system', { market })
      await fetchStatus()
    } catch (err) {
      alert(err.response?.data?.error || 'Hata oluştu')
    } finally {
      setRunning(false)
    }
  }

  const isRunning = sysStatus?.status === 'RUNNING'
  const progressPct = Math.min(98, Math.round((elapsed / 600) * 100))

  return (
    <div style={{
      background: 'rgba(13,31,18,0.6)',
      border: '1px solid rgba(45,212,191,0.18)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">
            🚀 Tüm {label} Sistemini Çalıştır
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {count} hisseyi tarar, top 8 seçer, 3+1 ajan analizi yapar.
          </p>
          <p className="text-xs text-slate-500 mt-0.5">⏱ Tahmini süre: 2–4 dakika</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleRun}
            disabled={isRunning || running}
            className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isRunning || running ? 'rgba(255,255,255,0.05)' : 'rgba(45,212,191,0.15)',
              border: `1px solid ${isRunning || running ? 'rgba(255,255,255,0.1)' : 'rgba(45,212,191,0.4)'}`,
              color: isRunning || running ? '#64748b' : '#2dd4bf',
            }}
          >
            {isRunning ? 'Çalışıyor...' : 'Çalıştır'}
          </button>
        )}
      </div>

      <div className="mt-3 min-h-[18px]">
        {sysStatus === undefined && (
          <p className="text-xs text-slate-500">Yükleniyor...</p>
        )}
        {sysStatus !== undefined && !sysStatus?.status && (
          <p className="text-xs text-slate-500">Henüz çalıştırılmadı</p>
        )}
        {isRunning && (
          <div>
            <div className="flex items-center gap-2 text-xs text-blue-400">
              <Loader size={11} className="animate-spin shrink-0" />
              Şu an çalışıyor... ({Math.floor(elapsed / 60)} dk {elapsed % 60} sn)
              {sysStatus.triggeredBy && (
                <span className="text-slate-500 ml-1">— {sysStatus.triggeredBy.name}</span>
              )}
            </div>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        {sysStatus?.status === 'DONE' && (
          <p className="text-xs text-green-400 flex items-center gap-1.5">
            <CheckCircle size={11} />
            Son çalışma: {format(new Date(sysStatus.endedAt), 'd MMM HH:mm', { locale: tr })}
            {sysStatus.duration != null
              ? ` (${Math.floor(sysStatus.duration / 60)} dk ${sysStatus.duration % 60} sn)`
              : ''}
          </p>
        )}
        {sysStatus?.status === 'FAILED' && (
          <p className="text-xs text-red-400 flex items-center gap-1.5">
            <XCircle size={11} />
            Hata: {sysStatus.error || 'Bilinmeyen hata'}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Single Ticker Form ───────────────────────────────────────────
function MarketForm({ market, label, placeholder, onRequestSent }) {
  const [ticker, setTicker] = useState('')
  const [scenario, setScenario] = useState('')
  const [tickerError, setTickerError] = useState(null)
  const qc = useQueryClient()

  const { mutate: sendRequest, isPending } = useMutation({
    mutationFn: () => api.post('/analysis/request', { market, ticker: ticker.trim(), scenario: scenario.trim() || undefined }),
    onSuccess: () => {
      setTicker('')
      setScenario('')
      setTickerError(null)
      qc.invalidateQueries({ queryKey: ['analysis-requests'] })
      onRequestSent?.()
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.error === 'TICKER_NOT_FOUND') setTickerError(data.message)
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ticker.trim()) return
    setTickerError(null)
    sendRequest()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">Hisse</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(normalizeTicker(e.target.value))}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        {tickerError && <p className="text-red-400 text-xs mt-1">⚠️ {tickerError}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Senaryo <span className="text-slate-600 font-normal">(opsiyonel)</span>
        </label>
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="Örn: Hürmüz Boğazı barış süreci etkisini değerlendir..."
          rows={2}
          maxLength={500}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none"
        />
        <p className="text-xs text-slate-600 text-right mt-0.5">{scenario.length}/500</p>
      </div>
      <button
        type="submit"
        disabled={isPending || !ticker.trim()}
        className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50"
      >
        <Search size={14} /> {isPending ? 'Gönderiliyor...' : 'Analiz Et'}
      </button>
    </form>
  )
}

// ─── Combined Panel ───────────────────────────────────────────────
function MarketPanel({ market, label, placeholder, isAdmin, onRequestSent }) {
  return (
    <div className="glass p-4 flex-1">
      <h2 className="text-base font-medium text-white mb-3">{label}</h2>
      <SystemRunSection market={market} isAdmin={isAdmin} />
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-xs text-slate-600">veya tek hisse</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <MarketForm market={market} label={label} placeholder={placeholder} onRequestSent={onRequestSent} />
    </div>
  )
}

const HISTORY_PER_PAGE = 5

// ─── Main Page ────────────────────────────────────────────────────
export default function Analysis() {
  const navigate = useNavigate()
  const [portfolioOverrides, setPortfolioOverrides] = useState({})
  const [historyPage, setHistoryPage] = useState(1)
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  const { data: requests = [] } = useQuery({
    queryKey: ['analysis-requests'],
    queryFn: () => api.get('/analysis/requests').then((r) => r.data),
    refetchInterval: (query) => {
      const data = query.state.data
      const hasActive = Array.isArray(data) &&
        data.some((r) => ['PENDING', 'QUEUED', 'PROCESSING'].includes(r.status))
      return hasActive ? 3000 : 10000
    },
  })

  const totalHistoryPages = Math.max(1, Math.ceil(requests.length / HISTORY_PER_PAGE))
  const pagedRequests = requests.slice(
    (historyPage - 1) * HISTORY_PER_PAGE,
    historyPage * HISTORY_PER_PAGE
  )

  const handleClear = async () => {
    if (!confirm('Tüm istek geçmişi silinecek. Emin misiniz?')) return
    await api.get('/analysis/requests?clear=true')
    qc.invalidateQueries({ queryKey: ['analysis-requests'] })
    setHistoryPage(1)
  }

  const togglePortfolio = async (req) => {
    if (!req.reportId) return
    const currentState = portfolioOverrides[req.reportId] ?? req.inPortfolio ?? false
    try {
      if (currentState) {
        await api.delete(`/reports/${req.reportId}/portfolio`)
        setPortfolioOverrides((prev) => ({ ...prev, [req.reportId]: false }))
      } else {
        await api.post(`/reports/${req.reportId}/portfolio`)
        setPortfolioOverrides((prev) => ({ ...prev, [req.reportId]: true }))
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Hata oluştu')
    }
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Manuel Analiz</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <MarketPanel market="BIST" label="BIST Hisse Analizi" placeholder="Örn: THYAO" isAdmin={isAdmin} onRequestSent={() => setHistoryPage(1)} />
        <MarketPanel market="US"   label="US Hisse Analizi"   placeholder="Örn: NVDA"  isAdmin={isAdmin} onRequestSent={() => setHistoryPage(1)} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">İstek Geçmişi</h2>
        {requests.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 text-sm transition-colors"
          >
            <Trash2 size={14} /> Temizle
          </button>
        )}
      </div>

      <div className="space-y-3" id="history-list">
        {requests.length === 0 && (
          <div className="glass p-6 text-center text-slate-500">Henüz analiz isteği bulunmuyor</div>
        )}
        {pagedRequests.map((req) => {
          const s = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING
          const SIcon = s.Icon
          const isProcessing = req.status === 'PROCESSING'
          const statusLabel = isProcessing && req.currentStep ? req.currentStep : s.label
          const isDone = req.status === 'DONE' && !!req.result

          return (
            <div key={req.id} className="glass p-4">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`badge border ${req.market === 'BIST' ? 'text-teal-400 bg-teal-400/10 border-teal-400/20' : 'text-blue-400 bg-blue-400/10 border-blue-400/20'}`}>
                    {req.market}
                  </span>
                  <span className="text-white font-bold text-lg">{req.ticker}</span>
                  <span className={`flex items-center gap-1.5 text-sm ${s.color}`}>
                    <SIcon size={14} className={isProcessing ? 'animate-spin' : ''} />
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isAdmin && req.user && (
                    <span className="text-xs text-slate-500">{req.user.name}</span>
                  )}
                  <span className="text-xs text-slate-500">
                    {format(new Date(req.createdAt), 'dd MMM HH:mm', { locale: tr })}
                  </span>
                </div>
              </div>

              {/* DONE: compact summary card */}
              {isDone && (() => {
                const rec = parseResultJson(req.result)
                const biasMatch = req.result.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i)
                const bias = biasMatch?.[1]?.toUpperCase()
                const currency = req.market === 'BIST' ? 'TL' : '$'
                const isInPortfolio = portfolioOverrides[req.reportId] ?? req.inPortfolio ?? false

                const yearEndMatch = req.result.match(/Yıl Sonu Beklentisi[^|]*\|([^|]+)\|/)
                const yearEnd = yearEndMatch ? yearEndMatch[1].trim() : null

                const summaryRows = rec
                  ? [
                      ['Giriş', rec.entry_low != null ? `${rec.entry_low}${rec.entry_high ? `–${rec.entry_high}` : ''} ${currency}` : null],
                      ['Stop', rec.stop_loss != null ? `${rec.stop_loss} ${currency}` : null],
                      ['H1', rec.target_short_low != null ? `${rec.target_short_low} ${currency}` : null],
                      ['H2', rec.target_mid_low != null ? `${rec.target_mid_low} ${currency}` : null],
                      ...(yearEnd ? [['Yıl Sonu', yearEnd]] : []),
                      ['Risk', rec.risk_level || null],
                    ].filter(([, v]) => v != null)
                  : []

                return (
                  <div className="mt-3">
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: '12px 14px',
                    }}>
                      {/* Bias + price row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {bias && (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold border ${BIAS_STYLE[bias] || 'text-slate-400 border-white/10'}`}>
                            ⚡ {bias}
                          </span>
                        )}
                        {req.currentPrice != null && (
                          <span className="text-xs text-slate-500">
                            Fiyat: <span className="text-slate-300">{req.currentPrice.toFixed(2)} {currency}</span>
                          </span>
                        )}
                      </div>

                      {/* Key metrics grid */}
                      {summaryRows.length > 0 && (
                        <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(summaryRows.length, 5)}, 1fr)` }}>
                          {summaryRows.map(([label, value]) => (
                            <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '5px 8px' }}>
                              <div className="text-slate-600 text-xs">{label}</div>
                              <div className="text-slate-200 text-xs font-medium mt-0.5">{value}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {req.reportId && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => navigate(`/reports/${req.reportId}`)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                              background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)',
                              color: '#2dd4bf',
                            }}
                          >
                            <Eye size={11} /> Tam Rapor
                          </button>
                          <PdfBtn reportId={req.reportId} market={req.market} />
                          <PortfolioBtn isInPortfolio={isInPortfolio} onClick={() => togglePortfolio(req)} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {req.status === 'FAILED' && req.result && (
                <p className="text-red-400 text-sm mt-2">{req.result}</p>
              )}
            </div>
          )
        })}
      </div>

      {requests.length > HISTORY_PER_PAGE && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
            disabled={historyPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={15} /> Önceki
          </button>
          <span className="text-sm text-slate-500">
            Sayfa {historyPage} / {totalHistoryPages}
          </span>
          <button
            onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
            disabled={historyPage === totalHistoryPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Sonraki <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
