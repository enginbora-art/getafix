import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  if (!alert) return {}
  if (alert.newBias === 'AL') return { background: 'rgba(34,197,94,0.08)', borderLeft: '3px solid #22c55e' }
  if (alert.previousBias === 'AL' && (alert.newBias === 'BEKLE' || alert.newBias === 'SAT')) {
    return { background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b' }
  }
  return { background: 'rgba(249,115,22,0.08)', borderLeft: '3px solid #f97316' }
}

function Toast({ message, color, onClose }) {
  if (!message) return null
  const bg = color === 'green' ? 'rgba(22,163,74,0.95)' : 'rgba(220,38,38,0.95)'
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 12, zIndex: 9999,
      background: bg, color: '#fff',
      borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)', maxWidth: 'min(340px, calc(100vw - 24px))',
      display: 'flex', alignItems: 'center', gap: 10,
      border: '1px solid rgba(255,255,255,0.2)',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7, fontSize: 16 }}>×</button>
    </div>
  )
}

function AlertModal({ alert, onClose, onRead }) {
  const navigate = useNavigate()
  if (!alert) return null
  const handleConfirm = async () => { await onRead(alert.id); onClose() }
  const biasColor = { AL: '#4ade80', SAT: '#f87171', BEKLE: '#fbbf24' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxWidth: 480, width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        <p style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>⚡ {alert.ticker} — Karar Değişikliği</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: biasColor[alert.previousBias] || '#94a3b8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>{alert.previousBias}</span>
          <span style={{ color: '#64748b', fontSize: 16 }}>→</span>
          <span style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 700, color: biasColor[alert.newBias] || '#94a3b8', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>{alert.newBias}</span>
        </div>
        {alert.summary && <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 20 }}>{alert.summary}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => navigate(`/reports/${alert.reportId}`)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)', color: '#2dd4bf', cursor: 'pointer' }}>Tam Raporu Gör</button>
          <button onClick={handleConfirm} style={{ flex: 1, padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', cursor: 'pointer' }}>Tamam, Anladım</button>
        </div>
      </div>
    </div>
  )
}

function ReachBadge({ reachedH1, reachedH2, exitPrice, stopLoss }) {
  if (reachedH2) return <span style={{ background: 'rgba(45,212,191,0.15)', color: '#2dd4bf', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(45,212,191,0.3)', fontWeight: 600 }}>H2 ✓</span>
  if (reachedH1) return <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(74,222,128,0.3)', fontWeight: 600 }}>H1 ✓</span>
  if (stopLoss && exitPrice != null && exitPrice < stopLoss) return <span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>Stop</span>
  return <span style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '0.5px solid rgba(239,68,68,0.2)', fontWeight: 600 }}>Hedef Yok</span>
}

function PaginationBar({ page, totalPages, onPrev, onNext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
      <button
        onClick={onPrev}
        disabled={page <= 1}
        style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: page <= 1 ? '#334155' : '#94a3b8', opacity: page <= 1 ? 0.5 : 1 }}
      >← Önceki</button>
      <span style={{ fontSize: 12, color: '#64748b' }}>{page} / {totalPages}</span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: page >= totalPages ? '#334155' : '#94a3b8', opacity: page >= totalPages ? 0.5 : 1 }}
      >Sonraki →</button>
    </div>
  )
}

export default function Portfolio() {
  const [positionTab, setPositionTab] = useState('open')
  const [marketTab, setMarketTab] = useState('BIST')
  const [openPage, setOpenPage] = useState(1)
  const [closedPage, setClosedPage] = useState(1)
  const PER_PAGE = 10
  const [positions, setPositions] = useState([])
  const [closedPositions, setClosedPositions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [closedLoading, setClosedLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [closingId, setClosingId] = useState(null)
  const [closeValue, setCloseValue] = useState('')
  const [closeLoading, setCloseLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [closedStats, setClosedStats] = useState(null)
  const toastTimer = useRef(null)

  const showToast = (msg, color) => {
    setToast({ msg, color })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

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

  const fetchClosed = useCallback(async () => {
    setClosedLoading(true)
    try {
      const res = await api.get(`/reports/closed?limit=100&market=${marketTab}`)
      setClosedPositions(res.data.positions || [])
      setClosedStats(res.data.stats || null)
    } catch {
      // non-blocking
    } finally {
      setClosedLoading(false)
    }
  }, [marketTab])

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

  useEffect(() => {
    fetchClosed()
  }, [fetchClosed])

  const markRead = async (alertId) => {
    try {
      await api.put(`/reports/alerts/${alertId}/read`)
      setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, isRead: true } : a))
    } catch { /* non-blocking */ }
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

  const handleClosePosition = async (reportId, ticker) => {
    const val = parseFloat(closeValue)
    if (!val || val <= 0) return
    setCloseLoading(true)
    try {
      const res = await api.post(`/reports/${reportId}/close`, { exitPrice: val })
      setClosingId(null)
      setCloseValue('')
      fetchData()
      fetchClosed()
      const pct = res.data.profitLossPct
      if (pct != null) {
        const sign = pct >= 0 ? '+' : ''
        showToast(`${pct >= 0 ? '✓' : '✗'} ${ticker}: ${sign}${pct.toFixed(2)}% ${pct >= 0 ? 'kar' : 'zarar'} ile kapatıldı`, pct >= 0 ? 'green' : 'red')
      }
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.')
    } finally {
      setCloseLoading(false)
    }
  }

  const deleteClosedPosition = async (reportId) => {
    if (!window.confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return
    try {
      await api.delete(`/reports/${reportId}/closed-position`)
      fetchClosed()
    } catch {
      alert('Silme işlemi başarısız.')
    }
  }

  const openFiltered = positions.filter((p) => p.market === marketTab)
  const closedFiltered = closedPositions.filter((p) => p.market === marketTab)

  const openTotalPages = Math.max(1, Math.ceil(openFiltered.length / PER_PAGE))
  const closedTotalPages = Math.max(1, Math.ceil(closedFiltered.length / PER_PAGE))
  const pagedOpen = openFiltered.slice((openPage - 1) * PER_PAGE, openPage * PER_PAGE)
  const pagedClosed = closedFiltered.slice((closedPage - 1) * PER_PAGE, closedPage * PER_PAGE)

  const rowBgClass = (p) => {
    if (p.currentPrice != null && p.stopLoss != null && p.currentPrice < p.stopLoss) return 'bg-red-500/8'
    if (p.currentPrice != null && p.target1 != null && p.currentPrice >= p.target1) return 'bg-green-500/8'
    return ''
  }

  const avgReturnNum = closedStats ? parseFloat(closedStats.avgReturn) : 0

  const currency = marketTab === 'BIST' ? 'TL' : '$'

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Pozisyonlar</h1>
          <p className="text-sm text-slate-500 mt-1">Açık ve kapalı pozisyonlarınızı takip edin</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden sm:inline text-xs text-slate-500">Son güncelleme: {format(lastUpdated, 'HH:mm:ss')}</span>
          )}
          <button
            onClick={() => { fetchData(); fetchClosed() }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Yenile
          </button>
        </div>
      </div>

      {/* Position tabs */}
      <div className="flex items-center gap-2 mb-5">
        {[
          { key: 'open', label: `Açık Pozisyonlar (${positions.length})` },
          { key: 'closed', label: `Kapalı Pozisyonlar (${closedPositions.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setPositionTab(key); setOpenPage(1); setClosedPage(1) }}
            className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              positionTab === key
                ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
                : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Market tabs */}
      <div className="flex gap-2 mb-5">
        {['BIST', 'US'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setMarketTab(tab); setOpenPage(1); setClosedPage(1) }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              marketTab === tab
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-slate-400 hover:text-slate-200 border border-transparent hover:border-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {/* ── OPEN POSITIONS ─────────────────────────────────── */}
      {positionTab === 'open' && (
        loading && !positions.length ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : openFiltered.length === 0 ? (
          <div className="glass p-10 text-center text-slate-500 text-sm">
            Henüz takip edilen pozisyon yok. Rapor kartlarından "Takibe Al" ile ekleyin.
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 960 }}>
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
                  {pagedOpen.map((p) => {
                    const isEditing = editingId === p.reportId
                    const isClosingRow = closingId === p.reportId
                    const rowAlert = alerts.find((a) => a.ticker === p.ticker && a.market === p.market && !a.isRead)
                    const COLS = 12
                    return (
                      <React.Fragment key={p.reportId}>
                        <tr
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${rowAlert ? '' : rowBgClass(p)}`}
                          style={alertRowStyle(rowAlert)}
                        >
                          <td className="px-4 py-3"><span className="font-bold text-white">{p.ticker}</span></td>
                          <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(p.reportDate), 'd MMM', { locale: tr })}</td>
                          <td className="px-4 py-3"><BiasTag bias={p.bias} /></td>

                          {/* Editable entry price */}
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') saveEntry(p.reportId); if (e.key === 'Escape') setEditingId(null) }}
                                  style={{ width: 80, padding: '3px 6px', background: 'rgba(255,255,255,0.1)', border: '1px solid #2dd4bf', borderRadius: 4, color: 'white', fontSize: 12 }}
                                />
                                <button onClick={() => saveEntry(p.reportId)} style={{ color: '#2dd4bf', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>✓</button>
                                <button onClick={() => setEditingId(null)} style={{ color: '#64748b', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>✗</button>
                              </div>
                            ) : (
                              <span
                                onClick={() => { setEditingId(p.reportId); setEditValue(p.effectiveEntry ?? '') }}
                                title="Tıkla ve gerçek alış fiyatını gir"
                                style={{ cursor: 'pointer', borderBottom: '1px dashed rgba(45,212,191,0.4)', paddingBottom: 1 }}
                              >
                                {p.effectiveEntry != null ? `${p.effectiveEntry.toFixed(2)} ${currency}` : <span style={{ color: '#475569' }}>—</span>}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right"><PriceCell value={p.stopLoss} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.target1} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.target2} currency={currency} /></td>
                          <td className="px-4 py-3 text-right">
                            {p.yearEnd ? <span style={{ color: '#2dd4bf' }}>{p.yearEnd}</span> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.currentPrice} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><ReturnCell value={p.returnPct} /></td>
                          <td className="px-4 py-3 text-right">
                            {rowAlert ? (
                              <button
                                onClick={() => setSelectedAlert(rowAlert)}
                                style={{ background: 'rgba(245,158,11,0.15)', border: '0.5px solid #f59e0b', color: '#f59e0b', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                🔔 Değişiklik
                              </button>
                            ) : (
                              <span className="text-slate-700">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => { setClosingId(isClosingRow ? null : p.reportId); setCloseValue('') }}
                              style={{
                                background: isClosingRow ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                                border: `0.5px solid ${isClosingRow ? '#ef4444' : 'rgba(239,68,68,0.3)'}`,
                                color: '#ef4444', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              Pozisyonu Kapat
                            </button>
                          </td>
                        </tr>

                        {/* Inline close form */}
                        {isClosingRow && (
                          <tr className="border-b border-white/5 bg-slate-900/40">
                            <td colSpan={COLS} className="px-4 py-3">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>
                                  {p.ticker} pozisyonunu kapat
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Çıkış Fiyatı:</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={closeValue}
                                    onChange={(e) => setCloseValue(e.target.value)}
                                    autoFocus
                                    placeholder="0.00"
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleClosePosition(p.reportId, p.ticker); if (e.key === 'Escape') setClosingId(null) }}
                                    style={{ width: 100, padding: '4px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'white', fontSize: 13 }}
                                  />
                                  <span style={{ fontSize: 12, color: '#64748b' }}>{currency}</span>
                                </div>
                                <button
                                  onClick={() => handleClosePosition(p.reportId, p.ticker)}
                                  disabled={closeLoading || !closeValue}
                                  style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', opacity: closeLoading || !closeValue ? 0.5 : 1 }}
                                >
                                  {closeLoading ? 'Kapatılıyor...' : 'Pozisyonu Kapat'}
                                </button>
                                <button
                                  onClick={() => setClosingId(null)}
                                  style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}
                                >
                                  İptal
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Open pagination */}
      {positionTab === 'open' && openTotalPages > 1 && (
        <PaginationBar page={openPage} totalPages={openTotalPages} onPrev={() => setOpenPage(p => Math.max(1, p - 1))} onNext={() => setOpenPage(p => Math.min(openTotalPages, p + 1))} />
      )}

      {/* ── CLOSED POSITIONS ───────────────────────────────── */}
      {positionTab === 'closed' && (
        closedLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stats cards */}
            {closedStats && closedStats.totalCount > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
                {[
                  { label: 'Toplam İşlem', value: closedStats.totalCount },
                  { label: 'Başarı Oranı', value: `${closedStats.successRate}%` },
                  { label: 'Ort. Getiri', value: `${avgReturnNum >= 0 ? '+' : ''}${closedStats.avgReturn}%`, color: avgReturnNum >= 0 ? '#4ade80' : '#f87171' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, textAlign: 'center' }} className="p-2 sm:p-4">
                    <div style={{ color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }} className="text-[9px] sm:text-[11px]">{label}</div>
                    <div style={{ fontWeight: 700, color: color || '#e2e8f0' }} className="text-base sm:text-[22px]">{value}</div>
                  </div>
                ))}
              </div>
            )}

            {closedFiltered.length === 0 ? (
              <div className="glass p-10 text-center text-slate-500 text-sm">
                <p>Henüz kapatılmış pozisyon yok.</p>
                <p className="mt-1 text-slate-600 text-xs">Açık pozisyonlardan "Pozisyonu Kapat" ile işlem kapatın.</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 760 }}>
                    <thead>
                      <tr className="text-xs text-slate-300 font-medium border-b border-white/5 bg-white/3">
                        <th className="text-left px-4 py-3">Hisse</th>
                        <th className="text-left px-4 py-3">Karar</th>
                        <th className="text-right px-4 py-3">Giriş</th>
                        <th className="text-right px-4 py-3">Çıkış</th>
                        <th className="text-right px-4 py-3">H1</th>
                        <th className="text-right px-4 py-3">H2</th>
                        <th className="text-right px-4 py-3">Kar/Zarar</th>
                        <th className="text-center px-4 py-3">Ulaşılan</th>
                        <th className="text-right px-4 py-3">Tarih</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedClosed.map((p) => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3"><span className="font-bold text-white">{p.ticker}</span></td>
                          <td className="px-4 py-3"><BiasTag bias={p.bias} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.entryPrice} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.exitPrice} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.target1} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><PriceCell value={p.target2} currency={currency} /></td>
                          <td className="px-4 py-3 text-right"><ReturnCell value={p.profitLossPct} /></td>
                          <td className="px-4 py-3 text-center">
                            <ReachBadge reachedH1={p.reachedH1} reachedH2={p.reachedH2} exitPrice={p.exitPrice} stopLoss={p.stopLoss} />
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-400">
                            {p.exitDate ? format(new Date(p.exitDate), 'd MMM yy', { locale: tr }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => deleteClosedPosition(p.id)}
                              title="Kaydı sil"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 15, padding: '2px 6px', borderRadius: 4 }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
                            >🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Closed pagination */}
            {closedTotalPages > 1 && (
              <PaginationBar page={closedPage} totalPages={closedTotalPages} onPrev={() => setClosedPage(p => Math.max(1, p - 1))} onNext={() => setClosedPage(p => Math.min(closedTotalPages, p + 1))} />
            )}
          </>
        )
      )}

      <AlertModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} onRead={markRead} />
      <Toast message={toast?.msg} color={toast?.color} onClose={() => setToast(null)} />
    </div>
  )
}
