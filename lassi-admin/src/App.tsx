/**
 * App.tsx — Routeur principal du dashboard admin LASSI.
 */
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ErrorBoundary       from './components/ErrorBoundary'
import Layout              from './components/Layout'
import LoginPage           from './pages/LoginPage'
import OverviewPage        from './pages/OverviewPage'
import TransactionsPage    from './pages/TransactionsPage'
import VipPage             from './pages/VipPage'
import ManualFeaturedPage  from './pages/ManualFeaturedPage'
import DisputesPage        from './pages/DisputesPage'
import DisputeDetailPage   from './pages/DisputeDetailPage'
import SignalementsPage    from './pages/SignalementsPage'
import UsersPage           from './pages/UsersPage'
import ShopsPage           from './pages/ShopsPage'
import BIPage              from './pages/BIPage'
import AvisPage            from './pages/AvisPage'

// ─── Garde de route ───────────────────────────────────────────────────────────

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg gap-3">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-xs">Vérification de la session…</p>
      </div>
    )
  }

  // Si pas admin → /login (AuthContext nettoie la session si elle est corrompue)
  return user?.isAdmin ? <>{children}</> : <Navigate to="/login" replace />
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<RequireAdmin><Layout /></RequireAdmin>}>
        <Route index              element={<OverviewPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="vip"          element={<VipPage />} />
        <Route path="featured"     element={<ManualFeaturedPage />} />
        <Route path="disputes"     element={<DisputesPage />} />
        <Route path="disputes/:id"   element={<DisputeDetailPage />} />
        <Route path="signalements"   element={<SignalementsPage />} />
        <Route path="users"        element={<UsersPage />} />
        <Route path="shops"        element={<ShopsPage />} />
        <Route path="bi"           element={<BIPage />} />
        <Route path="avis"         element={<AvisPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
