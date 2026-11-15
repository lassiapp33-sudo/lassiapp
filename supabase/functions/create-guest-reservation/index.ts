// ============================================================
// EDGE FUNCTION : create-guest-reservation  (verify_jwt = false)
// Réservation beauté INVITÉ WEB depuis s.lassi.tech
// 3 modes GET/POST :
//   GET ?slug=&service=&date=  → créneaux disponibles
//   GET ?status=<reservationId> → statut paiement
//   POST {slug,serviceId,date,slotDebut,name,phone,moyenPaiement,idempotencyKey}
//        → {success, reservationId, redirectUrl, qrCode, mode}
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

const WEB_BASE = 'https://s.lassi.tech';
const GUEST_EMAIL = 'commande-web@lassi.tech';
const COMMISSION_RATE = 0.01;
const PHONE_RE = /^7[015678][0-9]{7}$/;
const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
const IS_OM_READY   = isOmReady();

// JS getDay() → DayKey
const JS_TO_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

  // ── GET ?receipt=<uuid> → données reçu beauté ────────────────────────────────
  const receiptId = url.searchParams.get('receipt') ?? '';
  if (req.method === 'GET' && isUUID(receiptId)) {
    const { data: resa } = await admin
      .from('beauty_reservations')
      .select('client_name, client_phone, date_reservation, heure_debut, heure_fin, prix_total, receipt_code, prestataire_id, service_id, statut')
      .eq('id', receiptId)
      .maybeSingle();
    if (!resa || resa.statut !== 'paye') return err('Réservation introuvable ou non payée', 404);
    const [svcRow, profRow] = await Promise.all([
      admin.from('beauty_services').select('nom').eq('id', String(resa.service_id)).maybeSingle(),
      admin.from('profiles').select('full_name').eq('id', String(resa.prestataire_id)).maybeSingle(),
    ]);
    const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const MONTHS_FR = ['jan.', 'f\xe9v.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'ao\xfbt', 'sep.', 'oct.', 'nov.', 'd\xe9c.'];
    const d = new Date(String(resa.date_reservation) + 'T12:00:00');
    const dateLabel = DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()];
    const montant = Math.round(Number(resa.prix_total));
    const montantLabel = String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
    return jsonR({
      success:          true,
      service_nom:      svcRow.data?.nom ?? 'Service',
      date_label:       dateLabel,
      heure_debut:      String(resa.heure_debut ?? '').slice(0, 5),
      heure_fin:        String(resa.heure_fin ?? '').slice(0, 5),
      montant_label:    montantLabel,
      receipt_code:     String(resa.receipt_code ?? ''),
      client_name:      String(resa.client_name ?? ''),
      prestataire_name: profRow.data?.full_name ?? '',
    });
  }

  // ── GET ?status=<reservationId> ───────────────────────────────────────────────
  const statusId = url.searchParams.get('status');
  if (statusId && isUUID(statusId)) {
    const { data } = await admin
      .from('beauty_reservations')
      .select('statut')
      .eq('id', statusId)
      .maybeSingle();
    return jsonR({ paid: data?.statut === 'paye' });
  }

  // ── GET ?slug=&service=&date= → créneaux disponibles ─────────────────────────
  const slugParam    = url.searchParams.get('slug');
  const serviceParam = url.searchParams.get('service');
  const dateParam    = url.searchParams.get('date');

  if (req.method === 'GET' && slugParam && serviceParam && dateParam) {
    if (!isUUID(serviceParam)) return err('service invalide');

    // Charger service (duree + prestataire)
    const { data: svc } = await admin
      .from('beauty_services')
      .select('id, duree_minutes, prestataire_id, actif')
      .eq('id', serviceParam)
      .maybeSingle();

    if (!svc || !svc.actif) return jsonR({ success: false, closed: true });

    // Charger horaires via shop slug
    const { data: shop } = await admin
      .from('shops')
      .select('opening_hours, is_manually_closed')
      .eq('slug', slugParam)
      .maybeSingle();

    if (shop?.is_manually_closed) return jsonR({ success: true, closed: true, slots: [] });

    const hours = (shop?.opening_hours ?? {}) as Record<string, { open: string; close: string; closed?: boolean }>;
    const d = new Date(dateParam + 'T12:00:00');
    const dayKey = JS_TO_DAY[d.getDay()];
    const dayH = hours[dayKey];

    // Jour explicitement fermé → closed. Horaires absents/vides → suppose ouvert (défaut 08:00-20:00)
    if (dayH && dayH.closed) return jsonR({ success: true, closed: true, slots: [] });
    const effectiveDayH = dayH ?? { open: '08:00', close: '20:00' };

    const dureeMin = Math.max(15, Number(svc.duree_minutes) || 30);
    const openMin  = toMin(effectiveDayH.open || '08:00');
    const rawClose = toMin(effectiveDayH.close || '20:00');
    const closeMin = rawClose || 1440;

    // Générer tous les créneaux du jour
    const allSlots: { debut: string; fin: string }[] = [];
    let cursor = openMin;
    while (cursor + dureeMin <= closeMin) {
      allSlots.push({ debut: fromMin(cursor), fin: fromMin(cursor + dureeMin) });
      cursor += dureeMin;
    }

    if (!allSlots.length) return jsonR({ success: true, slots: [] });

    // Créneaux déjà pris (via RPC existante)
    const { data: pris } = await admin.rpc('get_beauty_creneaux_pris', {
      p_prestataire_id: svc.prestataire_id,
      p_date: dateParam,
    });
    const taken: Array<{ debut: string; fin: string }> = Array.isArray(pris) ? pris : [];

    // Filtrer — un créneau est libre si aucun pris ne se chevauche
    const nowMin = new Date().toISOString().slice(0, 10) === dateParam
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : -1;

    const freeSlots = allSlots.filter(s => {
      if (nowMin >= 0 && toMin(s.debut) <= nowMin) return false; // passé
      return !taken.some(t => !(s.fin <= t.debut || s.debut >= t.fin));
    });

    return jsonR({ success: true, closed: false, slots: freeSlots });
  }

  // ── POST — créer réservation + initier paiement ───────────────────────────────
  if (req.method !== 'POST') return err('Méthode non supportée', 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err('Corps JSON invalide'); }

  const { slug, serviceId, date, slotDebut, name, phone, moyenPaiement, idempotencyKey } =
    body as Record<string, string>;

  if (!slug || !serviceId || !isUUID(serviceId) || !date || !slotDebut || !name || !phone || !moyenPaiement) {
    return err('Paramètres manquants');
  }
  const digits = String(phone).replace(/[^0-9]/g, '').replace(/^221/, '');
  if (!PHONE_RE.test(digits)) return err('Numéro de téléphone invalide');
  if (!['wave', 'orange_money'].includes(moyenPaiement)) return err('Moyen de paiement invalide');

  // Valider date (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Date invalide');

  // Charger service
  const { data: svc } = await admin
    .from('beauty_services')
    .select('id, prix, duree_minutes, prestataire_id, actif')
    .eq('id', serviceId)
    .maybeSingle();

  if (!svc) return err('Service introuvable', 404);
  if (!svc.actif) return err('Service non disponible');

  const dureeMin  = Math.max(15, Number(svc.duree_minutes) || 30);
  const [hD, mD]  = slotDebut.split(':').map(Number);
  if (!Number.isFinite(hD) || !Number.isFinite(mD)) return err('Créneau invalide');
  const heureFin  = fromMin(hD * 60 + mD + dureeMin);

  // Vérifier disponibilité (pas de double-booking)
  const { data: conflict } = await admin
    .from('beauty_reservations')
    .select('id')
    .eq('service_id', serviceId)
    .eq('date_reservation', date)
    .eq('heure_debut', slotDebut)
    .neq('statut', 'annule')
    .maybeSingle();

  if (conflict) return err('Créneau déjà réservé. Choisis un autre créneau.', 409);

  // Prix
  const prixBase = Math.round(Number(svc.prix));
  if (!(prixBase > 0)) return err('Prix invalide du service');
  const commission         = Math.ceil(prixBase * COMMISSION_RATE);
  const prixTotal          = prixBase + commission;
  const montantPrestataire = prixBase;

  // Récupérer l'ID du user système invité web
  const guestId = await ensureGuestUser(admin).catch(() => null);
  if (!guestId) return err('Erreur système : utilisateur invité introuvable', 500);

  // Créer la réservation
  const { data: resa, error: resaErr } = await admin
    .from('beauty_reservations')
    .insert({
      client_id:           guestId,
      prestataire_id:      svc.prestataire_id,
      service_id:          serviceId,
      date_reservation:    date,
      heure_debut:         slotDebut,
      heure_fin:           heureFin,
      client_name:         String(name).trim().slice(0, 100),
      client_phone:        digits,
      prix_total:          prixTotal,
      commission_lassi:    commission,
      montant_prestataire: montantPrestataire,
      moyen_paiement:      moyenPaiement,
      statut:              'en_attente',
    })
    .select('id')
    .single();

  if (resaErr || !resa) {
    console.error('[create-guest-reservation] insert', resaErr?.message);
    return err('Erreur création réservation', 500);
  }

  const reservationId = resa.id as string;
  const shopQ      = `&shop=${encodeURIComponent(slug)}`;
  // ⚠️ success_url pointe vers la PAGE DE CONFIRMATION — PAS la vitrine
  const successUrl = `${WEB_BASE}/commande?id=${reservationId}&type=beauty&s=ok${shopQ}`;
  const errorUrl   = `${WEB_BASE}/commande?id=${reservationId}&type=beauty&s=ko${shopQ}`;
  const idem       = String(idempotencyKey || reservationId).slice(0, 64);

  try {
    if (IS_WAVE_READY && moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(prixTotal),
        success_url:      successUrl,
        error_url:        errorUrl,
        client_reference: reservationId,
      });
      const resp = await callWaveCheckout(waveBody, idem);
      if (!resp.ok) throw new Error(`Wave HTTP ${resp.status}`);
      const d = await resp.json() as Record<string, unknown>;
      await admin.from('beauty_reservations')
        .update({ paiement_ref: d.id ?? d.transaction_id })
        .eq('id', reservationId);
      return jsonR({
        success: true, reservationId,
        redirectUrl: d.wave_launch_url ?? d.checkout_url,
        mode: 'production',
      });

    } else if (IS_OM_READY && moyenPaiement === 'orange_money') {
      const omToken = await getOmToken();
      const callbackUrl = `${SUPABASE_URL}/functions/v1/webhook-payment?source=om&beauty_r=${encodeURIComponent(reservationId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
      const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
        method:  'POST',
        headers: {
          Authorization:   `Bearer ${omToken}`,
          'Content-Type':  'application/json',
          'X-Callback-Url': callbackUrl,
        },
        body: JSON.stringify({
          code:     OM_MERCHANT_CODE,
          name:     'LASSI',
          amount:   { value: prixTotal, unit: 'XOF' },
          validity: 900,
          metadata: { beauty_r: reservationId },
          notificationUrl: callbackUrl,
        }),
      });
      if (!resp.ok) throw new Error(`OM HTTP ${resp.status}`);
      const d = await resp.json() as Record<string, unknown>;
      const deepLink = (d.deepLinks as Record<string, string> | undefined)?.OM ?? d.deepLink ?? null;
      const qrCode   = d.qrCode ?? null;
      if (!deepLink && !qrCode) {
        await admin.from('beauty_reservations').update({ statut: 'annule' }).eq('id', reservationId);
        return err('QR Orange Money indisponible. Réessaie ou choisis Wave.', 502);
      }
      await admin.from('beauty_reservations')
        .update({ paiement_ref: d.orderId ?? d.payToken ?? reservationId })
        .eq('id', reservationId);
      return jsonR({ success: true, reservationId, redirectUrl: deepLink, qrCode, mode: 'production' });

    } else {
      // Simulation (aucune clé prod configurée)
      await admin.from('beauty_reservations').update({ statut: 'paye' }).eq('id', reservationId);
      return jsonR({ success: true, reservationId, redirectUrl: successUrl, mode: 'simulation' });
    }

  } catch (e) {
    console.error('[create-guest-reservation] payment', e instanceof Error ? e.message : e);
    await admin.from('beauty_reservations').update({ statut: 'annule' }).eq('id', reservationId);
    return err('Le paiement n\'a pas pu être initié. Réessaie.', 502);
  }
});
