import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, TrendingUp, AlertCircle,
  Clock, Send, X, CheckCircle,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// ── Types ────────────────────────────────────────────────────────────────────

interface WaveSummary {
  total_collected:  number
  total_commission: number
  total_payouts:    number
  pending_payouts:  number
  count_collected:  number
  count_payouts:    number
  count_pending:    number
  count_initiated:  number
  count_failed:     number
}

interface WaveTransaction {
  id:               string
  created_at:       string
  statut:           string
  montant_total:    number
  commission_lassi: number
  prix_base:        number
  external_ref:     string | null
  type:             string | null
  client_name:      string | null
  prestataire_name: string | null
}

interface WavePayout {
  id:                string
  created_at:        string
  statut:            string
  montant:           number
  payment_intent_id: string
  attempts:          number
  last_error:        string | null
  prestataire_name:  string | null
}

interface WaveData {
  summary:      WaveSummary
  transactions: WaveTransaction[]
  payouts:      WavePayout[]
}

type UnifiedRow =
  | { kind: 'payment'; data: WaveTransaction }
  | { kind: 'payout';  data: WavePayout }

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString('fr-FR') + ' FCFA'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusBadge(statut: string, kind: 'payment' | 'payout') {
  if (kind === 'payment') {
    if (['confirmed', 'split_done'].includes(statut)) return { label: 'SUCCESS', cls: 'bg-green-500/10 text-green-400' }
    if (statut === 'failed')                          return { label: 'FAILED',  cls: 'bg-danger/10 text-danger' }
    if (statut === 'refunded')                        return { label: 'REFUNDED',cls: 'bg-blue-500/10 text-blue-400' }
    return { label: statut.toUpperCase(), cls: 'bg-yellow-500/10 text-yellow-400' }
  } else {
    if (statut === 'paid')    return { label: 'SUCCESS', cls: 'bg-green-500/10 text-green-400' }
    if (statut === 'failed')  return { label: 'FAILED',  cls: 'bg-danger/10 text-danger' }
    return { label: statut.toUpperCase(), cls: 'bg-yellow-500/10 text-yellow-400' }
  }
}

interface Toast { id: number; type: 'success' | 'error'; message: string }

// ── Composant ─────────────────────────────────────────────────────────────────

export default function WaveFinancePage() {
  const [data,    setData]    = useState<WaveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filter,  setFilter]  = useState<'all' | 'payment' | 'payout'>('all')
  const [days,    setDays]    = useState(30)

  // Payout manuel
  const [phone,       setPhone]       = useState('')
  const [amount,      setAmount]      = useState('')
  const [payoutName,  setPayoutName]  = useState('')
  const [reason,      setReason]      = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [paying,      setPaying]      = useState(false)
  const [toasts,      setToasts]      = useState<Toast[]>([])
  const toastId = useRef(0)

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('Session expirée')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/wave-finance?action=all&days=${days}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error((e as Record<string, string>).error ?? `Erreur ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 120_000)
    return () => clearInterval(id)
  }, [load])

  const handlePayout = async () => {
    setShowConfirm(false)
    setPaying(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('Session expirée')
      const res = await fetch(`${SUPABASE_URL}/functions/v1/wave-finance?action=payout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount: parseInt(amount), name: payoutName, reason }),
      })
      const json = await res.json()
      if (!res.ok || (json as Record<string, unknown>).error) throw new Error((json as Record<string, string>).error ?? `Erreur ${res.status}`)
      addToast('success', `Payout envoyé — ${fmt(parseInt(amount))} → +221${phone}`)
      setPhone(''); setAmount(''); setPayoutName(''); setReason('')
      load()
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setPaying(false)
    }
  }

  const validatePayout = () => {
    if (!/^7[05678][0-9]{7}$/.test(phone)) return 'Numéro invalide (ex: 771234567)'
    if (!amount || parseInt(amount) < 100)   return 'Montant minimum 100 FCFA'
    if (!payoutName.trim())                   return 'Nom du destinataire requis'
    return null
  }

  // Liste unifiée triée par date desc
  const unified = useMemo<UnifiedRow[]>(() => {
    const rows: UnifiedRow[] = [
      ...(data?.transactions ?? []).map(d => ({ kind: 'payment' as const, data: d })),
      ...(data?.payouts      ?? []).map(d => ({ kind: 'payout'  as const, data: d })),
    ]
    return rows.sort((a, b) =>
      new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
    )
  }, [data])

  const filtered = useMemo(() =>
    filter === 'all'     ? unified :
    filter === 'payment' ? unified.filter(r => r.kind === 'payment') :
                           unified.filter(r => r.kind === 'payout')
  , [unified, filter])

  const s = data?.summary

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Finance Wave</h1>
          <p className="text-sm text-muted mt-0.5">
            Transactions Wave production · données demo exclues
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === d ? 'bg-accent text-bg' : 'bg-surface border border-border text-muted hover:text-white'
              }`}
            >
              {d}j
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : s && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <ArrowDownLeft size={14} className="text-green-400" />
              Paiements reçus
            </div>
            <p className="text-xl font-bold text-green-400">+{fmt(s.total_collected)}</p>
            <p className="text-xs text-muted">
              {s.count_collected} confirmés
              {s.count_initiated > 0 && <span className="text-yellow-400 ml-1">· {s.count_initiated} en cours</span>}
              {s.count_failed > 0 && <span className="text-danger ml-1">· {s.count_failed} échoués</span>}
            </p>
          </div>
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <TrendingUp size={14} className="text-accent" />
              Commission LASSI
            </div>
            <p className="text-xl font-bold text-accent">{fmt(s.total_commission)}</p>
            <p className="text-xs text-muted">1–2% sur {s.count_collected} transactions</p>
          </div>
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <ArrowUpRight size={14} className="text-orange-400" />
              Reversements versés
            </div>
            <p className="text-xl font-bold text-orange-400">-{fmt(s.total_payouts)}</p>
            <p className="text-xs text-muted">{s.count_payouts} prestataires versés</p>
          </div>
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <Clock size={14} className="text-yellow-400" />
              Reversements en attente
            </div>
            <p className="text-xl font-bold text-yellow-400">{fmt(s.pending_payouts)}</p>
            <p className="text-xs text-muted">{s.count_pending} en file</p>
          </div>
        </div>
      )}

      {/* Payout manuel Wave */}
      <div className="rounded-xl bg-surface border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Send size={16} className="text-[#1DCDFE]" />
          <h2 className="font-semibold text-white text-sm">Payout manuel Wave</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Numéro Wave (+221)</label>
            <input
              type="tel"
              placeholder="77 123 45 67"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\s/g, ''))}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm placeholder-muted focus:outline-none focus:border-accent"
              maxLength={9}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Montant (FCFA)</label>
            <input
              type="number"
              placeholder="5 000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm placeholder-muted focus:outline-none focus:border-accent"
              min={100}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Nom destinataire</label>
            <input
              type="text"
              placeholder="Prénom Nom"
              value={payoutName}
              onChange={e => setPayoutName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Motif</label>
            <input
              type="text"
              placeholder="Reversement commande…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-white text-sm placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>
        <button
          disabled={paying}
          onClick={() => {
            const err = validatePayout()
            if (err) { addToast('error', err); return }
            setShowConfirm(true)
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1DCDFE] text-bg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Send size={14} />
          {paying ? 'Envoi en cours…' : 'Envoyer via Wave'}
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {([
          { key: 'all',     label: 'Toutes' },
          { key: 'payment', label: 'Paiements clients' },
          { key: 'payout',  label: 'Reversements prestataires' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-accent text-bg'
                : 'bg-surface border border-border text-muted hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table unifiée */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 text-muted font-medium">Date</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Type</th>
              <th className="text-left px-4 py-3 text-muted font-medium">N° Transaction</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Nom</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Montant</th>
              <th className="text-center px-4 py-3 text-muted font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted">
                  {loading ? 'Chargement…' : 'Aucune transaction Wave sur cette période'}
                </td>
              </tr>
            )}
            {filtered.map(row => {
              if (row.kind === 'payment') {
                const tx    = row.data
                const badge = statusBadge(tx.statut, 'payment')
                return (
                  <tr key={`p-${tx.id}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-muted">{fmtDate(tx.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-green-400">
                        <ArrowDownLeft size={14} />
                        Paiement client
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white">{tx.external_ref ?? '—'}</td>
                    <td className="px-4 py-3 text-muted">{tx.client_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">
                      +{fmt(tx.montant_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              } else {
                const pq    = row.data
                const badge = statusBadge(pq.statut, 'payout')
                return (
                  <tr key={`q-${pq.id}`} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 text-muted">{fmtDate(pq.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-orange-400">
                        <ArrowUpRight size={14} />
                        Reversement
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white">
                      {pq.payment_intent_id?.slice(0, 8) ?? '—'}…
                    </td>
                    <td className="px-4 py-3 text-muted">{pq.prestataire_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-400">
                      -{fmt(pq.montant)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                )
              }
            })}
          </tbody>
        </table>
      </div>

      {/* Modal confirmation payout */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Confirmer le payout Wave</h3>
              <button onClick={() => setShowConfirm(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 rounded-lg bg-bg border border-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Destinataire</span>
                <span className="text-white">{payoutName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Numéro</span>
                <span className="text-white font-mono">+221{phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Montant</span>
                <span className="text-[#1DCDFE] font-bold">{amount ? fmt(parseInt(amount)) : '—'}</span>
              </div>
              {reason && (
                <div className="flex justify-between">
                  <span className="text-muted">Motif</span>
                  <span className="text-white">{reason}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted">Cette action est irréversible. Vérifiez le numéro avant de confirmer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-border text-muted text-sm hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePayout}
                className="flex-1 py-2 rounded-lg bg-[#1DCDFE] text-bg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            t.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-danger/10 border border-danger/30 text-danger'
          }`}>
            {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
