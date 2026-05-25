import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

function ReturnCell({ value }) {
  if (value == null) return <span className="text-slate-500">—</span>
  if (value > 0) return <span className="text-green-400 font-medium">+{value}%</span>
  return <span className="text-red-400 font-medium">{value}%</span>
}

function PriceCell({ value, currency }) {
  if (value == null) return <span className="text-slate-500">—</span>
  return <span className="text-slate-200">{value.toFixed(2)} {currency}</span>
}

function alertRowStyle(alert) {
  if (!alert) return {};
  if (alert.newBias === 'AL') {
    return { background: 'rgba(34,197,94,0.08)', borderLeft: '3px solid #22c55e' };
  }
  if (alert.previousBias === 'AL' && (alert.newBias === 'BEKLE' || alert.newBias === 'SAT')) {
    return { background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b' };
  }
  return { background: 'rgba(249,115,22,0.08)', borderLeft: '3px solid #f97316' };
}

function AlertModal({ alert, onClose, onRead }) {
  const navigate = useNavigate()
  if (!alert) return null

  const handleConfirm = async () => {
    await onRead(alert.id)
    onClose()
  }

  const biasColor = {
    AL:    '#4ade80',
    SAT:   '#f87171',
    BEKLE: '#fbbf24',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 28, maxWidth: 480, width: '100%',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
        >
          <X size={18} />
        </button>

        <p style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>
          ⚡ {alert.ticker} — Karar Değişikliği
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            color: biasColor[alert.previousBias] || '#94a3b8',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          }}>{alert.previousBias}</span>
          <span style={{ color: '#64748b', fontSize: 16 }}>→</span>
          <span style={{
            padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700,
            color: biasColor[alert.newBias] || '#94a3b8',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          }}>{alert.newBias}</span>
        </div>

        {alert.summary && (
          <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>
            {alert.summary}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => navigate(`/reports/${alert.reportId}`)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
              color: '#2dd4bf', cursor: 'pointer',
            }}
          >
            Tam Raporu Gör
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#e2e8f0', cursor: 'pointer',
            }}
          >
            Tamam, Anladım
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Portfolio() {
  const [positions, setPositions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [activeTab, setActiveTab] = useState('BIST')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)

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

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/reports/alerts')
      setAlerts(res.data.alerts || [])
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    fetchData()
    fetchAlerts()
    const id = setInterval(fetchData, 60_000)
    return () => clearInterval(id)
  }, [fetchData, fetchAlerts])

  const markRead = async (alertId) => {
    try {
      await api.put(`/reports/alerts/${alertId}/read`)
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, isRead: true } : a))
    } catch {
      // non-blocking
    }
  }

  const removeFromPortfolio = async (reportId) => {
    try {
      await api.delete(`/reports/${reportId}/portfolio`)
      fetchData()
    } catch {
      alert('İşlem başarısız.')
    }
  }

  const saveEntry = async (reportId) => {
    const val = parseFloat(editValue)
    if (!val || val <= 0) return
    try {
      await api.put(`/reports/${reportId}/entry`, { entryPrice: val })
      setEditingId(null)
      fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  const filtered = positions.filter((p) => p.market === activeTab)

  const rowBgClass = (p) => {
    if (p.currentPrice != null && p.stopLoss != null && p.currentPrice < p.stopLoss) return 'bg-red-500/8'
    if (p.currentPrice != null && p.target1 != null && p.currentPrice >= p.target1) return 'bg-green-500/8'
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
                <tr className="text-xs text-slate-300 font-medium border-b border-white/5 bg-white/3">
                  <th className="text-left px-4 py-3">Hisse</th>
                  <th className="text-left px-4 py-3">Tarih</th>
                  <th className="text-left px-4 py-3">Karar</th>
                  <th className="text-right px-4 py-3">
                    <span className="text-teal-400">Giriş</span>
                    <span className="ml-1 text-teal-500 font-normal normal-case">✎</span>
                    <div className="text-teal-600 font-normal normal-case" style={{ fontSize: 10 }}>düzenle</div>
                  </th>
                  <th className="text-right px-4 py-3">Stop</th>
                  <th className="text-right px-4 py-3">H1 (Kısa)</th>
                  <th className="text-right px-4 py-3">H2 (Orta)</th>
                  <th className="text-right px-4 py-3">Yıl Sonu</th>
                  <th className="text-right px-4 py-3">Güncel</th>
                  <th className="text-right px-4 py-3">Getiri %</th>
                  <th className="text-right px-4 py-3">Bildirim</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const currency = p.market === 'BIST' ? 'TL' : '$'
                  const isEditing = editingId === p.reportId
                  const rowAlert = alerts.find((a) => a.ticker === p.ticker && a.market === p.market && !a.isRead)
                  return (
                    <tr
                      key={p.reportId}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rowAlert ? '' : rowBgClass(p)}`}
                      style={alertRowStyle(rowAlert)}
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

                      {/* Editable entry price */}
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEntry(p.reportId)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              style={{
                                width: 80, padding: '3px 6px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid #2dd4bf', borderRadius: 4,
                                color: 'white', fontSize: 12,
                              }}
                            />
                            <button
                              onClick={() => saveEntry(p.reportId)}
                              style={{ color: '#2dd4bf', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                            >✓</button>
                            <button
                              onClick={() => setEditingId(null)}
                              style={{ color: '#64748b', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                            >✗</button>
                          </div>
                        ) : (
                          <span
                            onClick={() => { setEditingId(p.reportId); setEditValue(p.effectiveEntry ?? '') }}
                            title="Tıkla ve gerçek alış fiyatını gir"
                            style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(45,212,191,0.4)', paddingBottom: 1 }}
                          >
                            {p.effectiveEntry != null
                              ? `${p.effectiveEntry.toFixed(2)} ${currency}`
                              : <span style={{ color: '#475569' }}>—</span>
                            }
                          </span>
                        )}
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
                        {p.yearEnd
                          ? <span style={{ color: '#2dd4bf' }}>{p.yearEnd}</span>
                          : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell value={p.currentPrice} currency={currency} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReturnCell value={p.returnPct} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {rowAlert ? (
                          <button
                            onClick={() => setSelectedAlert(rowAlert)}
                            style={{
                              background: 'rgba(245,158,11,0.15)',
                              border: '0.5px solid #f59e0b',
                              color: '#f59e0b',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 12,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🔔 Değişiklik
                          </button>
                        ) : (
                          <span className="text-slate-700">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeFromPortfolio(p.reportId)}
                          style={{
                            background: 'rgba(239,68,68,0.08)',
                            border: '0.5px solid rgba(239,68,68,0.3)',
                            color: '#ef4444',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Takibi Bırak
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertModal
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
        onRead={markRead}
      />
    </div>
  )
}
