import React, { useEffect, useState } from 'react'
import { Crown, Search, Plus, Trash2, Power, RefreshCw, X, Check } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import {
  getVip5EtoilesProfils,
  toggleActif,
  supprimerProfil,
  creerProfil,
  VIP_CAT_LABELS,
  type Vip5EtoilesProfil,
  type VipCategorie,
} from '../services/vip5etoiles'
import { getShops, type AdminShop } from '../services/users'

// ─── Formulaire création ──────────────────────────────────────────────────────

interface CreerModalProps {
  onClose: () => void
  onCreated: () => void
}

function CreerModal({ onClose, onCreated }: CreerModalProps) {
  const [shops, setShops]       = useState<AdminShop[]>([])
  const [search, setSearch]     = useState('')
  const [shopId, setShopId]     = useState('')
  const [categorie, setCategorie] = useState<VipCategorie>('restauration')
  const [gabarit, setGabarit]   = useState<'palais' | 'maison'>('palais')
  const [nomAffiche, setNom]    = useState('')
  const [baseline, setBaseline] = useState('')
  const [initiale, setInitiale] = useState('')
  const [saving, setSaving]     = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    getShops().then(setShops).catch(() => {})
  }, [])

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 40)

  async function handleSubmit() {
    if (!shopId || !nomAffiche.trim() || !initiale.trim()) {
      setErr('Boutique, nom affiché et initiale sont obligatoires.')
      return
    }
    if (initiale.trim().length > 1) {
      setErr("L'initiale doit être un seul caractère.")
      return
    }
    setSaving(true)
    setErr('')
    try {
      await creerProfil({
        shopId,
        categorie,
        gabarit,
        nomAffiche: nomAffiche.trim(),
        baseline:   baseline.trim() || undefined,
        initiale:   initiale.trim().toUpperCase(),
      })
      onCreated()
    } catch (e: any) {
      setErr(e.message ?? 'Erreur création')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold text-lg">Nouveau profil 5 Étoiles</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Sélection boutique */}
          <div>
            <label className="text-xs text-muted mb-1 block">Boutique *</label>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une boutique…"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent mb-1"
            />
            <select
              value={shopId}
              onChange={e => setShopId(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              size={4}
            >
              <option value="">— Choisir —</option>
              {filtered.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Catégorie */}
          <div>
            <label className="text-xs text-muted mb-1 block">Catégorie *</label>
            <select
              value={categorie}
              onChange={e => setCategorie(e.target.value as VipCategorie)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            >
              {(Object.keys(VIP_CAT_LABELS) as VipCategorie[]).map(k => (
                <option key={k} value={k}>{VIP_CAT_LABELS[k]}</option>
              ))}
            </select>
          </div>

          {/* Gabarit */}
          <div>
            <label className="text-xs text-muted mb-1 block">Gabarit</label>
            <div className="flex gap-3">
              {(['palais', 'maison'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGabarit(g)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    gabarit === g
                      ? 'border-accent text-accent bg-accent/10'
                      : 'border-border text-muted hover:border-white/30'
                  }`}
                >
                  {g === 'palais' ? 'Palais (Cinzel)' : 'Maison (Marcellus)'}
                </button>
              ))}
            </div>
          </div>

          {/* Nom affiché + Initiale */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted mb-1 block">Nom affiché *</label>
              <input
                value={nomAffiche}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex : Le Baobab d'Or"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="w-20">
              <label className="text-xs text-muted mb-1 block">Initiale *</label>
              <input
                value={initiale}
                onChange={e => setInitiale(e.target.value.slice(0, 1).toUpperCase())}
                maxLength={1}
                placeholder="B"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm text-center uppercase focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Baseline */}
          <div>
            <label className="text-xs text-muted mb-1 block">Baseline (optionnel)</label>
            <input
              value={baseline}
              onChange={e => setBaseline(e.target.value)}
              placeholder="Ex : Cuisine sénégalaise d'exception"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>

          {err && <p className="text-danger text-sm">{err}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border text-muted text-sm hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-accent text-bg font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création…' : 'Créer (inactif)'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Vip5EtoilesPage() {
  const [profils, setProfils]   = useState<Vip5EtoilesProfil[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showModal, setModal]   = useState(false)
  const [toDelete, setToDelete] = useState<Vip5EtoilesProfil | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [err, setErr]           = useState('')

  function load() {
    setLoading(true)
    setErr('')
    getVip5EtoilesProfils()
      .then(setProfils)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = profils.filter(p =>
    p.nomAffiche.toLowerCase().includes(search.toLowerCase()) ||
    p.shopName.toLowerCase().includes(search.toLowerCase())
  )

  async function handleToggle(p: Vip5EtoilesProfil) {
    setToggling(p.id)
    try {
      await toggleActif(p.id, !p.actif)
      setProfils(prev => prev.map(x => x.id === p.id ? { ...x, actif: !x.actif } : x))
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await supprimerProfil(toDelete.id, toDelete.shopId)
      setProfils(prev => prev.filter(x => x.id !== toDelete.id))
      setToDelete(null)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="text-accent" size={22} />
          <div>
            <h1 className="text-white font-title font-bold text-xl">5 Étoiles LASSI</h1>
            <p className="text-muted text-sm">{profils.length} profil{profils.length !== 1 ? 's' : ''} · commission 2 %</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg border border-border text-muted hover:text-white transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-bg font-semibold text-sm hover:bg-accent/90 transition-colors"
          >
            <Plus size={16} />
            Nouveau profil
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-danger text-sm flex items-center justify-between">
          {err}
          <button onClick={() => setErr('')}><X size={14} /></button>
        </div>
      )}

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou boutique…"
          className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-lg text-white text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-muted font-medium">Établissement</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Catégorie</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Gabarit</th>
              <th className="text-left px-4 py-3 text-muted font-medium">Gérant lié</th>
              <th className="text-center px-4 py-3 text-muted font-medium">Statut</th>
              <th className="text-right px-4 py-3 text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={<Crown size={32} className="text-muted" />}
                    title="Aucun profil 5 Étoiles"
                    description={search ? 'Aucun résultat pour cette recherche.' : 'Créez le premier établissement 5 Étoiles LASSI.'}
                  />
                </td>
              </tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full border border-accent/50 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                      {p.nomAffiche.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-white font-medium">{p.nomAffiche}</p>
                      <p className="text-muted text-xs">{p.shopName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted">{VIP_CAT_LABELS[p.categorie]}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted border border-border rounded px-2 py-0.5 capitalize">
                    {p.gabarit}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.gerantUserId ? (
                    <span className="flex items-center gap-1 text-success text-xs">
                      <Check size={12} /> Lié
                    </span>
                  ) : (
                    <span className="text-muted text-xs">Non lié</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.actif
                      ? 'bg-success/15 text-success border border-success/30'
                      : 'bg-border/60 text-muted'
                  }`}>
                    {p.actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleToggle(p)}
                      disabled={toggling === p.id}
                      title={p.actif ? 'Désactiver' : 'Activer'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        p.actif
                          ? 'border-orange/40 text-orange hover:bg-orange/10'
                          : 'border-success/40 text-success hover:bg-success/10'
                      } disabled:opacity-40`}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      onClick={() => setToDelete(p)}
                      title="Supprimer"
                      className="p-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal création */}
      {showModal && (
        <CreerModal
          onClose={() => setModal(false)}
          onCreated={() => { setModal(false); load() }}
        />
      )}

      {/* Confirmation suppression */}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface border border-border rounded-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-white font-semibold text-lg mb-2">Supprimer ce profil ?</h2>
            <p className="text-muted text-sm mb-1">
              <span className="text-white font-medium">{toDelete.nomAffiche}</span> — {toDelete.shopName}
            </p>
            <p className="text-muted text-sm mb-5">
              Le profil, ses prestations et ses horaires seront supprimés.
              La boutique perdra le badge 5 Étoiles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 py-2.5 rounded-lg border border-border text-muted text-sm hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-danger text-white font-semibold text-sm hover:bg-danger/80 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
