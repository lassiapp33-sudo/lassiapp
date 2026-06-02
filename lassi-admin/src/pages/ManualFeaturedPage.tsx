/**
 * ManualFeaturedPage — Mise en avant manuelle des commerces (VIP forcé + Recommandation offerte).
 * Toutes les modifications passent par une Edge Function sécurisée.
 * Accès admin uniquement.
 */
import React, { useEffect, useState } from 'react'
import { Search, Star, Trophy, X, Check, Ban } from 'lucide-react'
import Badge        from '../components/Badge'
import EmptyState   from '../components/EmptyState'
import {
  getAllShopsWithPromo, setShopFeatured, getActiveManualPromos,
  type ShopWithPromo,
} from '../services/promotions'

// Durées disponibles pour la mise en avant
const DURATIONS = [
  { label: '1 semaine',  days: 7 },
  { label: '1 mois',     days: 30 },
  { label: '3 mois',     days: 90 },
  { label: 'Illimité',   days: null },
]

interface EditState {
  shopId:       string
  vipManual:    boolean
  vipDays:      number | null
  vipExclu:     boolean
  featured:     boolean
  featuredDays: number | null
  note:         string
}

export default function ManualFeaturedPage() {
  const [shops,   setShops]   = useState<ShopWithPromo[]>([])
  const [active,  setActive]  = useState<{ vipCount: number; featuredCount: number }>({ vipCount: 0, featuredCount: 0 })
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [edit,    setEdit]    = useState<EditState | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [tab,     setTab]     = useState<'all' | 'active'>('all')

  function load() {
    setLoading(true)
    Promise.all([getAllShopsWithPromo(), getActiveManualPromos()])
      .then(([all, rec]) => {
        setShops(all)
        setActive({ vipCount: rec.vipCount, featuredCount: rec.featuredCount })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.zone.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  )

  const displayed = tab === 'active'
    ? filtered.filter(s => isActiveManual(s))
    : filtered

  function isActiveManual(s: ShopWithPromo): boolean {
    const now = Date.now()
    const vipActive  = s.vipManual && (!s.vipManualUntil || new Date(s.vipManualUntil).getTime() > now)
    const featActive = s.featuredManual && (!s.featuredManualUntil || new Date(s.featuredManualUntil).getTime() > now)
    return vipActive || featActive || s.vipExclu
  }

  function openEdit(shop: ShopWithPromo) {
    setEdit({
      shopId:       shop.id,
      vipManual:    shop.vipManual,
      vipDays:      null,
      vipExclu:     shop.vipExclu,
      featured:     shop.featuredManual,
      featuredDays: null,
      note:         shop.manualNote ?? '',
    })
    setError(null)
  }

  async function handleSave() {
    if (!edit) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const vipUntil = edit.vipDays
        ? new Date(Date.now() + edit.vipDays * 86400_000).toISOString()
        : null

      const featUntil = edit.featuredDays
        ? new Date(Date.now() + edit.featuredDays * 86400_000).toISOString()
        : null

      await setShopFeatured({
        shopId:         edit.shopId,
        vipManual:      edit.vipExclu ? false : edit.vipManual,
        vipUntil:       (edit.vipManual && !edit.vipExclu) ? vipUntil : null,
        vipExclu:       edit.vipExclu,
        featuredManual: edit.featured,
        featuredUntil:  edit.featured ? featUntil : null,
        note:           edit.note.trim() || null,
      })

      setSuccess('Mise à jour enregistrée.')
      setEdit(null)
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-title font-bold text-white">Mise en avant manuelle</h1>
        <p className="text-muted text-sm mt-0.5">
          Force un commerce en VIP ou Recommandation — sans scoring ni paiement.
        </p>
      </div>

      {/* Récap actives */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-surface border border-accent/30 rounded-xl p-4 text-center">
          <p className="text-3xl font-title font-bold text-accent">{active.vipCount}</p>
          <p className="text-muted text-xs mt-1">VIP manuels actifs</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-3xl font-title font-bold text-white">{active.featuredCount}</p>
          <p className="text-muted text-xs mt-1">Recos offertes actives</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-success/10 border border-success/30 rounded-xl px-4 py-3">
          <Check size={16} className="text-success" />
          <span className="text-success text-sm">{success}</span>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Chercher un commerce…"
            className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-white text-sm
                       focus:outline-none focus:border-accent placeholder-muted"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(['all', 'active'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t ? 'bg-accent text-bg' : 'text-muted hover:text-white'
              }`}
            >
              {t === 'all' ? 'Tous' : 'Actifs seulement'}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : displayed.length === 0 ? (
          <EmptyState title="Aucun commerce" subtitle="Essaie un autre filtre ou une autre recherche." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Commerce</th>
                <th className="px-4 py-3 text-left">Zone</th>
                <th className="px-4 py-3 text-center">VIP</th>
                <th className="px-4 py-3 text-center">Exclu</th>
                <th className="px-4 py-3 text-center">Recommandation</th>
                <th className="px-4 py-3 text-left">Note interne</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(shop => (
                <tr key={shop.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{shop.name}</p>
                    <p className="text-muted text-xs">{shop.category}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{shop.zone || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {shop.vipExclu
                      ? <span className="text-xs text-danger/60 line-through">bloqué</span>
                      : shop.isVip
                        ? <Badge variant="vip-scoring" />
                        : shop.vipManual
                          ? <>
                              <Badge variant="vip-manual" />
                              {shop.vipManualUntil && (
                                <p className="text-muted text-xs mt-1">
                                  jusqu'au {new Date(shop.vipManualUntil).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </>
                          : <span className="text-muted text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    {shop.vipExclu
                      ? <span className="text-xs bg-danger/20 text-danger border border-danger/30 px-1.5 py-0.5 rounded">Exclu</span>
                      : <span className="text-muted text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    {shop.featuredManual
                      ? <>
                          <Badge variant="reco-manual" />
                          {shop.featuredManualUntil && (
                            <p className="text-muted text-xs mt-1">
                              jusqu'au {new Date(shop.featuredManualUntil).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </>
                      : <span className="text-muted text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-muted text-xs italic">
                    {shop.manualNote || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(shop)}
                      className="text-xs text-accent hover:underline"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal d'édition */}
      {edit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Mise en avant manuelle</h2>
              <button onClick={() => setEdit(null)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Toggle Exclure du VIP — prioritaire */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-danger/30 bg-danger/5">
              <div className="flex items-center gap-2">
                <Ban size={16} className="text-danger" />
                <div>
                  <span className="text-white text-sm font-medium">Exclure du VIP</span>
                  <p className="text-danger/70 text-xs">Ce shop n'apparaîtra jamais en VIP, même avec un fort score</p>
                </div>
              </div>
              <button
                onClick={() => setEdit(e => e ? { ...e, vipExclu: !e.vipExclu, vipManual: e.vipExclu ? e.vipManual : false } : e)}
                className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                  edit.vipExclu ? 'bg-danger' : 'bg-border'
                }`}
              >
                <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                  edit.vipExclu ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Toggle VIP */}
            <div className={`space-y-3 ${edit.vipExclu ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-accent" />
                  <span className="text-white text-sm font-medium">Forcer VIP</span>
                </div>
                <button
                  onClick={() => setEdit(e => e ? { ...e, vipManual: !e.vipManual } : e)}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    edit.vipManual ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                    edit.vipManual ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {edit.vipManual && (
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map(d => (
                    <button
                      key={d.label}
                      onClick={() => setEdit(e => e ? { ...e, vipDays: d.days } : e)}
                      className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                        edit.vipDays === d.days
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'border-border text-muted hover:border-muted'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle Recommandation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-muted" />
                  <span className="text-white text-sm font-medium">Forcer Recommandation</span>
                </div>
                <button
                  onClick={() => setEdit(e => e ? { ...e, featured: !e.featured } : e)}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    edit.featured ? 'bg-accent' : 'bg-border'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-1 ${
                    edit.featured ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
              {edit.featured && (
                <div className="flex gap-2 flex-wrap">
                  {DURATIONS.map(d => (
                    <button
                      key={d.label}
                      onClick={() => setEdit(e => e ? { ...e, featuredDays: d.days } : e)}
                      className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                        edit.featuredDays === d.days
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'border-border text-muted hover:border-muted'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Note interne */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
                Note interne (admin uniquement)
              </label>
              <input
                value={edit.note}
                onChange={e => setEdit(prev => prev ? { ...prev, note: e.target.value } : prev)}
                placeholder="Ex : Partenaire de lancement, Gros poisson…"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-accent placeholder-muted"
              />
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setEdit(null)}
                className="flex-1 border border-border text-muted py-2.5 rounded-lg text-sm hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm
                           hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Sauvegarde…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
