/**
 * LoginPage — Connexion admin LASSI.
 * Redirige automatiquement si déjà connecté en tant qu'admin.
 */
import React, { useEffect, useState } from 'react'
import { useNavigate }   from 'react-router-dom'
import { useAuth }       from '../contexts/AuthContext'
import { Lock, Mail }    from 'lucide-react'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [busy,     setBusy]     = useState(false)
  const [erreur,   setErreur]   = useState<string | null>(null)

  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()

  // Déjà connecté → dashboard direct
  useEffect(() => {
    if (!loading && user?.isAdmin) navigate('/', { replace: true })
  }, [loading, user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setErreur('Email et mot de passe requis.'); return }
    setErreur(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setErreur(err.message ?? 'Erreur de connexion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="font-title text-accent text-4xl font-bold tracking-tight mb-1">LASSİ</h1>
          <p className="text-muted text-sm">Dashboard Administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-lg mb-2">Connexion</h2>

          <div>
            <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
              Adresse email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                autoComplete="email"
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
              Mot de passe
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                autoComplete="current-password"
                disabled={busy}
              />
            </div>
          </div>

          {erreur && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-red-400 text-sm">{erreur}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-bg font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            {busy && <span className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />}
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-4">Accès réservé aux administrateurs LASSI</p>
      </div>
    </div>
  )
}
