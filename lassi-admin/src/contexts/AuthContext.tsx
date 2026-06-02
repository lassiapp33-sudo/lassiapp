/**
 * AuthContext — Authentification admin LASSI.
 *
 * Comportement garanti :
 * - Si session valide + is_admin=true  → dashboard s'ouvre
 * - Si session absente ou invalide     → redirection /login automatique (pas d'écran d'erreur)
 * - Si session corrompue (localStorage) → nettoyage auto + redirection /login
 * - Jamais de spinner infini : timeout 15s max (+ timeout réseau 15s dans supabase.ts)
 */
import React, {
  createContext, useCallback, useContext,
  useEffect, useMemo, useRef, useState,
} from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:      string
  email:   string
  name:    string
  isAdmin: boolean
}

interface AuthCtx {
  user:    AdminUser | null
  loading: boolean
  signIn:  (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

// ─── Utilitaire interne ───────────────────────────────────────────────────────

async function fetchAdminProfile(supabaseUser: User): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, is_admin')
    .eq('id', supabaseUser.id)
    .single()

  if (error) throw new Error(error.message)
  if (!data?.is_admin) return null

  return {
    id:      data.id,
    email:   supabaseUser.email ?? '',
    name:    data.name,
    isAdmin: true,
  }
}

// Nettoie la session Supabase du localStorage et redirige vers /login
function clearSessionAndRedirect() {
  try {
    // Supprime uniquement les clés Supabase pour ne pas perdre d'autres données
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('sb-')) localStorage.removeItem(k)
    })
  } catch { /* localStorage indisponible */ }
  window.location.replace('/login')
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const busy = useRef(false) // évite deux initialisations simultanées

  const init = useCallback(() => {
    if (busy.current) return
    busy.current = true

    let done = false

    // Timeout de sécurité : si rien ne répond en 15s → session corrompue → reset
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        busy.current = false
        clearSessionAndRedirect()
      }
    }, 15_000)

    const finish = (admin: AdminUser | null) => {
      if (done) return
      done = true
      busy.current = false
      clearTimeout(timer)
      setUser(admin)
      setLoading(false)
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (done) return
        if (!session?.user) {
          // Pas de session → page de login (sans nettoyer — rien à nettoyer)
          finish(null)
          return
        }
        return fetchAdminProfile(session.user).then(finish)
      })
      .catch(() => {
        // Erreur réseau ou session invalide → nettoyage automatique
        if (!done) { done = true; busy.current = false; clearTimeout(timer) }
        clearSessionAndRedirect()
      })
  }, [])

  useEffect(() => {
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') { setUser(null); return }
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const admin = await fetchAdminProfile(session.user)
            setUser(admin)
          } catch { /* signIn() remonte déjà l'erreur */ }
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [init])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)

    const admin = await fetchAdminProfile(data.user)
    if (!admin) {
      await supabase.auth.signOut()
      throw new Error("Accès refusé — ce compte n'a pas les droits administrateur.")
    }
    setUser(admin)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, signIn, signOut }),
    [user, loading, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être dans AuthProvider')
  return ctx
}
