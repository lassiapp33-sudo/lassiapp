/**
 * UsersPage — Gestion des utilisateurs (clients + marchands) avec recherche.
 */
import React, { useEffect, useState } from 'react'
import { Users, Search, Trash2, AlertTriangle, X } from 'lucide-react'
import Badge      from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import { supabase } from '../lib/supabase'
import { getProfiles, getUserStats, deleteUser, type AdminProfile } from '../services/users'

// ─── Modal de confirmation de suppression ─────────────────────────────────────

interface DeleteModalProps {
  user: AdminProfile
  onConfirm: (reason: string) => void
  onCancel:  () => void
  loading:   boolean
}

function DeleteModal({ user, onConfirm, onCancel, loading }: DeleteModalProps) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={20} />
            <span className="font-title font-bold text-base">Supprimer définitivement</span>
          </div>
          <button onClick={onCancel} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300 space-y-1">
            <p className="font-semibold">⚠ Cette action est irréversible</p>
            <p>Le compte de <span className="text-white font-medium">{user.name}</span> ({user.role === 'merchant' ? 'Prestataire' : 'Client'}) sera
            définitivement supprimé avec toutes ses données : commandes, boutique, dettes, favoris.</p>
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

        {/* Footer */}
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
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
            ) : (
              <Trash2 size={16} />
            )}
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
  const [roleFilter,  setRoleFilter]  = useState<'all' | 'client' | 'merchant'>('all')
  const [toDelete,    setToDelete]    = useState<AdminProfile | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    Promise.all([getProfiles(), getUserStats()])
      .then(([p, s]) => { setProfiles(p); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  // Realtime : reflète instantanément les inscriptions/suppressions de comptes
  // faites depuis l'app (table profiles), sans recharger la page.
  useEffect(() => {
    const channel = supabase
      .channel('admin:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = profiles.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search)
    const matchRole   = roleFilter === 'all' || p.role === roleFilter
    return matchSearch && matchRole
  })

  const handleDeleteConfirm = async (reason: string) => {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteUser(toDelete.id, reason)
      setToDelete(null)
      loadData()
    } catch (err: any) {
      setDeleteError(err.message ?? 'Erreur inconnue')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-title font-bold text-white">Utilisateurs</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total',        value: stats.totalUsers },
            { label: 'Clients',      value: stats.totalClients },
            { label: 'Prestataires', value: stats.totalMerchants },
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
          <table className="w-full"><tbody>{Array.from({length:6}).map((_,i)=><SkeletonRow key={i} cols={5}/>)}</tbody></table>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users size={48}/>} title="Aucun utilisateur" subtitle="Ils apparaîtront au fur et à mesure des inscriptions." />
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
                    {p.isAdmin && <span className="text-xs text-accent">🛡 Admin</span>}
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{p.phone}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.role as any} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
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
