import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, Shield, User } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import api from '../../lib/api'

function NewUserModal({ onClose }) {
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'USER' })
  const qc = useQueryClient()
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.post('/admin/users', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Yeni Kullanıcı</h3>
        <div className="space-y-3">
          {[['Ad Soyad', 'name', 'text'], ['Email', 'email', 'email'], ['Şifre', 'password', 'password']].map(([lbl, key, type]) => (
            <div key={key}>
              <label className="block text-sm text-slate-400 mb-1">{lbl}</label>
              <input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rol</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500">
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-sm">{error.response?.data?.error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 btn-secondary">İptal</button>
            <button onClick={() => mutate()} disabled={isPending} className="flex-1 btn-primary">
              {isPending ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => api.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  const del = useMutation({
    mutationFn: (id) => api.delete(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> Yeni Kullanıcı
        </button>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['Ad', 'Email', 'Rol', 'Durum', 'Kayıt', 'İşlem'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/3">
                <td className="px-4 py-3 text-sm text-slate-200 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => changeRole.mutate({ id: u.id, role: u.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                    className={`badge border gap-1 cursor-pointer ${u.role === 'ADMIN' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : 'text-slate-400 bg-white/5 border-white/10'}`}
                  >
                    {u.role === 'ADMIN' ? <Shield size={11} /> : <User size={11} />}
                    {u.role}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`badge border cursor-pointer ${u.isActive ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-slate-500 bg-white/5 border-white/10'}`}>
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {format(new Date(u.createdAt), 'dd MMM yyyy', { locale: tr })}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { if (confirm('Emin misiniz?')) del.mutate(u.id) }}
                    className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <NewUserModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
