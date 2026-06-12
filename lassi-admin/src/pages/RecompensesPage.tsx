/**
 * RecompensesPage — Attribution manuelle des récompenses de classement
 * (badge, certificat, priorité recherche, crédit Lassi, carrousel "Offre di
 * Quartier", Top VIP) à un prestataire ou un client.
 * Toutes les modifications passent par une Edge Function sécurisée.
 * Accès admin uniquement.
 */
import React, { useEffect, useState } from 'react'
import { Gift, Search, X, Check, Award, Zap, Trophy, Megaphone } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getShops, getProfiles, type AdminShop, type AdminProfile } from '../services/users'
import {
  getRecompensesManuelles, attribuerRecompense, revoquerRecompense,
  type RecompenseManuelle,
} from '../services/recompenses'

// Durées disponibles pour la récompense
const DURATIONS = [
  { label: '1 semaine',  days: 7 },
  { label: '2 semaines', days: 14 },
  { label: '1 mois',     days: 30 },
  { label: '3 mois',     days: 90 },
  { label: '6 mois',     days: 180 },
  { label: 'Illimité',   days: null },
]

const BADGE_SUGGESTIONS = [
  '🏆 Champion de la semaine',
  '⭐ Supporter n°1',
  '🎖️ Partenaire LASSI',
  '🔥 Coup de cœur',
]

interface Target {
  type: 'prestataire' | 'client'
  id:   string
  name: string
}

interface FormState {
  targetType:        'prestataire' | 'client'
  target:            Target | null
  badge:             string
  certificat:        boolean
  prioriteRecherche: boolean
  topVip:            boolean
  creditLassi:       string
  carrouselProduits: string
  days:              number | null
  daysTouched:       boolean
  note:              string
}

const EMPTY_FORM: FormState = {
  targetType:        'prestataire',
  target:            null,
  badge:             '',
  certificat:        false,
  prioriteRecherche: false,
  topVip:            false,
  creditLassi:       '0',
  carrouselProduits: '0',
  days:              null,
  daysTouched:       false,
  note:              '',
}

export default function RecompensesPage() {
  const [recompenses, setRecompenses] = useState<RecompenseManuelle[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [search,    setSearch]    = useState('')
  const [results,   setResults]   = useState<(AdminShop | AdminProfile)[]>([])
  const [searching, setSearching] = useState(false)
  const [saving,    setSaving]    = useState(false)

  function load() {
    setLoading(true)
    getRecompensesManuelles()
      .then(setRecompenses)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  // Recherche de cible (débounce)
  useEffect(() => {
    if (!showForm || form.target) { setResults([]); return }
    const term = search.trim()
    if (term.length < 2) { setResults([]); return }

    setSearching(true)
    const timeout = setTimeout(() => {
      const query = form.targetType === 'prestataire' ? getShops(term) : getProfiles(term)

      query
        .then(rows => {
          if (form.targetType === 'client') {
            setResults((rows as AdminProfile[]).filter(p => p.role === 'client'))
          } else {
            setResults((rows as AdminShop[]).filter(s => s.merchantId))
          }
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, form.targetType, form.target, showForm])

  function openForm() {
    setForm(EMPTY_FORM)
    setSearch('')
    setResults([])
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function selectTarget(row: AdminShop | AdminProfile) {
    if (form.targetType === 'prestataire') {
      const shop = row as AdminShop
      if (!shop.merchantId) return
      setForm(f => ({ ...f, target: { type: 'prestataire', id: shop.merchantId!, name: shop.name } }))
    } else {
      const profile = row as AdminProfile
      setForm(f => ({ ...f, target: { type: 'client', id: profile.id, name: profile.name } }))
    }
    setResults([])
    setSearch('')
  }

  async function handleSave() {
    if (!form.target) {
      setError('Choisis un prestataire ou un client.')
      return
    }
    const credit = parseInt(form.creditLassi, 10)
    const carrousel = parseInt(form.carrouselProduits, 10)
    if (!Number.isFinite(credit) || credit < 0) {
      setError('Crédit Lassi invalide.')
      return
    }
    if (!Number.isFinite(carrousel) || carrousel < 0 || carrousel > 5) {
      setError('Produits carrousel : 0 à 5.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const validUntil = form.days ? new Date(Date.now() + form.days * 86400_000).toISOString() : null

      await attribuerRecompense({
        prestataireId:     form.target.type === 'prestataire' ? form.target.id : undefined,
        clientId:          form.target.type === 'client'      ? form.target.id : undefined,
        badge:             form.badge.trim() || null,
        certificat:        form.certificat,
        prioriteRecherche: form.prioriteRecherche,
        topVip:            form.topVip,
        creditLassi:       credit,
        carrouselProduits: form.target.type === 'prestataire' ? carrousel : 0,
        validUntil,
        note:              form.note.trim() || null,
      })

      setSuccess(`Récompense attribuée à ${form.target.name}.`)
      setShowForm(false)
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(r: RecompenseManuelle) {
    if (!confirm(`Révoquer cette récompense pour ${r.cibleNom} ?`)) return
    setError(null)
    setSuccess(null)
    try {
      await revoquerRecompense(r.id)
      setSuccess('Récompense révoquée.')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Récompenses</h1>
          <p className="text-muted text-sm mt-0.5">
            Attribue manuellement badge, certificat, priorité recherche, crédit Lassi,
            carrousel « Offre di Quartier » ou Top VIP à un prestataire ou un client.
          </p>
        </div>
        <button
          onClick={openForm}
          className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <Gift size={16} />
          Attribuer une récompense
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-xl px-4 py-3">
          <Check size={16} className="text-success" />
          <span className="text-success text-sm">{success}</span>
        </div>
      )}
      {error && !showForm && (
        <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
          <span className="text-danger text-sm">{error}</span>
        </div>
      )}

      {/* Liste des récompenses manuelles */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : recompenses.length === 0 ? (
          <EmptyState
            title="Aucune récompense manuelle"
            subtitle="Attribue un badge, un crédit ou un quota carrousel pour le voir apparaître ici."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Cible</th>
                <th className="px-4 py-3 text-left">Badge</th>
                <th className="px-4 py-3 text-center">Certificat</th>
                <th className="px-4 py-3 text-center">Priorité</th>
                <th className="px-4 py-3 text-center">Crédit</th>
                <th className="px-4 py-3 text-center">Carrousel</th>
                <th className="px-4 py-3 text-center">Top VIP</th>
                <th className="px-4 py-3 text-left">Expire</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {recompenses.map(r => (
                <tr key={r.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{r.cibleNom}</p>
                    <p className="text-muted text-xs">{r.cibleType === 'prestataire' ? 'Prestataire' : 'Client'}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{r.badge || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.certificat ? <Check size={14} className="text-success inline" /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.prioriteRecherche ? <Check size={14} className="text-success inline" /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-muted text-xs">{r.creditLassi > 0 ? `${r.creditLassi} F` : '—'}</td>
                  <td className="px-4 py-3 text-center text-muted text-xs">{r.carrouselProduits > 0 ? r.carrouselProduits : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.topVip ? <Trophy size={14} className="text-accent inline" /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {r.valideJusquA ? new Date(r.valideJusquA).toLocaleDateString('fr-FR') : 'Illimité'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.estActif
                      ? <span className="text-xs bg-success/20 text-success border border-success/30 px-1.5 py-0.5 rounded">Active</span>
                      : <span className="text-xs bg-border text-muted border border-border px-1.5 py-0.5 rounded">Révoquée</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.estActif && (
                      <button onClick={() => handleRevoke(r)} className="text-xs text-danger hover:underline">
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal d'attribution */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Attribuer une récompense</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Type de cible */}
            <div className="flex gap-1 bg-bg border border-border rounded-lg p-1">
              {(['prestataire', 'client'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...f, targetType: t, target: null }))}
                  className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    form.targetType === t ? 'bg-accent text-bg' : 'text-muted hover:text-white'
                  }`}
                >
                  {t === 'prestataire' ? 'Prestataire' : 'Client'}
                </button>
              ))}
            </div>

            {/* Recherche / cible sélectionnée */}
            {form.target ? (
              <div className="flex items-center justify-between bg-bg border border-border rounded-lg px-3 py-2">
                <div>
                  <p className="text-white text-sm font-medium">{form.target.name}</p>
                  <p className="text-muted text-xs">{form.target.type === 'prestataire' ? 'Prestataire' : 'Client'}</p>
                </div>
                <button onClick={() => setForm(f => ({ ...f, target: null }))} className="text-xs text-accent hover:underline">
                  Changer
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={form.targetType === 'prestataire' ? 'Chercher un commerce…' : 'Chercher un client…'}
                    className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-white text-sm
                               focus:outline-none focus:border-accent placeholder-muted"
                  />
                </div>
                {searching && <p className="text-muted text-xs mt-1.5">Recherche…</p>}
                {!searching && search.trim().length >= 2 && results.length === 0 && (
                  <p className="text-muted text-xs mt-1.5">Aucun résultat.</p>
                )}
                {results.length > 0 && (
                  <div className="mt-1.5 border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {results.map(row => {
                      const isShop = form.targetType === 'prestataire'
                      const name = isShop ? (row as AdminShop).name : (row as AdminProfile).name
                      const sub  = isShop ? (row as AdminShop).zone : (row as AdminProfile).phone
                      return (
                        <button
                          key={row.id}
                          onClick={() => selectTarget(row)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors border-b border-border last:border-0"
                        >
                          <span className="text-white">{name}</span>
                          {sub && <span className="text-muted text-xs ml-2">{sub}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Badge */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Badge</label>
              <input
                value={form.badge}
                onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                placeholder="Ex : 🏆 Champion de la semaine"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-accent placeholder-muted"
              />
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {BADGE_SUGGESTIONS.map(b => (
                  <button
                    key={b}
                    onClick={() => setForm(f => ({ ...f, badge: b }))}
                    className="text-xs px-2 py-1 rounded border border-border text-muted hover:border-accent hover:text-accent transition-colors"
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Bascules */}
            <div className="space-y-2">
              <ToggleRow
                icon={<Award size={16} className="text-muted" />}
                label="Certificat"
                checked={form.certificat}
                onChange={v => setForm(f => ({ ...f, certificat: v }))}
              />
              <ToggleRow
                icon={<Zap size={16} className="text-muted" />}
                label="Priorité dans les résultats de recherche"
                checked={form.prioriteRecherche}
                onChange={v => setForm(f => ({ ...f, prioriteRecherche: v }))}
              />
              <ToggleRow
                icon={<Trophy size={16} className="text-accent" />}
                label="Top VIP"
                checked={form.topVip}
                onChange={v => setForm(f => ({ ...f, topVip: v }))}
              />
            </div>

            {/* Crédit Lassi */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Crédit Lassi (FCFA)</label>
              <input
                type="number" min={0} step={100}
                value={form.creditLassi}
                onChange={e => setForm(f => ({ ...f, creditLassi: e.target.value }))}
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-accent"
              />
            </div>

            {/* Carrousel — prestataire uniquement */}
            {form.targetType === 'prestataire' && (
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
                  <Megaphone size={14} /> Produits dans le carrousel « Offre di Quartier »
                </label>
                <input
                  type="number" min={0} max={5} step={1}
                  value={form.carrouselProduits}
                  onChange={e => setForm(f => ({ ...f, carrouselProduits: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                             focus:outline-none focus:border-accent"
                />
                <p className="text-muted text-xs mt-1">0 à 5. Le prestataire choisit lui-même ses produits depuis sa vitrine.</p>
              </div>
            )}

            {/* Durée */}
            <div className="space-y-1.5">
              <label className="block text-xs text-muted font-medium uppercase tracking-wide">Durée</label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map(d => (
                  <button
                    key={d.label}
                    onClick={() => setForm(f => ({ ...f, days: d.days, daysTouched: true }))}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      form.daysTouched && form.days === d.days
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-border text-muted hover:border-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note interne */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Note interne (admin uniquement)</label>
              <input
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ex : Compensation litige #..., partenariat ponctuel…"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-accent placeholder-muted"
              />
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-border text-muted py-2.5 rounded-lg text-sm hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.target}
                className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm
                           hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Attribution…' : 'Attribuer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bascule réutilisable ───────────────────────────────────────────────────

function ToggleRow({ icon, label, checked, onChange }: {
  icon: React.ReactNode
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-white text-sm font-medium">{label}</span>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-accent' : 'bg-border'}`}
      >
        <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
