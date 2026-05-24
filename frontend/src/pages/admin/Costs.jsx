import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { DollarSign, Zap, Activity, Hash } from 'lucide-react'
import api from '../../lib/api'

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-teal-600/20 border border-teal-500/30 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-teal-400" />
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1">{label}</p>
        <p className="text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function fmt(n) {
  return n == null ? '—' : `$${Number(n).toFixed(4)}`
}

function fmtTokens(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function Costs() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/costs')
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.error || 'Yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-400 text-sm p-6">{error}</p>
  }

  const { totals, byMarket, byUser, byDay } = data

  const bistMarket = byMarket.find((m) => m.market === 'BIST')
  const usMarket = byMarket.find((m) => m.market === 'US')

  const chartData = byDay.reduce((acc, row) => {
    const day = String(row.day).split('T')[0]
    const existing = acc.find((d) => d.day === day)
    if (existing) {
      existing[row.market] = Number(row.costUsd)
    } else {
      acc.push({ day, [row.market]: Number(row.costUsd) })
    }
    return acc
  }, [])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-white">Maliyet Takibi</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Toplam Maliyet" value={fmt(totals.costUsd)} sub="tüm zamanlar" />
        <StatCard icon={Hash} label="API Çağrısı" value={totals.callCount.toLocaleString()} sub="toplam" />
        <StatCard icon={Zap} label="Input Token" value={fmtTokens(totals.inputTokens)} />
        <StatCard icon={Activity} label="Output Token" value={fmtTokens(totals.outputTokens)} />
      </div>

      {/* BIST vs US */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'BIST', d: bistMarket },
          { label: 'US', d: usMarket },
        ].map(({ label, d }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-300 mb-3">{label} Market</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Maliyet</span>
                <span className="text-white font-medium">{fmt(d?._sum?.costUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Çağrı</span>
                <span className="text-white">{d?._count?.id?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Input</span>
                <span className="text-white">{fmtTokens(d?._sum?.inputTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Output</span>
                <span className="text-white">{fmtTokens(d?._sum?.outputTokens)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {chartData.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-300 mb-4">Son 30 Gün — Günlük Maliyet ($)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#94a3b8', fontSize: 11 }}
                formatter={(v, name) => [`$${Number(v).toFixed(4)}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Bar dataKey="BIST" fill="#0d9488" radius={[3, 3, 0, 0]} maxBarSize={24} />
              <Bar dataKey="US" fill="#185FA5" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-user table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <p className="text-sm font-semibold text-slate-300">Kullanıcı Bazlı Maliyet</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-white/5">
                <th className="text-left px-5 py-3">Kullanıcı</th>
                <th className="text-right px-4 py-3">Toplam Maliyet</th>
                <th className="text-right px-4 py-3">Çağrı</th>
                <th className="text-right px-4 py-3">Input</th>
                <th className="text-right px-4 py-3">Output</th>
              </tr>
            </thead>
            <tbody>
              {byUser.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-slate-200">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-teal-400">{fmt(u.totalCostUsd)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{Number(u.callCount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{fmtTokens(u.totalInputTokens)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">{fmtTokens(u.totalOutputTokens)}</td>
                </tr>
              ))}
              {byUser.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-600 text-sm">Henüz kayıt yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
