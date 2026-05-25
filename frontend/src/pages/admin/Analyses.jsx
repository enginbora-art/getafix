import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../lib/api'

const STATUS_CONFIG = {
  PENDING:    { label: 'Bekliyor',    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  QUEUED:     { label: 'Kuyrukta',    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  PROCESSING: { label: 'İşleniyor',   color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  DONE:       { label: 'Tamamlandı',  color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  FAILED:     { label: 'Başarısız',   color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

function duration(createdAt, updatedAt, status) {
  if (!['DONE', 'FAILED'].includes(status)) return '—'
  const ms = new Date(updatedAt) - new Date(createdAt)
  if (ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}d ${s % 60}s` : `${s}s`
}

export default function AdminAnalyses() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ userId: '', market: '', status: '' })

  const { data: usersData = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analyses', page, filters],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 20 })
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.market) params.set('market', filters.market)
      if (filters.status) params.set('status', filters.status)
      return api.get(`/admin/analyses?${params}`).then((r) => r.data)
    },
    keepPreviousData: true,
  })

  const setFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }))
    setPage(1)
  }

  const selectCls = 'px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer'

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Manuel Analiz Geçmişi</h1>
        <p className="text-sm text-slate-500 mt-1">Tüm kullanıcıların manuel çalıştırdığı analizler</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select value={filters.userId} onChange={(e) => setFilter('userId', e.target.value)} className={selectCls}>
          <option value="">Tüm Kullanıcılar</option>
          {usersData.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <select value={filters.market} onChange={(e) => setFilter('market', e.target.value)} className={selectCls}>
          <option value="">Tüm Piyasalar</option>
          <option value="BIST">BIST</option>
          <option value="US">US</option>
        </select>

        <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={selectCls}>
          <option value="">Tüm Durumlar</option>
          <option value="DONE">Tamamlandı</option>
          <option value="FAILED">Başarısız</option>
          <option value="PROCESSING">İşleniyor</option>
          <option value="PENDING">Bekliyor</option>
          <option value="QUEUED">Kuyrukta</option>
        </select>

        {(filters.userId || filters.market || filters.status) && (
          <button
            onClick={() => { setFilters({ userId: '', market: '', status: '' }); setPage(1) }}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            Filtreleri Temizle
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-white/5 bg-white/3">
                    <th className="text-left px-4 py-3">Kullanıcı</th>
                    <th className="text-left px-4 py-3">Hisse</th>
                    <th className="text-left px-4 py-3">Piyasa</th>
                    <th className="text-left px-4 py-3">Senaryo</th>
                    <th className="text-left px-4 py-3">Durum</th>
                    <th className="text-left px-4 py-3">Süre</th>
                    <th className="text-left px-4 py-3">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-600 text-sm">
                        Kayıt bulunamadı
                      </td>
                    </tr>
                  )}
                  {data?.items?.map((item) => {
                    const s = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING
                    return (
                      <tr key={item.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-slate-200 font-medium">{item.user?.name ?? '—'}</p>
                          <p className="text-xs text-slate-500">{item.user?.email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-white">{item.ticker}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                            item.market === 'BIST'
                              ? 'text-teal-400 bg-teal-400/10 border-teal-400/20'
                              : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
                          }`}>
                            {item.market}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          {item.scenario ? (
                            <span
                              className="text-slate-400 text-xs cursor-default"
                              title={item.scenario}
                            >
                              {item.scenario.length > 50
                                ? item.scenario.slice(0, 50) + '…'
                                : item.scenario}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${s.color}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">
                          {duration(item.createdAt, item.updatedAt, item.status)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: tr })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">
                Toplam {data.total} kayıt · Sayfa {data.page} / {data.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 btn-secondary disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="p-1.5 btn-secondary disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
