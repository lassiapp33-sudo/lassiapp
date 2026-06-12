/**
 * AnnoncesPage — Annonces système diffusées dans l'app (modale plein écran
 * type "patch notes"), ciblées par audience (tous / prestataires / clients).
 * Accès admin uniquement.
 */
import React, { useEffect, useState } from 'react'
import { Megaphone, Plus, X, Check, EyeOff, Eye } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import {
  getAnnonces, creerAnnoncePersonnalisee, desactiverAnnonce, reactiverAnnonce,
  type Annonce, type AnnonceAudience,
} from '../services/annonces'

const AUDIENCES: { value: AnnonceAudience; label: string }[] = [
  { value: 'tous',         label: 'Tous' },
  { value: 'prestataires', label: 'Prestataires' },
  { value: 'clients',      label: 'Clients' },
]

const EXPIRATIONS = [
  { label: 'Jamais',  hours: null },
  { label: '24 h',    hours: 24 },
  { label: '48 h',    hours: 48 },
  { label: '7 jours', hours: 24 * 7 },
  { label: '30 jours', hours: 24 * 30 },
]

interface FormState {
  titre:      string
  corps:      string
  icone:      string
  tag:        string
  audience:   AnnonceAudience
  expireDans: number | null
}

const EMPTY_FORM: FormState = {
  titre:      '',
  corps:      '',
  icone:      '📢',
  tag:        '',
  audience:   'tous',
  expireDans: null,
}

export default function AnnoncesPage() {
  const [annonces, setAnnonces] = useState<Annonce[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState<FormState>(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)

  function load() {
    setLoading(true)
    getAnnonces()
      .then(setAnnonces)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openForm() {
    setForm(EMPTY_FORM)
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.titre.trim() || !form.corps.trim()) {
      setError('Titre et message sont obligatoires.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await creerAnnoncePersonnalisee({
        titre:      form.titre.trim(),
        corps:      form.corps.trim(),
        icone:      form.icone.trim() || '📢',
        tag:        form.tag.trim() || null,
        audience:   form.audience,
        expireDans: form.expireDans,
      })
      setSuccess('Annonce créée.')
      setShowForm(false)
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(a: Annonce) {
    setError(null)
    setSuccess(null)
    try {
      if (a.estActif) await desactiverAnnonce(a.id)
      else await reactiverAnnonce(a.id)
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
          <h1 className="text-2xl font-title font-bold text-white">Annonces</h1>
          <p className="text-muted text-sm mt-0.5">
            Messages système affichés une fois en plein écran au démarrage de l'app.
          </p>
        </div>
        <button
          onClick={openForm}
          className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Nouvelle annonce
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

      {/* Liste des annonces */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : annonces.length === 0 ? (
          <EmptyState
            icon={<Megaphone size={32} />}
            title="Aucune annonce"
            subtitle="Crée une annonce pour informer tous les utilisateurs ou un public ciblé."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Annonce</th>
                <th className="px-4 py-3 text-left">Audience</th>
                <th className="px-4 py-3 text-left">Tag</th>
                <th className="px-4 py-3 text-left">Expire</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {annonces.map(a => (
                <tr key={a.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 max-w-md">
                    <p className="text-white font-medium">{a.icone} {a.titre}</p>
                    <p className="text-muted text-xs mt-0.5 line-clamp-2">{a.corps}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {AUDIENCES.find(au => au.value === a.audience)?.label ?? a.audience}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{a.tag || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {a.expireAt ? new Date(a.expireAt).toLocaleDateString('fr-FR') : 'Jamais'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {a.estActif
                      ? <span className="text-xs bg-success/20 text-success border border-success/30 px-1.5 py-0.5 rounded">Active</span>
                      : <span className="text-xs bg-border text-muted border border-border px-1.5 py-0.5 rounded">Désactivée</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(a)}
                      className="text-xs text-accent hover:underline flex items-center gap-1 mx-auto"
                    >
                      {a.estActif ? <EyeOff size={13} /> : <Eye size={13} />}
                      {a.estActif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de création */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Nouvelle annonce</h2>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Icône + Titre */}
            <div className="flex gap-3">
              <div className="w-20">
                <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Icône</label>
                <input
                  value={form.icone}
                  onChange={e => setForm(f => ({ ...f, icone: e.target.value }))}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm text-center
                             focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Titre</label>
                <input
                  value={form.titre}
                  onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                  placeholder="Ex : Offre spéciale Korité 🌙"
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                             focus:outline-none focus:border-accent placeholder-muted"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Message</label>
              <textarea
                value={form.corps}
                onChange={e => setForm(f => ({ ...f, corps: e.target.value }))}
                rows={4}
                placeholder="Texte affiché dans la modale…"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm resize-none
                           focus:outline-none focus:border-accent placeholder-muted"
              />
            </div>

            {/* Tag */}
            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">Tag (optionnel)</label>
              <input
                value={form.tag}
                onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                placeholder="Ex : evenement"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                           focus:outline-none focus:border-accent placeholder-muted"
              />
            </div>

            {/* Audience */}
            <div className="space-y-1.5">
              <label className="block text-xs text-muted font-medium uppercase tracking-wide">Audience</label>
              <div className="flex gap-2 flex-wrap">
                {AUDIENCES.map(au => (
                  <button
                    key={au.value}
                    onClick={() => setForm(f => ({ ...f, audience: au.value }))}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      form.audience === au.value
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-border text-muted hover:border-muted'
                    }`}
                  >
                    {au.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <label className="block text-xs text-muted font-medium uppercase tracking-wide">Expiration</label>
              <div className="flex gap-2 flex-wrap">
                {EXPIRATIONS.map(exp => (
                  <button
                    key={exp.label}
                    onClick={() => setForm(f => ({ ...f, expireDans: exp.hours }))}
                    className={`text-xs px-2.5 py-1.5 rounded border transition-colors ${
                      form.expireDans === exp.hours
                        ? 'bg-accent/20 border-accent text-accent'
                        : 'border-border text-muted hover:border-muted'
                    }`}
                  >
                    {exp.label}
                  </button>
                ))}
              </div>
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
                disabled={saving}
                className="flex-1 bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm
                           hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
