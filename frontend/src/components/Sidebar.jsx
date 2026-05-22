import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Search, Users, Bot, SlidersHorizontal, LogOut, TrendingUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItem = (to, Icon, label) => (
  <NavLink
    key={to}
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-teal-600/20 text-teal-400 border border-teal-500/30'
          : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
      }`
    }
  >
    <Icon size={18} />
    {label}
  </NavLink>
)

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="w-64 min-h-screen flex flex-col bg-navy-800 border-r border-white/5">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-2">
          <TrendingUp size={22} className="text-teal-400" />
          <span className="text-xl font-bold text-white">Getafix</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">AI Market Forecast</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItem('/dashboard', LayoutDashboard, 'Dashboard')}
        {navItem('/reports', FileText, 'Raporlar')}
        {navItem('/analysis', Search, 'Manuel Analiz')}

        {user?.role === 'ADMIN' && (
          <>
            <div className="my-3 border-t border-white/5" />
            <p className="px-3 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Admin</p>
            {navItem('/admin/users', Users, 'Kullanıcılar')}
            {navItem('/admin/agents', Bot, 'Ajan Yapılandırması')}
            {navItem('/admin/criteria', SlidersHorizontal, 'Kriter Düzenleyici')}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors">
          <LogOut size={16} /> Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
