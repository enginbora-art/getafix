import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

function BiasTag({ bias }) {
  if (!bias) return <span className="text-slate-500">—</span>
  const styles = {
    AL:    'bg-green-500/15 text-green-400 border-green-500/25',
    SAT:   'bg-red-500/15 text-red-400 border-red-500/25',
    BEKLE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[bias] || 'text-slate-400'}`}>
      {bias}
    </span>
  )
}

function ReturnCell({ value, alwaysTeal }) {
  if (value == null) return <span className="text-slate-500">—</span>
  if (alwaysTeal) return <span className="text-teal-400 font-medium">{value > 0 ? '+' : ''}{value}%</span>
  if (value > 0) return <span className="text-green-400 font-medium">+{value}%</span>
  return <span className="text-red-400 font-medium">{value}%</span>
}

function PriceCell({ value, currency }) {
  if (value == null) return <span className="text-slate-500">—</span>
  return <span className="text-slate-200">{value.toFixed(2)} {currency}</span>
}

export default function Portfolio() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [activeTab, setActiveTab] = useState('BIST')

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/reports/portfolio')
      setPositions(res.data.positions || [])
      setLastUpdated(new Date())
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 60_000)
    return () => clearInterval(id)
  }, [fetchData])

  const filtered = positions.filter((p) => p.market === activeTab)

  const rowBg = (p) => {
    if (p.currentPrice != null && p.stopLoss != null && p.currentPrice < p.stopLoss) {
      return 'bg-red-500/8'
    }
    if (p.currentPrice != null && p.target1 != null && p.currentPrice >= p.target1) {
      return 'bg-green-500/8'
    }
    return ''
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Genel Takip Tablosu</h1>
          <p className="text-sm text-slate-500 mt-1">Sistemin önerdiği hisseler ve güncel durumları</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Son güncelleme: {format(lastUpdated, 'HH:mm:ss')}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
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

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && !positions.length ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass p-10 text-center text-slate-500 text-sm">
          Henüz rapor bulunmuyor. İlk forecast çalıştığında burada görünecek.
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-white/5 bg-white/3">
                  <th className="text-left px-4 py-3">Hisse</th>
                  <th className="text-left px-4 py-3">Tarih</th>
                  <th className="text-left px-4 py-3">Karar</th>
                  <th className="text-right px-4 py-3">Giriş</th>
                  <th className="text-right px-4 py-3">Stop</th>
                  <th className="text-right px-4 py-3">H1 (Kısa)</th>
                  <th className="text-right px-4 py-3">H2 (Orta)</th>
                  <th className="text-right px-4 py-3">Güncel</th>
                  <th className="text-right px-4 py-3">Anlık Getiri</th>
                  <th className="text-right px-4 py-3">Potansiyel</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const currency = p.market === 'BIST' ? 'TL' : '$'
                  return (
                    <tr
                      key={p.ticker}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rowBg(p)}`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-white">{p.ticker}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {format(new Date(p.reportDate), 'd MMM', { locale: tr })}
                      </td>
                      <td className="px-4 py-3">
                        <BiasTag bias={p.bias} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.entryPrice} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.stopLoss} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.target1} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.target2} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.currentPrice} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReturnCell value={p.returnShort} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReturnCell value={p.returnVsT1} alwaysTeal />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
