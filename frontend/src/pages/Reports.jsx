import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Download, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import ReportCard from '../components/ReportCard'

function ReportDetail({ id }) {
  const navigate = useNavigate()
  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.get(`/reports/${id}`).then((r) => r.data),
  })

  const handlePdf = async () => {
    const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a'); a.href = url
    a.download = `getafix-report-${id.slice(0, 8)}.pdf`
    a.click(); URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="p-8 text-slate-400">Yükleniyor...</div>
  if (!report) return <div className="p-8 text-slate-400">Rapor bulunamadı</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} /> Rapora Dön
        </button>
        <button onClick={handlePdf} className="btn-secondary flex items-center gap-2 text-sm">
          <Download size={16} /> PDF İndir
        </button>
      </div>
      <div className="glass p-8 prose prose-invert max-w-none prose-headings:text-teal-400 prose-strong:text-white prose-code:text-teal-300">
        <ReactMarkdown>{report.content}</ReactMarkdown>
      </div>
    </div>
  )
}

function ReportList() {
  const [market, setMarket] = useState('BIST')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', market, page],
    queryFn: () => api.get(`/reports?market=${market}&limit=20&page=${page}`).then((r) => r.data),
  })

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Raporlar</h1>

      <div className="flex gap-2 mb-6">
        {['BIST', 'US'].map((m) => (
          <button
            key={m}
            onClick={() => { setMarket(m); setPage(1) }}
            className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors ${market === m ? 'btn-primary' : 'btn-secondary'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400">Yükleniyor...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data?.reports?.map((r) => <ReportCard key={r.id} report={r} />)}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary disabled:opacity-40">
                <ChevronLeft size={18} />
              </button>
              <span className="text-slate-400 text-sm">Sayfa {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary disabled:opacity-40">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Reports() {
  const { id } = useParams()
  return id ? <ReportDetail id={id} /> : <ReportList />
}
