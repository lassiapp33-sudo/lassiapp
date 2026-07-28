import React, { useEffect, useState } from 'react'
import { Eye, Save, Check, X, ToggleLeft, ToggleRight, Clock, CheckCircle2, AlertCircle, Megaphone, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id:              string
  label:           string
  price:           number
  old_price:       number | null
  per_label:       string
  duration_months: number
  duration_days:   number
  popular:         boolean
  active:          boolean
}

interface DraftPlan extends Plan {
  dirty:  boolean
  saving: boolean
  error:  string | null
  saved:  boolean
}

interface AdPack {
  id:             string
  label:          string
  tagline:        string
  budget_credits: number
  duration_hours: number
  est_min:        number
  est_max:        number
  popular:        boolean
  active:         boolean
}

interface DraftAdPack extends AdPack {
  dirty:  boolean
  saving: boolean
  error:  string | null
  saved:  boolean
}

interface Subscription {
  id:            string
  amount:        number
  status:        string
  started_at:    string
  expires_at:    string
  pay_method:    string
  offer_type:    string | null
  plan_label:    string
  shop_name:     string
  merchant_name: string
}

// ─── Helpers generiques ───────────────────────────────────────────────────────

function toDraft<T>(item: T): T & { dirty: boolean; saving: boolean; error: null; saved: boolean } {
  return { ...item, dirty: false, saving: false, error: null, saved: false }
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function VisibilityPlansPage() {
  const [quartierPlans, setQuartierPlans] = useState<DraftPlan[]>([])
  const [boostPlans,    setBoostPlans]    = useState<DraftPlan[]>([])
  const [adPacks,       setAdPacks]       = useState<DraftAdPack[]>([])
  const [subs,          setSubs]          = useState<Subscription[]>([])

  const [loadingPlans,  setLoadingPlans]  = useState(true)
  const [loadingBoost,  setLoadingBoost]  = useState(true)
  const [loadingAds,    setLoadingAds]    = useState(true)
  const [loadingSubs,   setLoadingSubs]   = useState(true)

  const [globalError, setGlobalError] = useState<string | null>(null)
  const [subsError,   setSubsError]   = useState<string | null>(null)

  // ── Chargement ───────────────────────────────────────────────────────────────

  async function loadQuartierPlans() {
    setLoadingPlans(true)
    const { data, error } = await supabase
      .from('visibility_plans')
      .select('id, label, price, old_price, per_label, duration_months, duration_days, popular, active')
      .eq('plan_type', 'quartier')
      .order('duration_days')
    if (error) { setGlobalError(error.message); setLoadingPlans(false); return }
    setQuartierPlans((data as Plan[]).map(toDraft))
    setLoadingPlans(false)
  }

  async function loadBoostPlans() {
    setLoadingBoost(true)
    const { data, error } = await supabase
      .from('visibility_plans')
      .select('id, label, price, old_price, per_label, duration_months, duration_days, popular, active')
      .eq('plan_type', 'recherche')
      .order('duration_days')
    if (error) { setLoadingBoost(false); return }
    setBoostPlans((data as Plan[]).map(toDraft))
    setLoadingBoost(false)
  }

  async function loadAdPacks() {
    setLoadingAds(true)
    const { data, error } = await supabase
      .from('ad_packs')
      .select('id, label, tagline, budget_credits, duration_hours, est_min, est_max, popular, active')
      .order('budget_credits')
    if (error) { setLoadingAds(false); return }
    setAdPacks((data as AdPack[]).map(toDraft))
    setLoadingAds(false)
  }

  async function loadSubs() {
    setLoadingSubs(true)
    setSubsError(null)
    const { data, error } = await supabase
      .from('visibility_subscriptions')
      .select(`id, amount, status, started_at, expires_at, pay_method, offer_type,
               plan:plan_id ( label ), shop:shop_id ( name ), merchant:merchant_id ( name )`)
      .order('started_at', { ascending: false })
      .limit(200)
    if (error) { setSubsError(error.message); setLoadingSubs(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSubs((data as any[]).map(r => ({
      id: r.id, amount: r.amount, status: r.status,
      started_at: r.started_at, expires_at: r.expires_at,
      pay_method: r.pay_method, offer_type: r.offer_type,
      plan_label:    r.plan?.label    ?? '—',
      shop_name:     r.shop?.name     ?? '—',
      merchant_name: r.merchant?.name ?? '—',
    })))
    setLoadingSubs(false)
  }

  useEffect(() => {
    loadQuartierPlans()
    loadBoostPlans()
    loadAdPacks()
    loadSubs()
  }, [])

  // ── Helpers mutation plans ────────────────────────────────────────────────────

  function updatePlan(
    setter: React.Dispatch<React.SetStateAction<DraftPlan[]>>,
    id: string, field: keyof Plan, value: unknown,
  ) {
    setter(prev => prev.map(p => p.id === id ? { ...p, [field]: value, dirty: true, saved: false, error: null } : p))
  }

  async function savePlan(
    plans: DraftPlan[],
    setter: React.Dispatch<React.SetStateAction<DraftPlan[]>>,
    id: string,
  ) {
    const plan = plans.find(p => p.id === id)
    if (!plan) return
    setter(prev => prev.map(p => p.id === id ? { ...p, saving: true, error: null } : p))
    const { error } = await supabase.from('visibility_plans').update({
      label: plan.label, price: plan.price, old_price: plan.old_price || null,
      per_label: plan.per_label, popular: plan.popular, active: plan.active,
    }).eq('id', id)
    if (error) {
      setter(prev => prev.map(p => p.id === id ? { ...p, saving: false, error: error.message } : p))
    } else {
      setter(prev => prev.map(p => p.id === id ? { ...p, saving: false, dirty: false, saved: true } : p))
      setTimeout(() => setter(prev => prev.map(p => p.id === id ? { ...p, saved: false } : p)), 2500)
    }
  }

  // ── Helpers mutation ad_packs ─────────────────────────────────────────────────

  function updateAdPack(id: string, field: keyof AdPack, value: unknown) {
    setAdPacks(prev => prev.map(p => p.id === id ? { ...p, [field]: value, dirty: true, saved: false, error: null } : p))
  }

  async function saveAdPack(id: string) {
    const pack = adPacks.find(p => p.id === id)
    if (!pack) return
    setAdPacks(prev => prev.map(p => p.id === id ? { ...p, saving: true, error: null } : p))
    const { error } = await supabase.from('ad_packs').update({
      label: pack.label, tagline: pack.tagline,
      budget_credits: pack.budget_credits, duration_hours: pack.duration_hours,
      est_min: pack.est_min, est_max: pack.est_max,
      popular: pack.popular, active: pack.active,
    }).eq('id', id)
    if (error) {
      setAdPacks(prev => prev.map(p => p.id === id ? { ...p, saving: false, error: error.message } : p))
    } else {
      setAdPacks(prev => prev.map(p => p.id === id ? { ...p, saving: false, dirty: false, saved: true } : p))
      setTimeout(() => setAdPacks(prev => prev.map(p => p.id === id ? { ...p, saved: false } : p)), 2500)
    }
  }

  async function saveAllDirty() {
    await Promise.all([
      ...quartierPlans.filter(p => p.dirty).map(p => savePlan(quartierPlans, setQuartierPlans, p.id)),
      ...boostPlans.filter(p => p.dirty).map(p => savePlan(boostPlans, setBoostPlans, p.id)),
      ...adPacks.filter(p => p.dirty).map(p => saveAdPack(p.id)),
    ])
  }

  const hasDirty = [...quartierPlans, ...boostPlans, ...adPacks].some(p => p.dirty)

  // Stats
  const totalActive  = subs.filter(s => s.status === 'active').length
  const totalRevenue = subs.filter(s => s.status === 'active').reduce((a, s) => a + s.amount, 0)

  return (
    <div className="p-6 space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Packs Visibilité</h1>
          <p className="text-muted text-sm mt-0.5">Modifie les tarifs des 3 familles de packs — appliqués immédiatement dans l'app.</p>
        </div>
        <button onClick={saveAllDirty} disabled={!hasDirty}
          className="bg-accent text-bg font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-accent/90 transition-colors
                     flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
          <Save size={16} /> Tout sauvegarder
        </button>
      </div>

      {globalError && (
        <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3">
          <X size={16} className="text-danger" /><span className="text-danger text-sm">{globalError}</span>
        </div>
      )}

      {/* ── 1. Offre du quartier ─────────────────────────────────────────── */}
      <Section icon={<Eye size={16} />} title="Offre du Quartier" subtitle="Mise en avant de produits dans le feed local">
        {loadingPlans ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {quartierPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan}
                onChange={(f, v) => updatePlan(setQuartierPlans, plan.id, f, v)}
                onSave={() => savePlan(quartierPlans, setQuartierPlans, plan.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* ── 2. Booster recherche ─────────────────────────────────────────── */}
      <Section icon={<TrendingUp size={16} />} title="Booster ma position dans les recherches" subtitle="Forfaits pour remonter en tête des résultats (en FCFA)">
        {loadingBoost ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {boostPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan}
                onChange={(f, v) => updatePlan(setBoostPlans, plan.id, f, v)}
                onSave={() => savePlan(boostPlans, setBoostPlans, plan.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* ── 3. Annonces sponsorisées ─────────────────────────────────────── */}
      <Section icon={<Megaphone size={16} />} title="Annonces Sponsorisées" subtitle="Packs clés en main (en crédits LASSI)">
        {loadingAds ? <Spinner /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {adPacks.map(pack => (
              <AdPackCard key={pack.id} pack={pack}
                onChange={(f, v) => updateAdPack(pack.id, f, v)}
                onSave={() => saveAdPack(pack.id)} />
            ))}
          </div>
        )}
      </Section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {!loadingSubs && !subsError && (
        <div className="grid grid-cols-3 gap-4">
          <StatBadge label="Abonnements actifs" value={totalActive} color="success" />
          <StatBadge label="Total souscriptions" value={subs.length} color="accent" />
          <StatBadge label="Revenus actifs (FCFA)" value={totalRevenue.toLocaleString('fr-FR')} color="accent" />
        </div>
      )}

      {/* ── Historique souscriptions ─────────────────────────────────────── */}
      <Section icon={<CheckCircle2 size={16} />} title="Historique des achats" subtitle="Toutes les souscriptions payées">
        {subsError && (
          <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 mb-4">
            <X size={16} className="text-danger" /><span className="text-danger text-sm">{subsError}</span>
          </div>
        )}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {loadingSubs ? <div className="flex justify-center py-10"><Spinner /></div>
          : subs.length === 0 ? <div className="text-center py-12 text-muted text-sm">Aucune souscription.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted uppercase tracking-wider bg-bg/40">
                    <th className="px-4 py-3 text-left">Commerce</th>
                    <th className="px-4 py-3 text-left">Prestataire</th>
                    <th className="px-4 py-3 text-left">Pack</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-left">Paiement</th>
                    <th className="px-4 py-3 text-left">Début</th>
                    <th className="px-4 py-3 text-left">Fin</th>
                    <th className="px-4 py-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => {
                    const now = new Date(); const exp = new Date(s.expires_at)
                    const isActive = s.status === 'active' && exp > now
                    const daysLeft = isActive ? Math.ceil((exp.getTime() - now.getTime()) / 86400_000) : 0
                    return (
                      <tr key={s.id} className="border-b border-border hover:bg-white/4 transition-colors">
                        <td className="px-4 py-3"><p className="text-white font-medium">{s.shop_name}</p></td>
                        <td className="px-4 py-3 text-muted text-xs">{s.merchant_name}</td>
                        <td className="px-4 py-3">
                          <span className="bg-accent/15 text-accent text-xs font-semibold px-2 py-0.5 rounded-lg">{s.plan_label}</span>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs capitalize">
                          {s.offer_type === 'quartier' ? 'Quartier' : s.offer_type === 'recherche' ? 'Recherche' : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{s.amount.toLocaleString('fr-FR')} F</td>
                        <td className="px-4 py-3 text-muted text-xs capitalize">
                          {s.pay_method === 'wave' ? 'Wave' : s.pay_method === 'orange_money' ? 'Orange Money' : s.pay_method === 'credit' ? 'Crédit LASSI' : s.pay_method}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">{fmtDate(s.started_at)}</td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {fmtDate(s.expires_at)}
                          {isActive && <span className="block text-success font-medium">J-{daysLeft}</span>}
                        </td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={s.status} isActive={isActive} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}

// ─── Carte plan (Quartier / Boost recherche) ──────────────────────────────────

function PlanCard({ plan, onChange, onSave }: {
  plan:     DraftPlan
  onChange: (field: keyof Plan, value: unknown) => void
  onSave:   () => void
}) {
  const durationLabel = plan.duration_months > 0 ? `${plan.duration_months} mois` : `${plan.duration_days} jours`
  return (
    <div className={`bg-surface border rounded-2xl p-5 space-y-4 transition-colors ${plan.dirty ? 'border-accent/40' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{durationLabel}</p>
          <p className="text-muted text-xs">ID : {plan.id}</p>
        </div>
        <button onClick={() => onChange('active', !plan.active)}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            plan.active ? 'text-success bg-success/10 border border-success/25' : 'text-muted bg-border/30 border border-border'}`}>
          {plan.active ? <><ToggleRight size={14} /> Actif</> : <><ToggleLeft size={14} /> Inactif</>}
        </button>
      </div>

      <div className="space-y-3">
        <Field label="Nom du pack">
          <input value={plan.label} onChange={e => onChange('label', e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
        </Field>
        <div className="flex gap-3">
          <Field label="Prix (FCFA)" className="flex-1">
            <input type="number" min={0} step={100} value={plan.price}
              onChange={e => onChange('price', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
          </Field>
          <Field label="Prix barré" className="flex-1">
            <input type="number" min={0} step={100} value={plan.old_price ?? ''} placeholder="—"
              onChange={e => onChange('old_price', e.target.value === '' ? null : parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors placeholder-muted" />
          </Field>
        </div>
        <Field label="Libellé / période">
          <input value={plan.per_label} onChange={e => onChange('per_label', e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
        </Field>
        <Toggle label='Badge "Populaire"' checked={plan.popular} onChange={v => onChange('popular', v)} />
        {plan.old_price != null && plan.old_price > plan.price && (
          <div className="bg-success/8 border border-success/20 rounded-lg px-3 py-2 text-xs text-success">
            Économie : <span className="font-semibold">{(plan.old_price - plan.price).toLocaleString('fr-FR')} F</span>
          </div>
        )}
      </div>

      {plan.error && <ErrorMsg msg={plan.error} />}
      <SaveBtn dirty={plan.dirty} saving={plan.saving} saved={plan.saved} onSave={onSave} />
    </div>
  )
}

// ─── Carte ad pack (Annonces sponsorisées) ────────────────────────────────────

function AdPackCard({ pack, onChange, onSave }: {
  pack:     DraftAdPack
  onChange: (field: keyof AdPack, value: unknown) => void
  onSave:   () => void
}) {
  return (
    <div className={`bg-surface border rounded-2xl p-5 space-y-4 transition-colors ${pack.dirty ? 'border-accent/40' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-semibold text-sm">{pack.label}</p>
          <p className="text-muted text-xs">ID : {pack.id}</p>
        </div>
        <button onClick={() => onChange('active', !pack.active)}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
            pack.active ? 'text-success bg-success/10 border border-success/25' : 'text-muted bg-border/30 border border-border'}`}>
          {pack.active ? <><ToggleRight size={14} /> Actif</> : <><ToggleLeft size={14} /> Inactif</>}
        </button>
      </div>

      <div className="space-y-3">
        <Field label="Nom du pack">
          <input value={pack.label} onChange={e => onChange('label', e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
        </Field>
        <Field label="Sous-titre">
          <input value={pack.tagline} onChange={e => onChange('tagline', e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
        </Field>
        <div className="flex gap-3">
          <Field label="Budget (crédits)" className="flex-1">
            <input type="number" min={0} step={500} value={pack.budget_credits}
              onChange={e => onChange('budget_credits', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
          </Field>
          <Field label="Durée (heures)" className="flex-1">
            <input type="number" min={1} step={1} value={pack.duration_hours}
              onChange={e => onChange('duration_hours', parseInt(e.target.value, 10) || 1)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
          </Field>
        </div>
        <div className="flex gap-3">
          <Field label="Vues min" className="flex-1">
            <input type="number" min={0} step={100} value={pack.est_min}
              onChange={e => onChange('est_min', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
          </Field>
          <Field label="Vues max" className="flex-1">
            <input type="number" min={0} step={100} value={pack.est_max}
              onChange={e => onChange('est_max', parseInt(e.target.value, 10) || 0)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent transition-colors" />
          </Field>
        </div>
        <Toggle label='"Recommandé" badge' checked={pack.popular} onChange={v => onChange('popular', v)} />
        <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs text-muted">
          Équivalent FCFA : <span className="text-white font-semibold">{pack.budget_credits.toLocaleString('fr-FR')} F</span>
          {' · '}Durée : <span className="text-white font-semibold">{pack.duration_hours >= 24 ? `${pack.duration_hours / 24}j` : `${pack.duration_hours}h`}</span>
        </div>
      </div>

      {pack.error && <ErrorMsg msg={pack.error} />}
      <SaveBtn dirty={pack.dirty} saving={pack.saving} saved={pack.saved} onSave={onSave} />
    </div>
  )
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          <p className="text-muted text-xs">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted font-medium mb-1.5">{label}</p>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!checked)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors border ${
        checked ? 'bg-accent/8 border-accent/25' : 'border-border hover:bg-white/4'}`}>
      <p className="text-white text-sm font-medium">{label}</p>
      <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-accent' : 'bg-border'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`} />
      </div>
    </div>
  )
}

function SaveBtn({ dirty, saving, saved, onSave }: { dirty: boolean; saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <button onClick={onSave} disabled={!dirty || saving}
      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
        saved ? 'bg-success/15 text-success border border-success/30'
        : dirty ? 'bg-accent text-bg hover:bg-accent/90'
        : 'bg-border/40 text-muted cursor-not-allowed'}`}>
      {saving ? <><div className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" /> Sauvegarde…</>
      : saved  ? <><Check size={15} /> Sauvegardé</>
      :          <><Save size={15} /> Sauvegarder</>}
    </button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
      <X size={12} className="text-danger flex-shrink-0" /><p className="text-danger text-xs">{msg}</p>
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: string | number; color: 'success' | 'accent' }) {
  return (
    <div className="bg-surface border border-border rounded-xl px-5 py-4">
      <p className="text-muted text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold font-title ${color === 'success' ? 'text-success' : 'text-accent'}`}>{value}</p>
    </div>
  )
}

function StatusBadge({ status, isActive }: { status: string; isActive: boolean }) {
  if (isActive) return <span className="inline-flex items-center gap-1 text-xs bg-success/15 text-success border border-success/30 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 size={11} /> Actif</span>
  if (status === 'expired') return <span className="inline-flex items-center gap-1 text-xs bg-border/40 text-muted border border-border px-2 py-0.5 rounded-full"><Clock size={11} /> Expiré</span>
  if (status === 'pending') return <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/25 px-2 py-0.5 rounded-full"><Clock size={11} /> En attente</span>
  return <span className="inline-flex items-center gap-1 text-xs bg-danger/10 text-danger border border-danger/25 px-2 py-0.5 rounded-full"><AlertCircle size={11} /> {status}</span>
}

function Spinner() {
  return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
