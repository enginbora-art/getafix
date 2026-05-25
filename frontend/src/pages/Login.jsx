import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const cauldronStyles = `
  @keyframes bup  {0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.5);opacity:0}}
  @keyframes bup2 {0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.4);opacity:0}}
  @keyframes bup3 {0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.6);opacity:0}}
  @keyframes glow {0%,100%{opacity:.6}50%{opacity:1}}
  @keyframes wobble{0%,100%{transform:scaleX(1) scaleY(1)}50%{transform:scaleX(1.03) scaleY(.97)}}
  @keyframes tk   {0%{transform:translateY(0);opacity:0}10%{opacity:1}80%{opacity:.95}100%{transform:translateY(-210px);opacity:0}}
  .gla  { animation: glow    2s   ease-in-out infinite }
  .b1   { animation: bup     2.2s ease-in-out infinite;        transform-origin: 140px 232px }
  .b2   { animation: bup2    2.8s ease-in-out infinite  .5s;   transform-origin: 170px 228px }
  .b3   { animation: bup3    2s   ease-in-out infinite   1s;   transform-origin: 196px 233px }
  .b4   { animation: bup     2.4s ease-in-out infinite  .8s;   transform-origin: 155px 236px }
  .b5   { animation: bup2    1.9s ease-in-out infinite  1.4s;  transform-origin: 185px 230px }
  .liq  { animation: wobble  3s   ease-in-out infinite }
  .tk1  { animation: tk      5.5s ease-in-out infinite }
  .tk2  { animation: tk      5.5s ease-in-out infinite  1.8s }
  .tk3  { animation: tk      5.5s ease-in-out infinite  3.6s }
`

function Cauldron() {
  return (
    <>
      <style>{cauldronStyles}</style>
      <svg
        viewBox="0 0 340 480"
        width="300"
        height="430"
        style={{ overflow: 'visible' }}
      >
        {/* Ground shadow */}
        <ellipse cx="170" cy="462" rx="108" ry="16" fill="#000" opacity="0.45" />

        {/* LEFT LEG */}
        <path d="M108,388 Q98,412 92,448 Q100,455 112,450 Q120,415 126,390 Z" fill="#7A4E06" />
        <path d="M108,388 Q100,408 96,442" stroke="#5A3604" strokeWidth="1.5" fill="none" />
        <ellipse cx="102" cy="450" rx="16" ry="8" fill="#5A3604" />
        <ellipse cx="102" cy="449" rx="12" ry="5" fill="#7A5010" opacity="0.6" />

        {/* RIGHT LEG */}
        <path d="M232,388 Q242,412 248,448 Q240,455 228,450 Q220,415 214,390 Z" fill="#7A4E06" />
        <path d="M232,388 Q240,408 244,442" stroke="#5A3604" strokeWidth="1.5" fill="none" />
        <ellipse cx="238" cy="450" rx="16" ry="8" fill="#5A3604" />
        <ellipse cx="238" cy="449" rx="12" ry="5" fill="#7A5010" opacity="0.6" />

        {/* CENTER LEG */}
        <path d="M152,395 Q150,422 148,454 Q158,460 170,460 Q182,460 192,454 Q190,422 188,395 Z" fill="#8B5E08" />
        <ellipse cx="170" cy="458" rx="24" ry="9" fill="#5A3604" />
        <ellipse cx="170" cy="457" rx="18" ry="6" fill="#7A5010" opacity="0.6" />

        {/* CAULDRON BODY dark shadow */}
        <path d="M68,252 Q48,305 58,368 Q90,415 170,418 Q250,415 282,368 Q292,305 272,252 Q235,232 170,230 Q105,232 68,252 Z" fill="#5A3604" opacity="0.5" />

        {/* CAULDRON BODY main */}
        <path d="M72,248 Q52,303 62,368 Q95,410 170,412 Q245,410 278,368 Q288,303 268,248 Q232,228 170,226 Q108,228 72,248 Z" fill="#B87008" />

        {/* Left shading */}
        <path d="M72,252 Q53,305 62,365 Q82,400 120,410 Q88,396 72,360 Q58,308 70,258 Z" fill="#8B4E04" opacity="0.7" />

        {/* Center-left highlight */}
        <path d="M100,238 Q80,285 84,348 Q104,388 140,402 Q112,386 96,344 Q82,290 98,244 Z" fill="#D48C10" opacity="0.6" />
        <path d="M115,234 Q96,278 100,338 Q118,378 152,394 Q124,376 108,332 Q94,278 110,240 Z" fill="#E89C18" opacity="0.55" />

        {/* Bright specular highlight */}
        <ellipse cx="138" cy="250" rx="38" ry="22" fill="#F8C038" opacity="0.35" transform="rotate(-18,138,250)" />
        <ellipse cx="128" cy="242" rx="20" ry="12" fill="#FFD060" opacity="0.3" transform="rotate(-22,128,242)" />

        {/* Right side shadow */}
        <path d="M268,252 Q286,305 278,365 Q258,400 220,410 Q252,396 268,360 Q282,308 270,258 Z" fill="#5A3604" opacity="0.55" />

        {/* Bottom highlight band */}
        <path d="M90,375 Q130,408 170,410 Q210,408 250,375 Q220,395 170,396 Q120,395 90,375 Z" fill="#E89018" opacity="0.3" />

        {/* THICK RIM */}
        <ellipse cx="170" cy="230" rx="100" ry="30" fill="#A06808" />
        <ellipse cx="170" cy="230" rx="100" ry="30" fill="none" stroke="#7A4E06" strokeWidth="2" />
        <ellipse cx="170" cy="224" rx="95" ry="26" fill="#C88010" />
        <ellipse cx="160" cy="218" rx="70" ry="18" fill="#E8A020" opacity="0.6" />
        <ellipse cx="148" cy="214" rx="42" ry="11" fill="#F8C040" opacity="0.5" />
        <ellipse cx="170" cy="236" rx="86" ry="22" fill="#7A5010" />
        <ellipse cx="170" cy="238" rx="82" ry="20" fill="#4A3008" />

        {/* INSIDE glowing liquid */}
        <ellipse cx="170" cy="238" rx="82" ry="20" fill="#0d1f12" />
        <ellipse cx="170" cy="238" rx="78" ry="17" fill="#0d5c35" className="gla" />
        <ellipse cx="170" cy="236" rx="72" ry="14" fill="#1D9E75" className="gla" />
        <ellipse cx="170" cy="234" rx="64" ry="11" fill="#2dd4bf" className="liq" opacity="0.85" />
        <ellipse cx="155" cy="231" rx="30" ry="6" fill="#5ff0d0" opacity="0.3" className="gla" />

        {/* BUBBLES */}
        <circle cx="140" cy="232" r="7" fill="#1D9E75" className="b1" />
        <circle cx="170" cy="228" r="10" fill="#2dd4bf" className="b2" />
        <circle cx="196" cy="233" r="6" fill="#5DCAA5" className="b3" />
        <circle cx="155" cy="236" r="5" fill="#0F6E56" className="b4" />
        <circle cx="185" cy="230" r="8" fill="#1D9E75" className="b5" />
        <circle cx="168" cy="225" r="3" fill="white" opacity="0.5" className="b2" />
        <circle cx="140" cy="230" r="2" fill="white" opacity="0.4" className="b1" />

        {/* TICKER tags */}
        <g transform="translate(148,222)">
          <g className="tk1">
            <rect x="-28" y="-10" width="56" height="22" rx="6" fill="#1D9E75" opacity="0.95" />
            <rect x="-28" y="-10" width="56" height="22" rx="6" fill="none" stroke="#2dd4bf" strokeWidth="0.5" opacity="0.6" />
            <text x="0" y="6" textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">THYAO</text>
          </g>
        </g>
        <g transform="translate(178,218)">
          <g className="tk2">
            <rect x="-24" y="-10" width="48" height="22" rx="6" fill="#185FA5" opacity="0.95" />
            <rect x="-24" y="-10" width="48" height="22" rx="6" fill="none" stroke="#378ADD" strokeWidth="0.5" opacity="0.6" />
            <text x="0" y="6" textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">NVDA</text>
          </g>
        </g>
        <g transform="translate(158,220)">
          <g className="tk3">
            <rect x="-26" y="-10" width="52" height="22" rx="6" fill="#0F6E56" opacity="0.95" />
            <rect x="-26" y="-10" width="52" height="22" rx="6" fill="none" stroke="#1D9E75" strokeWidth="0.5" opacity="0.6" />
            <text x="0" y="6" textAnchor="middle" fill="white" fontSize="11" fontFamily="monospace" fontWeight="bold">ASTOR</text>
          </g>
        </g>

        {/* Sparkles */}
        <path d="M55,285 L57,279 L59,285 L65,287 L59,289 L57,295 L55,289 L49,287 Z" fill="#F8C040" opacity="0.7" className="gla" />
        <path d="M288,310 L290,304 L292,310 L298,312 L292,314 L290,320 L288,314 L282,312 Z" fill="#F8C040" opacity="0.7" className="gla" />
        <path d="M62,355 L64,350 L66,355 L71,357 L66,359 L64,364 L62,359 L57,357 Z" fill="#2dd4bf" opacity="0.6" className="gla" />
        <path d="M278,255 L280,250 L282,255 L287,257 L282,259 L280,264 L278,259 L273,257 Z" fill="#2dd4bf" opacity="0.6" className="gla" />
      </svg>
      <p style={{ color: 'white', fontSize: '13px', textAlign: 'center', marginTop: '1.5rem', opacity: 0.7 }}>
        Piyasanın sihirli formülü
      </p>
    </>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş başarısız')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-[#0a0f1e]">
      {/* LEFT — Cauldron */}
      <div
        className="flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-white/5 py-10 sm:py-0"
        style={{ flex: '0 0 55%' }}
      >
        <Cauldron />
      </div>

      {/* RIGHT — Login form */}
      <div
        className="flex flex-col items-center justify-center px-6 py-12 sm:py-0"
        style={{ flex: '0 0 45%' }}
      >
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="text-teal-400" />
            </div>
            <span className="text-2xl font-bold text-white">Getafix</span>
          </div>
          <p className="text-slate-500 text-sm mb-8 pl-[52px]">AI Destekli Borsa Forecast</p>

          {/* Form */}
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-400">Şifre</label>
                <a href="/forgot-password" style={{ color: '#2dd4bf', fontSize: 12, textDecoration: 'none' }}>
                  Şifremi unuttum
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-700 mt-8">
            Getafix — Yatırım tavsiyesi değildir. Karar destek aracıdır.
          </p>
        </div>
      </div>
    </div>
  )
}
