/**
 * DisputesPage — Liste des litiges avec filtres par statut.
 * Badge rouge sur les litiges ouverts.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate }                 from 'react-router-dom'
import { AlertTriangle }               from 'lucide-react'
import Badge       from '../components/Badge'
import EmptyState  from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import {
  getDisputes, REASON_LABELS, STATUS_LABELS,
  type Dispute, type DisputeStatus,
} from '../services/disputes'

type Filter = 'all' | DisputeStatus

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',       label: 'Tous' },
  { key: 'open',      label: 'Ouverts' },
  { key: 'in_review', label: 'En examen' },
  { key: 'resolved',  label: 'Résolus' },
  { key: 'rejected',  label: 'Rejetés' },
]

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [filter,   setFilter]   = useState<Filter>('all')
  const [loading,  setLoading]  = useState(true)
  const navigate                = useNavigate()

  useEffect(() => {
    setLoading(true)
    getDisputes(filter)
      .then(setDisputes)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  const openCount = disputes.filter(d => d.status === 'open').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-title font-bold text-white">Litiges</h1>
        {openCount > 0 && (
          <span className="bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {openCount} ouvert{openCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-accent text-bg' : 'text-muted hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <table className="w-full">
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
            </tbody>
          </table>
        ) : disputes.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={48} />}
            title="Aucun litige pour le moment"
            subtitle="Les signalements des clients et commerçants apparaîtront ici."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Plaignant</th>
                <th className="px-4 py-3 text-left">Contre</th>
                <th className="px-4 py-3 text-left">Commerce</th>
                <th className="px-4 py-3 text-left">Motif</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/disputes/${d.id}`)}
                  className="border-b border-border hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{d.reporterName}</p>
                    <p className="text-muted text-xs capitalize">{d.reporterRole}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{d.againstName}</td>
                  <td className="px-4 py-3 text-muted text-xs">{d.shopName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{REASON_LABELS[d.reason]}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      d.type === 'order'
                        ? 'text-accent border-accent/30'
                        : 'text-orange border-orange/30'
                    }`}>
                      {d.type === 'order' ? 'Commande' : 'Dette'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={d.status} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {new Date(d.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short',
                    })}
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
