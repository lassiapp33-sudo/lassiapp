/**
 * OverviewPage — Vue d'ensemble : GTV, commission, commandes, commerces.
 * 100% données réelles Supabase. Aucune donnée fictive.
 */
import React, { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, ShoppingBag, Store, Coins } from 'lucide-react'
import StatCard    from '../components/StatCard'
import EmptyState  from '../components/EmptyState'
import { SkeletonCard } from '../components/Skeleton'
import {
  getGtvSummary, getGtvDaily,
  formatFcfa, periodFrom,
  type GtvSummary, type GtvDailyPoint,
} from '../services/analytics'

type Period = 'day' | 'week' | 'month'

export default function OverviewPage() {
  const [period,  setPeriod]  = useState<Period>('week')
  const [summary, setSummary] = useState<GtvSummary | null>(null)
  const [chart,   setChart]   = useState<GtvDailyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const from = periodFrom(period)
    const to   = new Date()

    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30

    Promise.all([
      getGtvSummary(from, to),
      getGtvDaily(days),
    ])
      .then(([s, c]) => {
        if (cancelled) return
        setSummary(s)
        setChart(c)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [period])

  const PERIODS: Array<{ key: Period; label: string }> = [
    { key: 'day',   label: "Aujourd'hui" },
    { key: 'week',  label: '7 derniers jours' },
    { key: 'month', label: '30 derniers jours' },
  ]

  const hasChartData = chart.some(p => p.gtv > 0)

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-title font-bold text-white">Vue d'ensemble</h1>
          <p className="text-muted text-sm mt-0.5">Données en temps réel — Supabase</p>
        </div>

        {/* Sélecteur de période */}
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-accent text-bg'
                  : 'text-muted hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
          <p className="text-danger text-sm">Erreur : {error}</p>
        </div>
      )}

      {/* Cartes stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : summary ? (
          <>
            <StatCard
              label="GTV"
              value={formatFcfa(summary.gtv)}
              sub="Transactions payées"
              icon={<TrendingUp size={18} />}
              accent
            />
            <StatCard
              label="Ta commission (0,5%)"
              value={formatFcfa(summary.commission)}
              sub="Sur le GTV de la période"
              icon={<Coins size={18} />}
            />
            <StatCard
              label="Commandes"
              value={summary.ordersCount.toString()}
              sub="Payées / en préparation"
              icon={<ShoppingBag size={18} />}
            />
            <StatCard
              label="Commerces actifs"
              value={summary.shopsActive.toString()}
              sub="Avec activité sur la période"
              icon={<Store size={18} />}
            />
          </>
        ) : null}
      </div>

      {/* Graphe GTV */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">
          Évolution du GTV — {PERIODS.find(p => p.key === period)?.label}
        </h2>

        {loading ? (
          <div className="h-56 bg-border/30 rounded animate-pulse" />
        ) : !hasChartData ? (
          <EmptyState
            icon={<TrendingUp size={48} />}
            title="Aucune transaction pour le moment"
            subtitle="Le graphe se remplira automatiquement dès les premières commandes."
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="gtvGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FDCF34" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#FDCF34" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2C52" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#9A9BB0', fontSize: 11 }}
                tickFormatter={v => v.slice(5)}   // affiche MM-DD
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9A9BB0', fontSize: 11 }}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E2040',
                  border: '1px solid #2A2C52',
                  borderRadius: 8,
                  color: '#fff',
                }}
                formatter={(value: number) => [formatFcfa(value), 'GTV']}
                labelFormatter={label => `Journée du ${label}`}
              />
              <Area
                type="monotone"
                dataKey="gtv"
                stroke="#FDCF34"
                strokeWidth={2}
                fill="url(#gtvGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Résumé texte si peu de données */}
      {!loading && summary && summary.gtv === 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-muted text-sm text-center">
            📊 Le dashboard affiche <span className="text-white font-medium">0 FCFA</span> parce qu'aucune commande n'a encore été traitée.
            C'est normal au démarrage — les chiffres se mettront à jour automatiquement.
          </p>
        </div>
      )}
    </div>
  )
}
