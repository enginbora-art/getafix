import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Search, Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

const stripJsonBlocks = (content) => (content || '').replace(/```json[\s\S]*?```/g, '').trim()

const STATUS_CONFIG = {
  PENDING: { label: 'Bekliyor', color: 'text-yellow-400', Icon: Clock },
  PROCESSING: { label: 'İşleniyor', color: 'text-blue-400', Icon: Loader },
  DONE: { label: 'Tamamlandı', color: 'text-green-400', Icon: CheckCircle },
  FAILED: { label: 'Başarısız', color: 'text-red-400', Icon: XCircle },
}

export default function Analysis() {
  const [market, setMarket] = useState('BIST')
  const [ticker, setTicker] = useState('')
  const [selected, setSelected] = useState(null)
  const qc = useQueryClient()

  const { data: requests = [] } = useQuery({
    queryKey: ['analysis-requests'],
    queryFn: () => api.get('/analysis/requests').then((r) => r.data),
    refetchInterval: 10000,
  })

  const { mutate: sendRequest, isPending } = useMutation({
    mutationFn: () => api.post('/analysis/request', { market, ticker: ticker.trim().toUpperCase() }),
    onSuccess: () => {
      setTicker('')
      qc.invalidateQueries({ queryKey: ['analysis-requests'] })
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!ticker.trim()) return
    sendRequest()
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Manuel Analiz</h1>

      <div className="glass p-6 mb-8 max-w-xl">
        <h2 className="text-lg font-semibold text-white mb-4">Yeni Analiz İste</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            {['BIST', 'US'].map((m) => (
              <button
                key={m} type="button"
                onClick={() => setMarket(m)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${market === m ? 'btn-primary' : 'btn-secondary'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Ticker</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder={market === 'BIST' ? 'Örn: THYAO' : 'Örn: NVDA'}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button type="submit" disabled={isPending || !ticker.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Search size={16} /> {isPending ? 'Gönderiliyor...' : 'Analiz Et'}
          </button>
        </form>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">İstek Geçmişi</h2>
      <div className="space-y-3">
        {requests.length === 0 && (
          <div className="glass p-6 text-center text-slate-500">Henüz analiz isteği bulunmuyor</div>
        )}
        {requests.map((req) => {
          const s = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING
          const SIcon = s.Icon
          return (
            <div key={req.id} className="glass p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`badge border ${req.market === 'BIST' ? 'text-teal-400 bg-teal-400/10 border-teal-400/20' : 'text-blue-400 bg-blue-400/10 border-blue-400/20'}`}>
                    {req.market}
                  </span>
                  <span className="text-white font-bold text-lg">{req.ticker}</span>
                  <span className={`flex items-center gap-1.5 text-sm ${s.color}`}>
                    <SIcon size={14} className={req.status === 'PROCESSING' ? 'animate-spin' : ''} />
                    {s.label}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {format(new Date(req.createdAt), 'dd MMM HH:mm', { locale: tr })}
                </span>
              </div>

              {req.status === 'DONE' && req.result && (
                <div className="mt-3">
                  {selected === req.id ? (
                    <div className="mt-3 p-4 bg-white/5 rounded-lg prose prose-sm prose-invert max-w-none prose-headings:text-teal-400 prose-table:w-full prose-table:border-collapse prose-th:border prose-th:border-white/10 prose-th:p-3 prose-th:bg-white/5 prose-td:border prose-td:border-white/10 prose-td:p-3">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripJsonBlocks(req.result)}</ReactMarkdown>
                      <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xs mt-2">Gizle</button>
                    </div>
                  ) : (
                    <button onClick={() => setSelected(req.id)} className="text-teal-400 hover:text-teal-300 text-sm mt-1">
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
