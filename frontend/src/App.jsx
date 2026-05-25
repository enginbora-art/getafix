import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Reports from './pages/Reports'
import Analysis from './pages/Analysis'
import ChangePassword from './pages/ChangePassword'
import Portfolio from './pages/Portfolio'
import AdminUsers from './pages/admin/Users'
import AdminAgents from './pages/admin/Agents'
import AdminCriteria from './pages/admin/Criteria'
import AdminCosts from './pages/admin/Costs'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<Reports />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/agents" element={<ProtectedRoute adminOnly><AdminAgents /></ProtectedRoute>} />
            <Route path="/admin/criteria" element={<ProtectedRoute adminOnly><AdminCriteria /></ProtectedRoute>} />
            <Route path="/admin/costs" element={<ProtectedRoute adminOnly><AdminCosts /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
