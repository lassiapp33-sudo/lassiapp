/**
 * ShopsPage — Liste des commerces avec recherche, infos dispute et édition GPS.
 */
import React, { useEffect, useState } from 'react'
import { Store, Search, MapPin, X, Check } from 'lucide-react'
import Badge from '../components/Badge'
import EmptyState from '../components/EmptyState'
import { SkeletonRow } from '../components/Skeleton'
import { getShops, updateShopCoords, type AdminShop } from '../services/users'
import { getShopDisputeStats, type RecidivistStat } from '../services/disputes'

const CAT_LABELS: Record<string, string> = {
  stores: 'Commerçants', tangana: 'Tangana', food: 'Restos',
  hair: 'Coiffeurs', sport: 'Sport', bakery: 'Boulangeries',
  fruiterie: 'Fruiterie',
}

interface GpsModalProps {
  shop: AdminShop
  onClose: () => void
  onSaved: (lat: number, lng: number) => void
}

function GpsModal({ shop, onClose, onSaved }: GpsModalProps) {
  const [lat, setLat] = useState(shop.latitude?.toString() ?? '')
  const [lng, setLng] = useState(shop.longitude?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const valid =
    lat.trim() !== '' && lng.trim() !== '' &&
    !isNaN(Number(lat)) && !isNaN(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    setError('')
    try {
      await updateShopCoords(shop.id, Number(lat), Number(lng))
      onSaved(Number(lat), Number(lng))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-base">Coordonnées GPS</h2>
            <p className="text-muted text-xs mt-0.5">{shop.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-muted text-xs mb-4">
          Trouvez les coordonnées sur{' '}
          <a
            href="https://www.google.com/maps"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline"
          >
            Google Maps
          </a>{' '}
          → clic droit sur l'emplacement → copier les coordonnées.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Latitude</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={e => setLat(e.target.value)}
              placeholder="ex : 14.7833"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Longitude</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={e => setLng(e.target.value)}
              placeholder="ex : -17.3667"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
            />
          </div>
        </div>

        {error && <p className="text-danger text-xs mt-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!valid || saving}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-accent text-bg font-bold text-sm rounded-xl py-3 disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Check size={15} />
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}

export default function ShopsPage() {
  const [shops,   setShops]   = useState<AdminShop[]>([])
  const [stats,   setStats]   = useState<Record<string, RecidivistStat>>({})
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [gpsShop, setGpsShop] = useState<AdminShop | null>(null)

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
          <table className="w-full"><tbody>{Array.from({length:6}).map((_,i)=><SkeletonRow key={i} cols={7}/>)}</tbody></table>
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
                <th className="px-4 py-3 text-center">GPS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const disp = stats[s.id]
                const isRed = disp && disp.disputesCount >= 3
                const hasGps = s.latitude !== null && s.longitude !== null
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
                          {disp.disputesCount} {isRed && '!'}
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
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setGpsShop(s)}
                        title={hasGps ? `${s.latitude}, ${s.longitude}` : 'Ajouter les coordonnées GPS'}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
                          hasGps
                            ? 'bg-accent/15 text-accent hover:bg-accent/25'
                            : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <MapPin size={11} />
                        {hasGps ? 'Éditer' : 'Ajouter'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {gpsShop && (
        <GpsModal
          shop={gpsShop}
          onClose={() => setGpsShop(null)}
          onSaved={(lat, lng) => {
            setShops(prev => prev.map(s => s.id === gpsShop.id ? { ...s, latitude: lat, longitude: lng } : s))
            setGpsShop(null)
          }}
        />
      )}
    </div>
  )
}
