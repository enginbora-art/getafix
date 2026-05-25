import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Eye, TrendingUp, Shield, AlertTriangle, Loader2, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../lib/api'

const RISK_CONFIG = {
  'Düşük':  { label: 'Düşük Risk',  color: 'text-green-400 bg-green-400/10 border-green-400/20',  Icon: Shield },
  'Orta':   { label: 'Orta Risk',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', Icon: TrendingUp },
  'Yüksek': { label: 'Yüksek Risk', color: 'text-red-400 bg-red-400/10 border-red-400/20',         Icon: AlertTriangle },
  'Low':    { label: 'Low Risk',    color: 'text-green-400 bg-green-400/10 border-green-400/20',  Icon: Shield },
  'Medium': { label: 'Medium Risk', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', Icon: TrendingUp },
  'High':   { label: 'High Risk',   color: 'text-red-400 bg-red-400/10 border-red-400/20',         Icon: AlertTriangle },
}

export default function ReportCard({ report }) {
  const navigate = useNavigate()
  const [dlState, setDlState] = useState(null) // null | 'loading' | 'done'
  const risk = RISK_CONFIG[report.riskLevel] || RISK_CONFIG['Orta']
  const RiskIcon = risk.Icon

  const handlePdf = async (e) => {
    e.stopPropagation()
    if (dlState === 'loading') return
    setDlState('loading')
    try {
      const res = await api.get(`/reports/${report.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `getafix-${report.market}-${report.id.slice(0, 8)}.pdf`
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
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={`badge border font-bold ${report.market === 'BIST' ? 'text-teal-400 bg-teal-400/10 border-teal-400/20' : 'text-blue-400 bg-blue-400/10 border-blue-400/20'}`}>
            {report.market}
          </span>
          {report.isClosing && (
            <span className="badge border text-amber-400 bg-amber-400/10 border-amber-400/20">Kapanış</span>
          )}
          {report.type === 'MANUAL' && (
            <span className="badge border text-indigo-400 bg-indigo-400/10 border-indigo-400/20">Manuel</span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {format(new Date(report.createdAt || report.date), 'dd MMM yyyy', { locale: tr })}
        </span>
      </div>

      {report.ticker && (
        <div className="text-center py-1">
          <span className="text-xl font-bold text-teal-400 tracking-wider">{report.ticker}</span>
        </div>
      )}

      {(report.entryLow || report.stopLoss || report.targetShort) && (
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {report.entryLow && (
            <div className="glass rounded-lg p-1.5">
              <p className="text-xs text-slate-500 mb-0.5">Giriş</p>
              <p className="text-xs font-semibold text-slate-200">
                {report.entryLow}{report.entryHigh ? `–${report.entryHigh}` : ''}
              </p>
            </div>
          )}
          {report.stopLoss && (
            <div className="glass rounded-lg p-1.5">
              <p className="text-xs text-slate-500 mb-0.5">Stop</p>
              <p className="text-xs font-semibold text-red-400">{report.stopLoss}</p>
            </div>
          )}
          {report.targetShort && (
            <div className="glass rounded-lg p-1.5">
              <p className="text-xs text-slate-500 mb-0.5">Hedef</p>
              <p className="text-xs font-semibold text-green-400">{report.targetShort}</p>
            </div>
          )}
        </div>
      )}

      {report.riskLevel && (
        <div className={`badge border self-start gap-1 ${risk.color}`}>
          <RiskIcon size={11} /> {risk.label}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => navigate(`/reports/${report.id}`)}
          className="flex-1 flex items-center justify-center gap-1.5 btn-secondary text-sm py-1.5"
        >
          <Eye size={14} /> Tam Rapor
        </button>
        <button
          onClick={handlePdf}
          disabled={dlState === 'loading'}
          className={`flex items-center gap-1.5 btn-secondary text-sm py-1.5 px-3 disabled:opacity-60 transition-colors ${
            dlState === 'done' ? 'text-green-400 border-green-500/30' : ''
          }`}
        >
          {dlState === 'loading' ? (
            <><Loader2 size={14} className="animate-spin" /> İndiriliyor...</>
          ) : dlState === 'done' ? (
            <><CheckCircle size={14} /> İndirildi</>
          ) : (
            <><Download size={14} /> PDF</>
          )}
        </button>
      </div>
    </div>
  )
}
