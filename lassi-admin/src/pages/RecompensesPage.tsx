import React, { useEffect, useState } from 'react'
import {
  Gift, Search, X, Check, Award, Zap, Trophy, Megaphone,
  Star, Plus, Minus, ChevronRight, Coins,
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getShops, getProfiles, type AdminShop, type AdminProfile } from '../services/users'
import {
  getRecompensesManuelles, attribuerRecompense, revoquerRecompense,
  type RecompenseManuelle,
} from '../services/recompenses'

const DURATIONS = [
  { label: '1 sem.',  days: 7 },
  { label: '2 sem.', days: 14 },
  { label: '1 mois', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '6 mois', days: 180 },
  { label: 'Illimité', days: null },
]

const CREDIT_PRESETS = [500, 1_000, 2_000, 5_000, 10_000]

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
  carrouselProduits: number
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
  carrouselProduits: 0,
  days:              null,
  daysTouched:       false,
  note:              '',
}

// ─── Résumé de la récompense ──────────────────────────────────────────────────

function RewardSummary({ form }: { form: FormState }) {
  const credit    = parseInt(form.creditLassi, 10) || 0
  const items: string[] = []

  if (form.badge.trim())           items.push(`Badge : ${form.badge.trim()}`)
  if (form.certificat)             items.push('Certificat officiel')
  if (form.prioriteRecherche)      items.push('Priorité dans la recherche')
  if (form.topVip)                 items.push('Top VIP')
  if (credit > 0)                  items.push(`${credit.toLocaleString('fr-FR')} F crédit LASSI`)
  if (form.carrouselProduits > 0)  items.push(`${form.carrouselProduits} produit${form.carrouselProduits > 1 ? 's' : ''} en carrousel`)

  if (items.length === 0) return null

  const durationLabel = !form.daysTouched
    ? null
    : form.days === null
      ? 'Illimité'
      : DURATIONS.find(d => d.days === form.days)?.label ?? `${form.days}j`

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-2">
      <p className="text-xs text-accent font-semibold uppercase tracking-wider">Récapitulatif</p>
      <ul className="space-y-1">
        {items.map(item => (
          <li key={item} className="flex items-center gap-2 text-sm text-white">
            <Check size={12} className="text-accent flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
      {durationLabel && (
        <p className="text-xs text-muted pt-1 border-t border-accent/10">
          Durée : <span className="text-white">{durationLabel}</span>
        </p>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

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

  function applyPreset(amount: number) {
    setForm(f => ({ ...f, creditLassi: String(amount) }))
  }

  async function handleSave() {
    if (!form.target) {
      setError('Choisis un prestataire ou un client.')
      return
    }
    if (!form.daysTouched) {
      setError('Sélectionne une durée.')
      return
    }
    const credit   = parseInt(form.creditLassi, 10)
    if (!Number.isFinite(credit) || credit < 0) {
      setError('Crédit LASSI invalide.')
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
        creditLassi:       form.target.type === 'prestataire' ? credit : 0,
        carrouselProduits: form.target.type === 'prestataire' ? form.carrouselProduits : 0,
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

  const credit   = parseInt(form.creditLassi, 10) || 0
  const hasItems = form.badge.trim() || form.certificat || form.prioriteRecherche
    || form.topVip || credit > 0 || form.carrouselProduits > 0
  const canSave  = !!form.target && form.daysTouched && !!hasItems

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Récompenses</h1>
          <p className="text-muted text-sm mt-0.5">
            Attribue manuellement badge, certificat, priorité recherche, crédit LASSI,
            carrousel ou Top VIP à un prestataire ou un client.
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

      {/* Tableau */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
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
                <th className="px-4 py-3 text-center">Certif.</th>
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
                    {r.certificat
                      ? <Check size={14} className="text-success inline" />
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.prioriteRecherche
                      ? <Check size={14} className="text-success inline" />
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-muted text-xs">
                    {r.creditLassi > 0 ? `${r.creditLassi.toLocaleString('fr-FR')} F` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-muted text-xs">
                    {r.carrouselProduits > 0 ? r.carrouselProduits : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.topVip
                      ? <Trophy size={14} className="text-accent inline" />
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {r.valideJusquA ? new Date(r.valideJusquA).toLocaleDateString('fr-FR') : 'Illimité'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.estActif
                      ? <span className="text-xs bg-success/20 text-success border border-success/30 px-1.5 py-0.5 rounded">Active</span>
                      : <span className="text-xs bg-border text-muted border border-border px-1.5 py-0.5 rounded">Révoquée</span>}
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

      {/* ── Modale d'attribution ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl">

            {/* Header fixe */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                  <Gift size={18} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-base leading-tight">Attribuer une récompense</h2>
                  <p className="text-muted text-xs">Remplis au moins un champ récompense</p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Corps scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* 1 — Type de cible */}
              <Section label="Destinataire" required>
                <div className="flex gap-1 bg-bg border border-border rounded-xl p-1 mb-3">
                  {(['prestataire', 'client'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, targetType: t, target: null }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.targetType === t ? 'bg-accent text-bg' : 'text-muted hover:text-white'
                      }`}
                    >
                      {t === 'prestataire' ? '🏪 Prestataire' : '👤 Client'}
                    </button>
                  ))}
                </div>

                {form.target ? (
                  <div className="flex items-center justify-between bg-accent/8 border border-accent/25 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-sm">
                        {form.target.type === 'prestataire' ? '🏪' : '👤'}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{form.target.name}</p>
                        <p className="text-muted text-xs">{form.target.type === 'prestataire' ? 'Prestataire' : 'Client'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, target: null }))}
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      Changer <ChevronRight size={12} />
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
                        className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-white text-sm
                                   focus:outline-none focus:border-accent placeholder-muted transition-colors"
                      />
                    </div>
                    {searching && <p className="text-muted text-xs mt-1.5 pl-1">Recherche…</p>}
                    {!searching && search.trim().length >= 2 && results.length === 0 && (
                      <p className="text-muted text-xs mt-1.5 pl-1">Aucun résultat.</p>
                    )}
                    {results.length > 0 && (
                      <div className="mt-1.5 border border-border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                        {results.map(row => {
                          const isShop = form.targetType === 'prestataire'
                          const name   = isShop ? (row as AdminShop).name : (row as AdminProfile).name
                          const sub    = isShop ? (row as AdminShop).zone : (row as AdminProfile).phone
                          return (
                            <button
                              key={row.id}
                              onClick={() => selectTarget(row)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 transition-colors border-b border-border last:border-0 flex items-center justify-between"
                            >
                              <span className="text-white">{name}</span>
                              {sub && <span className="text-muted text-xs">{sub}</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* 2 — Récompenses */}
              <Section label="Récompenses à attribuer">
                {/* Badge */}
                <div className="mb-3">
                  <label className="block text-xs text-muted font-medium mb-2 flex items-center gap-1.5">
                    <Star size={12} /> Badge personnalisé
                  </label>
                  <input
                    value={form.badge}
                    onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                    placeholder="Ex : 🏆 Champion de la semaine"
                    className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-white text-sm
                               focus:outline-none focus:border-accent placeholder-muted transition-colors"
                  />
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {BADGE_SUGGESTIONS.map(b => (
                      <button
                        key={b}
                        onClick={() => setForm(f => ({ ...f, badge: b }))}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          form.badge === b
                            ? 'bg-accent/15 border-accent text-accent'
                            : 'border-border text-muted hover:border-muted hover:text-white'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bascules */}
                <div className="space-y-1">
                  <ToggleRow
                    icon={<Award size={15} className="text-blue-400" />}
                    label="Certificat officiel"
                    desc="Affiche un badge vérifié sur son profil"
                    checked={form.certificat}
                    onChange={v => setForm(f => ({ ...f, certificat: v }))}
                  />
                  <ToggleRow
                    icon={<Zap size={15} className="text-purple-400" />}
                    label="Priorité dans la recherche"
                    desc="Apparaît en tête des résultats"
                    checked={form.prioriteRecherche}
                    onChange={v => setForm(f => ({ ...f, prioriteRecherche: v }))}
                  />
                  <ToggleRow
                    icon={<Trophy size={15} className="text-accent" />}
                    label="Top VIP"
                    desc="Accès VIP exclusif et mise en avant"
                    checked={form.topVip}
                    onChange={v => setForm(f => ({ ...f, topVip: v }))}
                  />
                </div>
              </Section>

              {/* 3 — Crédit LASSI (prestataire uniquement) */}
              {form.targetType === 'prestataire' && (
                <Section label="Crédit LASSI">
                  {/* Montants rapides */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {CREDIT_PRESETS.map(p => (
                      <button
                        key={p}
                        onClick={() => applyPreset(p)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                          parseInt(form.creditLassi, 10) === p
                            ? 'bg-accent text-bg border-accent'
                            : 'border-border text-muted hover:border-muted hover:text-white'
                        }`}
                      >
                        {p.toLocaleString('fr-FR')} F
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Coins size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type="number" min={0} step={100}
                      value={form.creditLassi}
                      onChange={e => setForm(f => ({ ...f, creditLassi: e.target.value }))}
                      className="w-full bg-bg border border-border rounded-xl pl-9 pr-12 py-2.5 text-white text-sm
                                 focus:outline-none focus:border-accent transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs font-medium">FCFA</span>
                  </div>
                  {credit > 0 && (
                    <p className="text-xs text-muted mt-1.5 pl-1">
                      ≈ {credit.toLocaleString('fr-FR')} F ajoutés au portefeuille du prestataire.
                    </p>
                  )}
                </Section>
              )}

              {/* 4 — Carrousel (prestataire uniquement) */}
              {form.targetType === 'prestataire' && (
                <Section label='Carrousel "Offre du Quartier"'>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setForm(f => ({ ...f, carrouselProduits: Math.max(0, f.carrouselProduits - 1) }))}
                      className="w-9 h-9 rounded-xl border border-border bg-bg hover:border-muted flex items-center justify-center text-muted hover:text-white transition-colors"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="flex-1 text-center">
                      <span className="text-2xl font-bold text-white">{form.carrouselProduits}</span>
                      <p className="text-xs text-muted">produit{form.carrouselProduits !== 1 ? 's' : ''} (0–5)</p>
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, carrouselProduits: Math.min(5, f.carrouselProduits + 1) }))}
                      className="w-9 h-9 rounded-xl border border-border bg-bg hover:border-muted flex items-center justify-center text-muted hover:text-white transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setForm(f => ({ ...f, carrouselProduits: n }))}
                        className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          form.carrouselProduits === n
                            ? 'bg-accent text-bg border-accent'
                            : 'border-border text-muted hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-muted text-xs mt-2">
                    Le prestataire choisit lui-même ses produits depuis sa vitrine.
                  </p>
                </Section>
              )}

              {/* 5 — Durée (obligatoire) */}
              <Section label="Durée" required>
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map(d => (
                    <button
                      key={d.label}
                      onClick={() => setForm(f => ({ ...f, days: d.days, daysTouched: true }))}
                      className={`text-sm px-3 py-2 rounded-xl border font-medium transition-colors ${
                        form.daysTouched && form.days === d.days
                          ? 'bg-accent text-bg border-accent'
                          : 'border-border text-muted hover:border-muted hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {!form.daysTouched && (
                  <p className="text-xs text-muted mt-1.5 pl-0.5">Sélectionne une durée pour continuer.</p>
                )}
              </Section>

              {/* 6 — Note interne */}
              <Section label="Note interne (admin uniquement)">
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Ex : Compensation litige #12, partenariat ponctuel…"
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-white text-sm
                             focus:outline-none focus:border-accent placeholder-muted transition-colors resize-none"
                />
              </Section>

              {/* 7 — Récapitulatif */}
              <RewardSummary form={form} />

              {error && (
                <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
                  <X size={14} className="text-danger flex-shrink-0" />
                  <p className="text-danger text-sm">{error}</p>
                </div>
              )}
            </div>

            {/* Footer fixe */}
            <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-border text-muted py-2.5 rounded-xl text-sm font-medium hover:text-white hover:border-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-xl text-sm
                           hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" /> Attribution…</>
                  : <><Gift size={15} /> Attribuer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Section({ label, required, children }: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-3 flex items-center gap-1">
        {label}
        {required && <span className="text-accent">*</span>}
      </p>
      {children}
    </div>
  )
}

function ToggleRow({ icon, label, desc, checked, onChange }: {
  icon: React.ReactNode
  label: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
        checked ? 'bg-accent/8 border border-accent/20' : 'hover:bg-white/4 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <div>
          <p className="text-white text-sm font-medium leading-tight">{label}</p>
          <p className="text-muted text-xs">{desc}</p>
        </div>
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 relative ml-3 ${checked ? 'bg-accent' : 'bg-border'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  )
}
