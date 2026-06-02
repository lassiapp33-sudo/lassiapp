/**
 * TransactionsPage — Détail des commandes et GTV par période.
 */
import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase }    from '../lib/supabase'
import { formatFcfa, getGtvDaily, getGtvByZone } from '../services/analytics'
import EmptyState from '../components/EmptyState'
import { TrendingUp } from 'lucide-react'

interface OrderRow {
  id:          string
  shopName:    string
  clientName:  string
  total:       number
  status:      string
  payMethod:   string
  createdAt:   string
}

export default function TransactionsPage() {
  const [orders,  setOrders]  = useState<OrderRow[]>([])
  const [chart,   setChart]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase
        .from('orders')
        .select('id, total, status, pay_method, client_name, created_at, shops!inner(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      getGtvDaily(30),
    ]).then(([res, c]) => {
      const rows = (res.data ?? []).map((r: any) => ({
        id:         r.id,
        shopName:   r.shops?.name ?? '—',
        clientName: r.client_name,
        total:      r.total,
        status:     r.status,
        payMethod:  r.pay_method,
        createdAt:  r.created_at,
      }))
      setOrders(rows)
      setChart(c)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const STATUS_COLORS: Record<string, string> = {
    done:      'text-success',
    ready:     'text-accent',
    preparing: 'text-orange',
    pending:   'text-muted',
    refused:   'text-danger',
  }

  const STATUS_FR: Record<string, string> = {
    done: 'Terminé', ready: 'Prêt', preparing: 'En prép.', pending: 'En attente', refused: 'Refusé',
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-title font-bold text-white">GTV & Transactions</h1>

      {/* Graphe 30 jours */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">GTV — 30 derniers jours</h2>
        {chart.some(p => p.gtv > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2C52" />
              <XAxis dataKey="day" tick={{ fill: '#9A9BB0', fontSize: 10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9A9BB0', fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E2040', border: '1px solid #2A2C52', borderRadius: 8, color: '#fff' }}
                formatter={(v: number) => [formatFcfa(v), 'GTV']}
              />
              <Bar dataKey="gtv" fill="#FDCF34" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState icon={<TrendingUp size={40} />} title="Aucune transaction encore" subtitle="Les barres apparaîtront avec les premières commandes." />
        )}
      </div>

      {/* Liste des commandes */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-white font-semibold">Dernières commandes</h2>
          <span className="text-muted text-sm">{orders.length} commandes</span>
        </div>

        {loading ? (
          <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : orders.length === 0 ? (
          <EmptyState title="Aucune commande pour le moment" subtitle="La liste se remplira au fur et à mesure." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Commerce</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-border hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{o.shopName}</td>
                  <td className="px-4 py-3 text-muted">{o.clientName}</td>
                  <td className="px-4 py-3 text-accent font-semibold text-right">{formatFcfa(o.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium ${STATUS_COLORS[o.status] ?? 'text-muted'}`}>
                      {STATUS_FR[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(o.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
