/**
 * AvisPage — Modération des avis clients.
 * L'admin peut voir, masquer/démasquer, supprimer tous les avis.
 */
import React, { useEffect, useState } from 'react'
import { Eye, EyeOff, Trash2, Star } from 'lucide-react'
import { SkeletonRow } from '../components/Skeleton'
import {
  getAllAvis, maskAvis, deleteAvis,
  type AvisAdmin,
} from '../services/avis'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function Stars({ note }: { note: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={12}
          className={n <= note ? 'fill-accent text-accent' : 'text-border'}
        />
      ))}
    </span>
  )
}

// ─── Filtres ─────────────────────────────────────────────────────────────────

type Filter = 'all' | 'visible' | 'masked'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',     label: 'Tous'    },
  { key: 'visible', label: 'Visibles' },
  { key: 'masked',  label: 'Masqués'  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AvisPage() {
  const [avis,    setAvis]    = useState<AvisAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState<Filter>('all')
  const [working, setWorking] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllAvis({ limit: 200 })
      setAvis(data)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const displayed = avis.filter(a => {
    if (filter === 'visible') return !a.masque
    if (filter === 'masked')  return a.masque
    return true
  })

  const handleMask = async (a: AvisAdmin) => {
    setWorking(a.id)
    try {
      await maskAvis(a.id, !a.masque)
      setAvis(prev => prev.map(x => x.id === a.id ? { ...x, masque: !a.masque } : x))
    } catch { /* ignore */ }
    setWorking(null)
  }

  const handleDelete = async (a: AvisAdmin) => {
    if (!confirm(`Supprimer définitivement l'avis de ${a.authorName} ?`)) return
    setWorking(a.id)
    try {
      await deleteAvis(a.id)
      setAvis(prev => prev.filter(x => x.id !== a.id))
    } catch { /* ignore */ }
    setWorking(null)
  }

  const visibleCount = avis.filter(a => !a.masque).length
  const maskedCount  = avis.filter(a =>  a.masque).length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ── En-tête ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-title text-white mb-1">Avis clients</h1>
        <p className="text-muted text-sm">
          {avis.length} avis au total · {visibleCount} visibles · {maskedCount} masqués
        </p>
      </div>

      {/* ── Filtres ── */}
      <div className="flex gap-2 mb-5">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-accent text-bg'
                : 'bg-surface text-muted border border-border hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Liste ── */}
      <div className="space-y-3">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : displayed.length === 0 ? (
          <p className="text-muted text-sm py-10 text-center">Aucun avis dans cette catégorie.</p>
        ) : (
          displayed.map(a => (
            <div
              key={a.id}
              className={`bg-surface border rounded-xl p-4 ${
                a.masque ? 'border-danger/30 opacity-60' : 'border-border'
              }`}
            >
              {/* ── Ligne principale ── */}
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-title flex-shrink-0">
                  {a.authorName.charAt(0).toUpperCase()}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-white font-medium text-sm">{a.authorName}</span>
                    <Stars note={a.note} />
                    <span className="text-muted text-xs">• {a.shopName}</span>
                    <span className="text-muted text-xs">{fmtDate(a.createdAt)}</span>
                    {a.masque && (
                      <span className="text-danger text-xs bg-danger/10 px-2 py-0.5 rounded-full">
                        Masqué
                      </span>
                    )}
                  </div>
                  {a.commentaire && (
                    <p className="text-sm text-muted mt-1 line-clamp-3">{a.commentaire}</p>
                  )}
                  {a.reponseCommercant && (
                    <p className="text-xs text-accent/80 mt-1 pl-3 border-l-2 border-accent/40">
                      Réponse : {a.reponseCommercant}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleMask(a)}
                    disabled={working === a.id}
                    title={a.masque ? 'Démasquer' : 'Masquer'}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
                  >
                    {a.masque ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={working === a.id}
                    title="Supprimer définitivement"
                    className="p-2 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
