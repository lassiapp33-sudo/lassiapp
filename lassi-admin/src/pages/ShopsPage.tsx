/**
 * ShopsPage — Liste des commerces avec recherche et infos dispute.
 */
import React, { useEffect, useState } from 'react'
import { Store, Search } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import { getShops, type AdminShop } from '../services/users'
import { getShopDisputeStats, type RecidivistStat } from '../services/disputes'

const CAT_LABELS: Record<string, string> = {
  stores: 'Commerçants', tangana: 'Tangana', food: 'Restos',
  hair: 'Coiffeurs', sport: 'Fitness', bakery: 'Boulangeries',
  fruiterie: 'Fruiterie',
}

export default function ShopsPage() {
  const [shops,   setShops]   = useState<AdminShop[]>([])
  const [stats,   setStats]   = useState<Record<string, RecidivistStat>>({})
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getShops(), getShopDisputeStats()])
      .then(([sh, st]) => {
        setShops(sh)
        const byId: Record<string, RecidivistStat> = {}
        st.forEach(s => { if (s.shopId) byId[s.shopId] = s })
        setStats(byId)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = shops.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-title font-bold text-white">Commerces</h1>

      <div className="relative max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un commerce…"
          className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
        />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <table className="w-full"><tbody>{Array.from({length:6}).map((_,i)=><SkeletonRow key={i} cols={6}/>)}</tbody></table>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Store size={48}/>} title="Aucun commerce" subtitle="Les commerces apparaîtront après inscription des prestataires." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Nom</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Zone</th>
                <th className="px-4 py-3 text-left">Marchand</th>
                <th className="px-4 py-3 text-center">VIP</th>
                <th className="px-4 py-3 text-center">Litiges</th>
                <th className="px-4 py-3 text-center">Ouvert</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const disp = stats[s.id]
                const isRed = disp && disp.disputesCount >= 3
                return (
                  <tr key={s.id} className={`border-b border-border hover:bg-white/5 transition-colors ${isRed ? 'bg-danger/5' : ''}`}>
                    <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted text-xs">{CAT_LABELS[s.category] ?? s.category}</td>
                    <td className="px-4 py-3 text-muted text-xs">{s.zone || '—'}</td>
                    <td className="px-4 py-3 text-muted text-xs">{s.merchantName ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {s.isVip
                        ? <Badge variant="vip-scoring" />
                        : s.vipManual
                          ? <Badge variant="vip-manual" />
                          : <span className="text-muted text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {disp ? (
                        <span className={`text-xs font-bold ${isRed ? 'text-danger' : 'text-muted'}`}>
                          {disp.disputesCount} {isRed && '⚠️'}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${s.isOpen ? 'text-success' : 'text-muted'}`}>
                        {s.isOpen ? 'Ouvert' : 'Fermé'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
