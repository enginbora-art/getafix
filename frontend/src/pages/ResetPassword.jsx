import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { TrendingUp, CheckCircle, Circle } from 'lucide-react'
import api from '../lib/api'

const rules = [
  { label: 'En az 8 karakter', test: (p) => p.length >= 8 },
  { label: 'En az 1 büyük harf', test: (p) => /[A-Z]/.test(p) },
  { label: 'En az 1 rakam', test: (p) => /[0-9]/.test(p) },
]

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) navigate('/login', { replace: true })
  }, [token, navigate])

  const allRulesMet = rules.every((r) => r.test(newPassword))
  const passwordsMatch = newPassword && newPassword === confirmPassword

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allRulesMet) { setError('Şifre politikası gereksinimleri karşılanmıyor'); return }
    if (!passwordsMatch) { setError('Şifreler eşleşmiyor'); return }

    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center shrink-0">
            <TrendingUp size={20} className="text-teal-400" />
          </div>
          <span className="text-2xl font-bold text-white">Getafix</span>
        </div>
        <p className="text-slate-500 text-sm mb-8 pl-[52px]">AI Destekli Borsa Forecast</p>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Yeni Şifre Belirle</h1>
          <p className="text-slate-400 text-sm mb-6">Yeni şifrenizi girin.</p>

          {success ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-4 text-green-400 text-sm">
              Şifreniz güncellendi! Giriş sayfasına yönlendiriliyorsunuz...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Şifre Tekrar</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Password policy */}
              <div className="bg-white/5 rounded-lg px-4 py-3 space-y-2">
                {rules.map((r) => {
                  const ok = r.test(newPassword)
                  return (
                    <div key={r.label} className={`flex items-center gap-2 text-sm ${ok ? 'text-green-400' : 'text-slate-500'}`}>
                      {ok ? <CheckCircle size={14} className="shrink-0" /> : <Circle size={14} className="shrink-0" />}
                      {r.label}
                    </div>
                  )
                })}
                {confirmPassword && (
                  <div className={`flex items-center gap-2 text-sm ${passwordsMatch ? 'text-green-400' : 'text-red-400'}`}>
                    {passwordsMatch ? <CheckCircle size={14} className="shrink-0" /> : <Circle size={14} className="shrink-0" />}
                    Şifreler eşleşiyor
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                  {error.includes('Geçersiz') && (
                    <div className="mt-2">
                      <Link to="/forgot-password" className="text-teal-400 hover:underline text-xs">
                        Yeni link için tıklayın →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !allRulesMet || !passwordsMatch}
                className="w-full btn-primary py-2.5 disabled:opacity-50"
              >
                {loading ? 'Kaydediliyor...' : 'Şifremi Güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
