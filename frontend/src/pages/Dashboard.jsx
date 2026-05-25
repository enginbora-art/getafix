import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Clock, Circle } from 'lucide-react'
import api from '../lib/api'
import ReportCard from '../components/ReportCard'

function MarketStatus({ market }) {
  const now = new Date()
  const hour = now.getUTCHours()
  const min = now.getUTCMinutes()
  const day = now.getDay()
  const isWeekday = day >= 1 && day <= 5
  const timeVal = hour * 60 + min

  let isOpen = false
  if (market === 'BIST' && isWeekday) {
    isOpen = timeVal >= 7 * 60 + 0 && timeVal < 15 * 60 + 0  // 10:00-18:00 TR = 07:00-15:00 UTC
  } else if (market === 'US' && isWeekday) {
    isOpen = timeVal >= 13 * 60 + 30 && timeVal < 20 * 60 + 0  // 9:30-16:00 ET = 13:30-20:00 UTC
  }

  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${isOpen ? 'text-green-400' : 'text-slate-500'}`}>
      <Circle size={8} fill="currentColor" />
      {isOpen ? 'Borsa Açık' : 'Borsa Kapalı'}
    </span>
  )
}

export default function Dashboard() {
  const { data: bistData } = useQuery({
    queryKey: ['reports', 'BIST'],
    queryFn: () => api.get('/reports?market=BIST&limit=1').then((r) => r.data),
  })
  const { data: usData } = useQuery({
    queryKey: ['reports', 'US'],
    queryFn: () => api.get('/reports?market=US&limit=1').then((r) => r.data),
  })

  const bistReport = bistData?.reports?.[0]
  const usReport = usData?.reports?.[0]

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
            <Clock size={14} />
            {format(new Date(), "dd MMMM yyyy, HH:mm", { locale: tr })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BIST Panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">BIST Son Öneri</h2>
              {bistReport?.type === 'MANUAL' && (
                <span style={{
                  background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  border: '0.5px solid rgba(99,102,241,0.3)', fontWeight: 500,
                }}>Manuel Analiz</span>
              )}
            </div>
            <MarketStatus market="BIST" />
          </div>
          {bistReport ? (
            <ReportCard report={bistReport} />
          ) : (
            <div className="glass p-8 text-center text-slate-500">
              <p>Henüz BIST raporu bulunmuyor</p>
            </div>
          )}
        </div>

        {/* US Panel */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">US Son Öneri</h2>
              {usReport?.type === 'MANUAL' && (
                <span style={{
                  background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  border: '0.5px solid rgba(99,102,241,0.3)', fontWeight: 500,
                }}>Manuel Analiz</span>
              )}
            </div>
            <MarketStatus market="US" />
          </div>
          {usReport ? (
            <ReportCard report={usReport} />
          ) : (
            <div className="glass p-8 text-center text-slate-500">
              <p>Henüz US raporu bulunmuyor</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
