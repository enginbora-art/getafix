import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../../lib/api'

const AGENT_LABELS = {
  technical: 'Teknik Analist',
  fundamental: 'Temel Analist',
  sentiment: 'Sentiment Analisti',
  manager: 'Yönetici (Manager)',
}

function AgentEditor({ agent }) {
  const [prompt, setPrompt] = useState(agent.systemPrompt)
  const qc = useQueryClient()

  useEffect(() => { setPrompt(agent.systemPrompt) }, [agent.systemPrompt])

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () => api.put(`/admin/agents/${agent.market}/${agent.agentName}`, { systemPrompt: prompt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-agents'] }),
  })

  const isDirty = prompt !== agent.systemPrompt

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">{AGENT_LABELS[agent.agentName] || agent.agentName}</h3>
          {agent.updatedAt && (
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <Clock size={11} />
              {format(new Date(agent.updatedAt), 'dd MMM yyyy HH:mm', { locale: tr })}
              {agent.updatedBy && ` — ${agent.updatedBy}`}
            </p>
          )}
        </div>
        <button
          onClick={() => mutate()}
          disabled={isPending || !isDirty}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isDirty ? 'btn-primary' : 'btn-secondary opacity-40'}`}
        >
          <Save size={14} /> {isPending ? 'Kaydediliyor...' : isSuccess && !isDirty ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm font-mono focus:outline-none focus:border-teal-500 resize-y"
      />
    </div>
  )
}

export default function AdminAgents() {
  const [market, setMarket] = useState('BIST')

  const { data: agents = [] } = useQuery({
    queryKey: ['admin-agents'],
    queryFn: () => api.get('/admin/agents').then((r) => r.data),
  })

  const filtered = agents.filter((a) => a.market === market)

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Ajan Yapılandırması</h1>

      <div className="flex gap-2 mb-6">
        {['BIST', 'US'].map((m) => (
          <button key={m} onClick={() => setMarket(m)}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${market === m ? 'btn-primary' : 'btn-secondary'}`}>
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="glass p-8 text-center text-slate-500">
            <p>Ajan yapılandırması bulunamadı. Seed çalıştırıldı mı?</p>
          </div>
        )}
        {['technical', 'fundamental', 'sentiment', 'manager'].map((name) => {
          const agent = filtered.find((a) => a.agentName === name)
          return agent ? <AgentEditor key={agent.id} agent={agent} /> : null
        })}
      </div>
    </div>
  )
}
