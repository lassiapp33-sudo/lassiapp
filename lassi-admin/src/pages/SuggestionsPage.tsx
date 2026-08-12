/**
 * SuggestionsPage — Gestion des suggestions prédéfinies de la Fiche Guidée.
 * Navigation par sous-catégorie (granularité fine) + section.
 */
import React, { useEffect, useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

type FicheSection = 'type_contenu' | 'sous_categorie_produit' | 'nom_produit' | 'prix'

interface Suggestion {
  id:                string
  categorie_id:      string
  sous_categorie_id: string | null
  section:           FicheSection
  valeur:            string
  ordre:             number
  actif:             boolean
  created_at:        string
}

interface NewForm {
  categorie_id:      string
  sous_categorie_id: string
  section:           FicheSection
  valeur:            string
  ordre:             string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'food',      label: 'Restos & Boissons' },
  { id: 'hair',      label: 'Coiffeurs & Salons' },
  { id: 'tangana',   label: 'Tangana / Ndéki / Soupe' },
  { id: 'bakery',    label: 'Boulangeries' },
  { id: 'stores',    label: 'Commerçants' },
  { id: 'fruiterie', label: 'Fruiterie' },
  { id: 'sport',     label: 'Sport' },
]

// ─── Sous-catégories ──────────────────────────────────────────────────────────
// À compléter au fur et à mesure : { id: slug en base, label: affiché, categorieId }

const SOUS_CATEGORIES: { id: string; label: string; categorieId: string }[] = [
  // Exemples à remplacer par les vraies listes
]

const SECTIONS: { id: FicheSection; label: string }[] = [
  { id: 'type_contenu',           label: 'Type de contenu' },
  { id: 'sous_categorie_produit', label: 'Sous-catégorie produit' },
  { id: 'nom_produit',            label: 'Nom du produit' },
  { id: 'prix',                   label: 'Prix' },
]

const EMPTY_FORM: NewForm = {
  categorie_id:      'food',
  sous_categorie_id: '',
  section:           'nom_produit',
  valeur:            '',
  ordre:             '0',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState<string | null>(null)

  // Filtres
  const [filterSousCat,  setFilterSousCat]  = useState<string | null>(null)
  const [filterSection,  setFilterSection]  = useState<FicheSection | 'toutes'>('toutes')

  // Formulaire ajout
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<NewForm>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('suggestions_fiche')
        .select('*')
        .order('sous_categorie_id')
        .order('section')
        .order('ordre')
      if (err) throw err
      setSuggestions(data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function notify(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }


  async function handleToggle(s: Suggestion) {
    const { error: err } = await supabase
      .from('suggestions_fiche')
      .update({ actif: !s.actif })
      .eq('id', s.id)
    if (err) { setError(err.message); return }
    setSuggestions(prev => prev.map(x => x.id === s.id ? { ...x, actif: !s.actif } : x))
    notify(s.actif ? 'Suggestion désactivée' : 'Suggestion activée')
  }

  async function handleDelete(s: Suggestion) {
    if (!window.confirm(`Supprimer « ${s.valeur} » ? Cette action est irréversible.`)) return
    const { error: err } = await supabase.from('suggestions_fiche').delete().eq('id', s.id)
    if (err) { setError(err.message); return }
    setSuggestions(prev => prev.filter(x => x.id !== s.id))
    notify('Suggestion supprimée')
  }

  async function handleSave() {
    if (!form.valeur.trim())         { setError('La valeur est requise.'); return }
    if (!form.sous_categorie_id.trim()) { setError('La sous-catégorie est requise.'); return }
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('suggestions_fiche')
        .insert({
          categorie_id:      form.categorie_id,
          sous_categorie_id: form.sous_categorie_id.trim(),
          section:           form.section,
          valeur:            form.valeur.trim(),
          ordre:             parseInt(form.ordre, 10) || 0,
          actif:             true,
        })
        .select()
        .single()
      if (err) throw err
      setSuggestions(prev => [...prev, data])
      setForm(f => ({ ...f, valeur: '', ordre: '0' }))
      setShowForm(false)
      setFilterSousCat(form.sous_categorie_id.trim())
      notify('Suggestion ajoutée ✓')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  // Filtrage
  const filtered = suggestions.filter(s => {
    if (filterSousCat && s.sous_categorie_id !== filterSousCat) return false
    if (filterSection !== 'toutes' && s.section !== filterSection) return false
    return true
  })

  // Groupement par section
  const grouped = SECTIONS.map(sec => ({
    ...sec,
    items: filtered.filter(s => s.section === sec.id),
  })).filter(g => filterSection === 'toutes' || g.id === filterSection)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-title text-2xl">Fiche Guidée — Suggestions</h1>
          <p className="text-muted text-sm mt-1">
            Listes prédéfinies par sous-catégorie affichées dans l'app lors de la création de produits.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true)
            setForm({ ...EMPTY_FORM, sous_categorie_id: filterSousCat ?? '' })
          }}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-bg rounded-xl font-title text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Alertes */}
      {error   && <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
      {success && <div className="bg-green-900/30 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">{success}</div>}

      {/* Filtre sous-catégories */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Toutes */}
          <button
            onClick={() => setFilterSousCat(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-ui border transition-all ${
              filterSousCat === null
                ? 'bg-accent text-bg border-accent'
                : 'bg-surface text-muted border-border hover:border-accent/40'
            }`}
          >
            Toutes
          </button>
          {SOUS_CATEGORIES.map(sc => (
            <button
              key={sc.id}
              onClick={() => setFilterSousCat(sc.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-ui border transition-all ${
                filterSousCat === sc.id
                  ? 'bg-accent text-bg border-accent'
                  : 'bg-surface text-muted border-border hover:border-accent/40'
              }`}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Filtre sections */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterSection('toutes')}
            className={`px-3 py-1.5 rounded-full text-xs font-ui border transition-all ${
              filterSection === 'toutes'
                ? 'bg-white/10 text-white border-white/20'
                : 'bg-surface text-muted border-border hover:border-white/20'
            }`}
          >
            Toutes sections
          </button>
          {SECTIONS.map(sec => (
            <button
              key={sec.id}
              onClick={() => setFilterSection(sec.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-ui border transition-all ${
                filterSection === sec.id
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-surface text-muted border-border hover:border-white/20'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="bg-surface border border-accent/30 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-title text-base">Nouvelle suggestion</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-muted text-xs uppercase tracking-wide block mb-1">Sous-catégorie *</label>
              <input
                type="text"
                value={form.sous_categorie_id}
                onChange={e => setForm(p => ({ ...p, sous_categorie_id: e.target.value }))}
                placeholder="Ex : Coiffure hommes, Fast-food, Pâtisserie…"
                list="sousCatList"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-white text-sm placeholder-muted"
              />
              <datalist id="sousCatList">
                {SOUS_CATEGORIES.map(sc => <option key={sc.id} value={sc.id} />)}
              </datalist>
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wide block mb-1">Section *</label>
              <select
                value={form.section}
                onChange={e => setForm(p => ({ ...p, section: e.target.value as FicheSection }))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-white text-sm"
              >
                {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wide block mb-1">Valeur *</label>
              <input
                type="text"
                value={form.valeur}
                onChange={e => setForm(p => ({ ...p, valeur: e.target.value }))}
                placeholder="Ex : Menu du jour, Burger, 2000…"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-white text-sm placeholder-muted"
              />
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wide block mb-1">Ordre</label>
              <input
                type="number"
                value={form.ordre}
                onChange={e => setForm(p => ({ ...p, ordre: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-white text-sm"
                min={0}
              />
            </div>
            <div>
              <label className="text-muted text-xs uppercase tracking-wide block mb-1">Catégorie parente</label>
              <select
                value={form.categorie_id}
                onChange={e => setForm(p => ({ ...p, categorie_id: e.target.value }))}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-white text-sm"
              >
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-accent text-bg rounded-xl font-title text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border text-muted rounded-xl text-sm hover:border-white/30 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Compteur */}
      {filterSousCat && !loading && (
        <p className="text-muted text-xs">
          <span className="text-white font-ui">
            {SOUS_CATEGORIES.find(s => s.id === filterSousCat)?.label ?? filterSousCat}
          </span>
          {' — '}{filtered.length} suggestion{filtered.length > 1 ? 's' : ''}
          {filterSection !== 'toutes' ? ` · ${SECTIONS.find(s => s.id === filterSection)?.label}` : ''}
        </p>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={filterSousCat ? `Aucune suggestion pour « ${filterSousCat} ».` : 'Aucune suggestion trouvée.'} />
      ) : (
        <div className="space-y-6">
          {grouped.map(group => group.items.length > 0 && (
            <div key={group.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-white font-title text-sm">{group.label}</span>
                <span className="text-muted text-xs">{group.items.length} suggestion{group.items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-border">
                {group.items.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`flex-1 text-sm font-ui ${s.actif ? 'text-white' : 'text-muted line-through'}`}>
                      {s.valeur}
                    </span>
                    <span className="text-muted text-xs w-8 text-center">#{s.ordre}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.actif ? 'bg-green-900/30 text-green-400' : 'bg-red-900/20 text-red-400/70'}`}>
                      {s.actif ? 'Actif' : 'Inactif'}
                    </span>
                    <button
                      onClick={() => handleToggle(s)}
                      className="text-muted hover:text-accent transition-colors"
                      title={s.actif ? 'Désactiver' : 'Activer'}
                    >
                      {s.actif ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="text-muted hover:text-red-400 transition-colors"
                      title="Supprimer définitivement"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
