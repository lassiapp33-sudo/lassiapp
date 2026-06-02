/**
 * SignalementsPage — Liste et gestion des signalements utilisateurs.
 * Filtres par statut et type. Détail inline avec changement de statut.
 */
import React, { useEffect, useState } from 'react'
import { Flag, X, ExternalLink }      from 'lucide-react'
import { SkeletonRow }                from '../components/Skeleton'
import {
  getSignalements, updateSignalementStatus, getSignedScreenshotUrl,
  TYPE_LABELS, STATUS_LABELS, STATUS_COLORS,
  type Signalement, type SignalementStatus, type SignalementType,
} from '../services/signalements'

// ─── Filtres ─────────────────────────────────────────────────────────────────

type StatusFilter = SignalementStatus | 'all'
type TypeFilter   = SignalementType   | 'all'

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all',      label: 'Tous' },
  { key: 'nouveau',  label: 'Nouveaux' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'resolu',   label: 'Résolus' },
]

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: 'all',      label: 'Tous les types' },
  { key: 'bug',      label: 'Bug' },
  { key: 'paiement', label: 'Paiement' },
  { key: 'commande', label: 'Commande' },
  { key: 'commerce', label: 'Commerçant/Client' },
  { key: 'arnaque',  label: 'Arnaque' },
  { key: 'autre',    label: 'Autre' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

// ─── Composant détail (modal inline) ─────────────────────────────────────────

function SignalementDetail({
  sig,
  onClose,
  onStatusChange,
}: {
  sig:            Signalement
  onClose:        () => void
  onStatusChange: (id: string, s: SignalementStatus) => void
}) {
  const [saving,       setSaving]       = useState(false)
  const [feedback,     setFeedback]     = useState<string | null>(null)
  const [signedUrl,    setSignedUrl]    = useState<string | null>(null)
  const [loadingUrl,   setLoadingUrl]   = useState(false)

  async function changeStatus(status: SignalementStatus) {
    setSaving(true)
    setFeedback(null)
    try {
      await updateSignalementStatus(sig.id, status)
      onStatusChange(sig.id, status)
      setFeedback('Statut mis à jour.')
    } catch (e: any) {
      setFeedback(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header modal */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-white font-title font-semibold text-lg">Signalement</h2>
            <p className="text-muted text-xs mt-0.5">{fmtDate(sig.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Qui */}
          <div className="flex gap-6">
            <div>
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Utilisateur</p>
              <p className="text-white text-sm font-medium">{sig.userName ?? 'Inconnu'}</p>
              <p className="text-muted text-xs mt-0.5">{sig.profil}</p>
            </div>
            <div>
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Type</p>
              <p className="text-white text-sm">{TYPE_LABELS[sig.type]}</p>
            </div>
            <div>
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Statut</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[sig.status]}`}>
                {STATUS_LABELS[sig.status]}
              </span>
            </div>
          </div>

          {/* Contexte */}
          {(sig.relatedOrderId || sig.shopName) && (
            <div className="bg-bg/40 border border-border/50 rounded-lg p-3">
              <p className="text-muted text-xs uppercase tracking-wider mb-1">Élément concerné</p>
              {sig.shopName      && <p className="text-accent text-sm">Commerce : {sig.shopName}</p>}
              {sig.relatedOrderId && <p className="text-muted text-xs mt-0.5">Commande : {sig.relatedOrderId}</p>}
            </div>
          )}

          {/* Description */}
          <div>
            <p className="text-muted text-xs uppercase tracking-wider mb-2">Description</p>
            <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap bg-bg/40 border border-border/50 rounded-lg p-3">
              {sig.description}
            </p>
          </div>

          {/* Capture — bucket privé → signed URL générée à la demande */}
          {sig.screenshotUrl && (
            <div>
              <p className="text-muted text-xs uppercase tracking-wider mb-2">Capture d'écran</p>
              {signedUrl ? (
                <a href={signedUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-accent text-sm hover:underline">
                  <ExternalLink size={14} />
                  Ouvrir la capture (lien valable 1h)
                </a>
              ) : (
                <button
                  onClick={async () => {
                    setLoadingUrl(true)
                    const url = await getSignedScreenshotUrl(sig.screenshotUrl!)
                    setSignedUrl(url)
                    setLoadingUrl(false)
                  }}
                  disabled={loadingUrl}
                  className="inline-flex items-center gap-2 text-accent text-sm hover:underline disabled:opacity-50"
                >
                  <ExternalLink size={14} />
                  {loadingUrl ? 'Chargement…' : 'Voir la capture'}
                </button>
              )}
            </div>
          )}

          {/* Actions statut */}
          <div>
            <p className="text-muted text-xs uppercase tracking-wider mb-3">Changer le statut</p>
            <div className="flex gap-2 flex-wrap">
              {(['nouveau', 'en_cours', 'resolu'] as SignalementStatus[]).map(st => (
                <button
                  key={st}
                  onClick={() => changeStatus(st)}
                  disabled={saving || sig.status === st}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sig.status === st
                      ? 'bg-accent/10 text-accent border border-accent/30 cursor-default'
                      : 'bg-surface border border-border text-muted hover:text-white hover:border-white/30'
                  }`}
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
            {feedback && (
              <p className="text-success text-xs mt-2">{feedback}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState<Signalement[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>('all')
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<Signalement | null>(null)

  function load() {
    setLoading(true)
    getSignalements(statusFilter, typeFilter)
      .then(setSignalements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter, typeFilter])

  const nouveauCount = signalements.filter(s => s.status === 'nouveau').length

  function handleStatusChange(id: string, status: SignalementStatus) {
    setSignalements(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Titre */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-title font-bold text-white">Signalements</h1>
        {nouveauCount > 0 && (
          <span className="bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {nouveauCount} nouveau{nouveauCount > 1 ? 'x' : ''}
          </span>
        )}
      </div>

      {/* Filtres statut */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              statusFilter === f.key ? 'bg-accent text-bg' : 'text-muted hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtre type */}
      <select
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value as TypeFilter)}
        className="bg-surface border border-border text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
      >
        {TYPE_FILTERS.map(f => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>

      {/* Tableau */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Aperçu</th>
              <th className="text-left px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} cols={5} />)
            ) : signalements.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted">
                  <Flag size={24} className="mx-auto mb-2 opacity-30" />
                  Aucun signalement
                </td>
              </tr>
            ) : signalements.map(sig => (
              <tr
                key={sig.id}
                onClick={() => setSelected(sig)}
                className="border-b border-border/50 hover:bg-white/3 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-muted whitespace-nowrap">
                  {fmtDate(sig.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{sig.userName ?? '—'}</p>
                  <p className="text-muted text-xs">{sig.profil}</p>
                </td>
                <td className="px-4 py-3 text-white/80">
                  {TYPE_LABELS[sig.type]}
                </td>
                <td className="px-4 py-3 text-muted max-w-xs">
                  <p className="truncate">{sig.description}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[sig.status]}`}>
                    {STATUS_LABELS[sig.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal détail */}
      {selected && (
        <SignalementDetail
          sig={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
