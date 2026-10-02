// ============================================================
// EDGE FUNCTION : create-guest-order  (verify_jwt = false)
// Checkout INVITÉ WEB — commande depuis le lien de partage (s.lassi.tech)
// SANS app, SANS compte. Le client saisit nom + téléphone + note, choisit
// Wave/OM, paie. La commande arrive dans l'app DU MARCHAND comme une commande
// normale (le marchand le rappelle pour organiser retrait/livraison).
//
// Sécurité — réutilise le cœur paiement existant, aucune table sensible modifiée :
//   • Prix recalculés côté serveur depuis products (jamais le client).
//   • client_id = utilisateur système "Commande web" (satisfait la contrainte
//     payment_intents.client_id NOT NULL ; ≠ marchand → passe le trigger
//     anti-auto-achat ; webhook client push simplement skippé).
//   • create_order_atomic + initiate_order_payment RÉUTILISÉS tels quels.
//   • Wave/OM initiés avec success_url WEB (pas de deep link lassiapp://).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isUUID, isPositiveInt, isSafeString } from '../_shared/validation.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { callWaveCheckout, getWaveCheckout } from '../_shared/waveProxy.ts';

// CORS PUBLIC : cet endpoint est appelé depuis la vitrine web publique
// (s.lassi.tech), pas seulement l'admin. On reflète l'Origin (endpoint sans
// cookie, sécurité = validation serveur + prix recalculés, PAS le CORS).
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

// ── Normalisation header WAV ─────────────────────────────────────────────────
// Les encodeurs WAV navigateur (checkout web) streament le fichier et laissent
// souvent la taille du chunk "data" (et le RIFF size) à 0. Les <audio> HTML
// recalculent → lecture OK dans le navigateur. Mais iOS AVPlayer (expo-av, app
// prestataire) lit 0 échantillon → "ça charge mais rien". On réécrit les vraies
// tailles à partir de la longueur réelle des octets. Idempotent (WAV déjà valide
// → mêmes valeurs). PCM canonique uniquement (marqueurs RIFF/WAVE requis).
function normalizeWavHeader(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 44) return bytes;
  const ascii = (o: number, s: string) =>
    s.split('').every((c, i) => bytes[o + i] === c.charCodeAt(0));
  if (!ascii(0, 'RIFF') || !ascii(8, 'WAVE')) return bytes;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  dv.setUint32(4, bytes.length - 8, true); // RIFF chunk size = total - 8
  const scanEnd = Math.min(bytes.length - 8, 512); // le chunk "data" est dans l'en-tête
  for (let off = 12; off <= scanEnd; off++) {
    if (ascii(off, 'data')) {
      dv.setUint32(off + 4, bytes.length - (off + 8), true); // data size réel
      break;
    }
  }
  return bytes;
}

// Page de confirmation web (vitrine) — PAS de deep link lassiapp:// (invité = sans app).
const WEB_BASE       = 'https://s.lassi.tech';
const GUEST_EMAIL    = 'commande-web@lassi.tech';
const PHONE_RE       = /^7[05678][0-9]{7}$/;
const MAX_ITEMS      = 50;
const MAX_QTY        = 999;

interface ItemInput { productId?: string; dailySpecialId?: string; qty: number }

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

  if (req.method === 'GET') {
    const gp = new URL(req.url).searchParams;

    // ── GET ?receipt=<uuid> : reçu PDF téléchargeable ─────────────────────────
    const rid = gp.get('receipt') ?? '';
    if (rid) {
      if (!isUUID(rid)) return err('receipt invalide', 400);
      const { data: o } = await admin
        .from('orders')
        .select('id, shop_id, client_name, total, note, created_at, pay_method, status')
        .eq('id', rid).maybeSingle();
      if (!o) return err('Commande introuvable', 404);
      if (o.status === 'pending') return err('Commande non payée', 409);
      const { data: its } = await admin
        .from('order_items').select('product_name, qty, unit_price').eq('order_id', rid);
      const { data: sh } = await admin.from('shops').select('name').eq('id', o.shop_id).maybeSingle();
      const phoneMatch = String(o.note ?? '').match(/(7[0-9]{8})/);
      const pdf = buildReceiptPDF({
        shop:   sh?.name ?? 'Boutique',
        ref:    String(o.id).slice(0, 8).toUpperCase(),
        date:   fmtDate(o.created_at),
        client: o.client_name ?? 'Client',
        phone:  phoneMatch ? phoneMatch[1] : '',
        items:  (its ?? []).map((i: Record<string, unknown>) => ({
          name: String(i.product_name ?? ''), qty: Number(i.qty ?? 1), unit: Number(i.unit_price ?? 0),
        })),
        total:  Number(o.total ?? 0),
        pay:    o.pay_method === 'om' ? 'Orange Money' : 'Wave',
      });
      return new Response(pdf, {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="recu-lassi-${String(o.id).slice(0, 8)}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── GET ?order=<uuid> : statut de la commande (polling côté web) ──────────
    const oid = gp.get('order') ?? '';
    if (isUUID(oid)) {
      const { data: o } = await admin.from('orders').select('status').eq('id', oid).maybeSingle();
      if (!o) return err('Commande introuvable', 404);
      const paid = o.status !== 'pending';
      return json({ success: true, paid, status: o.status });
    }

    // ── GET ?verify_order=<uuid> : vérification directe Wave/OM ──────────────
    // Appelé après 5 polls DB infructueux. Interroge Wave/OM directement,
    // confirme en base si payé, évite les INITIATED bloqués.
    const vord = gp.get('verify_order') ?? '';
    if (!isUUID(vord)) return err('paramètre manquant', 400);

    // Chercher le payment_intent lié à cette commande
    const { data: pi } = await admin
      .from('payment_intents')
      .select('id, statut, moyen_paiement, external_ref')
      .eq('order_id', vord)
      .maybeSingle();

    if (!pi) {
      // Pas de payment_intent → lire le statut order directement
      const { data: ordChk } = await admin.from('orders').select('status').eq('id', vord).maybeSingle();
      return json({ success: true, paid: ordChk ? ordChk.status !== 'pending' : false });
    }

    if (pi.statut !== 'initiated') {
      return json({ success: true, paid: ['confirmed', 'split_done', 'simulated'].includes(pi.statut) });
    }

    let confirmed = false;

    // Vérification Wave directe
    if (pi.moyen_paiement === 'wave' && pi.external_ref && IS_WAVE_READY) {
      try {
        const resp = await getWaveCheckout(pi.external_ref as string);
        if (resp.ok) {
          const wd = await resp.json() as Record<string, unknown>;
          const st = String(wd.payment_status ?? wd.status ?? '');
          confirmed = ['succeeded', 'completed', 'success', 'SUCCESSFUL', 'SUCCEEDED',
                       'PAID', 'paid', 'payment_successful', 'PAYMENT_SUCCEEDED', 'COMPLETED'].includes(st);
          console.log('[create-guest-order] verify_order Wave:', { vord, st, confirmed });
        }
      } catch (e) {
        console.error('[create-guest-order] verify_order Wave erreur:', e instanceof Error ? e.message : e);
      }
    }

    // Vérification OM directe
    if (!confirmed && pi.moyen_paiement === 'orange_money' && pi.external_ref && IS_OM_READY) {
      try {
        const omToken = await getOmToken();
        const ref = encodeURIComponent(pi.external_ref as string);
        const r = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode/${ref}`, {
          headers: { Authorization: `Bearer ${omToken}` },
        });
        if (r.ok) {
          const od = await r.json() as Record<string, unknown>;
          const st = String(od.status ?? od.statut ?? od.txStatus ?? '').toUpperCase();
          confirmed = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCESSFULL', 'SUCCESSFUL', 'PAYMENT_SUCCESS'].includes(st);
          console.log('[create-guest-order] verify_order OM:', { vord, st, confirmed });
        }
      } catch (e) {
        console.error('[create-guest-order] verify_order OM erreur:', e instanceof Error ? e.message : e);
      }
    }

    if (confirmed) {
      await admin.from('payment_intents').update({
        statut:          'confirmed',
        external_status: 'SUCCESS_PULL_WEB',
        confirmed_at:    new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      }).eq('id', pi.id).eq('statut', 'initiated');

      await admin.rpc('confirm_order_from_payment', { p_payment_intent_id: pi.id });
    }

    return json({ success: true, paid: confirmed });
  }

  if (req.method !== 'POST') return err('Méthode non autorisée', 405);

  try {
    const body = await req.json();
    const {
      shopId: rawShopId, slug, items, name, phone, note, adresse,
      moyenPaiement, idempotencyKey,
    } = body ?? {};

    // ── Résoudre la boutique (shopId direct ou slug) ──────────────────────────
    let shopId: string | null = null;
    if (rawShopId && isUUID(rawShopId)) {
      shopId = rawShopId;
    } else if (typeof slug === 'string' && slug.trim()) {
      const { data: shop } = await admin
        .from('shops').select('id').eq('slug', slug.trim()).maybeSingle();
      shopId = shop?.id ?? null;
    }
    if (!shopId) return err('Boutique introuvable', 404);

    // ── Validation entrées ────────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) return err('Panier vide', 400);
    if (items.length > MAX_ITEMS) return err('Trop d\'articles', 400);
    for (const it of items as unknown[]) {
      const pid = (it as Record<string, unknown> | null)?.productId;
      const dsid = (it as Record<string, unknown> | null)?.dailySpecialId;
      const qty  = (it as Record<string, unknown> | null)?.qty;
      if ((!isUUID(pid) && !isUUID(dsid)) || !isPositiveInt(qty, MAX_QTY)) return err('Article invalide', 400);
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || !isSafeString(cleanName, { maxLen: 80 })) return err('Nom requis', 400);

    const cleanPhone = String(phone ?? '').replace(/[\s.+]/g, '').replace(/^221/, '');
    if (!PHONE_RE.test(cleanPhone)) return err('Numéro de téléphone invalide (ex : 77 123 45 67)', 400);

    if (note != null && !isSafeString(String(note), { maxLen: 400 })) return err('Note trop longue', 400);
    if (adresse != null && !isSafeString(String(adresse), { maxLen: 200 })) return err('Adresse trop longue', 400);

    const moyen = moyenPaiement === 'orange_money' ? 'orange_money' : moyenPaiement === 'wave' ? 'wave' : null;
    if (!moyen) return err('Moyen de paiement invalide', 400);

    if (
      idempotencyKey != null &&
      !isSafeString(String(idempotencyKey), { maxLen: 200, pattern: /^[A-Za-z0-9_:.-]+$/ })
    ) return err('idempotencyKey invalide', 400);

    // ── Anti-spam : 10 commandes / heure / numéro ─────────────────────────────
    const { data: rl } = await admin.rpc('check_rate_limit', {
      p_key: `guest_order:${cleanPhone}`, p_max_attempts: 10, p_window_seconds: 3600, p_block_seconds: 0,
    });
    if (rl?.allowed === false) return err('Trop de commandes. Réessaie dans quelques minutes.', 429);

    // ── Recalcul prix serveur (jamais le client) — prix listés, sans promo v1 ──
    const regularItems  = (items as ItemInput[]).filter(i => i.productId && !i.dailySpecialId);
    const specialItems  = (items as ItemInput[]).filter(i => i.dailySpecialId);
    const productIds    = regularItems.map(i => i.productId!);

    let products: { id: string; price: number; name: string; stock: string }[] = [];
    if (productIds.length > 0) {
      const { data } = await admin
        .from('products').select('id, price, name, stock').in('id', productIds).eq('shop_id', shopId);
      if (!data?.length) return err('Produits introuvables', 400);
      products = data as typeof products;
    }

    const pMap: Record<string, { id: string; price: number; name: string; stock: string }> =
      Object.fromEntries(products.map(p => [p.id, p]));

    // Plats du jour
    const specialIds = specialItems.map(i => i.dailySpecialId!);
    let specialMap: Record<string, { id: string; price: number; name: string }> = {};
    if (specialIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: specials } = await admin
        .from('daily_specials').select('id, name, price').in('id', specialIds).eq('shop_id', shopId).eq('date', today);
      if (!specials?.length) return err('Plat du jour introuvable ou expiré', 400);
      specialMap = Object.fromEntries((specials as { id: string; name: string; price: number }[]).map(s => [s.id, s]));
    }

    if (regularItems.length === 0 && specialItems.length === 0) return err('Panier vide', 400);

    let subtotal = 0;
    const orderItems = (items as ItemInput[]).map(it => {
      if (it.dailySpecialId) {
        const sp = specialMap[it.dailySpecialId];
        if (!sp) throw new Error('Plat du jour introuvable');
        subtotal += Math.round(sp.price) * it.qty;
        return { daily_special_id: it.dailySpecialId, product_name: `Plat du jour · ${sp.name}`, qty: it.qty, unit_price: Math.round(sp.price) };
      }
      const p = pMap[it.productId!];
      if (!p) throw new Error('Produit introuvable');
      if (p.stock === 'out') throw new Error(`"${p.name}" est en rupture de stock`);
      subtotal += Math.round(p.price) * it.qty;
      return { product_name: p.name, qty: it.qty, unit_price: Math.round(p.price) };
    });
    const total = Math.max(Math.round(subtotal), 1);

    // ── Utilisateur système invité (client_id valide, ≠ marchand) ─────────────
    const guestId = await ensureGuestUser(admin);

    // Note marchand : téléphone + adresse + message client
    const noteParts = [`📞 ${cleanPhone}`];
    if (adresse && String(adresse).trim()) noteParts.push(`📍 ${String(adresse).trim()}`);
    if (note && String(note).trim()) noteParts.push(String(note).trim());
    const fullNote = noteParts.join('\n').slice(0, 490);

    // ── Créer la commande (RPC atomique existant, client_id = invité) ─────────
    const { data: orderRes, error: orderErr } = await admin.rpc('create_order_atomic', {
      p_shop_id:         shopId,
      p_client_id:       guestId,
      p_client_name:     cleanName,
      p_total:           total,
      p_discount_amount: 0,
      p_promo_label:     null,
      p_order_type:      'place',
      p_note:            fullNote,
      p_idempotency_key: idempotencyKey ?? null,
      p_items:           orderItems,
      p_pay_method:      moyen === 'wave' ? 'wave' : 'om',
      p_livraison_fee:   0,
    });

    let orderId: string | null = ((orderRes as any)?.order_id ?? (orderRes as any)?.id) ?? null;
    if (orderErr) {
      // Double-tap concurrent (UNIQUE client_id+idempotency_key) → récupérer l'existante
      if (orderErr.code === '23505' && idempotencyKey) {
        const { data: dup } = await admin
          .from('orders').select('id').eq('idempotency_key', idempotencyKey).eq('client_id', guestId).maybeSingle();
        orderId = dup?.id ?? null;
      }
      if (!orderId) { console.error('[create-guest-order] order', orderErr.message); return err('Commande impossible', 500); }
    }
    if (!orderId) return err('Commande impossible', 500);

    // ── Message vocal invité (optionnel) — uploadé en service_role, best-effort ─
    // Le marchand le lit via orders.voice_note_url (même bucket que l'app).
    const voiceB64  = typeof body.voiceB64  === 'string' ? body.voiceB64  : '';
    const voiceMime = typeof body.voiceMime === 'string' ? body.voiceMime : '';
    if (voiceB64 && voiceB64.length <= 6_000_000 && /^[A-Za-z0-9+/=]+$/.test(voiceB64)) {
      try {
        // Extraire le type de base (audio/webm;codecs=opus → audio/webm)
        const rawMime = typeof voiceMime === 'string' ? voiceMime.split(';')[0].trim() : '';
        const mime = /^audio\/[a-z0-9.+-]+$/.test(rawMime) ? rawMime : 'audio/wav';
        const ext =
          /wav|wave/.test(mime)    ? 'wav' :
          /mp4|m4a|aac/.test(mime) ? 'm4a' :
          /ogg/.test(mime)         ? 'ogg' :
          /mpeg|mp3/.test(mime)    ? 'mp3' :
          /webm/.test(mime)        ? 'webm' : 'webm';
        let bytes = Uint8Array.from(atob(voiceB64), c => c.charCodeAt(0));
        if (ext === 'wav') bytes = normalizeWavHeader(bytes); // fix header pour AVPlayer iOS
        const vpath = `guest/${orderId}.${ext}`;
        const { error: upErr } = await admin.storage
          .from('voice-notes').upload(vpath, bytes, { contentType: mime, upsert: true });
        if (!upErr) await admin.from('orders').update({ voice_note_url: vpath }).eq('id', orderId);
        else console.error('[create-guest-order] voice upload', upErr.message);
      } catch (ve) {
        console.error('[create-guest-order] voice', ve instanceof Error ? ve.message : 'err');
      }
    }

    // ── Initier le paiement (RPC existant, recalcule + crée payment_intent) ────
    const { data: init, error: initErr } = await admin.rpc('initiate_order_payment', {
      p_order_id: orderId, p_client_id: guestId, p_moyen_paiement: moyen,
    });
    if (initErr || !init?.ok) {
      console.error('[create-guest-order] initiate', initErr?.message ?? init?.error);
      return err('Paiement impossible', 400);
    }

    const piId         = init.payment_intent_id as string;
    const montantTotal = init.montant_total as number;

    const useWaveProd = IS_WAVE_READY && moyen === 'wave';
    const useOmProd   = IS_OM_READY   && moyen === 'orange_money';

    // success/error URL = page web (invité sans app). id = orderId pour le polling,
    // shop = slug pour que "Retour" ramène sur la vitrine de la boutique.
    const shopSlug = typeof slug === 'string' ? slug.trim() : '';
    const shopQ = shopSlug ? `&shop=${encodeURIComponent(shopSlug)}` : '';
    const successUrl = `${WEB_BASE}/commande?id=${orderId}&s=ok${shopQ}`;
    const errorUrl   = `${WEB_BASE}/commande?id=${orderId}&s=ko${shopQ}`;

    try {
      if (useWaveProd) {
        const waveBody = JSON.stringify({
          currency: 'XOF', amount: String(montantTotal),
          success_url: successUrl, error_url: errorUrl, client_reference: piId,
        });
        const resp = await callWaveCheckout(waveBody, piId);
        if (!resp.ok) throw new Error(`Wave ${resp.status}`);
        const d = await resp.json();
        await admin.from('payment_intents').update({ statut: 'initiated', external_ref: d.id ?? d.transaction_id, updated_at: new Date().toISOString() }).eq('id', piId);
        return json({ success: true, orderId, montantTotal, redirectUrl: d.wave_launch_url ?? d.checkout_url, mode: 'production' });

      } else if (useOmProd) {
        if (!OM_WEBHOOK_SECRET) throw new Error('OM non configuré');
        const omToken = await getOmToken();
        const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-payment?source=om&pi_id=${encodeURIComponent(piId)}&secret=${encodeURIComponent(OM_WEBHOOK_SECRET)}`;
        const resp = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${omToken}`, 'Content-Type': 'application/json', 'X-Callback-Url': callbackUrl },
          body: JSON.stringify({
            code: OM_MERCHANT_CODE, name: 'LASSI',
            amount: { value: montantTotal, unit: 'XOF' }, validity: 900,
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
        await admin.from('payment_intents').update({ statut: 'initiated', external_ref: d.orderId ?? d.id ?? d.payToken ?? piId, updated_at: new Date().toISOString() }).eq('id', piId);
        return json({ success: true, orderId, montantTotal, redirectUrl: deepLink, qrCode, mode: 'production' });

      } else {
        // Simulation (aucune clé configurée) — marque payé côté simulation.
        await admin.from('payment_intents').update({ statut: 'simulated', external_ref: `SIM-${Date.now()}`, updated_at: new Date().toISOString() }).eq('id', piId);
        return json({ success: true, orderId, montantTotal, redirectUrl: successUrl, mode: 'simulation' });
      }
    } catch (apiErr) {
      const m = apiErr instanceof Error ? apiErr.message : 'fournisseur';
      console.error('[create-guest-order] provider', m);
      await admin.from('payment_intents').update({ statut: 'failed', updated_at: new Date().toISOString() }).eq('id', piId);
      return err('Le paiement n\'a pas pu être initié. Réessaie.', 502);
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[create-guest-order]', m);
    // Erreurs métier (rupture stock…) = message clair ; sinon générique.
    return err(m.includes('rupture') || m.includes('introuvable') ? m : 'Une erreur est survenue. Réessaie.', 500);
  }
});

// Utilisateur système partagé pour toutes les commandes invité web.
// Créé une fois via l'Admin API ; le trigger handle_new_auth_user crée le profil.
async function ensureGuestUser(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: prof } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof?.id) return prof.id as string;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: GUEST_EMAIL, email_confirm: true,
    user_metadata: { name: 'Commande web', role: 'client' },
  });
  if (created?.user?.id) return created.user.id;

  // Course entre deux cold starts : re-chercher.
  const { data: prof2 } = await admin.from('profiles').select('id').eq('auth_email', GUEST_EMAIL).maybeSingle();
  if (prof2?.id) return prof2.id as string;
  throw new Error('guest user unavailable: ' + (error?.message ?? ''));
}

// ── Reçu PDF (construit à la main, aucune dépendance, compatible edge) ────────
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function money(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F';
}
function stripAccents(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ').replace(/[()\\]/g, ' ').trim();
}
function buildReceiptPDF(d: {
  shop: string; ref: string; date: string; client: string; phone: string;
  items: { name: string; qty: number; unit: number }[]; total: number; pay: string;
}): Uint8Array {
  const GOLD = '0.992 0.812 0.204';
  const BLACK = '0 0 0';
  const LH = 18;
  type Row = { t: string; f: 'F1' | 'F2'; s: number; c: string };
  const rows: Row[] = [];
  const sep = '------------------------------';
  rows.push({ t: 'LASSI', f: 'F1', s: 24, c: GOLD });
  rows.push({ t: 'Recu de commande', f: 'F2', s: 11, c: BLACK });
  rows.push({ t: sep, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'Boutique : ' + stripAccents(d.shop), f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'Date : ' + d.date, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'Commande : #' + d.ref, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'Client : ' + stripAccents(d.client), f: 'F2', s: 11, c: BLACK });
  if (d.phone) rows.push({ t: 'Tel : ' + d.phone, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: sep, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'ARTICLES', f: 'F1', s: 10, c: BLACK });
  for (const it of d.items) {
    const name = stripAccents(it.name).slice(0, 30);
    rows.push({ t: it.qty + ' x ' + name + '  =  ' + money(it.unit * it.qty), f: 'F2', s: 11, c: BLACK });
  }
  rows.push({ t: sep, f: 'F2', s: 11, c: BLACK });
  rows.push({ t: 'TOTAL : ' + money(d.total), f: 'F1', s: 14, c: BLACK });
  rows.push({ t: 'Paiement : ' + stripAccents(d.pay) + ' - Paye', f: 'F2', s: 10, c: BLACK });
  rows.push({ t: '', f: 'F2', s: 6, c: BLACK });
  rows.push({ t: 'Merci pour ta commande !', f: 'F1', s: 12, c: GOLD });
  rows.push({ t: 'lassi.tech', f: 'F2', s: 9, c: BLACK });

  const W = 380;
  const TOP = 46;
  const H = TOP + rows.length * LH + 30;
  let y = H - TOP;
  let content = 'BT\n';
  let cf = '', cs = 0, cc = '';
  for (const r of rows) {
    if (r.f !== cf || r.s !== cs) { content += '/' + r.f + ' ' + r.s + ' Tf\n'; cf = r.f; cs = r.s; }
    if (r.c !== cc) { content += r.c + ' rg\n'; cc = r.c; }
    content += '1 0 0 1 40 ' + y.toFixed(0) + ' Tm (' + r.t + ') Tj\n';
    y -= LH;
  }
  content += 'ET';

  const objs: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    4: '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream',
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    6: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  };
  let pdf = '%PDF-1.4\n';
  const off: number[] = [];
  for (let i = 1; i <= 6; i++) { off[i] = pdf.length; pdf += i + ' 0 obj\n' + objs[i] + '\nendobj\n'; }
  const xref = pdf.length;
  pdf += 'xref\n0 7\n0000000000 65535 f \n';
  for (let i = 1; i <= 6; i++) pdf += String(off[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return new TextEncoder().encode(pdf);
}
