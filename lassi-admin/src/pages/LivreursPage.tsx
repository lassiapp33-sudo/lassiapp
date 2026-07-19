/**
 * LivreursPage — Gestion des livreurs + suivi des livraisons + paiements.
 *
 * Onglet 1 : Livreurs     — créer, activer/désactiver, nb livraisons
 * Onglet 2 : Livraisons   — toutes les courses avec livreur assigné
 * Onglet 3 : Paiements    — total à payer par livreur sur une période
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Truck, Plus, X, ToggleLeft, ToggleRight, RefreshCw, Copy, Check, AlertCircle, BadgeCheck } from 'lucide-react'
import { SkeletonRow } from '../components/Skeleton'
import {
  getLivreurs,
  getLivraisons,
  getVersements,
  toggleLivreurActif,
  creerCompteLivreur,
  marquerLivreurVerse,
  getSoldesActuels,
  AdminLivreur,
  AdminLivraison,
  SoldeLivreur,
} from '../services/livreurs'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statutColor(s: string) {
  switch (s) {
    case 'en_attente': return 'text-amber-400 bg-amber-400/10'
    case 'acceptee':   return 'text-blue-400 bg-blue-400/10'
    case 'terminee':   return 'text-emerald-400 bg-emerald-400/10'
    default:           return 'text-red-400 bg-red-400/10'
  }
}

function statutLabel(s: string) {
  switch (s) {
    case 'en_attente': return 'En attente'
    case 'acceptee':   return 'En cours'
    case 'terminee':   return 'Terminée'
    default:           return 'Annulée'
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatMontant(n: number) {
  return n.toLocaleString('fr-FR') + ' F'
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// Périodes prédéfinies
function getPeriodes() {
  const now = new Date()
  const today = isoDate(now)

  const j7 = new Date(now); j7.setDate(now.getDate() - 6)
  const j30 = new Date(now); j30.setDate(now.getDate() - 29)

  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1)
  const debutMoisPrec = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const finMoisPrec = new Date(now.getFullYear(), now.getMonth(), 0)

  return [
    { label: '7 derniers jours',  depuis: isoDate(j7),          jusqua: today },
    { label: '30 derniers jours', depuis: isoDate(j30),         jusqua: today },
    { label: 'Mois en cours',     depuis: isoDate(debutMois),   jusqua: today },
    { label: 'Mois précédent',    depuis: isoDate(debutMoisPrec), jusqua: isoDate(finMoisPrec) },
  ]
}

// ─── Modal Créer livreur ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose:   () => void
  onCreated: () => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [step,        setStep]        = useState<'form' | 'done'>('form')
  const [nomComplet,  setNomComplet]  = useState('')
  const [telephone,   setTelephone]   = useState('')
  const [motDePasse,  setMotDePasse]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [identifiant, setIdentifiant] = useState('')
  const [copied,      setCopied]      = useState(false)

  const handleSubmit = async () => {
    const tel = telephone.replace(/\D/g, '')
    if (!nomComplet.trim()) { setError('Le nom est requis.'); return }
    if (tel.length < 8)     { setError('Numéro de téléphone invalide.'); return }
    if (motDePasse.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }

    setLoading(true)
    setError('')
    try {
      const result = await creerCompteLivreur({ nomComplet: nomComplet.trim(), telephone, motDePasse })
      setIdentifiant(result.identifiant)
      setStep('done')
      onCreated()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(identifiant)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <span className="font-title font-bold text-white text-base">
            {step === 'form' ? 'Créer un compte livreur' : 'Compte créé ✓'}
          </span>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {step === 'form' ? (
          <>
            <div className="p-5 space-y-4">
              {error && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs text-muted mb-1.5">Nom complet *</label>
                <input
                  value={nomComplet}
                  onChange={e => setNomComplet(e.target.value)}
                  placeholder="Mamadou Diallo"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Téléphone * <span className="text-muted/60">(identifiant de connexion)</span></label>
                <input
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="77 000 00 00"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5">Mot de passe * <span className="text-muted/60">(min 8 caractères)</span></label>
                <input
                  type="password"
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                />
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t border-border">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl border border-border text-muted hover:text-white transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2 rounded-xl bg-accent text-bg font-bold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </>
        ) : (
          <div className="p-5 space-y-4">
            {/* Succès */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
              <div className="text-emerald-400 text-sm font-medium mb-1">Compte créé avec succès</div>
              <div className="text-white text-xs mt-1">{nomComplet}</div>
            </div>

            {/* Identifiant à communiquer */}
            <div className="bg-accent/8 border border-accent/30 rounded-xl p-4">
              <div className="text-xs text-muted mb-2 font-medium uppercase tracking-wide">
                Identifiant à communiquer au livreur
              </div>
              <div className="flex items-center justify-between gap-3">
                <code className="text-accent text-xl font-bold tracking-widest">{identifiant}</code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors text-xs"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <div className="text-xs text-muted mt-2">
                Le livreur utilise ce numéro + son mot de passe pour se connecter.
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-surface border border-border text-white hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal confirmation versement ────────────────────────────────────────────

interface ConfirmVersementProps {
  solde:    SoldeLivreur
  onClose:  () => void
  onConfirm: () => Promise<void>
}

function ConfirmVersementModal({ solde, onClose, onConfirm }: ConfirmVersementProps) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <span className="font-title font-bold text-white text-base">Confirmer le versement</span>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-muted text-sm">
            Confirmer le paiement à <span className="text-white font-medium">{solde.nomComplet}</span> ?
            Le solde sera réinitialisé à 0.
          </p>

          <div className="bg-bg rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Montant brut</span>
              <span className="text-white font-medium">{formatMontant(solde.montantBrut)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Commission LASSİ (15%)</span>
              <span className="text-red-400">− {formatMontant(solde.commissionLassi)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-white font-bold">Net à verser</span>
              <span className="text-accent font-bold text-base">{formatMontant(solde.montantNet)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted">Courses concernées</span>
              <span className="text-muted">{solde.nbCourses} course{solde.nbCourses > 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-border text-muted hover:text-white transition-colors text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-xl bg-accent text-bg font-bold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {loading ? 'En cours…' : 'Confirmer versement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────

type Tab = 'livreurs' | 'livraisons' | 'paiements'

export default function LivreursPage() {
  const [tab,             setTab]             = useState<Tab>('livreurs')
  const [livreurs,        setLivreurs]        = useState<AdminLivreur[]>([])
  const [livraisons,      setLivraisons]      = useState<AdminLivraison[]>([])
  const [loadingLivreurs, setLoadingLivreurs] = useState(true)
  const [loadingLiv,      setLoadingLiv]      = useState(true)
  const [loadingVers,     setLoadingVers]     = useState(true)
  const [showCreate,      setShowCreate]      = useState(false)
  const [toggling,        setToggling]        = useState<string | null>(null)
  const [versements,      setVersements]      = useState<import('../services/livreurs').VersementLivreur[]>([])
  const [confirmSolde,    setConfirmSolde]    = useState<SoldeLivreur | null>(null)

  // Filtre statut livraisons
  const [filtreStatut, setFiltreStatut] = useState<string>('tous')

  // ── Chargement ──────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoadingLivreurs(true)
    setLoadingLiv(true)
    setLoadingVers(true)
    try { setLivreurs(await getLivreurs()) }       catch { /* ignore */ } finally { setLoadingLivreurs(false) }
    try { setLivraisons(await getLivraisons()) }   catch { /* ignore */ } finally { setLoadingLiv(false) }
    try { setVersements(await getVersements()) }   catch { /* ignore */ } finally { setLoadingVers(false) }
  }

  useEffect(() => { loadAll() }, [])

  // ── Toggle ──────────────────────────────────────────────────────────────────
  const handleToggle = async (livreur: AdminLivreur) => {
    setToggling(livreur.id)
    try {
      await toggleLivreurActif(livreur.id, !livreur.actif)
      setLivreurs(prev => prev.map(l => l.id === livreur.id ? { ...l, actif: !l.actif } : l))
    } catch { /* ignore */ }
    finally { setToggling(null) }
  }

  // ── Versement confirmé ───────────────────────────────────────────────────────
  const handleVerse = async (livreurId: string) => {
    await marquerLivreurVerse(livreurId)
    await loadAll()
  }

  // ── Stats par livreur ────────────────────────────────────────────────────────
  const nbLivraisonsByLivreur = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of livraisons) {
      if (!l.livreurId) continue
      map.set(l.livreurId, (map.get(l.livreurId) ?? 0) + 1)
    }
    return map
  }, [livraisons])

  // ── Noms des livreurs pour la tab livraisons ─────────────────────────────────
  const livreurById = useMemo(() => {
    const map = new Map<string, AdminLivreur>()
    for (const l of livreurs) map.set(l.id, l)
    return map
  }, [livreurs])

  // ── Livraisons filtrées ──────────────────────────────────────────────────────
  const livraisonsFiltrees = useMemo(() => {
    if (filtreStatut === 'tous') return livraisons
    return livraisons.filter(l => l.statut === filtreStatut)
  }, [livraisons, filtreStatut])

  // ── Soldes actuels (non versés) ──────────────────────────────────────────────
  const soldes = useMemo(
    () => getSoldesActuels(livraisons, livreurs, versements),
    [livraisons, livreurs, versements],
  )

  const totalBrut = soldes.reduce((a, s) => a + s.montantBrut, 0)
  const totalNet  = soldes.reduce((a, s) => a + s.montantNet, 0)

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="text-accent" size={24} />
          <div>
            <h1 className="font-title font-bold text-white text-xl">Livreurs & Livraisons</h1>
            <p className="text-muted text-xs mt-0.5">Gestion des livreurs internes LASSİ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAll}
            title="Actualiser"
            className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent rounded-lg text-bg text-sm font-bold hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} />
            Nouveau livreur
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        {([
          ['livreurs',   `Livreurs (${livreurs.length})`],
          ['livraisons', `Livraisons (${livraisons.length})`],
          ['paiements',  'Rémunérations'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-accent text-bg' : 'text-muted hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 1 — LIVREURS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'livreurs' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="text-left px-5 py-3 font-medium">Nom</th>
                <th className="text-left px-5 py-3 font-medium">Téléphone</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
                <th className="text-left px-5 py-3 font-medium">Livraisons</th>
                <th className="text-left px-5 py-3 font-medium">Depuis</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loadingLivreurs
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : livreurs.length === 0
                ? (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-12 text-sm">
                      Aucun livreur — cliquez sur « Nouveau livreur » pour commencer.
                    </td>
                  </tr>
                )
                : livreurs.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-white text-sm font-medium">{l.nomComplet}</td>
                    <td className="px-5 py-3 text-muted text-sm font-mono">{l.telephone}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        l.actif ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                      }`}>
                        {l.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted text-sm">
                      {loadingLiv ? '…' : (
                        <span className="font-mono text-white">
                          {nbLivraisonsByLivreur.get(l.id) ?? 0}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted text-xs">{formatDate(l.createdAt)}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggle(l)}
                        disabled={toggling === l.id}
                        className="text-muted hover:text-white transition-colors disabled:opacity-50"
                        title={l.actif ? 'Désactiver' : 'Activer'}
                      >
                        {l.actif
                          ? <ToggleRight size={22} className="text-emerald-400" />
                          : <ToggleLeft size={22} />
                        }
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 2 — LIVRAISONS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'livraisons' && (
        <div className="space-y-4">

          {/* Filtre statut */}
          <div className="flex gap-2 flex-wrap">
            {(['tous', 'en_attente', 'acceptee', 'terminee', 'annulee'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFiltreStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filtreStatut === s
                    ? 'bg-accent border-accent text-bg'
                    : 'border-border text-muted hover:text-white'
                }`}
              >
                {s === 'tous' ? `Toutes (${livraisons.length})` : statutLabel(s)}
              </button>
            ))}
          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="text-left px-5 py-3 font-medium">Départ</th>
                  <th className="text-left px-5 py-3 font-medium">Arrivée</th>
                  <th className="text-left px-5 py-3 font-medium">Contact</th>
                  <th className="text-left px-5 py-3 font-medium">Livreur</th>
                  <th className="text-left px-5 py-3 font-medium">Dist.</th>
                  <th className="text-left px-5 py-3 font-medium">Prix</th>
                  <th className="text-left px-5 py-3 font-medium">Statut</th>
                  <th className="text-left px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {loadingLiv
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                  : livraisonsFiltrees.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-12 text-sm">
                        Aucune livraison {filtreStatut !== 'tous' ? `"${statutLabel(filtreStatut)}"` : ''}.
                      </td>
                    </tr>
                  )
                  : livraisonsFiltrees.map(l => {
                    const livreur = l.livreurId ? livreurById.get(l.livreurId) : null
                    return (
                      <tr key={l.id} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                        <td className="px-5 py-3 text-white text-sm max-w-[140px] truncate" title={l.departLabel}>{l.departLabel}</td>
                        <td className="px-5 py-3 text-muted text-sm max-w-[140px] truncate" title={l.arriveeLabel}>{l.arriveeLabel}</td>
                        <td className="px-5 py-3 text-xs">
                          {l.contactNom && <div className="text-white">{l.contactNom}</div>}
                          {l.contactTel && <div className="text-muted">{l.contactTel}</div>}
                          {!l.contactNom && !l.contactTel && <span className="text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3 text-xs">
                          {livreur ? (
                            <>
                              <div className="text-white font-medium">{livreur.nomComplet}</div>
                              <div className="text-muted font-mono">{livreur.telephone}</div>
                            </>
                          ) : (
                            <span className="text-muted/50 italic">Non assigné</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted text-sm whitespace-nowrap">{l.distanceKm.toFixed(1)} km</td>
                        <td className="px-5 py-3 text-accent text-sm font-medium whitespace-nowrap">
                          {formatMontant(l.prixLivraison)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColor(l.statut)}`}>
                            {statutLabel(l.statut)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-muted text-xs whitespace-nowrap">{formatDate(l.createdAt)}</td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ONGLET 3 — RÉMUNÉRATIONS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab === 'paiements' && (
        <div className="space-y-5">

          {/* Bannière */}
          <div className="flex items-start gap-3 bg-amber-400/8 border border-amber-400/25 rounded-xl p-4">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-amber-200 text-sm leading-relaxed">
              Solde actuel non versé par livreur (depuis leur dernier paiement).
              Cliquez sur <strong>Déjà versé</strong> après avoir réglé le livreur hors application.
              Le solde sera remis à zéro et l'historique des courses reste intact.
            </p>
          </div>

          {/* Résumé global */}
          {(loadingLivreurs || loadingLiv || loadingVers)
            ? null
            : soldes.some(s => s.montantBrut > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface border border-border rounded-xl px-5 py-4">
                  <div className="text-xs text-muted mb-1">Total brut à décaisser</div>
                  <div className="text-white font-bold text-xl">{formatMontant(totalBrut)}</div>
                  <div className="text-xs text-muted mt-1">{soldes.filter(s => s.montantBrut > 0).length} livreur{soldes.filter(s => s.montantBrut > 0).length > 1 ? 's' : ''} en attente</div>
                </div>
                <div className="bg-surface border border-border rounded-xl px-5 py-4">
                  <div className="text-xs text-muted mb-1">Net à verser aux livreurs</div>
                  <div className="text-accent font-bold text-xl">{formatMontant(totalNet)}</div>
                  <div className="text-xs text-muted mt-1">après commission LASSİ 15%</div>
                </div>
              </div>
            )
          }

          {/* Tableau par livreur */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="text-left px-5 py-3 font-medium">Livreur</th>
                  <th className="text-right px-5 py-3 font-medium">Courses</th>
                  <th className="text-right px-5 py-3 font-medium">Montant brut</th>
                  <th className="text-right px-5 py-3 font-medium">Commission (15%)</th>
                  <th className="text-right px-5 py-3 font-medium">Net à verser</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {(loadingLivreurs || loadingLiv || loadingVers)
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : soldes.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted py-12 text-sm">
                        Aucun livreur enregistré.
                      </td>
                    </tr>
                  )
                  : soldes.map(s => (
                    <tr key={s.livreurId} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-3">
                        <div className="text-white font-medium text-sm">{s.nomComplet}</div>
                        <div className="text-muted text-xs font-mono mt-0.5">{s.telephone}</div>
                        {!s.actif && (
                          <span className="text-xs text-red-400/80 mt-0.5 block">Inactif</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-white text-sm font-mono">
                        {s.nbCourses > 0 ? s.nbCourses : <span className="text-muted">0</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-white text-sm font-mono">
                        {s.montantBrut > 0 ? formatMontant(s.montantBrut) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-red-400 text-sm font-mono">
                        {s.commissionLassi > 0 ? `− ${formatMontant(s.commissionLassi)}` : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.montantNet > 0
                          ? <span className="text-accent font-bold text-base">{formatMontant(s.montantNet)}</span>
                          : <span className="text-emerald-400 text-sm font-medium">Soldé ✓</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.montantBrut > 0 && (
                          <button
                            onClick={() => setConfirmSolde(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium whitespace-nowrap"
                          >
                            <BadgeCheck size={14} />
                            Déjà versé
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { loadAll() }}
        />
      )}

      {/* Modal confirmation versement */}
      {confirmSolde && (
        <ConfirmVersementModal
          solde={confirmSolde}
          onClose={() => setConfirmSolde(null)}
          onConfirm={() => handleVerse(confirmSolde.livreurId)}
        />
      )}

    </div>
  )
}
