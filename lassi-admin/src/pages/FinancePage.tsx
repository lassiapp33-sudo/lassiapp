import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, TrendingUp, AlertCircle,
  Send, X, CheckCircle,
} from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface OmTransaction {
  transactionId:  string
  type:           'MERCHANT_PAYMENT' | 'CASHIN'
  status:         string
  amount:         { value: number; unit: string }
  createdAt:      string
  customer?:      { id: string; idType: string }
  partner?:       { id: string; idType: string }
  reference?:     string
  channel?:       string
}

interface FinanceData {
  balance:     number
  msisdn:      string
  name:        string
  barred:      string
  suspended:   string
  transactions: OmTransaction[]
  summary: {
    total_income:   number
    total_payouts:  number
    net_commission: number
    count_income:   number
    count_payouts:  number
  }
}

function formatFcfa(v: number) {
  return v.toLocaleString('fr-FR') + ' FCFA'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Toast { id: number; type: 'success' | 'error'; message: string }

export default function FinancePage() {
  const [data,    setData]    = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [filter,  setFilter]  = useState<'all' | 'MERCHANT_PAYMENT' | 'CASHIN'>('all')

  // Cash-Out
  const [recipient,     setRecipient]     = useState('')
  const [amount,        setAmount]        = useState('')
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [transferring,  setTransferring]  = useState(false)
  const [toasts,        setToasts]        = useState<Toast[]>([])
  const toastId = useRef(0)

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const validateForm = () => {
    if (!/^7[05678][0-9]{7}$/.test(recipient)) return 'Numéro invalide (ex: 771234567)'
    if (!amount || parseInt(amount) < 100)       return 'Montant minimum 100 FCFA'
    return null
  }

  const handleTransfer = async () => {
    setShowConfirm(false)
    setTransferring(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('Session expirée')

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/om-finance?action=transfer&recipient=${encodeURIComponent(recipient)}&amount=${encodeURIComponent(amount)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${jwt}` } }
      )
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? `Erreur ${res.status}`)

      addToast('success', `Transfert réussi — ${formatFcfa(parseInt(amount))} envoyés au ${recipient}`)
      setRecipient('')
      setAmount('')
      load() // rafraîchir le solde
    } catch (e) {
      addToast('error', e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setTransferring(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token
      if (!jwt) throw new Error('Session expirée')

      const res = await fetch(`${SUPABASE_URL}/functions/v1/om-finance?action=all&size=100`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error ?? `Erreur ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Rafraîchissement auto toutes les 2 min
  useEffect(() => {
    const id = setInterval(load, 120_000)
    return () => clearInterval(id)
  }, [load])

  const txList = (data?.transactions ?? []).filter(t =>
    filter === 'all' ? true : t.type === filter
  )

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Finance Orange Money</h1>
          <p className="text-sm text-muted mt-0.5">Compte LASSI · {data?.msisdn ?? '770926843'}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border text-sm text-muted hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Cartes solde + résumé */}
      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Solde */}
          <div className="col-span-2 md:col-span-1 rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <Wallet size={14} />
              Solde actuel
            </div>
            <p className="text-2xl font-bold text-accent">{formatFcfa(data.balance)}</p>
            <p className="text-xs text-muted">{data.name}</p>
            {data.barred !== 'No' && (
              <span className="text-xs text-danger">Compte barré</span>
            )}
          </div>

          {/* Entrées */}
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <ArrowDownLeft size={14} className="text-green-400" />
              Paiements reçus
            </div>
            <p className="text-xl font-bold text-green-400">
              +{formatFcfa(data.summary.total_income)}
            </p>
            <p className="text-xs text-muted">{data.summary.count_income} transactions</p>
          </div>

          {/* Sorties */}
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <ArrowUpRight size={14} className="text-orange-400" />
              Reversements prestataires
            </div>
            <p className="text-xl font-bold text-orange-400">
              -{formatFcfa(data.summary.total_payouts)}
            </p>
            <p className="text-xs text-muted">{data.summary.count_payouts} cashins</p>
          </div>

          {/* Commission nette */}
          <div className="rounded-xl bg-surface border border-border p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted text-xs">
              <TrendingUp size={14} className="text-accent" />
              Commission nette LASSI
            </div>
            <p className="text-xl font-bold text-accent">
              {formatFcfa(data.summary.net_commission)}
            </p>
            <p className="text-xs text-muted">sur {data.summary.count_income} commandes</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        {([
          { key: 'all',              label: 'Toutes' },
          { key: 'MERCHANT_PAYMENT', label: 'Paiements clients' },
          { key: 'CASHIN',           label: 'Reversements prestataires' },
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

      {/* Section Cash-Out */}
      <div className="rounded-xl bg-surface border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Send size={16} className="text-accent" />
          <h2 className="font-semibold text-white text-sm">Transfert d'argent (Cash-Out)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Numéro destinataire (OM)</label>
            <input
              type="tel"
              placeholder="77 123 45 67"
              value={recipient}
              onChange={e => setRecipient(e.target.value.replace(/\s/g, ''))}
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
        </div>
        <button
          disabled={transferring}
          onClick={() => {
            const err = validateForm()
            if (err) { addToast('error', err); return }
            setShowConfirm(true)
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-bg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Send size={14} />
          {transferring ? 'Transfert en cours…' : 'Transférer les fonds'}
        </button>
      </div>

      {/* Modal confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Confirmer le transfert</h3>
              <button onClick={() => setShowConfirm(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 rounded-lg bg-bg border border-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Destinataire</span>
                <span className="text-white font-mono">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Montant</span>
                <span className="text-accent font-bold">{formatFcfa(parseInt(amount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Depuis</span>
                <span className="text-white">Compte LASSI · {data?.msisdn ?? '770926843'}</span>
              </div>
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
                onClick={handleTransfer}
                className="flex-1 py-2 rounded-lg bg-accent text-bg text-sm font-semibold hover:opacity-90 transition-opacity"
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
          <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right ${
            t.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-danger/10 border border-danger/30 text-danger'
          }`}>
            {t.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {t.message}
          </div>
        ))}
      </div>

      {/* Table transactions */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="text-left px-4 py-3 text-muted font-medium">Date</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Type</th>
              <th className="text-left px-4 py-3 text-muted font-medium">N° Transaction</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Numéro</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Montant</th>
              <th className="text-center px-4 py-3 text-muted font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {txList.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-muted">
                  {loading ? 'Chargement…' : 'Aucune transaction'}
                </td>
              </tr>
            )}
            {txList.map(tx => {
              const isMp     = tx.type === 'MERCHANT_PAYMENT'
              const phone    = isMp ? tx.customer?.id : tx.customer?.id
              const amount   = tx.amount?.value ?? 0
              const success  = tx.status === 'SUCCESS'
              return (
                <tr key={tx.transactionId} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 text-muted">{formatDate(tx.createdAt)}</td>
                  <td className="px-4 py-3">
                    {isMp ? (
                      <span className="flex items-center gap-1.5 text-green-400">
                        <ArrowDownLeft size={14} />
                        Paiement client
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-orange-400">
                        <ArrowUpRight size={14} />
                        Reversement
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-white">
                    {tx.transactionId}
                  </td>
                  <td className="px-4 py-3 text-muted">{phone ?? '—'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isMp ? 'text-green-400' : 'text-orange-400'}`}>
                    {isMp ? '+' : '-'}{formatFcfa(amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      success ? 'bg-green-500/10 text-green-400' : 'bg-danger/10 text-danger'
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
