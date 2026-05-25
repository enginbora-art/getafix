import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle } from 'lucide-react'
import api from '../../lib/api'

function CriteriaRow({ item }) {
  const [value, setValue] = useState(item.configValue)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef(null)
  const qc = useQueryClient()

  useEffect(() => { setValue(item.configValue) }, [item.configValue])

  const { mutate } = useMutation({
    mutationFn: (v) => api.put(`/admin/criteria/${item.market}/${item.configKey}`, { configValue: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-criteria'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const handleChange = (e) => {
    const v = e.target.value
    setValue(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => mutate(v), 1000)
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-slate-200 text-sm font-medium">{item.label}</p>
        <p className="text-slate-600 text-xs font-mono">{item.configKey}</p>
      </div>
      <div className="flex items-center gap-2">
        {saved && <CheckCircle size={16} className="text-green-400" />}
        <input
          value={value}
          onChange={handleChange}
          className="w-28 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 text-sm text-right focus:outline-none focus:border-teal-500"
        />
      </div>
    </div>
  )
}

export default function AdminCriteria() {
  const [market, setMarket] = useState('BIST')

  const { data: criteria = [] } = useQuery({
    queryKey: ['admin-criteria'],
    queryFn: () => api.get('/admin/criteria').then((r) => r.data),
  })

  const filtered = criteria.filter((c) => c.market === market)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Kriter Düzenleyici</h1>
      <p className="text-slate-500 text-sm mb-6">Değişiklikler 1 saniye sonra otomatik kaydedilir.</p>

      <div className="flex gap-2 mb-6">
        {['BIST', 'US'].map((m) => (
          <button key={m} onClick={() => setMarket(m)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${market === m ? 'btn-primary' : 'btn-secondary'}`}>
            {m}
          </button>
        ))}
      </div>

      <div className="glass p-6 max-w-xl">
        {filtered.length === 0 ? (
          <p className="text-slate-500 text-center py-4">Kriter bulunamadı. Seed çalıştırıldı mı?</p>
        ) : (
          filtered.map((item) => <CriteriaRow key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
