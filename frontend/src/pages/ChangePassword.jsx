import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Circle, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const rules = [
  { label: 'En az 8 karakter', test: (p) => p.length >= 8 },
  { label: 'En az 1 büyük harf', test: (p) => /[A-Z]/.test(p) },
  { label: 'En az 1 rakam', test: (p) => /[0-9]/.test(p) },
]

export default function ChangePassword() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const allRulesMet = rules.every((r) => r.test(form.newPassword))
  const passwordsMatch = form.newPassword && form.newPassword === form.confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!allRulesMet) { setError('Şifre politikası gereksinimleri karşılanmıyor'); return }
    if (!passwordsMatch) { setError('Yeni şifreler eşleşmiyor'); return }

    setLoading(true)
    try {
      await api.put('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      await refreshUser()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 p-4">
      <div className="glass p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
            <Lock size={18} className="text-teal-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Şifrenizi Belirleyin</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6 ml-13">
          Hesabınıza ilk kez giriş yapıyorsunuz. Güvenliğiniz için lütfen yeni bir şifre belirleyin.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Geçici Şifre (e-postanıza gönderildi)</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Yeni Şifre</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={set('newPassword')}
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="bg-white/5 rounded-lg px-4 py-3 space-y-2">
            {rules.map((r) => {
              const ok = r.test(form.newPassword)
              return (
                <div key={r.label} className={`flex items-center gap-2 text-sm ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                  {ok
                    ? <CheckCircle size={14} className="shrink-0" />
                    : <Circle size={14} className="shrink-0" />}
                  {r.label}
                </div>
              )
            })}
            {form.confirmPassword && (
              <div className={`flex items-center gap-2 text-sm ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                {passwordsMatch
                  ? <CheckCircle size={14} className="shrink-0" />
                  : <Circle size={14} className="shrink-0" />}
                Şifreler eşleşiyor
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !allRulesMet || !passwordsMatch}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor...' : 'Şifremi Belirle ve Devam Et'}
          </button>
        </form>
      </div>
    </div>
  )
}
