import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Search, Clock, CheckCircle, XCircle, Loader, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

const stripJsonBlocks = (content) => (content || '').replace(/```json[\s\S]*?```/g, '').trim()

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

// ─── System Run Section ───────────────────────────────────────────
function SystemRunSection({ market, isAdmin }) {
  const { count, label } = MARKET_META[market]
  const [sysStatus, setSysStatus] = useState(undefined) // undefined = loading, null = no runs, object = data
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

  // live elapsed counter when RUNNING
  useEffect(() => {
    if (sysStatus?.status !== 'RUNNING') { setElapsed(0); return }
    const update = () => setElapsed(
      Math.round((Date.now() - new Date(sysStatus.startedAt)) / 1000)
    )
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [sysStatus?.status, sysStatus?.startedAt])

  // poll every 5s when RUNNING
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
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-snug">
            🚀 Tüm {label} Sistemini Çalıştır
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {count} hisseyi tarar, top 8 seçer, 3+1 ajan analizi yapar.
          </p>
          <p className="text-xs text-slate-500 mt-0.5">⏱ Tahmini süre: 8–12 dakika</p>
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

      {/* Status row */}
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
function MarketForm({ market, label, placeholder }) {
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
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">Hisse</label>
        <input
          value={ticker}
          onChange={(e) => setTicker(normalizeTicker(e.target.value))}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
        />
        {tickerError && <p className="text-red-400 text-sm mt-1.5">⚠️ {tickerError}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1.5">
          Senaryo / Ek Bağlam <span className="text-slate-600 font-normal">(opsiyonel)</span>
        </label>
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="Örn: Hürmüz Boğazı barış süreci etkisini değerlendir..."
          rows={3}
          maxLength={500}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none text-sm"
        />
        <p className="text-xs text-slate-600 text-right mt-1">{scenario.length}/500</p>
      </div>
      <button
        type="submit"
        disabled={isPending || !ticker.trim()}
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        <Search size={16} /> {isPending ? 'Gönderiliyor...' : 'Analiz Et'}
      </button>
    </form>
  )
}

// ─── Combined Panel ───────────────────────────────────────────────
function MarketPanel({ market, label, placeholder, isAdmin }) {
  return (
    <div className="glass p-6 flex-1">
      <h2 className="text-lg font-semibold text-white mb-4">{label}</h2>
      <SystemRunSection market={market} isAdmin={isAdmin} />
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-xs text-slate-600">veya tek hisse</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <MarketForm market={market} label={label} placeholder={placeholder} />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function Analysis() {
  const [selected, setSelected] = useState(null)
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

  const handleClear = async () => {
    if (!confirm('Tüm istek geçmişi silinecek. Emin misiniz?')) return
    await api.get('/analysis/requests?clear=true')
    qc.invalidateQueries({ queryKey: ['analysis-requests'] })
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Manuel Analiz</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <MarketPanel market="BIST" label="BIST Hisse Analizi" placeholder="Örn: THYAO" isAdmin={isAdmin} />
        <MarketPanel market="US"   label="US Hisse Analizi"   placeholder="Örn: NVDA"  isAdmin={isAdmin} />
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

      <div className="space-y-3">
        {requests.length === 0 && (
          <div className="glass p-6 text-center text-slate-500">Henüz analiz isteği bulunmuyor</div>
        )}
        {requests.map((req) => {
          const s = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING
          const SIcon = s.Icon
          const isProcessing = req.status === 'PROCESSING'
          const statusLabel = isProcessing && req.currentStep ? req.currentStep : s.label

          return (
            <div key={req.id} className="glass p-4">
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

              {req.status === 'DONE' && req.result && (
                <div className="mt-3">
                  {selected === req.id ? (
                    <div className="mt-3 p-4 bg-white/5 rounded-lg prose prose-sm prose-invert max-w-none
                      prose-headings:text-teal-400 prose-strong:text-white
                      prose-table:w-full prose-table:border-collapse
                      prose-th:border prose-th:border-white/10 prose-th:p-3 prose-th:text-left prose-th:bg-white/5
                      prose-td:border prose-td:border-white/10 prose-td:p-3
                      [&_h2:has(⚡)]:text-2xl [&_h2:has(⚡)]:font-black [&_h2:has(⚡)]:text-white">
                      {req.currentPrice != null && (
                        <p className="not-prose text-sm text-slate-400 mb-3">
                          Analiz anı fiyatı:{' '}
                          <span className="text-white font-semibold">
                            {req.currentPrice.toFixed(2)} {req.market === 'BIST' ? 'TL' : '$'}
                          </span>
                        </p>
                      )}
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripJsonBlocks(req.result)}</ReactMarkdown>
                      <button
                        onClick={() => setSelected(null)}
                        className="text-slate-400 hover:text-white text-xs mt-2 not-prose"
                      >
                        Gizle
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelected(req.id)}
                      className="text-teal-400 hover:text-teal-300 text-sm mt-1"
                    >
                      Sonucu Görüntüle →
                    </button>
                  )}
                </div>
              )}

              {req.status === 'FAILED' && req.result && (
                <p className="text-red-400 text-sm mt-2">{req.result}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
