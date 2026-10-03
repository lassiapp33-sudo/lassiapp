// Utilitaires push — partagés entre notify-share-vitrine, notify-empty-shops, etc.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await fetch(EXPO_PUSH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(messages),
  });
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
