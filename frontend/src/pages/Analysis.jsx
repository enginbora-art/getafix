import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Search, Clock, CheckCircle, XCircle, Loader, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

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

function MarketForm({ market, label, placeholder }) {
  const [ticker, setTicker] = useState('')
  const [tickerError, setTickerError] = useState(null)
  const qc = useQueryClient()

  const { mutate: sendRequest, isPending } = useMutation({
    mutationFn: () => api.post('/analysis/request', { market, ticker: ticker.trim() }),
    onSuccess: () => {
      setTicker('')
      setTickerError(null)
      qc.invalidateQueries({ queryKey: ['analysis-requests'] })
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.error === 'TICKER_NOT_FOUND') {
        setTickerError(data.message)
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ticker.trim()) return
    setTickerError(null)
    sendRequest()
  }

  return (
    <div className="glass p-6 flex-1">
      <h2 className="text-lg font-semibold text-white mb-4">{label}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1.5">Hisse</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(normalizeTicker(e.target.value))}
            placeholder={placeholder}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
          />
          {tickerError && (
            <p className="text-red-400 text-sm mt-1.5">⚠️ {tickerError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending || !ticker.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Search size={16} /> {isPending ? 'Gönderiliyor...' : 'Analiz Et'}
        </button>
      </form>
    </div>
  )
}

export default function Analysis() {
  const [selected, setSelected] = useState(null)
  const qc = useQueryClient()

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
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Manuel Analiz</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <MarketForm market="BIST" label="BIST Hisse Analizi" placeholder="Örn: THYAO" />
        <MarketForm market="US"   label="US Hisse Analizi"   placeholder="Örn: NVDA"  />
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
                <span className="text-xs text-slate-500 shrink-0">
                  {format(new Date(req.createdAt), 'dd MMM HH:mm', { locale: tr })}
                </span>
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
