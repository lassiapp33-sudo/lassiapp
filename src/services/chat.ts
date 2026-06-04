import { supabase, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
import useAuthStore from '../store/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TicketData {
  orderId: string;
  items: { qty: number; name: string; price: number }[];
  total: number;
  status: 'pending' | 'paid';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'client' | 'merchant';
  type: 'text' | 'voice' | 'ticket' | 'image';
  content: string;
  voiceUrl: string | null;
  ticketData: TicketData | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  clientId: string;
  shopId: string;
  lastMessage: string | null;
  lastMessageAt: string;
  clientUnread: number;
  merchantUnread: number;
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

export function rowToMessage(row: Record<string, any>): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    type: row.type,
    content: row.content,
    voiceUrl: row.voice_url ?? null,
    ticketData: row.ticket_data ?? null,
    createdAt: row.created_at,
  };
}

function rowToConversation(row: Record<string, any>): Conversation {
  return {
    id: row.id,
    clientId: row.client_id,
    shopId: row.shop_id,
    lastMessage: row.last_message ?? null,
    lastMessageAt: row.last_message_at,
    clientUnread: row.client_unread ?? 0,
    merchantUnread: row.merchant_unread ?? 0,
  };
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export async function getOrCreateConversation(shopId: string): Promise<Conversation> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error('Non connecté');

  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_id', userId)
    .eq('shop_id', shopId)
    .maybeSingle();

  if (existing) return rowToConversation(existing);

  const { data, error } = await supabase
    .from('conversations')
    .insert({ client_id: userId, shop_id: shopId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToConversation(data);
}

export async function getMyConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(rowToConversation);
}

export async function getMerchantConversations(shopId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('shop_id', shopId)
    .order('last_message_at', { ascending: false });
  if (error) return [];
  return (data ?? []).map(rowToConversation);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  // Filtre côté client : seulement les messages dans la fenêtre 72h
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToMessage);
}

// ─── Upload générique vers Supabase Storage ───────────────────────────────────
// Utilise FormData + fetch direct vers l'API REST Supabase.
// C'est la seule méthode totalement fiable dans React Native (Hermes) :
// fetch().blob() / arrayBuffer() retournent souvent un buffer vide sur device réel.

async function uploadToStorage(
  localUri: string,
  storagePath: string,
  mimeType: string,
): Promise<string> {
  // Récupérer le token JWT de la session courante
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON;

  // FormData avec le fichier local — React Native gère le streaming nativement
  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: storagePath.split('/').pop() ?? 'file',
    type: mimeType,
  } as any);

  // Appel direct à l'API REST Supabase Storage (pas le SDK)
  // NE PAS mettre Content-Type dans les headers : React Native le génère
  // automatiquement avec le bon boundary multipart
  const endpoint = `${SUPABASE_URL}/storage/v1/object/chat-media/${storagePath}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Storage upload: ${body?.message ?? response.status}`);
  }

  // URL publique construite via le SDK (plus propre)
  const { data } = supabase.storage.from('chat-media').getPublicUrl(storagePath);
  return data.publicUrl;
}

// Upload un message vocal et retourne l'URL publique
export async function uploadVoiceMessage(
  localUri: string,
  conversationId: string,
): Promise<string> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Non connecté');

  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'm4a';
  const mime = ext === 'webm' ? 'audio/webm' : 'audio/mp4';
  const path = `${conversationId}/voice/${Date.now()}_${user.id}.${ext}`;

  return uploadToStorage(localUri, path, mime);
}

// Upload une image et retourne l'URL publique
export async function uploadChatImage(localUri: string, conversationId: string): Promise<string> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Non connecté');

  const path = `${conversationId}/images/${Date.now()}_${user.id}.jpg`;
  return uploadToStorage(localUri, path, 'image/jpeg');
}

export interface SendMessageParams {
  type: 'text' | 'voice' | 'ticket' | 'image';
  content: string;
  voiceUrl?: string;
  ticketData?: TicketData;
}

// Aperçu du message pour la notification push
function pushPreview(type: SendMessageParams['type'], content: string): string {
  switch (type) {
    case 'voice':
      return '🎤 Message vocal';
    case 'image':
      return '🖼️ Photo';
    case 'ticket':
      return '🧾 Ticket de commande';
    default:
      return content.length > 100 ? content.substring(0, 100) + '…' : content;
  }
}

export async function sendMessage(
  conversationId: string,
  params: SendMessageParams,
): Promise<ChatMessage> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Non connecté');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_role: user.role,
      type: params.type,
      content: params.content,
      voice_url: params.voiceUrl ?? null,
      ticket_data: params.ticketData ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Notifier le destinataire (best-effort — ne bloque pas l'envoi)
  supabase.functions
    .invoke('notify-new-message', {
      body: {
        conversationId,
        preview: pushPreview(params.type, params.content),
      },
    })
    .catch(() => {});

  return rowToMessage(data);
}

// Met à jour le statut d'un ticket (pending → paid) après paiement
export async function updateTicketStatus(messageId: string): Promise<void> {
  const { data: row, error: fetchErr } = await supabase
    .from('messages')
    .select('ticket_data')
    .eq('id', messageId)
    .single();
  if (fetchErr || !row) return;

  await supabase
    .from('messages')
    .update({ ticket_data: { ...(row.ticket_data ?? {}), status: 'paid' } })
    .eq('id', messageId);
}

// Réinitialise le compteur non-lus de la conversation pour le rôle actuel
export async function markConversationRead(conversationId: string): Promise<void> {
  const role = useAuthStore.getState().user?.role ?? 'client';
  const field = role === 'client' ? 'client_unread' : 'merchant_unread';
  await supabase
    .from('conversations')
    .update({ [field]: 0 })
    .eq('id', conversationId);
}

// ─── Profil client ────────────────────────────────────────────────────────────

export interface ClientProfile {
  name: string;
  avatarUrl: string | null;
  phone: string | null;
}

// Récupère le profil complet d'un client (nom + avatar + téléphone) depuis la table profiles.
// Utilise la RPC get_profile_by_id (SECURITY DEFINER) qui contourne le RLS —
// indispensable quand un marchand lit le profil d'un client (rows appartenant à l'autre).
export async function getClientProfile(userId: string): Promise<ClientProfile> {
  // Tentative 1 : RPC SECURITY DEFINER (contourne RLS, renvoie name + avatar_url + phone)
  const { data: rpcData, error: rpcErr } = await supabase.rpc('get_profile_by_id', {
    p_user_id: userId,
  });

  if (!rpcErr && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    // Si la RPC a retourné phone (nouvelle version), on s'arrête ici.
    // Si row.phone === undefined, la RPC est l'ancienne version (sans phone) → on continue.
    if (row && row.phone !== undefined) {
      return {
        name: (row.full_name as string | null) ?? '',
        avatarUrl: (row.avatar_url as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
      };
    }
  }

  // Tentative 2 : lecture directe (contourne l'ancienne RPC sans phone,
  // ou si la RPC a échoué)
  const { data } = await supabase
    .from('profiles')
    .select('name, avatar_url, phone')
    .eq('id', userId)
    .maybeSingle();

  return {
    name: data?.name ?? '',
    avatarUrl: data?.avatar_url ?? null,
    phone: data?.phone ?? null,
  };
}

// Alias rapide pour compatibilité avec les appelants existants
export async function getClientName(userId: string): Promise<string> {
  const profile = await getClientProfile(userId);
  return profile.name;
}

// Récupère une conversation par ID (utilisé par ChatScreen pour auto-résoudre le nom)
export async function getConversationById(conversationId: string): Promise<Conversation | null> {
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();
  return data ? rowToConversation(data) : null;
}
