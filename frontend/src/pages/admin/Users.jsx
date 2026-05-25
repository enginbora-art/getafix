import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Trash2, Shield, User, X } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useAuth } from '../../context/AuthContext'
import api from '../../lib/api'

function formatLoginDate(dateStr) {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

function NewUserModal({ onClose }) {
  const [form, setForm] = useState({ email: '', name: '', role: 'USER' })
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
          {[['Ad Soyad', 'name', 'text'], ['Email', 'email', 'email']].map(([lbl, key, type]) => (
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
          <p className="text-xs text-slate-500 bg-white/5 rounded-lg px-3 py-2">
            Şifre otomatik oluşturulur ve kullanıcıya e-posta ile iletilir.
          </p>
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

function ManageModal({ targetUser, onClose }) {
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()
  const isSelf = currentUser?.id === targetUser.id

  const [selectedRole, setSelectedRole] = useState(targetUser.role)
  const [roleMsg, setRoleMsg] = useState(null)
  const [pwMsg, setPwMsg] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRoleUpdate = async () => {
    if (isSelf) return
    setRoleLoading(true)
    setRoleMsg(null)
    try {
      await api.patch(`/admin/users/${targetUser.id}`, { role: selectedRole })
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setRoleMsg({ type: 'ok', text: '✓ Rol güncellendi' })
      setTimeout(() => setRoleMsg(null), 2000)
    } catch (err) {
      setRoleMsg({ type: 'err', text: err.response?.data?.error || 'Hata oluştu' })
    } finally {
      setRoleLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setPwLoading(true)
    setPwMsg(null)
    try {
      await api.post(`/admin/users/${targetUser.id}/reset-password`)
      setPwMsg({ type: 'ok', text: '✓ Geçici şifre gönderildi' })
      setTimeout(() => setPwMsg(null), 3000)
    } catch (err) {
      setPwMsg({ type: 'err', text: err.response?.data?.error || 'Hata oluştu' })
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Kullanıcı Yönetimi — {targetUser.name}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">{targetUser.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors ml-4 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section 1 — Role */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-400">Rol</label>

          {isSelf && (
            <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
              Kendi rolünüzü değiştiremezsiniz.
            </p>
          )}

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            disabled={isSelf}
            className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <button
            onClick={handleRoleUpdate}
            disabled={isSelf || roleLoading || selectedRole === targetUser.role}
            className="w-full btn-primary py-2 text-sm disabled:opacity-40"
          >
            {roleLoading ? 'Kaydediliyor...' : 'Rolü Güncelle'}
          </button>

          {roleMsg && (
            <p className={`text-sm ${roleMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {roleMsg.text}
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="my-5 border-t border-white/10" />

        {/* Section 2 — Reset password */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-400">Şifre Sıfırlama</label>
          <p className="text-xs text-slate-500">
            Kullanıcıya yeni geçici şifre gönder. Giriş yaptığında şifre değiştirmesi istenir.
          </p>

          <button
            onClick={handleResetPassword}
            disabled={pwLoading}
            className="w-full py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            style={{
              background: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#fbbf24',
            }}
          >
            {pwLoading ? 'Gönderiliyor...' : 'Şifre Sıfırla ve Mail Gönder'}
          </button>

          {pwMsg && (
            <p className={`text-sm ${pwMsg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {pwMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const [showNewModal, setShowNewModal] = useState(false)
  const [manageTarget, setManageTarget] = useState(null)
  const qc = useQueryClient()

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/admin/users/${id}`, { isActive }),
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
        <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> Yeni Kullanıcı
        </button>
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              {['Ad', 'Email', 'Rol', 'Durum', 'Kayıt', 'İlk Giriş', 'Son Giriş', 'İşlem'].map((h) => (
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
                  <span className={`badge border gap-1 ${u.role === 'ADMIN' ? 'text-purple-400 bg-purple-400/10 border-purple-400/20' : 'text-slate-400 bg-white/5 border-white/10'}`}>
                    {u.role === 'ADMIN' ? <Shield size={11} /> : <User size={11} />}
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })}
                    className={`badge border cursor-pointer ${u.isActive ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-slate-500 bg-white/5 border-white/10'}`}
                  >
                    {u.isActive ? 'Aktif' : 'Pasif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {format(new Date(u.createdAt), 'dd MMM yyyy', { locale: tr })}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.firstLoginAt ? formatLoginDate(u.firstLoginAt) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {u.lastLoginAt ? formatLoginDate(u.lastLoginAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setManageTarget(u)}
                      style={{
                        color: '#2dd4bf', fontSize: 12, background: 'none',
                        border: '0.5px solid rgba(45,212,191,0.3)',
                        borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                      }}
                    >
                      Yönet
                    </button>
                    <button
                      onClick={() => { if (confirm('Emin misiniz?')) del.mutate(u.id) }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewModal && <NewUserModal onClose={() => setShowNewModal(false)} />}
      {manageTarget && (
        <ManageModal
          targetUser={manageTarget}
          onClose={() => setManageTarget(null)}
        />
      )}
    </div>
  )
}
