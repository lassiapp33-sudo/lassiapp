import { supabase }           from '../lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import logger                from '../utils/logger';

export type SignalementType =
  | 'bug'
  | 'paiement'
  | 'commande'
  | 'commerce'
  | 'arnaque'
  | 'autre';

export const TYPE_LABELS: Record<SignalementType, string> = {
  bug:      "Bug / l'app ne marche pas",
  paiement: 'Problème de paiement',
  commande: 'Problème avec une commande',
  commerce: 'Problème avec un commerçant',
  arnaque:  'Contenu inapproprié / arnaque',
  autre:    'Autre',
};

export const TYPE_LABELS_PRO: Record<SignalementType, string> = {
  ...TYPE_LABELS,
  commerce: 'Problème avec un client',
};

export interface EnvoyerParams {
  profil:        'client' | 'prestataire';
  type:          SignalementType;
  description:   string;
  orderId?:      string;
  shopId?:       string;
  screenshotUrl?: string;
}

// ─── Rate limiting côté client (max 5 signalements / heure / utilisateur) ───

async function checkRateLimit(userId: string): Promise<void> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await supabase
    .from('signalements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);

  if (error) return; // en cas d'erreur on laisse passer
  if ((count ?? 0) >= 5) {
    throw new Error('Tu as déjà envoyé 5 signalements cette heure. Réessaie plus tard.');
  }
}

// ─── Envoi du signalement ────────────────────────────────────────────────────

export async function envoyerSignalement(params: EnvoyerParams): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Tu dois être connecté pour signaler un problème.');

  await checkRateLimit(user.id);

  // 1. Insertion en base
  const { error } = await supabase.from('signalements').insert({
    user_id:          user.id,
    profil:           params.profil,
    type:             params.type,
    description:      params.description.trim(),
    related_order_id: params.orderId       ?? null,
    related_shop_id:  params.shopId        ?? null,
    screenshot_url:   params.screenshotUrl ?? null,
  });

  if (error) throw new Error(error.message);

  // 2. Email via Edge Function (best-effort — ne bloque pas si ça échoue)
  try {
    // Profil utilisateur pour l'email
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, phone')
      .eq('id', user.id)
      .single();

    // URL signée de la capture (24h) si fournie
    let screenshotUrl: string | null = null;
    if (params.screenshotUrl) {
      const { data: signed } = await supabase.storage
        .from('signalements')
        .createSignedUrl(params.screenshotUrl, 86400);
      screenshotUrl = signed?.signedUrl ?? null;
    }

    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' });

    await supabase.functions.invoke('send-report-email', {
      body: {
        typeLabel:    TYPE_LABELS[params.type],
        profil:       params.profil,
        description:  params.description.trim(),
        userName:     profile?.name  ?? '—',
        userPhone:    profile?.phone ?? '—',
        orderId:      params.orderId  ?? null,
        shopId:       params.shopId   ?? null,
        screenshotUrl,
        timestamp,
      },
    });
  } catch (emailErr) {
    // L'email est une notification secondaire — on log mais on ne rejette pas
    logger.warn('[signalements] Email non envoyé :', emailErr);
  }
}

// ─── Upload capture d'écran ──────────────────────────────────────────────────
// Bucket privé → on stocke le PATH relatif (pas une URL publique).
// L'admin génère une signed URL à la demande depuis ce chemin.

export async function uploadScreenshot(localUri: string, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;

  // Compression identique aux autres assets (max 1080px, 75%)
  const compressed = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1080 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response    = await fetch(compressed.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('signalements')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Upload échoué : ${error.message}`);
  return path; // ← path relatif, pas une URL
}
