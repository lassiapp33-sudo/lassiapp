/**
 * Sidebar — Navigation principale du dashboard admin LASSİ.
 * Affiche un badge rouge sur "Litiges" si des litiges ouverts existent.
 */
import React, { useEffect, useState } from 'react'
import { NavLink, useNavigate }        from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, Trophy, Star,
  AlertTriangle, Flag, Users, Store, Map, LogOut, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getOpenDisputesCount }      from '../services/disputes'
import { getNewSignalementsCount }   from '../services/signalements'

interface NavItem {
  to:    string
  icon:  React.ReactNode
  label: string
  badge?: number
}

export default function Sidebar() {
  const { user, signOut }  = useAuth()
  const navigate           = useNavigate()
  const [openDisputes,    setOpenDisputes]    = useState(0)
  const [newSignalements, setNewSignalements] = useState(0)

  function refreshSignalementsCount() {
    getNewSignalementsCount().then(setNewSignalements).catch(() => {})
  }

  useEffect(() => {
    getOpenDisputesCount().then(setOpenDisputes).catch(() => {})
    refreshSignalementsCount()

    const interval = setInterval(() => {
      getOpenDisputesCount().then(setOpenDisputes).catch(() => {})
      refreshSignalementsCount()
    }, 60_000)

    // Mise à jour immédiate du badge quand un statut change depuis SignalementsPage
    window.addEventListener('signalement-status-changed', refreshSignalementsCount)

    return () => {
      clearInterval(interval)
      window.removeEventListener('signalement-status-changed', refreshSignalementsCount)
    }
  }, [])

  const navItems: NavItem[] = [
    { to: '/',            icon: <LayoutDashboard size={18} />, label: 'Vue d\'ensemble' },
    { to: '/transactions', icon: <TrendingUp size={18} />,     label: 'GTV & Transactions' },
    { to: '/vip',          icon: <Trophy size={18} />,         label: 'Scoring VIP' },
    { to: '/featured',     icon: <Star size={18} />,           label: 'Mise en avant' },
    { to: '/disputes',     icon: <AlertTriangle size={18} />,  label: 'Litiges',        badge: openDisputes    || undefined },
    { to: '/signalements', icon: <Flag size={18} />,           label: 'Signalements',   badge: newSignalements || undefined },
    { to: '/users',        icon: <Users size={18} />,          label: 'Utilisateurs' },
    { to: '/shops',        icon: <Store size={18} />,          label: 'Commerces' },
    { to: '/avis',         icon: <MessageSquare size={18} />,  label: 'Avis clients' },
    { to: '/bi',           icon: <Map size={18} />,            label: 'BI par quartier' },
  ]

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-surface border-r border-border flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-title text-accent text-xl font-bold tracking-tight">LASSİ</span>
          <span className="text-xs text-muted bg-border px-2 py-0.5 rounded-full">Admin</span>
        </div>
        {user && (
          <p className="text-xs text-muted mt-1 truncate">{user.name}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="ml-auto bg-danger text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Déconnexion */}
      <div className="px-3 py-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted hover:text-danger hover:bg-danger/10 transition-colors w-full"
        >
          <LogOut size={18} />
          <span>Se déconnecter</span>
        </button>
      </div>
    </aside>
  )
}
