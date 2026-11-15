// ============================================================
// EDGE FUNCTION : create-guest-terrain-reservation  (verify_jwt = false)
// Réservation terrain invité WEB depuis s.lassi.tech
//
// GET ?terrain_id=<uuid>                              → info terrain
// GET ?terrain_id=<uuid>&date=<YYYY-MM-DD>&dur=<min> → créneaux libres
// GET ?resa=<uuid>                                    → statut + auto-vérif Wave/OM
// POST {terrainId, date, heureDebut, dureeMinutes, name, phone, moyenPaiement, idem}
//      → {success, resaId, redirectUrl?, qrCode?, mode}
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { callWaveCheckout, getWaveCheckout } from '../_shared/waveProxy.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { triggerTerrainPayout } from '../_shared/terrainPayout.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')              ?? '';
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')              ?? '';
const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')            ?? '';
const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')          ?? '';
const OM_WEBHOOK_SECRET = Deno.env.get('OM_WEBHOOK_SECRET')         ?? '';
const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';

const WEB_BASE = 'https://s.lassi.tech';
const GUEST_EMAIL = 'commande-web@lassi.tech';
const COMMISSION_RATE = 0.01;
const PHONE_RE = /^7[015678][0-9]{7}$/;
const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
const IS_OM_READY   = isOmReady();

const JS_DAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
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

function buildCors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  };
}

// Utilisateur système partagé pour toutes les réservations terrain invité web.
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

  // ── GET ?receipt=<uuid> → données reçu terrain ───────────────────────────────
  const receiptResaId = url.searchParams.get('receipt') ?? '';
  if (req.method === 'GET' && isUUID(receiptResaId)) {
    const { data: resa } = await admin
      .from('reservations_terrain')
      .select('client_name, client_phone, date_reservation, heure_debut, heure_fin, prix_total, receipt_code, prestataire_id, terrain_id, statut')
      .eq('id', receiptResaId)
      .maybeSingle();
    if (!resa || resa.statut !== 'paye') return err('Réservation introuvable ou non payée', 404);
    const [terrainRow, shopRow] = await Promise.all([
      admin.from('terrains').select('nom, sport_type').eq('id', String(resa.terrain_id)).maybeSingle(),
      admin.from('shops').select('name').eq('merchant_id', String(resa.prestataire_id)).maybeSingle(),
    ]);
    const SPORT_EMOJI: Record<string, string> = { football: '⚽', basketball: '🏀', tennis: '🎾', volleyball: '🏐', autre: '🏟' };
    const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const MONTHS_FR = ['jan.', 'f\xe9v.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'ao\xfbt', 'sep.', 'oct.', 'nov.', 'd\xe9c.'];
    const d = new Date(String(resa.date_reservation) + 'T12:00:00');
    const dateLabel = DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()];
    const montant = Math.round(Number(resa.prix_total));
    const montantLabel = String(montant).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
    const sportType = String(terrainRow.data?.sport_type ?? '');
    return jsonR({
      success:          true,
      terrain_nom:      terrainRow.data?.nom ?? 'Terrain',
      sport_emoji:      SPORT_EMOJI[sportType] ?? '🏟',
      date_label:       dateLabel,
      heure_debut:      String(resa.heure_debut ?? ''),
      heure_fin:        String(resa.heure_fin ?? ''),
      montant_label:    montantLabel,
      receipt_code:     String(resa.receipt_code ?? ''),
      client_name:      String(resa.client_name ?? ''),
      prestataire_name: shopRow.data?.name ?? '',
    });
  }

  // ── GET ?resa=<uuid> → poll statut (avec auto-vérification paiement) ──────────
  const resaId = url.searchParams.get('resa') ?? '';
  if (req.method === 'GET' && isUUID(resaId)) {
    const { data: resa } = await admin
      .from('reservations_terrain')
      .select('statut, paiement_ref, moyen_paiement, date_reservation, heure_fin, heure_debut, prestataire_id, montant_prestataire, terrain_id, prix_total')
      .eq('id', resaId)
      .maybeSingle();

    if (!resa) return jsonR({ paid: false, notFound: true });
    if (resa.statut === 'paye') return jsonR({ paid: true });
    if (resa.statut !== 'en_attente') return jsonR({ paid: false, statut: resa.statut });

    // Si paiement_ref connu → vérifier auprès de l'opérateur
    const pref = resa.paiement_ref as string | null;
    if (!pref) return jsonR({ paid: false });

    let paid = false;
    const moyen = String(resa.moyen_paiement ?? 'wave');

    if (moyen === 'wave' && IS_WAVE_READY) {
      try {
        const r = await getWaveCheckout(pref);
        if (r.ok) {
          const d = await r.json() as Record<string, unknown>;
          const ps = String(d.payment_status ?? d.status ?? '');
          paid = ['succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCEEDED', 'PAID', 'paid'].includes(ps);
        }
      } catch (e) {
        console.error('[terrain-resa poll] wave verify:', e instanceof Error ? e.message : e);
      }
    } else if (moyen === 'orange_money' && IS_OM_READY) {
      try {
        const omToken = await getOmToken();
        const r = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode/${encodeURIComponent(pref)}`, {
          headers: { Authorization: `Bearer ${omToken}` },
        });
        if (r.ok) {
          const d = await r.json() as Record<string, unknown>;
          const st = String(d.status ?? d.statut ?? d.txStatus ?? '').toUpperCase();
          paid = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCESSFULL', 'SUCCESSFUL', 'PAYMENT_SUCCESS'].includes(st);
        }
      } catch (e) {
        console.error('[terrain-resa poll] om verify:', e instanceof Error ? e.message : e);
      }
    }

    if (!paid) return jsonR({ paid: false });

    // Confirmer la réservation
    let receiptCode: string;
    let receiptValidUntil: string;
    try {
      receiptCode = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        b => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 34],
      ).join('');
      const hf = String(resa.heure_fin ?? '23:59').slice(0, 5);
      receiptValidUntil = new Date(`${resa.date_reservation}T${hf}:00`).toISOString();
      if (isNaN(new Date(receiptValidUntil).getTime())) {
        receiptValidUntil = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      }
    } catch {
      receiptCode = Array.from({ length: 6 }, () => '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 34)]).join('');
      receiptValidUntil = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    }

    const { error: updErr } = await admin
      .from('reservations_terrain')
      .update({
        statut:              'paye',
        receipt_status:      'valide',
        receipt_code:        receiptCode,
        receipt_valid_until: receiptValidUntil,
        payout_statut:       'pending',
      })
      .eq('id', resaId)
      .eq('statut', 'en_attente');

    if (updErr) {
      console.error('[terrain-resa poll] updErr:', updErr.message);
      // Peut arriver si confirmation déjà faite en parallèle
      const { data: rechk } = await admin.from('reservations_terrain').select('statut').eq('id', resaId).maybeSingle();
      return jsonR({ paid: rechk?.statut === 'paye' });
    }

    // Déclencher le reversement en background — ne pas bloquer la réponse { paid: true }
    // (le payout Wave/OM peut prendre 10-20s, ce qui maintiendrait le spinner client).
    const payoutTask = triggerTerrainPayout(admin, {
      reservationId:             resaId,
      prestataireId:             resa.prestataire_id as string,
      montant:                   resa.montant_prestataire as number,
      moyenPaiement:             moyen,
      WAVE_API_KEY,
      OM_RETAILER_MSISDN,
      OM_RETAILER_PIN_ENCRYPTED,
    }).catch(e => console.error('[terrain-resa poll] bg payout:', e instanceof Error ? e.message : e));
    // Garder l'invocation Deno active pendant le payout background
    try {
      // @ts-ignore — EdgeRuntime.waitUntil disponible en Supabase Edge Functions
      (globalThis as Record<string, unknown>).EdgeRuntime?.waitUntil?.(payoutTask);
    } catch { /* ignore si non dispo */ }

    return jsonR({ paid: true });
  }

  // ── GET ?terrain_id=<uuid> → info terrain ────────────────────────────────────
  const terrainIdParam = url.searchParams.get('terrain_id') ?? '';
  const dateParam      = url.searchParams.get('date') ?? '';
  const durParam       = parseInt(url.searchParams.get('dur') ?? '60', 10) || 60;

  if (req.method === 'GET' && isUUID(terrainIdParam)) {
    const { data: terrain } = await admin
      .from('terrains')
      .select('id, nom, description, images, prix_horaire, sport_type, adresse, actif, prestataire_id')
      .eq('id', terrainIdParam)
      .eq('actif', true)
      .maybeSingle();

    if (!terrain) return jsonR({ success: false, notFound: true }, 404);

    // Si date non fournie → retourner seulement les infos terrain
    if (!dateParam) {
      const { data: horaires } = await admin
        .from('terrain_horaires')
        .select('jour_semaine, heure_ouverture, heure_fermeture, ferme')
        .eq('terrain_id', terrainIdParam);
      return jsonR({ success: true, terrain, horaires: horaires ?? [] });
    }

    // Si date fournie → retourner créneaux disponibles
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return err('Date invalide');
    const duree = Math.max(30, Math.min(durParam, 300));

    // Horaire du jour
    const d = new Date(dateParam + 'T12:00:00');
    const jourSemaine = d.getDay();
    const { data: horaire } = await admin
      .from('terrain_horaires')
      .select('heure_ouverture, heure_fermeture, ferme')
      .eq('terrain_id', terrainIdParam)
      .eq('jour_semaine', jourSemaine)
      .maybeSingle();

    if (horaire?.ferme) return jsonR({ success: true, closed: true, slots: [] });

    const openStr  = (horaire?.heure_ouverture ?? '08:00').slice(0, 5);
    const closeStr = (horaire?.heure_fermeture ?? '22:00').slice(0, 5);
    const openMin  = toMin(openStr);
    const closeMin = toMin(closeStr) || 1440;

    // Créneaux déjà pris
    const { data: pris } = await admin.rpc('get_crenaux_pris', {
      p_terrain_id: terrainIdParam,
      p_date:       dateParam,
    });
    const taken: Array<{ heure_debut: string; heure_fin: string }> = Array.isArray(pris) ? pris : [];

    // Générer créneaux disponibles (tous les 30 min)
    const nowMin = new Date().toISOString().slice(0, 10) === dateParam
      ? new Date().getHours() * 60 + new Date().getMinutes()
      : -1;

    const slots: Array<{ debut: string; fin: string }> = [];
    let cursor = openMin;
    while (cursor + duree <= closeMin) {
      const debut = fromMin(cursor);
      const fin   = fromMin(cursor + duree);
      if (nowMin < 0 || cursor > nowMin) {
        const overlap = taken.some(t => {
          const td = toMin(t.heure_debut.slice(0, 5));
          const tf = toMin(t.heure_fin.slice(0, 5));
          return !(cursor + duree <= td || cursor >= tf);
        });
        if (!overlap) slots.push({ debut, fin });
      }
      cursor += 30;
    }

    return jsonR({ success: true, closed: false, slots });
  }

  // ── POST → créer réservation + initier paiement ───────────────────────────────
  if (req.method !== 'POST') return err('Méthode non supportée', 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err('Corps JSON invalide'); }

  const {
    terrainId, date, heureDebut, dureeMinutes: durMin,
    name, phone, moyenPaiement, idem,
  } = body as Record<string, string>;

  if (!terrainId || !isUUID(terrainId) || !date || !heureDebut || !name || !phone || !moyenPaiement) {
    return err('Paramètres manquants');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Date invalide');
  const digits = String(phone).replace(/[^0-9]/g, '').replace(/^221/, '');
  if (!PHONE_RE.test(digits)) return err('Numéro de téléphone invalide');
  if (!['wave', 'orange_money'].includes(moyenPaiement)) return err('Moyen de paiement invalide');

  const dureeM = Math.max(30, Math.min(parseInt(String(durMin || '60'), 10) || 60, 300));
  const [hD, mD] = heureDebut.split(':').map(Number);
  if (!Number.isFinite(hD) || !Number.isFinite(mD)) return err('Créneau invalide');
  const heureFin    = fromMin(hD * 60 + mD + dureeM);
  const dureeHeures = dureeM / 60;

  // Charger terrain
  const { data: terrain } = await admin
    .from('terrains')
    .select('id, nom, prix_horaire, prestataire_id, actif')
    .eq('id', terrainId)
    .maybeSingle();

  if (!terrain) return err('Terrain introuvable', 404);
  if (!terrain.actif) return err('Terrain non disponible');

  // Prix
  const prixBase          = Math.round(Number(terrain.prix_horaire) * dureeHeures);
  const commission         = Math.ceil(prixBase * COMMISSION_RATE);
  const prixTotal          = prixBase + commission;
  const montantPrestataire = prixBase;

  // Utilisateur invité
  let guestId: string;
  try { guestId = await ensureGuestUser(admin); }
  catch (e) { return err('Erreur utilisateur invité : ' + (e instanceof Error ? e.message : ''), 500); }

  // Créer la réservation
  const { data: resa, error: resaErr } = await admin
    .from('reservations_terrain')
    .insert({
      client_id:           guestId,
      terrain_id:          terrainId,
      prestataire_id:      terrain.prestataire_id as string,
      date_reservation:    date,
      heure_debut:         heureDebut,
      heure_fin:           heureFin,
      duree_heures:        dureeHeures,
      prix_total:          prixTotal,
      commission_lassi:    commission,
      montant_prestataire: montantPrestataire,
      moyen_paiement:      moyenPaiement,
      client_name:         String(name).trim().slice(0, 100),
      client_phone:        digits,
      statut:              'en_attente',
    })
    .select('id')
    .single();

  if (resaErr) {
    // 23P01 = GIST exclusion violation → créneau déjà réservé
    if (resaErr.code === '23P01') {
      return err('Ce créneau est déjà réservé. Choisis un autre horaire.', 409);
    }
    console.error('[create-guest-terrain] insert:', resaErr.message);
    return err('Erreur création réservation', 500);
  }

  const resaIdNew = resa.id as string;
  const { data: _shopSlug } = await admin.from('shops').select('slug').eq('merchant_id', String(terrain.prestataire_id)).maybeSingle();
  const _shopQ = (_shopSlug as any)?.slug ? `&shop=${encodeURIComponent(String((_shopSlug as any).slug))}` : '';
  const successUrl  = `${WEB_BASE}/commande?id=${resaIdNew}&type=terrain&s=ok${_shopQ}`;
  const errorUrl    = `${WEB_BASE}/commande?id=${resaIdNew}&type=terrain&s=ko${_shopQ}`;
  const idempKey    = String(idem || resaIdNew).slice(0, 64);

  try {
    if (IS_WAVE_READY && moyenPaiement === 'wave') {
      const waveBody = JSON.stringify({
        currency:         'XOF',
        amount:           String(prixTotal),
        success_url:      successUrl,
        error_url:        errorUrl,
        client_reference: resaIdNew,
      });
      const resp = await callWaveCheckout(waveBody, idempKey);
      if (!resp.ok) throw new Error(`Wave HTTP ${resp.status}`);
      const d = await resp.json() as Record<string, unknown>;
      await admin.from('reservations_terrain')
        .update({ paiement_ref: d.id ?? d.transaction_id })
        .eq('id', resaIdNew);
      return jsonR({
        success: true, resaId: resaIdNew,
        redirectUrl: d.wave_launch_url ?? d.checkout_url,
        mode: 'production',
      });

    } else if (IS_OM_READY && moyenPaiement === 'orange_money') {
      const omToken    = await getOmToken();
      const callbackUrl = `${SUPABASE_URL}/functions/v1/webhook-payment?source=om&terrain_r=${encodeURIComponent(resaIdNew)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
      const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
        method:  'POST',
        headers: {
          Authorization:    `Bearer ${omToken}`,
          'Content-Type':   'application/json',
          'X-Callback-Url': callbackUrl,
        },
        body: JSON.stringify({
          code:     OM_MERCHANT_CODE,
          name:     'LASSI',
          amount:   { value: prixTotal, unit: 'XOF' },
          validity: 900,
          metadata: { terrain_r: resaIdNew },
          notificationUrl: callbackUrl,
        }),
      });
      if (!resp.ok) throw new Error(`OM HTTP ${resp.status}`);
      const d = await resp.json() as Record<string, unknown>;
      const deepLink = (d.deepLinks as Record<string, string> | undefined)?.OM ?? d.deepLink ?? null;
      const qrCode   = d.qrCode ?? null;
      if (!deepLink && !qrCode) {
        await admin.from('reservations_terrain').update({ statut: 'annule' }).eq('id', resaIdNew);
        return err('QR Orange Money indisponible. Réessaie ou choisis Wave.', 502);
      }
      await admin.from('reservations_terrain')
        .update({ paiement_ref: d.orderId ?? d.payToken ?? resaIdNew })
        .eq('id', resaIdNew);
      return jsonR({ success: true, resaId: resaIdNew, redirectUrl: deepLink, qrCode, mode: 'production' });

    } else {
      // Simulation (aucune clé prod configurée)
      await admin.from('reservations_terrain').update({ statut: 'paye' }).eq('id', resaIdNew);
      return jsonR({ success: true, resaId: resaIdNew, redirectUrl: successUrl, mode: 'simulation' });
    }

  } catch (e) {
    console.error('[create-guest-terrain] payment:', e instanceof Error ? e.message : e);
    await admin.from('reservations_terrain').update({ statut: 'annule' }).eq('id', resaIdNew);
    return err('Le paiement n\'a pas pu être initié. Réessaie.', 502);
  }
});
