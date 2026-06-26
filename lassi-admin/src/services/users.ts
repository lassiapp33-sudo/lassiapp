/**
 * services/users.ts — Gestion des utilisateurs et commerces (admin).
 */
import { supabase } from '../lib/supabase'

export interface AdminProfile {
  id:        string
  name:      string
  phone:     string
  email:     string | null
  role:      'client' | 'merchant'
  isAdmin:   boolean
  avatarUrl: string | null
  createdAt: string
}

export interface AdminShop {
  id:         string
  name:       string
  category:   string
  zone:       string
  logoUrl:    string | null
  isOpen:     boolean
  isVip:      boolean
  vipManual:  boolean
  rating:     number
  merchantId: string | null
  merchantName: string | null
}

const PAGE_SIZE = 200

// ─── Profils utilisateurs ─────────────────────────────────────────────────────

export async function getProfiles(search?: string, page = 0): Promise<AdminProfile[]> {
  let query = supabase
    .from('profiles')
    .select('id, name, phone, email, role, is_admin, avatar_url, created_at')
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:        row.id,
    name:      row.name,
    phone:     row.phone,
    email:     row.email,
    role:      row.role,
    isAdmin:   row.is_admin,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }))
}

// ─── Commerces ────────────────────────────────────────────────────────────────

export async function getShops(search?: string, page = 0): Promise<AdminShop[]> {
  let query = supabase
    .from('shops')
    .select(`
      id, name, category, zone, logo_url, is_open, is_vip,
      vip_manual, rating, merchant_id,
      profiles!merchant_id(name)
    `)
    .order('name')
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map(row => ({
    id:           row.id,
    name:         row.name,
    category:     row.category,
    zone:         row.zone ?? '',
    logoUrl:      row.logo_url,
    isOpen:       row.is_open,
    isVip:        row.is_vip,
    vipManual:    row.vip_manual,
    rating:       Number(row.rating),
    merchantId:   row.merchant_id,
    merchantName: (row.profiles as any)?.name ?? null,
  }))
}

// ─── Statistiques globales ────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  totalUsers:     number
  totalClients:   number
  totalMerchants: number
  totalShops:     number
  newThisWeek:    number
}> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  // Utiliser COUNT côté DB — ne pas télécharger toutes les lignes pour compter en JS
  const [clientsRes, merchantsRes, shopsRes, newRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'merchant'),
    supabase.from('shops').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
  ])

  const totalClients   = clientsRes.count   ?? 0
  const totalMerchants = merchantsRes.count ?? 0

  return {
    totalUsers:     totalClients + totalMerchants,
    totalClients,
    totalMerchants,
    totalShops:     shopsRes.count ?? 0,
    newThisWeek:    newRes.count   ?? 0,
  }
}

// ─── Suspension d'un compte ───────────────────────────────────────────────────

export async function suspendUser(
  userId: string,
  reason: string,
  durationDays = 30,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const suspendedUntil = new Date(Date.now() + durationDays * 86_400_000).toISOString()

  // 1. Mettre à jour suspended_until sur le profil (effet réel de la suspension)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ suspended_until: suspendedUntil })
    .eq('id', userId)

  if (profileError) throw new Error(profileError.message)

  // 2. Journaliser dans admin_actions_log
  const { error: logError } = await supabase.from('admin_actions_log').insert({
    admin_id:       session.user.id,
    action:         'suspend_user',
    target_user_id: userId,
    details:        { reason, suspended_until: suspendedUntil, duration_days: durationDays },
  })

  if (logError) throw new Error(logError.message)
}

// ─── Suppression définitive d'un compte ──────────────────────────────────────

export async function deleteUser(userId: string, reason: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ targetUserId: userId, reason }),
    },
  )

  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la suppression')
}
