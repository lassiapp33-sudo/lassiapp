/**
 * VipPage — Scoring VIP : classement en cours, historique, config, journal.
 */
import React, { useEffect, useState } from 'react'
import { Trophy, RefreshCw, Settings, Clock, History, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import {
  getVipScores, getVipRunLog, getVipHistory, getVipSettings, updateVipSettings,
  recalculateVip, getCurrentISOWeek,
  type VipScoreShop, type VipRunLog, type VipRanking, type VipSettings,
} from '../services/promotions'

const CATEGORY_LABELS: Record<string, string> = {
  stores:    'Commerçants',
  tangana:   'Tangana',
  food:      'Restos',
  hair:      'Coiffeurs',
  sport:     'Fitness',
  bakery:    'Boulangeries',
  fruiterie: 'Fruiterie',
}

type Tab = 'classement' | 'historique' | 'config' | 'journal'

export default function VipPage() {
  const [tab,       setTab]       = useState<Tab>('classement')
  const [shops,     setShops]     = useState<VipScoreShop[]>([])
  const [logs,      setLogs]      = useState<VipRunLog[]>([])
  const [history,   setHistory]   = useState<VipRanking[]>([])
  const [settings,  setSettings]  = useState<VipSettings | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [recalcMsg, setRecalcMsg] = useState<string | null>(null)
  const [recalcErr, setRecalcErr] = useState<string | null>(null)
  const [recalcing, setRecalcing] = useState(false)
  const [savingCfg, setSavingCfg] = useState(false)
  const [cfgMsg,    setCfgMsg]    = useState<string | null>(null)
  const [showAll,   setShowAll]   = useState(false)

  const semaine = getCurrentISOWeek()

  function loadClassement() {
    setLoading(true)
    getVipScores()
      .then(setShops)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function loadLogs() {
    setLoading(true)
    getVipRunLog()
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function loadHistory() {
    setLoading(true)
    getVipHistory()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function loadSettings() {
    setLoading(true)
    getVipSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'classement')  loadClassement()
    if (tab === 'journal')     loadLogs()
    if (tab === 'historique')  loadHistory()
    if (tab === 'config')      loadSettings()
  }, [tab])

  async function handleRecalculate() {
    setRecalcing(true)
    setRecalcMsg(null)
    setRecalcErr(null)
    try {
      const res = await recalculateVip()
      if (res.result?.motif === 'doublon — semaine déjà traitée') {
        setRecalcErr('Semaine ' + semaine + ' déjà calculée. Pour forcer : demande à l\'équipe tech de supprimer le log.')
      } else {
        setRecalcMsg('Recalcul effectué — ' + semaine)
        loadClassement()
      }
    } catch (err: any) {
      setRecalcErr(err.message)
    } finally {
      setRecalcing(false)
    }
  }

  async function handleSaveSettings() {
    if (!settings) return
    setSavingCfg(true)
    setCfgMsg(null)
    try {
      await updateVipSettings({
        poids_commandes:     settings.poids_commandes,
        poids_ca:            settings.poids_ca,
        poids_note:          settings.poids_note,
        cap_ca_par_commande: settings.cap_ca_par_commande,
        plafond_par_client:  settings.plafond_par_client,
        taille_podium:       settings.taille_podium,
      })
      setCfgMsg('Configuration enregistrée.')
    } catch (err: any) {
      setCfgMsg('Erreur : ' + err.message)
    } finally {
      setSavingCfg(false)
    }
  }

  // Grouper par catégorie
  const byCategory = shops.reduce<Record<string, VipScoreShop[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    if (acc[s.category].length < 3) acc[s.category].push(s)
    return acc
  }, {})

  // Grouper historique par semaine
  const histBySemaine = history.reduce<Record<string, VipRanking[]>>((acc, r) => {
    if (!acc[r.semaine]) acc[r.semaine] = []
    acc[r.semaine].push(r)
    return acc
  }, {})

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'classement', label: 'Classement', icon: <Trophy size={15} /> },
    { id: 'historique', label: 'Historique', icon: <History size={15} /> },
    { id: 'config',     label: 'Config',     icon: <Settings size={15} /> },
    { id: 'journal',    label: 'Journal',    icon: <Clock size={15} /> },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Système VIP</h1>
          <p className="text-muted text-sm mt-0.5">
            Semaine en cours : <span className="text-accent font-mono">{semaine}</span> · Calcul serveur · Anti-triche
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalcing}
          className="flex items-center gap-2 bg-accent text-bg font-semibold px-4 py-2 rounded-lg text-sm
                     hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={recalcing ? 'animate-spin' : ''} />
          {recalcing ? 'Calcul…' : 'Recalculer'}
        </button>
      </div>

      {recalcMsg && (
        <div className="bg-success/10 border border-success/30 text-success text-sm rounded-xl px-4 py-3">
          {recalcMsg}
        </div>
      )}
      {recalcErr && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
          {recalcErr}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-accent text-bg' : 'text-muted hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Classement ────────────────────────────────────────────── */}
          {tab === 'classement' && (
            <div className="space-y-4">
              {Object.keys(byCategory).length === 0 ? (
                <EmptyState
                  icon={<Trophy size={48} />}
                  title="Aucun commerce VIP cette semaine"
                  subtitle="Le scoring se calcule sur les commandes done + payées via LASSI des 7 derniers jours."
                />
              ) : (
                Object.entries(byCategory).map(([cat, catShops]) => (
                  <div key={cat} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border bg-border/20">
                      <h2 className="text-white font-semibold">{CATEGORY_LABELS[cat] ?? cat}</h2>
                    </div>
                    <div className="divide-y divide-border">
                      {catShops.map((shop, i) => (
                        <div key={shop.id} className="px-5 py-4 flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-title font-bold flex-shrink-0 ${
                            i === 0 ? 'bg-accent text-bg' :
                            i === 1 ? 'bg-muted/30 text-white' :
                                      'bg-border text-muted'
                          }`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium truncate ${shop.vipExclu ? 'line-through text-muted' : 'text-white'}`}>
                                {shop.name}
                              </span>
                              {shop.isVip    && <Badge variant="vip-scoring" />}
                              {shop.vipManual && <Badge variant="vip-manual" />}
                              {shop.vipExclu  && (
                                <span className="text-xs bg-danger/20 text-danger border border-danger/30 px-1.5 py-0.5 rounded">
                                  Exclu
                                </span>
                              )}
                            </div>
                            <p className="text-muted text-xs mt-0.5">{shop.zone || 'Zone non renseignée'}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-accent font-semibold text-sm">{shop.ordersCount} cmd</p>
                            <p className="text-muted text-xs">★{shop.rating.toFixed(1)} · {shop.score.toFixed(1)}pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {/* Table complète */}
              {shops.length > 0 && (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowAll(v => !v)}
                    className="w-full px-5 py-4 flex items-center justify-between text-white font-semibold hover:bg-white/5 transition-colors"
                  >
                    <span>Classement complet ({shops.length} commerces)</span>
                    {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showAll && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-border text-xs text-muted uppercase tracking-wider">
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Commerce</th>
                          <th className="px-4 py-3 text-left">Cat.</th>
                          <th className="px-4 py-3 text-right">Cmd.</th>
                          <th className="px-4 py-3 text-right">Note</th>
                          <th className="px-4 py-3 text-right">Score</th>
                          <th className="px-4 py-3 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shops.map((shop, i) => (
                          <tr key={shop.id} className="border-t border-border hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3 text-muted text-xs">{i + 1}</td>
                            <td className={`px-4 py-3 font-medium ${shop.vipExclu ? 'line-through text-muted' : 'text-white'}`}>
                              {shop.name}
                            </td>
                            <td className="px-4 py-3 text-muted">{CATEGORY_LABELS[shop.category] ?? shop.category}</td>
                            <td className="px-4 py-3 text-right text-white">{shop.ordersCount}</td>
                            <td className="px-4 py-3 text-right text-muted">{shop.rating.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right text-accent font-semibold">{shop.score.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center">
                              {shop.vipExclu
                                ? <span className="text-xs text-danger">Exclu</span>
                                : shop.isVip
                                  ? <Badge variant="vip-scoring" />
                                  : shop.vipManual
                                    ? <Badge variant="vip-manual" />
                                    : <span className="text-muted text-xs">—</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Historique ────────────────────────────────────────────── */}
          {tab === 'historique' && (
            <div className="space-y-4">
              {Object.keys(histBySemaine).length === 0 ? (
                <EmptyState
                  icon={<History size={48} />}
                  title="Pas encore d'historique"
                  subtitle="L'historique se construit à chaque recalcul hebdomadaire."
                />
              ) : (
                Object.entries(histBySemaine).map(([sem, rows]) => (
                  <div key={sem} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border bg-border/20 flex items-center gap-3">
                      <h2 className="text-white font-semibold font-mono">{sem}</h2>
                      {sem === semaine && (
                        <span className="text-xs bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full">
                          Semaine courante
                        </span>
                      )}
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                          <th className="px-4 py-3 text-left">Rang</th>
                          <th className="px-4 py-3 text-left">Commerce</th>
                          <th className="px-4 py-3 text-left">Catégorie</th>
                          <th className="px-4 py-3 text-right">Score</th>
                          <th className="px-4 py-3 text-center">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-b border-border hover:bg-white/5">
                            <td className="px-4 py-3">
                              <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                                r.rang === 1 ? 'bg-accent text-bg' :
                                r.rang === 2 ? 'bg-muted/30 text-white' :
                                               'bg-border text-muted'
                              }`}>
                                {r.rang}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white font-medium">{r.shops?.name}</td>
                            <td className="px-4 py-3 text-muted">{CATEGORY_LABELS[r.categorie] ?? r.categorie}</td>
                            <td className="px-4 py-3 text-right text-accent font-semibold">{r.score.toFixed(1)}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                r.source === 'manuel'
                                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  : 'bg-accent/10 text-accent border-accent/20'
                              }`}>
                                {r.source}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Config ────────────────────────────────────────────────── */}
          {tab === 'config' && settings && (
            <div className="bg-surface border border-border rounded-xl p-6 space-y-5 max-w-lg">
              <div>
                <h2 className="text-white font-semibold">Configuration des poids VIP</h2>
                <p className="text-muted text-sm mt-0.5">
                  Modifiable sans toucher au code. Effectif au prochain recalcul.
                </p>
              </div>

              <div className="space-y-4">
                <ConfigField
                  label="Poids Commandes (%)"
                  hint="Part du score basée sur le volume de commandes"
                  value={settings.poids_commandes}
                  onChange={v => setSettings(s => s ? { ...s, poids_commandes: v } : s)}
                />
                <ConfigField
                  label="Poids CA (%)"
                  hint="Part du score basée sur le chiffre d'affaires vérifié (plafonné)"
                  value={settings.poids_ca}
                  onChange={v => setSettings(s => s ? { ...s, poids_ca: v } : s)}
                />
                <ConfigField
                  label="Poids Note (%)"
                  hint="Part du score basée sur la note pondérée par le nb d'avis"
                  value={settings.poids_note}
                  onChange={v => setSettings(s => s ? { ...s, poids_note: v } : s)}
                />
                <ConfigField
                  label="Plafond CA / commande (XOF)"
                  hint="Cap anti-whale : chaque commande est comptée max à ce montant"
                  value={settings.cap_ca_par_commande}
                  onChange={v => setSettings(s => s ? { ...s, cap_ca_par_commande: v } : s)}
                />
                <ConfigField
                  label="Max commandes par client / shop / semaine"
                  hint="Anti-triche : limite la contribution d'un même complice"
                  value={settings.plafond_par_client}
                  onChange={v => setSettings(s => s ? { ...s, plafond_par_client: v } : s)}
                />
                <ConfigField
                  label="Taille du podium"
                  hint="Nombre de places VIP par catégorie (défaut : 3)"
                  value={settings.taille_podium}
                  onChange={v => setSettings(s => s ? { ...s, taille_podium: v } : s)}
                />
              </div>

              {cfgMsg && (
                <p className={`text-sm ${cfgMsg.startsWith('Erreur') ? 'text-danger' : 'text-success'}`}>
                  {cfgMsg}
                </p>
              )}

              <div className="text-xs text-muted border-t border-border pt-3">
                Dernière modif : {settings.updated_at
                  ? new Date(settings.updated_at).toLocaleString('fr-FR')
                  : '—'}
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={savingCfg}
                className="w-full bg-accent text-bg font-semibold py-2.5 rounded-lg text-sm
                           hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {savingCfg ? 'Enregistrement…' : 'Enregistrer la config'}
              </button>
            </div>
          )}

          {/* ── Journal ───────────────────────────────────────────────── */}
          {tab === 'journal' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {logs.length === 0 ? (
                <EmptyState
                  icon={<Clock size={48} />}
                  title="Aucune exécution enregistrée"
                  subtitle="Le journal se remplit à chaque run hebdomadaire ou manuel."
                />
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Semaine</th>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-left">Détails</th>
                      <th className="px-4 py-3 text-left">Déclenché par</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-border hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-white text-xs">{log.semaine}</td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {new Date(log.run_at).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            log.statut === 'ok'
                              ? 'bg-success/20 text-success border-success/30'
                              : log.statut === 'doublon'
                                ? 'bg-muted/20 text-muted border-border'
                                : 'bg-danger/20 text-danger border-danger/30'
                          }`}>
                            {log.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs max-w-xs truncate">{log.details ?? '—'}</td>
                        <td className="px-4 py-3 text-muted text-xs font-mono">
                          {log.run_by === 'cron' ? 'cron auto' : log.run_by.slice(0, 8) + '…'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ConfigField({
  label, hint, value, onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-white text-sm font-medium mb-1">{label}</label>
      <p className="text-muted text-xs mb-1.5">{hint}</p>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm
                   focus:outline-none focus:border-accent"
      />
    </div>
  )
}
