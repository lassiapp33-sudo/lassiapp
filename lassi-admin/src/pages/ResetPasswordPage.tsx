/**
 * ResetPasswordPage — Nouveau mot de passe après lien de réinitialisation.
 * Accessible via /reset-password (lien reçu par email).
 */
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase }   from '../lib/supabase'
import { Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [busy,      setBusy]      = useState(false)
  const [erreur,    setErreur]    = useState<string | null>(null)
  const [done,      setDone]      = useState(false)
  const [ready,     setReady]     = useState(false)

  const navigate = useNavigate()

  // Supabase injecte la session depuis le fragment URL (#access_token=...)
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8)       { setErreur('Minimum 8 caractères.'); return }
    if (password !== password2)    { setErreur('Les mots de passe ne correspondent pas.'); return }
    setErreur(null)
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur.')
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

        {done ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
            <CheckCircle className="text-emerald-400 mx-auto" size={40} />
            <p className="text-white font-semibold">Mot de passe mis à jour !</p>
            <p className="text-muted text-sm">Redirection vers la connexion…</p>
          </div>
        ) : !ready ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
            <AlertCircle className="text-amber-400 mx-auto" size={40} />
            <p className="text-white font-semibold">Lien expiré ou invalide</p>
            <p className="text-muted text-sm">Demandez un nouveau lien depuis la page de connexion.</p>
            <button
              onClick={() => navigate('/login')}
              className="text-accent hover:text-accent/80 text-sm transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-white font-semibold text-lg mb-2">Nouveau mot de passe</h2>

            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
                  disabled={busy}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted font-medium mb-1.5 uppercase tracking-wide">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg border border-border rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent placeholder-muted"
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
              className="w-full bg-accent text-bg font-semibold py-3 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {busy && <span className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />}
              {busy ? 'Mise à jour…' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
