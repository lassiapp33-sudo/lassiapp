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

// ─── Profils utilisateurs ─────────────────────────────────────────────────────

export async function getProfiles(search?: string): Promise<AdminProfile[]> {
  let query = supabase
    .from('profiles')
    .select('id, name, phone, email, role, is_admin, avatar_url, created_at')
    .order('created_at', { ascending: false })

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

export async function getShops(search?: string): Promise<AdminShop[]> {
  let query = supabase
    .from('shops')
    .select(`
      id, name, category, zone, logo_url, is_open, is_vip,
      vip_manual, rating, merchant_id,
      profiles!merchant_id(name)
    `)
    .order('name')

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

  const [usersRes, shopsRes, newRes] = await Promise.all([
    supabase.from('profiles').select('role', { count: 'exact' }),
    supabase.from('shops').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
  ])

  const users     = usersRes.data ?? []
  const clients   = users.filter(u => u.role === 'client').length
  const merchants = users.filter(u => u.role === 'merchant').length

  return {
    totalUsers:     users.length,
    totalClients:   clients,
    totalMerchants: merchants,
    totalShops:     shopsRes.count ?? 0,
    newThisWeek:    newRes.count ?? 0,
  }
}

// ─── Suspension d'un compte ───────────────────────────────────────────────────

export async function suspendUser(userId: string, reason: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expirée')

  const { error } = await supabase.from('admin_actions_log').insert({
    admin_id:       session.user.id,
    action:         'suspend_user',
    target_user_id: userId,
    details:        { reason },
  })

  if (error) throw new Error(error.message)
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
