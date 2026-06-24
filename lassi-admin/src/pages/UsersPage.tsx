/**
 * UsersPage — Gestion des utilisateurs (clients + prestataires).
 * Synchronisation temps réel via Supabase Realtime (table profiles).
 * Suppression via Edge Function admin-delete-user (service_role).
 */
import React, { useEffect, useRef, useState } from 'react'
import { Users, Search, Trash2, AlertTriangle, X, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import Badge      from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import { supabase } from '../lib/supabase'
import { getProfiles, getUserStats, deleteUser, type AdminProfile } from '../services/users'

// ─── Modal de confirmation de suppression ────────────────────────────────────

interface DeleteModalProps {
  user:      AdminProfile
  onConfirm: (reason: string) => void
  onCancel:  () => void
  loading:   boolean
}

function DeleteModal({ user, onConfirm, onCancel, loading }: DeleteModalProps) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <span className="font-title font-bold text-base">Supprimer définitivement</span>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300 space-y-1">
            <p className="font-semibold">⚠ Cette action est irréversible</p>
            <p>
              Le compte de <span className="text-white font-medium">{user.name}</span>{' '}
              ({user.role === 'merchant' ? 'Prestataire' : 'Client'}) sera définitivement supprimé
              avec toutes ses données : commandes, boutique, dettes, favoris.
            </p>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Raison de la suppression</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex : violation des CGU, compte frauduleux…"
              rows={3}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-400 placeholder-muted"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-muted hover:text-white hover:border-white/30 transition-colors text-sm font-medium"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason || 'Aucune raison fournie')}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              : <Trash2 size={16} />}
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function UsersPage() {
  const [profiles,    setProfiles]    = useState<AdminProfile[]>([])
  const [stats,       setStats]       = useState<any>(null)
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [roleFilter,  setRoleFilter]  = useState<'all' | 'client' | 'merchant'>('all')
  const [toDelete,    setToDelete]    = useState<AdminProfile | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [realtimeOk,  setRealtimeOk]  = useState<boolean | null>(null)
  const [lastSync,    setLastSync]    = useState<Date | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setSyncing(true)
    try {
      const [p, s] = await Promise.all([getProfiles(), getUserStats()])
      setProfiles(p)
      setStats(s)
      setLastSync(new Date())
    } catch (err) {
      console.error('[UsersPage] loadData:', err)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // ── Realtime : reflète instantanément les inscriptions/suppressions ──────────
  useEffect(() => {
    const channel = supabase
      .channel('admin:profiles:sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          // Mise à jour optimiste selon le type d'événement
          if (payload.eventType === 'INSERT') {
            const newProfile = payload.new as any
            setProfiles(prev => {
              if (prev.some(p => p.id === newProfile.id)) return prev
              return [{
                id:        newProfile.id,
                name:      newProfile.name ?? 'Utilisateur',
                phone:     newProfile.phone ?? '',
                email:     newProfile.email ?? null,
                role:      newProfile.role ?? 'client',
                isAdmin:   newProfile.is_admin ?? false,
                avatarUrl: newProfile.avatar_url ?? null,
                createdAt: newProfile.created_at ?? new Date().toISOString(),
              }, ...prev]
            })
            // Rafraîchir les stats aussi
            getUserStats().then(setStats).catch(() => {})
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id
            setProfiles(prev => prev.filter(p => p.id !== deletedId))
            getUserStats().then(setStats).catch(() => {})
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any
            setProfiles(prev => prev.map(p => p.id === updated.id ? {
              ...p,
              name:      updated.name ?? p.name,
              phone:     updated.phone ?? p.phone,
              email:     updated.email ?? p.email,
              role:      updated.role ?? p.role,
              isAdmin:   updated.is_admin ?? p.isAdmin,
              avatarUrl: updated.avatar_url ?? p.avatarUrl,
            } : p))
          }
          setLastSync(new Date())
        },
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [])

  const filtered = profiles.filter(p => {
    const q          = search.toLowerCase()
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.phone.includes(q)
    const matchRole   = roleFilter === 'all' || p.role === roleFilter
    return matchSearch && matchRole
  })

  const handleDeleteConfirm = async (reason: string) => {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteUser(toDelete.id, reason)
      // Mise à jour optimiste : retire immédiatement de la liste
      setProfiles(prev => prev.filter(p => p.id !== toDelete.id))
      getUserStats().then(setStats).catch(() => {})
      setToDelete(null)
    } catch (err: any) {
      setDeleteError(err.message ?? 'Erreur inconnue')
    } finally {
      setDeleting(false)
    }
  }

  const handleManualSync = () => loadData(true)

  const formatLastSync = () => {
    if (!lastSync) return null
    const diff = Math.floor((Date.now() - lastSync.getTime()) / 1000)
    if (diff < 10)  return 'à l\'instant'
    if (diff < 60)  return `il y a ${diff}s`
    if (diff < 120) return 'il y a 1 min'
    return `il y a ${Math.floor(diff / 60)} min`
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Utilisateurs</h1>
          <p className="text-muted text-xs mt-0.5">
            Les inscriptions et suppressions depuis l'app apparaissent automatiquement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Indicateur realtime */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
            realtimeOk === true
              ? 'bg-success/10 border-success/30 text-success'
              : realtimeOk === false
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-border border-border text-muted'
          }`}>
            {realtimeOk === true
              ? <><Wifi size={12} /> Temps réel actif</>
              : realtimeOk === false
                ? <><WifiOff size={12} /> Hors ligne</>
                : <><span className="w-2 h-2 rounded-full bg-muted animate-pulse" /> Connexion…</>}
          </div>
          {/* Bouton sync manuel */}
          <button
            onClick={handleManualSync}
            disabled={syncing || loading}
            title="Synchroniser manuellement"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted hover:text-white hover:border-muted text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sync…' : 'Actualiser'}
          </button>
        </div>
      </div>

      {/* Dernière sync */}
      {lastSync && (
        <p className="text-muted text-xs -mt-3">
          Dernière mise à jour : {formatLastSync()}
        </p>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total',         value: stats.totalUsers },
            { label: 'Clients',       value: stats.totalClients },
            { label: 'Prestataires',  value: stats.totalMerchants },
            { label: 'Nouveaux (7j)', value: stats.newThisWeek },
          ].map(s => (
            <div key={s.label} className="bg-surface border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-title font-bold text-white">{s.value}</p>
              <p className="text-muted text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom ou téléphone…"
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(['all', 'client', 'merchant'] as const).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                roleFilter === r ? 'bg-accent text-bg' : 'text-muted hover:text-white'
              }`}
            >
              {r === 'all' ? 'Tous' : r === 'client' ? 'Clients' : 'Prestataires'}
            </button>
          ))}
        </div>
        <span className="text-muted text-xs ml-auto">
          {filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Erreur de suppression */}
      {deleteError && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="ml-4 text-red-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={48} />}
            title="Aucun utilisateur"
            subtitle={search ? 'Aucun résultat pour cette recherche.' : 'Les nouvelles inscriptions apparaîtront ici automatiquement.'}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Téléphone</th>
                <th className="px-4 py-3 text-center">Rôle</th>
                <th className="px-4 py-3 text-left">Inscription</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{p.name}</p>
                    {p.email && <p className="text-muted text-xs">{p.email}</p>}
                    {p.isAdmin && <span className="text-xs text-accent">🛡 Admin</span>}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.role as any} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(p.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isAdmin ? (
                      <span className="text-xs text-muted italic">Protégé</span>
                    ) : (
                      <button
                        onClick={() => { setDeleteError(null); setToDelete(p) }}
                        title="Supprimer définitivement"
                        className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal suppression */}
      {toDelete && (
        <DeleteModal
          user={toDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { setToDelete(null); setDeleteError(null) }}
          loading={deleting}
        />
      )}
    </div>
  )
}
