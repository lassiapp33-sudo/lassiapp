/**
 * SecurityPage — Gestion des comptes bloqués (blocage progressif connexion).
 * Affiche les comptes temporairement ou définitivement bloqués.
 * L'admin peut débloquer n'importe quel compte via admin_unlock_account().
 */
import React, { useEffect, useState, useCallback } from 'react'
import { Shield, Unlock, RefreshCw, AlertTriangle, Clock } from 'lucide-react'
import EmptyState       from '../components/EmptyState'
import { SkeletonRow }  from '../components/Skeleton'
import { supabase }     from '../lib/supabase'

interface LockedAccount {
  phone:               string
  current_fails:       number
  lockout_cycle:       number
  locked_until:        string | null
  permanently_blocked: boolean
  blocked_at:          string | null
  updated_at:          string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeLeft(iso: string | null): string {
  if (!iso) return ''
  const diff = Math.max(0, new Date(iso).getTime() - Date.now())
  const min  = Math.ceil(diff / 60000)
  if (min <= 0) return 'Expiré'
  if (min < 60) return `${min} min`
  return `${Math.ceil(min / 60)} h`
}

export default function SecurityPage() {
  const [accounts, setAccounts] = useState<LockedAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcErr } = await supabase.rpc('admin_get_locked_accounts')
      if (rpcErr) throw rpcErr
      setAccounts((data as LockedAccount[]) ?? [])
    } catch (e: any) {
      setError(e?.message ?? 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleUnlock(phone: string) {
    if (!confirm(`Débloquer le compte ${phone} ?`)) return
    setUnlocking(phone)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_unlock_account', { p_phone: phone })
      if (rpcErr) throw rpcErr
      setAccounts(prev => prev.filter(a => a.phone !== phone))
    } catch (e: any) {
      alert(`Erreur : ${e?.message ?? 'Impossible de débloquer'}`)
    } finally {
      setUnlocking(null)
    }
  }

  const permanentCount  = accounts.filter(a => a.permanently_blocked).length
  const temporaryCount  = accounts.filter(a => !a.permanently_blocked && a.locked_until && new Date(a.locked_until) > new Date()).length
  const warnedCount     = accounts.filter(a => !a.permanently_blocked && !a.locked_until && a.current_fails > 0).length

  return (
    <div className="space-y-6">

      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="text-accent" size={22} />
          <div>
            <h1 className="text-white font-title text-xl font-bold">Sécurité — Comptes bloqués</h1>
            <p className="text-muted text-xs mt-0.5">
              3 échecs → 5 min · 6 échecs → 10 min · 9 échecs → 15 min · 12 échecs → blocage permanent
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-muted hover:text-white text-sm transition-colors"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-muted text-xs">Bloqués définitivement</p>
            <p className="text-white font-title text-lg font-bold">{permanentCount}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
            <Clock size={16} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-muted text-xs">Bloqués temporairement</p>
            <p className="text-white font-title text-lg font-bold">{temporaryCount}</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <Shield size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-muted text-xs">En cours d'avertissement</p>
            <p className="text-white font-title text-lg font-bold">{warnedCount}</p>
          </div>
        </div>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-white font-medium text-sm">
            {accounts.length} compte{accounts.length > 1 ? 's' : ''} avec activité de blocage
          </p>
        </div>

        {error && (
          <div className="p-6 text-center text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="divide-y divide-border">
            {[...Array(4)].map((_, i) => <SkeletonRow key={i} cols={5} />)}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Shield size={32} className="text-muted" />}
            title="Aucun compte bloqué"
            subtitle="Tous les comptes ont un accès normal."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg/40">
                <tr className="text-left text-muted text-xs uppercase tracking-wide">
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Cycle</th>
                  <th className="px-5 py-3">Échecs cycle</th>
                  <th className="px-5 py-3">Fin du blocage</th>
                  <th className="px-5 py-3">Bloqué le</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {accounts.map(acc => {
                  const isTemp    = !acc.permanently_blocked && acc.locked_until && new Date(acc.locked_until) > new Date()
                  const isPerm    = acc.permanently_blocked
                  const isWarned  = !isPerm && !isTemp && acc.current_fails > 0
                  return (
                    <tr key={acc.phone} className="hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-white font-medium font-mono text-xs">
                        {acc.phone}
                      </td>
                      <td className="px-5 py-3">
                        {isPerm ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                            <AlertTriangle size={10} />
                            Permanent
                          </span>
                        ) : isTemp ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                            <Clock size={10} />
                            Temporaire · {timeLeft(acc.locked_until)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
                            Averti
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted text-center">
                        {acc.lockout_cycle > 0 ? (
                          <span className="text-white font-mono">{acc.lockout_cycle}/4</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted text-center">
                        <span className="text-white font-mono">{acc.current_fails}/3</span>
                      </td>
                      <td className="px-5 py-3 text-muted text-xs">
                        {isTemp ? formatDate(acc.locked_until) : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted text-xs">
                        {formatDate(acc.blocked_at ?? acc.updated_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleUnlock(acc.phone)}
                          disabled={unlocking === acc.phone}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Unlock size={12} />
                          {unlocking === acc.phone ? '…' : 'Débloquer'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
