/**
 * TerrainReservationsPage — Réservations terrain web (s.lassi.tech)
 */
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import EmptyState   from '../components/EmptyState'
import { Calendar } from 'lucide-react'

interface TerrainRow {
  id:                 string
  terrainNom:         string
  clientName:         string
  clientPhone:        string
  dateReservation:    string
  heureDebut:         string
  heureFin:           string
  prixTotal:          number
  commissionLassi:    number
  montantPrestataire: number
  moyenPaiement:      string
  statut:             string
  payoutStatut:       string | null
  receiptCode:        string | null
  createdAt:          string
}

function formatFcfa(v: number) {
  return (v ?? 0).toLocaleString('fr-FR') + ' FCFA'
}

const STATUT_COLORS: Record<string, string> = {
  paye:       'text-green-400',
  en_attente: 'text-yellow-400',
  annule:     'text-red-400',
}
const STATUT_FR: Record<string, string> = {
  paye:       'Payé',
  en_attente: 'En attente',
  annule:     'Annulé',
}
const PAYOUT_COLORS: Record<string, string> = {
  ok:      'text-green-400',
  pending: 'text-yellow-400',
  erreur:  'text-red-400',
}

export default function TerrainReservationsPage() {
  const [rows,    setRows]    = useState<TerrainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<'all' | 'paye' | 'en_attente'>('all')

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('reservations_terrain')
          .select(`
            id, client_name, client_phone,
            date_reservation, heure_debut, heure_fin,
            prix_total, commission_lassi, montant_prestataire,
            moyen_paiement, statut, payout_statut, receipt_code, created_at,
            terrains ( nom )
          `)
          .order('created_at', { ascending: false })
          .limit(200)
        if (error) console.error('[terrain-admin]', error.message)
        setRows((data ?? []).map((r: any) => ({
          id:                 r.id,
          terrainNom:         r.terrains?.nom ?? '—',
          clientName:         r.client_name   ?? '—',
          clientPhone:        r.client_phone  ?? '—',
          dateReservation:    r.date_reservation,
          heureDebut:         (r.heure_debut ?? '').slice(0, 5),
          heureFin:           (r.heure_fin   ?? '').slice(0, 5),
          prixTotal:          r.prix_total          ?? 0,
          commissionLassi:    r.commission_lassi    ?? 0,
          montantPrestataire: r.montant_prestataire ?? 0,
          moyenPaiement:      r.moyen_paiement      ?? '—',
          statut:             r.statut              ?? '—',
          payoutStatut:       r.payout_statut,
          receiptCode:        r.receipt_code,
          createdAt:          r.created_at,
        })))
      } catch (e) {
        console.error('[terrain-admin]', e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = filter === 'all' ? rows : rows.filter(r => r.statut === filter)

  const totalPaye = rows
    .filter(r => r.statut === 'paye')
    .reduce((s, r) => s + r.prixTotal, 0)
  const totalCommission = rows
    .filter(r => r.statut === 'paye')
    .reduce((s, r) => s + r.commissionLassi, 0)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-title font-bold text-white">Réservations Terrain</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total collecté', value: formatFcfa(totalPaye) },
          { label: 'Commission LASSI', value: formatFcfa(totalCommission) },
          { label: 'Réservations payées', value: String(rows.filter(r => r.statut === 'paye').length) },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-5">
            <p className="text-muted text-xs mb-1">{s.label}</p>
            <p className="text-accent font-bold text-lg">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['all', 'paye', 'en_attente'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-accent text-navy'
                : 'bg-surface border border-border text-muted hover:text-white'
            }`}
          >
            {f === 'all' ? 'Tout' : STATUT_FR[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-white font-semibold">Réservations</h2>
          <span className="text-muted text-sm">{filtered.length} résultats</span>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar size={40} />}
            title="Aucune réservation"
            subtitle="Les réservations terrain apparaîtront ici."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Terrain</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Date / Créneau</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-center">Paiement</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-center">Reversement</th>
                  <th className="px-4 py-3 text-left">Code reçu</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-border hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{r.terrainNom}</td>
                    <td className="px-4 py-3">
                      <p className="text-white">{r.clientName}</p>
                      <p className="text-muted text-xs">{r.clientPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      <p>{r.dateReservation}</p>
                      <p>{r.heureDebut} – {r.heureFin}</p>
                    </td>
                    <td className="px-4 py-3 text-accent font-semibold text-right">{formatFcfa(r.prixTotal)}</td>
                    <td className="px-4 py-3 text-right text-white">{formatFcfa(r.commissionLassi)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted">
                        {r.moyenPaiement === 'wave' ? 'Wave' : r.moyenPaiement === 'orange_money' ? 'OM' : r.moyenPaiement}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${STATUT_COLORS[r.statut] ?? 'text-muted'}`}>
                        {STATUT_FR[r.statut] ?? r.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.payoutStatut ? (
                        <span className={`text-xs font-medium ${PAYOUT_COLORS[r.payoutStatut] ?? 'text-muted'}`}>
                          {r.payoutStatut === 'ok' ? 'Reversé' : r.payoutStatut === 'pending' ? 'En cours' : 'Erreur'}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted">
                      {r.receiptCode ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
