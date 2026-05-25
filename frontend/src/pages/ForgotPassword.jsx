import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import api from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

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
          <h1 className="text-xl font-bold text-white mb-1">Şifremi Unuttum</h1>
          <p className="text-slate-400 text-sm mb-6">
            Email adresinizi girin, sıfırlama bağlantısı gönderelim.
          </p>

          {success ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-4 text-green-400 text-sm">
              Mail gönderildi. Gelen kutunuzu kontrol edin.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="email@example.com"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full btn-primary py-2.5 disabled:opacity-50"
              >
                {loading ? 'Gönderiliyor...' : 'Bağlantı Gönder'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-white/5">
            <Link
              to="/login"
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-400 transition-colors"
            >
              <ArrowLeft size={14} /> Girişe Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
