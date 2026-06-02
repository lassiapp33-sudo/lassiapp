/**
 * BIPage — Business Intelligence par quartier.
 * Graphe en barres du GTV et nombre de commandes par zone géographique.
 */
import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { Map } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getGtvByZone, formatFcfa, type ZoneStat } from '../services/analytics'

export default function BIPage() {
  const [zones,   setZones]   = useState<ZoneStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGtvByZone()
      .then(setZones)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const COLORS = ['#FDCF34', '#F0A847', '#5FD38A', '#9A9BB0', '#E07A7A', '#6E76D0']

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-title font-bold text-white">BI par quartier</h1>
        <p className="text-muted text-sm mt-0.5">
          Activité réelle agrégée par zone géographique des commerces.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={<Map size={48} />}
          title="Aucune donnée géographique encore"
          subtitle="Les zones se rempliront dès que des commandes seront traitées."
        />
      ) : (
        <>
          {/* Graphe GTV par zone */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">GTV par zone</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={zones} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2C52" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#9A9BB0', fontSize: 11 }}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="zone"
                  tick={{ fill: '#9A9BB0', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E2040', border: '1px solid #2A2C52', borderRadius: 8, color: '#fff' }}
                  formatter={(v: number) => [formatFcfa(v), 'GTV']}
                />
                <Bar dataKey="gtv" radius={[0, 4, 4, 0]}>
                  {zones.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table récap */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Zone / Quartier</th>
                  <th className="px-4 py-3 text-right">Commandes</th>
                  <th className="px-4 py-3 text-right">GTV</th>
                  <th className="px-4 py-3 text-right">Panier moyen</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={z.zone} className="border-b border-border hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-white font-medium">{z.zone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{z.ordersCount}</td>
                    <td className="px-4 py-3 text-right text-accent font-semibold">
                      {formatFcfa(z.gtv)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {z.ordersCount > 0 ? formatFcfa(Math.round(z.gtv / z.ordersCount)) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
