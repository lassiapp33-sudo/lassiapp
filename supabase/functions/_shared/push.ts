// Utilitaires push — partagés entre notify-share-vitrine, notify-empty-shops, etc.

const EXPO_PUSH_URL    = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  _contentAvailable?: boolean;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: unknown;
}

interface ExpoReceipt {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

// Envoie les push et retourne les tickets Expo
async function sendExpoPushRaw(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(messages),
  });
  const json = await res.json().catch(() => ({ data: [] }));
  return (json.data ?? []) as ExpoTicket[];
}

// Vérifie les receipts APNs/FCM 5s après l'envoi (best-effort)
async function checkReceipts(
  sb: { from: (t: string) => any } | null,
  ticketIds: string[],
  logRows: Array<{ id?: string; ticket_id: string }>,
): Promise<void> {
  if (ticketIds.length === 0 || !sb) return;
  await new Promise(r => setTimeout(r, 5000));
  try {
    const res  = await fetch(EXPO_RECEIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ ids: ticketIds }),
    });
    const json = await res.json().catch(() => ({ data: {} }));
    const data = (json.data ?? {}) as Record<string, ExpoReceipt>;

    for (const row of logRows) {
      const receipt = data[row.ticket_id];
      if (!receipt) continue;
      await sb.from('push_log')
        .update({
          receipt_status:  receipt.status,
          receipt_message: receipt.message ?? receipt.details?.error ?? null,
          status:          receipt.status === 'ok' ? 'ok' : 'error',
        })
        .eq('ticket_id', row.ticket_id);
    }
  } catch (e) {
    console.error('[push] checkReceipts failed:', e);
  }
}

export async function sendExpoPush(
  messages: ExpoPushMessage[],
  sb?: { from: (t: string) => any } | null,
  userId?: string,
): Promise<void> {
  if (messages.length === 0) return;

  const tickets = await sendExpoPushRaw(messages);

  if (!sb) return;

  // Logger chaque envoi dans push_log
  const logRows: Array<{ ticket_id: string }> = [];
  for (let i = 0; i < messages.length; i++) {
    const msg    = messages[i];
    const ticket = tickets[i];
    const row = {
      user_id:   userId ?? null,
      token:     msg.to,
      title:     msg.title,
      body:      msg.body,
      ticket_id: ticket?.id ?? null,
      status:    ticket?.status === 'ok' ? 'sent' : 'error',
      details:   ticket?.status !== 'ok' ? ticket : null,
    };
    const { data: inserted } = await sb.from('push_log').insert(row).select('ticket_id').single();
    if (inserted?.ticket_id) logRows.push({ ticket_id: inserted.ticket_id });
  }

  // Vérifier les receipts APNs/FCM en arrière-plan (pas await — fire & forget)
  const ticketIds = logRows.map(r => r.ticket_id).filter(Boolean);
  checkReceipts(sb, ticketIds, logRows).catch(() => {});
}

export async function getPushTokens(
  sb: { from: (t: string) => any },
  userId: string,
): Promise<string[]> {
  const { data } = await sb
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId);
  return ((data ?? []) as { token: string }[])
    .map(r => r.token)
    .filter((t: string) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
}

export async function sendPushToUser(
  sb: { from: (t: string) => any },
  userId: string,
  message: Omit<ExpoPushMessage, 'to'>,
): Promise<void> {
  const tokens = await getPushTokens(sb, userId);
  if (tokens.length === 0) return;
  await sendExpoPush(
    tokens.map(to => ({
      sound: 'default',
      priority: 'high' as const,
      ...message,
      to,
    })),
    sb,
    userId,
  );
}
