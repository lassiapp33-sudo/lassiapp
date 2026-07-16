/**
 * LivreursPage — Gestion des livreurs internes + historique livraisons.
 */
import React, { useEffect, useState } from 'react'
import { Truck, Plus, X, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react'
import { SkeletonRow } from '../components/Skeleton'
import {
  getLivreurs,
  getLivraisons,
  toggleLivreurActif,
  creerCompteLivreur,
  AdminLivreur,
  AdminLivraison,
} from '../services/livreurs'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statutColor(s: string): string {
  switch (s) {
    case 'en_attente': return 'text-amber-400 bg-amber-400/10'
    case 'acceptee':   return 'text-blue-400 bg-blue-400/10'
    case 'terminee':   return 'text-emerald-400 bg-emerald-400/10'
    default:           return 'text-red-400 bg-red-400/10'
  }
}

function statutLabel(s: string): string {
  switch (s) {
    case 'en_attente': return 'En attente'
    case 'acceptee':   return 'En cours'
    case 'terminee':   return 'Terminée'
    default:           return 'Annulée'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Modal Créer livreur ─────────────────────────────────────────────────────

interface CreateModalProps {
  onClose:   () => void
  onCreated: () => void
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [nomComplet,  setNomComplet]  = useState('')
  const [telephone,   setTelephone]   = useState('')
  const [motDePasse,  setMotDePasse]  = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const handleSubmit = async () => {
    if (!nomComplet.trim() || !telephone.trim() || !motDePasse.trim()) {
      setError('Tous les champs sont requis.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await creerCompteLivreur({ nomComplet, telephone, motDePasse })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? 'Erreur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <span className="font-title font-bold text-white text-base">Créer un compte livreur</span>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
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
            <label className="block text-xs text-muted mb-1.5">Téléphone *</label>
            <input
              value={telephone}
              onChange={e => setTelephone(e.target.value)}
              placeholder="77 000 00 00"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">Mot de passe *</label>
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
      </div>
    </div>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────

type Tab = 'livreurs' | 'livraisons'

export default function LivreursPage() {
  const [tab,             setTab]             = useState<Tab>('livreurs')
  const [livreurs,        setLivreurs]        = useState<AdminLivreur[]>([])
  const [livraisons,      setLivraisons]      = useState<AdminLivraison[]>([])
  const [loadingLivreurs, setLoadingLivreurs] = useState(true)
  const [loadingLiv,      setLoadingLiv]      = useState(true)
  const [showCreate,      setShowCreate]      = useState(false)
  const [toggling,        setToggling]        = useState<string | null>(null)

  const loadLivreurs = async () => {
    setLoadingLivreurs(true)
    try { setLivreurs(await getLivreurs()) } catch { /* ignore */ }
    finally { setLoadingLivreurs(false) }
  }

  const loadLivraisons = async () => {
    setLoadingLiv(true)
    try { setLivraisons(await getLivraisons()) } catch { /* ignore */ }
    finally { setLoadingLiv(false) }
  }

  useEffect(() => { loadLivreurs(); loadLivraisons() }, [])

  const handleToggle = async (livreur: AdminLivreur) => {
    setToggling(livreur.id)
    try {
      await toggleLivreurActif(livreur.id, !livreur.actif)
      setLivreurs(prev =>
        prev.map(l => l.id === livreur.id ? { ...l, actif: !l.actif } : l)
      )
    } catch { /* ignore */ }
    finally { setToggling(null) }
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="text-accent" size={24} />
          <div>
            <h1 className="font-title font-bold text-white text-xl">Livreurs & Livraisons</h1>
            <p className="text-muted text-xs mt-0.5">Gestion des livreurs internes</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { loadLivreurs(); loadLivraisons() }}
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
        {(['livreurs', 'livraisons'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-accent text-bg' : 'text-muted hover:text-white'
            }`}
          >
            {t === 'livreurs' ? `Livreurs (${livreurs.length})` : `Livraisons (${livraisons.length})`}
          </button>
        ))}
      </div>

      {/* Onglet Livreurs */}
      {tab === 'livreurs' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="text-left px-5 py-3 font-medium">Nom</th>
                <th className="text-left px-5 py-3 font-medium">Téléphone</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
                <th className="text-left px-5 py-3 font-medium">Depuis</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {loadingLivreurs
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                : livreurs.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-12 text-sm">
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
                        l.actif
                          ? 'text-emerald-400 bg-emerald-400/10'
                          : 'text-red-400 bg-red-400/10'
                      }`}>
                        {l.actif ? 'Actif' : 'Inactif'}
                      </span>
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
                          ? <ToggleRight size={20} className="text-emerald-400" />
                          : <ToggleLeft size={20} />
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

      {/* Onglet Livraisons */}
      {tab === 'livraisons' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="text-left px-5 py-3 font-medium">Départ</th>
                <th className="text-left px-5 py-3 font-medium">Arrivée</th>
                <th className="text-left px-5 py-3 font-medium">Contact</th>
                <th className="text-left px-5 py-3 font-medium">Distance</th>
                <th className="text-left px-5 py-3 font-medium">Prix</th>
                <th className="text-left px-5 py-3 font-medium">Statut</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {loadingLiv
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : livraisons.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-12 text-sm">
                      Aucune livraison enregistrée.
                    </td>
                  </tr>
                )
                : livraisons.map(l => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3 text-white text-sm max-w-[150px] truncate">{l.departLabel}</td>
                    <td className="px-5 py-3 text-muted text-sm max-w-[150px] truncate">{l.arriveeLabel}</td>
                    <td className="px-5 py-3 text-muted text-xs">
                      {l.contactNom && <div className="text-white">{l.contactNom}</div>}
                      {l.contactTel && <div>{l.contactTel}</div>}
                    </td>
                    <td className="px-5 py-3 text-muted text-sm">{l.distanceKm.toFixed(1)} km</td>
                    <td className="px-5 py-3 text-accent text-sm font-medium">
                      {l.prixLivraison.toLocaleString('fr-FR')} F
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutColor(l.statut)}`}>
                        {statutLabel(l.statut)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted text-xs">{formatDate(l.createdAt)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadLivreurs() }}
        />
      )}
    </div>
  )
}
