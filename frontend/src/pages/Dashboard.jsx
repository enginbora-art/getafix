import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

function MarketStatus({ status }) {
  const isOpen = status?.isOpen ?? false
  const reason = status?.reason ?? null
  const session = status?.session ?? null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOpen ? '#22c55e' : '#475569', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: isOpen ? '#22c55e' : '#94a3b8', fontWeight: 500 }}>
          {isOpen ? 'Borsa Açık' : 'Borsa Kapalı'}
        </span>
      </div>
      {reason && !session && (
        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2, marginLeft: 14 }}>{reason}</div>
      )}
      {session === 'premarket' && (
        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2, marginLeft: 14 }}>Pre-market</div>
      )}
      {session === 'afterhours' && (
        <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 2, marginLeft: 14 }}>After-hours</div>
      )}
      {session === 'night' && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, marginLeft: 14 }}>Gece piyasası</div>
      )}
    </div>
  )
}

function extractBias(content) {
  const m = content?.match(/##\s*⚡\s*KARAR:\s*(AL|SAT|BEKLE)/i)
  return m?.[1] || null
}

const BIAS_COLOR = { AL: '#22c55e', SAT: '#ef4444', BEKLE: '#f59e0b' }

function MiniReportCard({ report, label, onClick }) {
  const data = report.jsonData || {}
  const ticker = report.ticker || data.ticker || '—'
  const bias = extractBias(report.content)
  const isUS = report.market === 'US'
  const cur = isUS ? '$' : ''
  const entryLow = report.entryLow ?? data.entry_low
  const entryHigh = report.entryHigh ?? data.entry_high
  const stop = report.stopLoss ?? data.stop_loss
  const target = report.targetShort ?? data.target_short_low
  const color = BIAS_COLOR[bias] || '#64748b'

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
    >
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 6, letterSpacing: '-0.02em' }}>{ticker}</div>
      {bias && (
        <div style={{
          display: 'inline-flex', alignItems: 'center',
          background: color + '22', color, border: `1px solid ${color}44`,
          borderRadius: 4, fontSize: 11, fontWeight: 700,
          padding: '2px 8px', marginBottom: 10,
        }}>
          {bias}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: 13 }}>
        {entryLow != null && entryHigh != null && (
          <>
            <span style={{ color: '#64748b' }}>Giriş</span>
            <span style={{ color: '#cbd5e1' }}>{cur}{entryLow}–{cur}{entryHigh}</span>
          </>
        )}
        {stop != null && (
          <>
            <span style={{ color: '#64748b' }}>Stop</span>
            <span style={{ color: '#f87171' }}>{cur}{stop}</span>
          </>
        )}
        {target != null && (
          <>
            <span style={{ color: '#64748b' }}>Hedef</span>
            <span style={{ color: '#4ade80' }}>{cur}{target}</span>
          </>
        )}
      </div>
      {report.type === 'MANUAL' && (
        <div style={{ marginTop: 8, fontSize: 10, color: '#818cf8', background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: 3, display: 'inline-block' }}>
          Manuel Analiz
        </div>
      )}
    </div>
  )
}

function MarketPanel({ title, reports, marketStatus, market }) {
  const navigate = useNavigate()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <MarketStatus status={marketStatus} />
      </div>
      {reports.length > 0 ? (
        <div style={{
          background: 'rgba(15,23,42,0.5)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {reports.slice(0, 2).map((report, i) => (
              <MiniReportCard
                key={report.id}
                report={report}
                label={`${i + 1}. Seçim`}
                onClick={() => navigate(`/reports/${report.id}`)}
              />
            ))}
          </div>
          {reports.length > 0 && (
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <span
                onClick={() => navigate(`/reports?market=${market}`)}
                style={{ fontSize: 12, color: '#2dd4bf', cursor: 'pointer', opacity: 0.8 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
              >
                Tüm raporlar →
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="glass p-8 text-center text-slate-500">
          <p>Henüz {market} raporu bulunmuyor</p>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { data: bistData } = useQuery({
    queryKey: ['reports', 'BIST'],
    queryFn: () => api.get('/reports?market=BIST&limit=2&type=SCHEDULED').then((r) => r.data),
  })
  const { data: usData } = useQuery({
    queryKey: ['reports', 'US'],
    queryFn: () => api.get('/reports?market=US&limit=2&type=SCHEDULED').then((r) => r.data),
  })
  const { data: marketStatus } = useQuery({
    queryKey: ['market-status'],
    queryFn: () => api.get('/health/market-status').then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const bistReports = bistData?.reports || []
  const usReports = usData?.reports || []

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Günlük Öneri</h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
            <Clock size={14} />
            {format(new Date(), "dd MMMM yyyy, HH:mm", { locale: tr })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarketPanel
          title="BIST Son Öneri"
          reports={bistReports}
          marketStatus={marketStatus?.bist}
          market="BIST"
        />
        <MarketPanel
          title="US Son Öneri"
          reports={usReports}
          marketStatus={marketStatus?.us}
          market="US"
        />
      </div>
    </div>
  )
}
