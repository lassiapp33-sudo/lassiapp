// ============================================================
// EDGE FUNCTION : create-guest-table-reservation  (verify_jwt = false)
// Réservation de TABLE restaurant standard, INVITÉ WEB depuis s.lassi.tech.
//
// Réutilise STRICTEMENT le flux de l'app (create-std-table-reservation) :
//   • crée uniquement un payment_intents (type 'table_reservation'), détails résa
//     dans metadata ; la réservation est insérée au paiement confirmé par
//     webhook-payment → RPC confirm_table_reservation_payment (chemin inchangé).
//   • Montant fixé serveur : 2100 F (2000 acompte resto + 100 frais LASSI).
//
// Différence unique vs app : pas d'auth client → on utilise l'utilisateur système
// invité web (commande-web@lassi.tech) et on véhicule nom/téléphone dans
// metadata.details_motif (table_reservations n'a pas de colonnes nom/tél).
//
// 3 modes :
//   GET ?slug=&date=            → { reservation_enabled, payment_methods, slots[] }
//   GET ?status=<piId>          → { paid, reservationId }
//   POST {slug,date,timeSlotId,heureDebut,nbPersonnes,name,phone,moyenPaiement,idempotencyKey}
//                               → { success, piId, redirectUrl, qrCode, mode, montant }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callWaveCheckout } from '../_shared/waveProxy.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')              ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')              ?? '';
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')            ?? '';
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')          ?? '';
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET')         ?? '';

const WEB_BASE    = 'https://s.lassi.tech';
const GUEST_EMAIL = 'commande-web@lassi.tech';
const PHONE_RE    = /^7[015678][0-9]{7}$/;

// Montants IDENTIQUES à create-std-table-reservation (ne jamais modifier)
const MONTANT_CLIENT      = 2100;
const COMMISSION_LASSI    = 100;
const MONTANT_PRESTATAIRE = MONTANT_CLIENT - COMMISSION_LASSI; // 2000 acompte

const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
const IS_OM_READY   = isOmReady();
const IS_PRODUCTION = IS_WAVE_READY || IS_OM_READY;

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
function toMin(hhmm: string): number { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }

async function ensureGuestUser(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: prof } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof?.id) return prof.id as string;
  const { data: created } = await admin.auth.admin.createUser({
    email: GUEST_EMAIL, email_confirm: true,
    user_metadata: { name: 'Commande web', role: 'client' },
  });
  if (created?.user?.id) return created.user.id;
  const { data: prof2 } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof2?.id) return prof2.id as string;
  throw new Error('guest user unavailable');
}

// Résout slug → { merchant_id, reservation_enabled, payment_methods }
async function resolveShop(admin: ReturnType<typeof createClient>, slug: string) {
  const { data: shop } = await admin
    .from('shops')
    .select('merchant_id, reservation_enabled, payment_methods, is_manually_closed')
    .eq('slug', slug)
    .maybeSingle();
  return shop as {
    merchant_id: string; reservation_enabled: boolean;
    payment_methods: string[] | null; is_manually_closed: boolean;
  } | null;
}

Deno.serve(async (req) => {
  const CORS = buildCors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const jsonR = (o: unknown, s = 200) =>
    new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
  const err = (msg: string, s = 400) => jsonR({ success: false, error: msg }, s);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const url = new URL(req.url);

  // ── GET ?status=<piId> → statut paiement + id réservation ────────────────────
  const statusId = url.searchParams.get('status');
  if (statusId && isUUID(statusId)) {
    const { data: pi } = await admin
      .from('payment_intents').select('statut').eq('id', statusId).maybeSingle();
    const paid = ['confirmed', 'split_done', 'simulated'].includes(String(pi?.statut ?? ''));
    let reservationId: string | null = null;
    if (paid) {
      const { data: r } = await admin
        .from('table_reservations').select('id').eq('paiement_ref', statusId).maybeSingle();
      reservationId = (r?.id as string) ?? null;
    }
    return jsonR({ paid, reservationId });
  }

  const slugParam = url.searchParams.get('slug');

  // ── GET ?slug=&weekdays=1 → jours de la semaine ouverts à la réservation ──────
  //    (calendrier : vert = jour avec créneaux actifs, rouge = jour sans)
  if (req.method === 'GET' && slugParam && url.searchParams.get('weekdays')) {
    const shop = await resolveShop(admin, slugParam);
    if (!shop) return jsonR({ success: false });
    if (!shop.reservation_enabled) return jsonR({ success: true, reservation_enabled: false, available_weekdays: [] });
    const { data: ts } = await admin
      .from('restaurant_time_slots')
      .select('jours_semaine')
      .eq('prestataire_id', shop.merchant_id)
      .eq('actif', true);
    const set = new Set<number>();
    (ts ?? []).forEach((r: { jours_semaine: number[] }) => (r.jours_semaine ?? []).forEach(d => set.add(Number(d))));
    return jsonR({ success: true, reservation_enabled: true, available_weekdays: Array.from(set).sort() });
  }

  // ── GET ?slug=&date= → créneaux du jour avec flag libre/pris ──────────────────
  const dateParam = url.searchParams.get('date');
  if (req.method === 'GET' && slugParam && dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return err('date invalide');
    const shop = await resolveShop(admin, slugParam);
    if (!shop) return jsonR({ success: false, closed: true });
    const payment_methods = Array.isArray(shop.payment_methods) ? shop.payment_methods : ['wave', 'om'];
    if (!shop.reservation_enabled) return jsonR({ success: true, reservation_enabled: false, slots: [] });
    if (shop.is_manually_closed)   return jsonR({ success: true, reservation_enabled: true, payment_methods, closed: true, slots: [] });

    const weekday = new Date(dateParam + 'T12:00:00').getDay(); // 0=dim … 6=sam (= EXTRACT DOW)

    // Tous les créneaux actifs de ce jour (y compris ceux qui seront rouges)
    const { data: allSlots, error: slotErr } = await admin
      .from('restaurant_time_slots')
      .select('id, label, heure_debut, heure_fin, jours_semaine, position')
      .eq('prestataire_id', shop.merchant_id)
      .eq('actif', true)
      .contains('jours_semaine', [weekday])
      .order('position').order('heure_debut');
    if (slotErr) return err('Créneaux indisponibles', 500);

    // Créneaux déjà réservés ce jour (non annulés/refusés)
    const { data: taken } = await admin
      .from('table_reservations')
      .select('heure_debut, statut')
      .eq('prestataire_id', shop.merchant_id)
      .eq('date_reservation', dateParam);
    const takenSet = new Set(
      (taken ?? [])
        .filter((r: { statut: string }) => !['annulee', 'refusee'].includes(String(r.statut)))
        .map((r: { heure_debut: string }) => String(r.heure_debut).slice(0, 5)),
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowMin = todayStr === dateParam ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
    const slots = (Array.isArray(allSlots) ? allSlots : []).map((r: {
      id: string; label: string; heure_debut: string; heure_fin: string;
    }) => {
      const hd = String(r.heure_debut).slice(0, 5);
      const past = nowMin >= 0 && toMin(hd) <= nowMin;
      return {
        slot_id: r.id, label: r.label, heure_debut: hd, heure_fin: String(r.heure_fin).slice(0, 5),
        available: !past && !takenSet.has(hd),
      };
    });
    return jsonR({ success: true, reservation_enabled: true, payment_methods, closed: false, slots });
  }

  // ── POST — créer le payment_intent + initier le paiement ─────────────────────
  if (req.method !== 'POST') return err('Méthode non supportée', 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err('Corps JSON invalide'); }

  const { slug, date, timeSlotId, heureDebut, nbPersonnes, name, phone, moyenPaiement, idempotencyKey } =
    body as Record<string, string>;

  if (!slug || !date || !heureDebut || !name || !phone || !moyenPaiement) return err('Paramètres manquants');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Date invalide');
  if (!/^\d{2}:\d{2}$/.test(heureDebut)) return err('Heure invalide');
  if (timeSlotId && !isUUID(timeSlotId)) return err('Créneau invalide');
  const nb = Number(nbPersonnes);
  if (!Number.isInteger(nb) || nb < 1 || nb > 100) return err('Nombre de personnes invalide (1-100)');
  const digits = String(phone).replace(/[^0-9]/g, '').replace(/^221/, '');
  if (!PHONE_RE.test(digits)) return err('Numéro de téléphone invalide');
  if (!['wave', 'orange_money'].includes(moyenPaiement)) return err('Moyen de paiement invalide');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(date + 'T00:00:00') < today) return err('La date doit être dans le futur', 422);

  const shop = await resolveShop(admin, slug);
  if (!shop) return err('Restaurant introuvable', 404);
  if (!shop.reservation_enabled) return err('Ce restaurant ne propose pas la réservation de table', 422);
  const allowed = Array.isArray(shop.payment_methods) ? shop.payment_methods : ['wave', 'om'];
  const wanted  = moyenPaiement === 'wave' ? 'wave' : 'om';
  if (!allowed.includes(wanted)) return err('Moyen de paiement non accepté par ce restaurant', 422);

  const guestId = await ensureGuestUser(admin).catch(() => null);
  if (!guestId) return err('Erreur système : utilisateur invité introuvable', 500);

  const cleanName = String(name).trim().slice(0, 100);
  const resaMeta = {
    date_reservation:  date,
    heure_debut:       heureDebut,
    nb_personnes:      nb,
    motif:             'autre',
    // table_reservations n'a pas de colonnes nom/tél : on les expose au marchand ici.
    details_motif:     `Réservation web — ${cleanName} · ${digits}`,
    options_speciales: [],
    space_id:          null,
    time_slot_id:      timeSlotId ?? null,
    client_name:       cleanName,
    client_phone:      digits,
    source:            'web_guest',
  };

  const idem = String(idempotencyKey || `guest-std-table-${guestId}-${shop.merchant_id}-${date}-${Date.now()}`).slice(0, 64);
  const { data: pi, error: piErr } = await admin
    .from('payment_intents')
    .insert({
      type:             'table_reservation',
      client_id:        guestId,
      prestataire_id:   shop.merchant_id,
      montant_total:    MONTANT_CLIENT,
      commission_lassi: COMMISSION_LASSI,
      prix_base:        MONTANT_PRESTATAIRE,
      statut:           'pending',
      moyen_paiement:   moyenPaiement,
      idempotency_key:  idem,
      metadata:         resaMeta,
    })
    .select('id')
    .single();

  if (piErr || !pi) {
    console.error('[create-guest-table-reservation] pi insert', piErr?.message);
    return err('Erreur création réservation', 500);
  }
  const piId = pi.id as string;
  const shopQ = `&shop=${encodeURIComponent(slug)}`;

  try {
    // Simulation (aucune clé prod) : confirmer + créer la résa directement.
    if (!IS_PRODUCTION) {
      await admin.from('payment_intents')
        .update({ statut: 'simulated', external_ref: `SIM-GSTDRS-${Date.now()}` })
        .eq('id', piId);
      const { error: rpcErr } = await admin.rpc('confirm_table_reservation_payment', { p_pi_id: piId });
      if (rpcErr) throw new Error(rpcErr.message);
      return jsonR({ success: true, mode: 'simulation', piId, redirectUrl: null, qrCode: null, montant: MONTANT_CLIENT });
    }

    if (moyenPaiement === 'wave' && IS_WAVE_READY) {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(MONTANT_CLIENT),
        success_url:      `${WEB_BASE}/__resa?pi=${piId}&s=ok${shopQ}`,
        error_url:        `${WEB_BASE}/__resa?pi=${piId}&s=ko${shopQ}`,
        client_reference: piId,
      });
      const resp = await callWaveCheckout(waveBody, piId);
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.message ?? `Wave HTTP ${resp.status}`);
      await admin.from('payment_intents').update({ statut: 'initiated', external_ref: d.id ?? piId }).eq('id', piId);
      return jsonR({ success: true, mode: 'production', piId, redirectUrl: d.wave_launch_url ?? null, qrCode: null, montant: MONTANT_CLIENT });
    }

    if (moyenPaiement === 'orange_money' && IS_OM_READY) {
      if (!OM_WEBHOOK_SECRET) throw new Error('OM_WEBHOOK_SECRET non configuré');
      const omToken = await getOmToken();
      const callbackUrl = `${SUPABASE_URL}/functions/v1/webhook-payment?source=om&pi_id=${encodeURIComponent(piId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
      const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${omToken}`, 'Content-Type': 'application/json', 'X-Callback-Url': callbackUrl },
        body: JSON.stringify({
          code: OM_MERCHANT_CODE, name: 'LASSI Réservation Table',
          amount: { value: MONTANT_CLIENT, unit: 'XOF' }, validity: 900,
          metadata: { pi_id: piId }, notificationUrl: callbackUrl,
        }),
      });
      const d = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(`OM: ${d.message ?? resp.status}`);
      const deepLink = d.deepLinks?.OM ?? d.deepLink ?? null;
      const qrCode   = d.qrCode ?? null;
      if (!deepLink && !qrCode) throw new Error('QR Orange Money indisponible');
      await admin.from('payment_intents').update({ statut: 'initiated', external_ref: d.payToken ?? piId }).eq('id', piId);
      return jsonR({ success: true, mode: 'production', piId, redirectUrl: deepLink, qrCode, montant: MONTANT_CLIENT });
    }

    return err('Moyen de paiement indisponible', 502);
  } catch (e) {
    console.error('[create-guest-table-reservation] payment', e instanceof Error ? e.message : e);
    await admin.from('payment_intents').update({ statut: 'failed' }).eq('id', piId);
    return err('Le paiement n\'a pas pu être initié. Réessaie.', 502);
  }
});
