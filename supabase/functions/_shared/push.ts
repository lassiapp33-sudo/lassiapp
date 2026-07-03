const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: string
  channelId?: string
}

export async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  })
}

// Récupère les tokens Expo valides d'un utilisateur depuis push_tokens
export async function getPushTokens(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
  return ((data ?? []) as { token: string }[])
    .map(r => r.token)
    .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
}

// Envoie un push à tous les appareils d'un utilisateur — best-effort, silencieux
export async function sendPushToUser(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  message: Omit<PushMessage, 'to'>,
): Promise<void> {
  try {
    const tokens = await getPushTokens(supabase, userId)
    if (tokens.length === 0) return
    await sendExpoPush(tokens.map(to => ({ to, sound: 'default', ...message })))
  } catch {
    // best-effort
  }
}
