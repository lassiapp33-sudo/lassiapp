import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';
import { Notif, NotifType } from '../store/notificationsStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const ANN_PREFIX = 'ann_';

export function isAnnonceId(id: string): boolean {
  return id.startsWith(ANN_PREFIX);
}

export function annonceIdFrom(notifId: string): string {
  return notifId.slice(ANN_PREFIX.length);
}

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
  const data: Record<string, any> = row.data ?? {};
  return {
    id: row.id,
    type: mapType(row.type),
    title: row.title,
    body: row.body,
    time: timeLabel(row.created_at),
    unread: !row.is_read,
    group: toGroup(row.created_at),
    createdAt: row.created_at,
    targetId: data.conversation_id ?? data.order_id ?? undefined,
    data,
  };
}

// ─── Requêtes ─────────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notif[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];

  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  // 1. Notifications régulières (commandes, paiements, messages, VIP...)
  const { data: notifData } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since72h)
    .order('created_at', { ascending: false })
    .limit(50);

  // 2. Annonces admin (7 derniers jours, ciblées par rôle, avec statut lu)
  const { data: annoncesData } = await supabase.rpc('get_annonces_recentes');

  const regularNotifs: Notif[] = (notifData ?? []).map(rowToNotif);

  const annonceNotifs: Notif[] = (annoncesData ?? []).map(
    (a: { id: string; titre: string; corps: string; icone: string; created_at: string; est_lue: boolean }) => ({
      id: ANN_PREFIX + a.id,
      type: 'ann' as NotifType,
      title: `${a.icone} ${a.titre}`,
      body: a.corps,
      time: timeLabel(a.created_at),
      unread: !a.est_lue,
      group: toGroup(a.created_at),
      createdAt: a.created_at,
    }),
  );

  // Fusionner et trier par date décroissante
  return [...regularNotifs, ...annonceNotifs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function markAsRead(id: string): Promise<void> {
  if (isAnnonceId(id)) {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await supabase
      .from('annonces_lues')
      .upsert(
        { annonce_id: annonceIdFrom(id), user_id: userId },
        { onConflict: 'annonce_id,user_id' },
      );
    return;
  }
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllRead(): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  // Marquer toutes les notifications régulières
  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);

  // Marquer toutes les annonces non lues (get_annonces_recentes déjà déployé)
  const { data: annonces } = await supabase.rpc('get_annonces_recentes');
  const unread = (annonces ?? []).filter((a: { est_lue: boolean }) => !a.est_lue);
  if (unread.length > 0) {
    await supabase.from('annonces_lues').upsert(
      unread.map((a: { id: string }) => ({ annonce_id: a.id, user_id: userId })),
      { onConflict: 'annonce_id,user_id' },
    );
  }
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
