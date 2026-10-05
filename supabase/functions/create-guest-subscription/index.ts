// ============================================================
// EDGE FUNCTION : create-guest-subscription  (verify_jwt = false)
// Abonnement fitness INVITÉ WEB — depuis s.lassi.tech
// Le visiteur choisit une offre, saisit nom + téléphone, paie Wave/OM.
// Le payment_intent (type='fitness_abonnement') est confirmé par webhook-payment
// qui crée l'entrée dans fitness_abonnements_clients.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isUUID, isSafeString } from '../_shared/validation.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { callWaveCheckout, getWaveCheckout } from '../_shared/waveProxy.ts';

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? '';
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')    ?? '';
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? '';
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET') ?? '';

const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
const IS_OM_READY   = isOmReady();

const WEB_BASE    = 'https://s.lassi.tech';
const GUEST_EMAIL = 'commande-web@lassi.tech';
const PHONE_RE    = /^7[05678][0-9]{7}$/;

Deno.serve(async (req) => {
  const CORS = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const err = (message: string, status: number) => json({ success: false, error: message }, status);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── GET ?pi=<uuid> — statut du paiement (polling web) ────────────────────────
  if (req.method === 'GET') {
    const params = new URL(req.url).searchParams;

    const piId = params.get('pi') ?? '';
    if (!isUUID(piId)) return err('pi invalide', 400);

    const { data: pi } = await admin
      .from('payment_intents')
      .select('statut')
      .eq('id', piId)
      .maybeSingle();
    if (!pi) return err('Paiement introuvable', 404);

    // Vérification directe Wave si polling DB non concluant
    const verify = params.get('verify') === '1';
    if (verify && pi.statut === 'initiated') {
      const { data: piExt } = await admin
        .from('payment_intents')
        .select('moyen_paiement, external_ref')
        .eq('id', piId)
        .maybeSingle();

      if (piExt?.moyen_paiement === 'wave' && piExt.external_ref && IS_WAVE_READY) {
        try {
          const resp = await getWaveCheckout(piExt.external_ref as string);
          if (resp.ok) {
            const wd = await resp.json() as Record<string, unknown>;
            const st = String(wd.payment_status ?? wd.status ?? '');
            const confirmed = ['succeeded','completed','success','SUCCESSFUL','SUCCEEDED','PAID','paid'].includes(st);
            if (confirmed) {
              await admin.rpc('process_payment_webhook', {
                p_external_event_id: `${piId}:SUCCESS_PULL_WEB`,
                p_payment_intent_id: piId,
                p_source:            'wave',
                p_external_status:   'SUCCESS_PULL_WEB',
                p_external_ref:      piExt.external_ref,
                p_received_amount:   null,
                p_is_success:        true,
                p_raw_payload:       { source: 'verify_sub_pull' },
              });
              return json({ success: true, paid: true });
            }
          }
        } catch { /* best-effort */ }
      }
    }

    const paid = ['confirmed', 'split_done', 'simulated'].includes(pi.statut);
    return json({ success: true, paid, statut: pi.statut });
  }

  if (req.method !== 'POST') return err('Méthode non autorisée', 405);

  try {
    const body = await req.json();
    const { offreId: rawOffreId, name, phone, moyenPaiement, shopSlug } = body ?? {};

    // ── Validation ──────────────────────────────────────────────────────────────
    if (!isUUID(rawOffreId)) return err('Offre invalide', 400);

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || !isSafeString(cleanName, { maxLen: 80 })) return err('Nom requis', 400);

    const cleanPhone = String(phone ?? '').replace(/[\s.+]/g, '').replace(/^221/, '');
    if (!PHONE_RE.test(cleanPhone)) return err('Numéro invalide (ex : 77 123 45 67)', 400);

    const moyen = moyenPaiement === 'orange_money' ? 'orange_money'
                : moyenPaiement === 'wave'          ? 'wave'
                : null;
    if (!moyen) return err('Moyen de paiement invalide', 400);

    // ── Charger l'offre ─────────────────────────────────────────────────────────
    const { data: offre } = await admin
      .from('fitness_abonnement_offres')
      .select('id, nom, prix, duree_jours, prestataire_id, actif')
      .eq('id', rawOffreId)
      .maybeSingle();
    if (!offre || !offre.actif) return err('Offre introuvable ou inactive', 404);

    // Commission 1% LASSI — prix_base + commission_lassi requis par payment_intents
    const prixBase        = Math.round(Number(offre.prix));
    const commissionLassi = Math.ceil(prixBase * 0.01);
    const total           = prixBase + commissionLassi;

    // ── Anti-spam ───────────────────────────────────────────────────────────────
    const { data: rl } = await admin.rpc('check_rate_limit', {
      p_key: `guest_sub:${cleanPhone}`, p_max_attempts: 5, p_window_seconds: 3600, p_block_seconds: 0,
    });
    if (rl?.allowed === false) return err('Trop de tentatives. Réessaie dans quelques minutes.', 429);

    // ── Utilisateur invité système ──────────────────────────────────────────────
    const guestId = await ensureGuestUser(admin);

    // ── Créer le payment_intent ─────────────────────────────────────────────────
    const idempotencyKey = `gsub_${offre.id}_${cleanPhone}_${Date.now()}`;
    const { data: pi, error: piErr } = await admin
      .from('payment_intents')
      .insert({
        type:              'fitness_abonnement',
        metadata: {
          offre_id:        offre.id,
          offre_nom:       String(offre.nom),
          duree_jours:     Number(offre.duree_jours),
          client_name:     cleanName,
          client_phone:    cleanPhone,
        },
        client_id:         guestId,
        prestataire_id:    String(offre.prestataire_id),
        prix_base:         prixBase,
        commission_lassi:  commissionLassi,
        montant_total:     total,
        moyen_paiement:    moyen,
        statut:            'pending',
        idempotency_key:   idempotencyKey,
      })
      .select('id')
      .single();

    if (piErr || !pi?.id) {
      console.error('[create-guest-subscription] pi insert', piErr?.message, piErr?.code);
      return err('Erreur interne. Réessaie.', 500);
    }

    const piId = pi.id as string;
    const shopQ = shopSlug ? `&shop=${encodeURIComponent(String(shopSlug))}` : '';
    const successUrl = `${WEB_BASE}/commande?id=${piId}&s=ok&type=abonnement${shopQ}`;
    const errorUrl   = `${WEB_BASE}/commande?id=${piId}&s=ko&type=abonnement${shopQ}`;

    const useWaveProd = IS_WAVE_READY && moyen === 'wave';
    const useOmProd   = IS_OM_READY   && moyen === 'orange_money';

    try {
      if (useWaveProd) {
        const waveBody = JSON.stringify({
          currency: 'XOF', amount: String(total),
          success_url: successUrl, error_url: errorUrl, client_reference: piId,
        });
        const resp = await callWaveCheckout(waveBody, piId);
        if (!resp.ok) throw new Error(`Wave ${resp.status}`);
        const d = await resp.json();
        await admin.from('payment_intents').update({
          statut: 'initiated', external_ref: d.id ?? d.transaction_id,
          updated_at: new Date().toISOString(),
        }).eq('id', piId);
        return json({ success: true, piId, total, redirectUrl: d.wave_launch_url ?? d.checkout_url, mode: 'production' });

      } else if (useOmProd) {
        if (!OM_WEBHOOK_SECRET) throw new Error('OM non configuré');
        const omToken = await getOmToken();
        const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-payment?source=om&pi_id=${encodeURIComponent(piId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
        const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${omToken}`, 'Content-Type': 'application/json', 'X-Callback-Url': callbackUrl },
          body: JSON.stringify({
            code: OM_MERCHANT_CODE, name: 'LASSI',
            amount: { value: total, unit: 'XOF' }, validity: 900,
            metadata: { pi_id: piId }, notificationUrl: callbackUrl,
          }),
        });
        if (!resp.ok) throw new Error(`OM ${resp.status}`);
        const d = await resp.json();
        const deepLink = d.deepLinks?.OM ?? d.deepLink ?? null;
        const qrCode   = d.qrCode ?? null;
        if (!deepLink && !qrCode) {
          await admin.from('payment_intents').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', piId);
          return err('QR Orange Money indisponible. Réessaie ou choisis Wave.', 502);
        }
        await admin.from('payment_intents').update({
          statut: 'initiated', external_ref: d.orderId ?? d.id ?? d.payToken ?? piId,
          updated_at: new Date().toISOString(),
        }).eq('id', piId);
        return json({ success: true, piId, total, redirectUrl: deepLink, qrCode, mode: 'production' });

      } else {
        // Simulation — déclenche le webhook manuellement pour créer l'abonnement
        const simRef = `SIM-SUB-${Date.now()}`;
        await admin.from('payment_intents').update({
          statut: 'initiated', external_ref: simRef, updated_at: new Date().toISOString(),
        }).eq('id', piId);
        await admin.rpc('process_payment_webhook', {
          p_external_event_id: `${piId}:SIM`,
          p_payment_intent_id: piId,
          p_source:            'wave',
          p_external_status:   'succeeded',
          p_external_ref:      simRef,
          p_received_amount:   null,
          p_is_success:        true,
          p_raw_payload:       { source: 'simulation' },
        });
        return json({ success: true, piId, total, redirectUrl: successUrl, mode: 'simulation' });
      }
    } catch (apiErr) {
      const m = apiErr instanceof Error ? apiErr.message : 'fournisseur';
      console.error('[create-guest-subscription] provider', m);
      await admin.from('payment_intents').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', piId);
      return err('Le paiement n\'a pas pu être initié. Réessaie.', 502);
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[create-guest-subscription]', m);
    return err('Une erreur est survenue. Réessaie.', 500);
  }
});

async function ensureGuestUser(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: prof } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof?.id) return prof.id as string;
  const { data: created, error } = await admin.auth.admin.createUser({
    email: GUEST_EMAIL, email_confirm: true,
    user_metadata: { name: 'Commande web', role: 'client' },
  });
  if (created?.user?.id) return created.user.id;
  const { data: prof2 } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof2?.id) return prof2.id as string;
  throw new Error('guest user unavailable: ' + (error?.message ?? ''));
}
