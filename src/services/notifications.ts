import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import { Notif, NotifType } from '../store/notificationsStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeLabel(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  return `il y a ${d} jour${d > 1 ? 's' : ''}`;
}

function toGroup(iso: string): 'today' | 'week' {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? 'today' : 'week';
}

// Mappe le type Supabase vers le NotifType local (compatibilité store)
function mapType(dbType: string): NotifType {
  const MAP: Record<string, NotifType> = {
    order: 'order',
    payment: 'pay',
    vip: 'vip',
    message: 'msg',
    debt: 'msg',
  };
  return (MAP[dbType] as NotifType) ?? 'msg';
}

// Exporté pour être réutilisé par le hook Realtime
export function rowToNotif(row: Record<string, any>): Notif {
  // La colonne "target_id" n'existe pas dans notifications.
  // L'id cible est stocké dans la colonne JSONB "data"
  // (conversation_id pour les messages, order_id pour les commandes).
  const data: Record<string, any> = row.data ?? {};
  return {
    id: row.id,
    type: mapType(row.type),
    title: row.title,
    body: row.body,
    time: timeLabel(row.created_at),
    unread: !row.is_read,
    group: toGroup(row.created_at),
    targetId: data.conversation_id ?? data.order_id ?? undefined,
    data,
  };
}

// ─── Requêtes ─────────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notif[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []).map(rowToNotif);
}

export async function markAsRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllRead(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
}

// Upsert du token push dans push_tokens (multi-device, un token par appareil)
export async function savePushToken(token: string, platform?: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: platform ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    );
}

// Supprime le token de l'appareil courant — appelé à la déconnexion
export async function deletePushToken(token: string): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;
  await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
}
