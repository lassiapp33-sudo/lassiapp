import { getCachedToken, SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import logger from '../utils/logger';

export type SignalementType = 'bug' | 'paiement' | 'commande' | 'commerce' | 'arnaque' | 'autre';

export const TYPE_LABELS: Record<SignalementType, string> = {
  bug: "Bug / l'app ne marche pas",
  paiement: 'Problème de paiement',
  commande: 'Problème avec une commande',
  commerce: 'Problème avec un commerçant',
  arnaque: 'Contenu inapproprié / arnaque',
  autre: 'Autre',
};

export const TYPE_LABELS_PRO: Record<SignalementType, string> = {
  ...TYPE_LABELS,
  commerce: 'Problème avec un client',
};

export interface EnvoyerParams {
  profil: 'client' | 'prestataire';
  type: SignalementType;
  description: string;
  orderId?: string;
  shopId?: string;
  screenshotUrl?: string;
}

// Décode l'userId depuis le JWT (champ "sub") — sans appel réseau ni GoTrue
function getUserIdFromToken(token: string): string | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function restHeaders(token: string): Record<string, string> {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

// ─── Rate limiting côté client (max 5 signalements / heure) ──────────────────

async function checkRateLimit(userId: string, token: string): Promise<void> {
  try {
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/signalements?select=id&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(since)}&limit=5`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as unknown[];
    if (data.length >= 5) {
      throw new Error('Tu as déjà envoyé 5 signalements cette heure. Réessaie plus tard.');
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('5 signalements')) throw e;
    // Erreur réseau → on laisse passer (la validation serveur prend le relais)
  }
}

// ─── Envoi du signalement ─────────────────────────────────────────────────────
// Utilise raw fetch + token caché pour bypasser le mutex GoTrue bloqué.

export async function envoyerSignalement(params: EnvoyerParams): Promise<void> {
  const token = getCachedToken();
  if (!token) throw new Error('Tu dois être connecté pour signaler un problème.');

  const userId = getUserIdFromToken(token);
  if (!userId) throw new Error('Tu dois être connecté pour signaler un problème.');

  await checkRateLimit(userId, token);

  // 1. Insertion en base via REST (bypass GoTrue mutex)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/signalements`, {
    method: 'POST',
    headers: { ...restHeaders(token), Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      profil: params.profil,
      type: params.type,
      description: params.description.trim(),
      related_order_id: params.orderId ?? null,
      related_shop_id: params.shopId ?? null,
      screenshot_url: params.screenshotUrl ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.message as string) ?? 'Signalement refusé.');
  }

  // 2. Email via EF (best-effort — ne bloque pas si ça échoue)
  try {
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=name,phone&id=eq.${encodeURIComponent(userId)}&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` } },
    );
    const profiles = profileRes.ok
      ? ((await profileRes.json()) as { name?: string; phone?: string }[])
      : [];
    const profile = profiles[0] ?? {};

    let screenshotUrl: string | null = null;
    if (params.screenshotUrl) {
      const signRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/sign/signalements/${encodeURIComponent(params.screenshotUrl)}`,
        {
          method: 'POST',
          headers: restHeaders(token),
          body: JSON.stringify({ expiresIn: 86400 }),
        },
      );
      if (signRes.ok) {
        const signData = (await signRes.json()) as { signedURL?: string };
        screenshotUrl = signData.signedURL
          ? `${SUPABASE_URL}/storage/v1${signData.signedURL}`
          : null;
      }
    }

    await fetch(`${SUPABASE_URL}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: restHeaders(token),
      body: JSON.stringify({
        typeLabel: TYPE_LABELS[params.type],
        profil: params.profil,
        description: params.description.trim(),
        userName: profile.name ?? '—',
        userPhone: profile.phone ?? '—',
        orderId: params.orderId ?? null,
        shopId: params.shopId ?? null,
        screenshotUrl,
        timestamp: new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' }),
      }),
    });
  } catch (emailErr) {
    logger.warn('[signalements] Email non envoyé :', emailErr);
  }
}

// ─── Upload capture d'écran ───────────────────────────────────────────────────

export async function uploadScreenshot(localUri: string, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;

  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response = await fetch(compressed.uri);
  const arrayBuffer = await response.arrayBuffer();

  const token = getCachedToken() ?? SUPABASE_ANON;

  const uploadRes = await fetch(`${SUPABASE_URL}/functions/v1/upload-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON,
      'Content-Type': 'image/jpeg',
      'x-bucket': 'signalements',
      'x-path': path,
    },
    body: arrayBuffer,
  });

  const result = (await uploadRes.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!uploadRes.ok || !result.url) throw new Error(`Upload échoué : ${result.error ?? uploadRes.status}`);

  return path;
}
