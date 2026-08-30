// ============================================================
// EDGE FUNCTION : webhook-payment (payment-webhook)
// Reçoit les confirmations asynchrones de Wave/OM
// 🔌 L'ingénieur Wave/OM configure cette URL dans leur dashboard
// URL : https://[project].supabase.co/functions/v1/webhook-payment
//
// Section 3.2 — point le plus critique :
//   1. Signature HMAC obligatoire (sinon 401, rien n'est fait)
//   2. Le traitement (idempotence, anti-rejeu, vérification du montant,
//      transition + activation commande + payout_queue) est délégué à
//      process_payment_webhook(), une transaction SQL atomique unique :
//      soit tout est appliqué, soit rien (rollback automatique en cas
//      d'erreur, l'argent reste en sécurité).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';
import { isUUID } from '../_shared/validation.ts';
import { logAuditEvent } from '../_shared/audit.ts';
import { sendPushToUser } from '../_shared/push.ts';
import { getOmToken, OM_BASE_URL, isOmReady } from '../_shared/omAuth.ts';
import { buildWaveSignature } from '../_shared/waveSign.ts';
import { triggerTerrainPayout } from '../_shared/terrainPayout.ts';

const WAVE_WEBHOOK_SECRET       = Deno.env.get('WAVE_WEBHOOK_SECRET')       ?? '';
const OM_WEBHOOK_SECRET         = Deno.env.get('OM_WEBHOOK_SECRET')         ?? '';
const WAVE_API_KEY              = Deno.env.get('WAVE_API_KEY')              ?? '';
const OM_RETAILER_MSISDN        = Deno.env.get('OM_RETAILER_MSISDN')        ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';
const CRON_SECRET               = Deno.env.get('CRON_SECRET')               ?? '';
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')              ?? '';

// Déclenche process-payouts sans attendre (fire-and-forget).
// Le cron toutes les 2 min reste le filet de sécurité.
function triggerPayoutsNow(): void {
  if (!CRON_SECRET || !SUPABASE_URL) return;
  fetch(`${SUPABASE_URL}/functions/v1/process-payouts`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': CRON_SECRET },
    body:    '{}',
  }).catch(e => console.error('[webhook] trigger process-payouts erreur:', e instanceof Error ? e.message : e));
}
const PHONE_RE                  = /^7[05678][0-9]{7}$/;

function genReceiptCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const url  = new URL(req.url);

  // OPTIONS / HEAD : validation de l'URL par Orange avant d'accepter le callback
  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    return new Response(null, { status: 200 })
  }

  // ── Redirects navigateur Wave/OM (success_url / error_url) ──────────────
  // Wave/OM redirigent le navigateur ici après paiement.
  // JavaScript window.location est plus fiable que meta-refresh pour les
  // custom URL schemes (lassiapp://) sur Brave/Chrome Android.
  if (req.method === 'GET') {
    // Nouveau format : ?r=lassiapp%3A%2F%2F... (deep link encodé, valide pour tous les types)
    const rRaw = url.searchParams.get('r') ?? '';
    const rDecoded = decodeURIComponent(rRaw);
    let deepLink: string;
    let isSuccess = true;
    if (rDecoded.startsWith('lassiapp://')) {
      deepLink = rDecoded;
      isSuccess = !rDecoded.includes('/echec');
      // 302 redirect direct → le navigateur suit AVANT de rendre la page.
      // Fiable sur iOS Safari et Android Chrome, même depuis un WKWebView/CCT.
      return new Response(null, {
        status: 302,
        headers: {
          'Location': deepLink,
          'Cache-Control': 'no-store',
        },
      });
    } else {
      // Ancien format : ?result=success&pi_id=... (OM / fallback)
      const result = url.searchParams.get('result') ?? 'cancel';
      const piIdRaw = url.searchParams.get('pi_id') ?? '';
      const piId = isUUID(piIdRaw) ? piIdRaw : '';
      isSuccess = result === 'success';
      deepLink = isSuccess
        ? `lassiapp://paiement/succes?pi=${encodeURIComponent(piId)}`
        : `lassiapp://paiement/echec?pi=${encodeURIComponent(piId)}`;
    }
    // Ancien format : page HTML de repli
    const deepLinkAttr = deepLink.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const statusEmoji  = isSuccess ? '&#x2705;' : '&#x274C;';
    const statusMsg    = isSuccess ? 'Paiement r&#233;ussi' : 'Paiement &#233;chou&#233;';
    const btnColor     = isSuccess ? '#FDCF34' : '#FF6B6B';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LASSI</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#14152A;color:#fff;min-height:100vh;
         display:flex;flex-direction:column;align-items:center;
         justify-content:center;padding:32px 20px;text-align:center}
    .emoji{font-size:56px;margin-bottom:20px}
    h1{font-size:22px;font-weight:700;margin-bottom:10px}
    p{font-size:15px;color:#ccc;margin-bottom:32px}
    .btn{display:inline-block;padding:18px 36px;border-radius:14px;
         font-size:17px;font-weight:700;text-decoration:none;
         background:${btnColor};color:#14152A;letter-spacing:.3px;
         -webkit-tap-highlight-color:transparent}
    .hint{margin-top:24px;font-size:13px;color:#888;line-height:1.6}
  </style>
</head>
<body>
  <div class="emoji">${statusEmoji}</div>
  <h1>${statusMsg}</h1>
  <p>Appuyez sur le bouton pour retourner dans LASSI.</p>
  <a class="btn" href="${deepLinkAttr}">Retourner dans LASSI</a>
  <p class="hint">Si le bouton ne fonctionne pas,<br>fermez cette page et rouvrez LASSI.</p>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const body = await req.text();

  // ── Détection source : Sonatel OM (query param) ou Wave (HMAC header) ────
  const sourceParam    = url.searchParams.get('source');          // "om" si Sonatel
  const waveSignature  = req.headers.get('Wave-Signature');       // Wave-Signature: t={ts},v1={hmac}

  // ── Chemin Orange Money Sonatel ──────────────────────────────────────────
  // Auth : secret en query param (pas de HMAC — API Sonatel n'en propose pas)
  // URL format : /webhook-payment?source=om&pi_id={uuid}&secret={OM_WEBHOOK_SECRET}
  if (sourceParam === 'om') {
    // OM peut HTML-encoder l'URL et envoyer "&amp;secret=" → fallback "amp;secret"
    const secret = url.searchParams.get('secret') ?? url.searchParams.get('amp;secret') ?? '';

    // Toujours rejeter si secret absent (jamais de fallback permissif sur un endpoint financier)
    if (!OM_WEBHOOK_SECRET) {
      console.error('[webhook-om] OM_WEBHOOK_SECRET non configuré — webhook désactivé par sécurité');
      return new Response('Configuration manquante', { status: 503 });
    }
    if (secret !== OM_WEBHOOK_SECRET) {
      console.error('[webhook-om] secret invalide:', { received: secret.slice(0, 8) + '...' });
      return new Response('Non autorisé', { status: 401 });
    }

    let omPayload: Record<string, unknown>;
    try {
      omPayload = JSON.parse(body);
    } catch {
      return new Response('Body invalide', { status: 400 });
    }

    // ── Chemin terrain : terrain_r en query param (réservations_terrain) ──────
    const terrainRFromUrl = url.searchParams.get('terrain_r') ?? '';
    if (isUUID(terrainRFromUrl)) {
      // Charger la réservation (paiement_ref nécessaire pour vérification API fallback)
      const { data: resa } = await supabase
        .from('reservations_terrain')
        .select('statut, paiement_ref, date_reservation, heure_fin, heure_debut, prestataire_id, client_id, montant_prestataire, moyen_paiement, terrain_id, prix_total')
        .eq('id', terrainRFromUrl)
        .single();

      if (!resa || resa.statut !== 'en_attente') {
        console.log('[webhook-om-terrain] déjà traité ou introuvable statut=', resa?.statut);
        return new Response('OK', { status: 200 });
      }

      // ── Détection du statut OM : multi-champ (OM peut varier) ──────────────
      const externalStatus = String(
        omPayload.status ?? omPayload.txStatus ?? omPayload.paymentStatus ??
        (omPayload.data as Record<string, unknown> | undefined)?.status ?? ''
      );
      let confirmed = ['SUCCESS', 'SUCCESSFUL', 'success', 'successful',
                       'PAYMENT_SUCCESS', 'COMPLETED', 'completed'].includes(externalStatus);

      console.log('[webhook-om-terrain]', JSON.stringify({
        terrainR: terrainRFromUrl, externalStatus, confirmed,
        payloadKeys: Object.keys(omPayload),
      }));

      // ── Fallback : vérification via OM API si payload ambigu ───────────────
      if (!confirmed && isOmReady() && resa.paiement_ref) {
        try {
          const omToken = await getOmToken();
          const ref = encodeURIComponent(resa.paiement_ref as string);
          const r = await fetch(`${OM_BASE_URL}/api/eWallet/v4/qrcode/${ref}`, {
            headers: { Authorization: `Bearer ${omToken}` },
          });
          if (r.ok) {
            const d = await r.json() as Record<string, unknown>;
            const st = String(d.status ?? d.statut ?? d.txStatus ?? '').toUpperCase();
            confirmed = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCESSFULL', 'SUCCESSFUL', 'PAYMENT_SUCCESS'].includes(st);
            console.log('[webhook-om-terrain] API fallback:', { st, confirmed });
          }
        } catch (e) {
          console.error('[webhook-om-terrain] API fallback erreur:', e instanceof Error ? e.message : e);
        }
      }

      if (!confirmed) {
        console.log('[webhook-om-terrain] paiement non confirmé — aucune action');
        return new Response('OK', { status: 200 });
      }

      // ── Confirmer la réservation en DB ─────────────────────────────────────
      const receiptCode       = genReceiptCode();
      const heureFin          = (resa.heure_fin as string).slice(0, 5);
      const receiptValidUntil = new Date(`${resa.date_reservation}T${heureFin}:00`).toISOString();

      const { error: updateErr } = await supabase
        .from('reservations_terrain')
        .update({
          statut:              'paye',
          receipt_status:      'valide',
          receipt_code:        receiptCode,
          receipt_valid_until: receiptValidUntil,
          payout_statut:       'pending',
        })
        .eq('id', terrainRFromUrl)
        .eq('statut', 'en_attente'); // garde atomique

      if (updateErr) {
        console.error('[webhook-om-terrain] update DB erreur:', updateErr.message);
        return new Response('Erreur DB', { status: 500 });
      }

      // ── Reversement au prestataire (shared function avec retry DB) ─────────
      await triggerTerrainPayout(supabase, {
        reservationId:             terrainRFromUrl,
        prestataireId:             resa.prestataire_id as string,
        montant:                   resa.montant_prestataire as number,
        moyenPaiement:             (resa.moyen_paiement ?? 'orange_money') as string,
        WAVE_API_KEY,
        OM_RETAILER_MSISDN,
        OM_RETAILER_PIN_ENCRYPTED,
      });

      // ── Notification client — paiement confirmé (best-effort) ──────────────
      // ⚠ Notification prestataire intentionnellement ABSENTE ici.
      //   Elle est émise dans triggerTerrainPayout uniquement après payout réussi,
      //   garantissant que l'argent a bien été versé avant d'inviter la validation.
      try {
        const { data: terrainRow } = await supabase.from('terrains').select('nom').eq('id', resa.terrain_id as string).maybeSingle();
        const terrainNomOm = (terrainRow?.nom as string | undefined) ?? 'Terrain';
        const heureStr     = resa.heure_debut ? String(resa.heure_debut).slice(0, 5) : '';
        const heureFinStr  = resa.heure_fin   ? String(resa.heure_fin).slice(0, 5)   : '';
        const creneauOm    = heureStr && heureFinStr ? `${heureStr} → ${heureFinStr}` : '';

        if (resa.client_id) {
          const notifBodyClient = creneauOm
            ? `Ta réservation de ${terrainNomOm} · ${creneauOm} est confirmée ✓`
            : `Ta réservation de ${terrainNomOm} est confirmée ✓`;
          await Promise.allSettled([
            sendPushToUser(supabase, resa.client_id as string, {
              title:     'Réservation confirmée ✓',
              body:      notifBodyClient,
              data:      { type: 'reservation_terrain', reservationId: terrainRFromUrl },
              channelId: 'commandes',
            }),
            supabase.from('notifications').insert({
              user_id: resa.client_id,
              type:    'reservation_terrain',
              title:   'Réservation confirmée ✓',
              body:    notifBodyClient,
              data:    { type: 'reservation_terrain', reservationId: terrainRFromUrl },
            }),
          ]);
        }
      } catch { /* best-effort */ }

      return new Response('OK', { status: 200 });
    }

    // pi_id : depuis l'URL (notificationUrl dynamique) OU depuis metadata (URL statique portail OM)
    const piIdFromUrl  = url.searchParams.get('pi_id') ?? '';
    const piIdFromBody = (omPayload.metadata as Record<string, unknown> | undefined)?.pi_id as string | undefined ?? '';
    const piId = isUUID(piIdFromUrl) ? piIdFromUrl : isUUID(piIdFromBody) ? piIdFromBody : '';

    if (!piId) {
      console.error('[webhook-om] pi_id introuvable (ni URL ni metadata)', JSON.stringify({ keys: Object.keys(omPayload) }));
      return new Response('pi_id introuvable', { status: 400 });
    }

    // Format notification Sonatel : { status, transactionId, amount, partner, customer, ... }
    const externalStatus = omPayload.status as string | undefined;
    // OM Senegal peut envoyer 'SUCCESS', 'SUCCESSFUL', 'success', 'PAYMENT_SUCCESS', etc.
    const isSuccess = ['SUCCESS', 'SUCCESSFUL', 'success', 'successful',
                       'PAYMENT_SUCCESS', 'COMPLETED', 'completed'].includes(externalStatus ?? '');
    // transactionId ou payToken selon la version OM
    const externalRef = (omPayload.transactionId ?? omPayload.payToken ?? omPayload.txId) as string | undefined;
    // OM Senegal peut envoyer amount.value, amount.montant, ou directement un champ montant
    const omAmount = omPayload.amount as Record<string, unknown> | undefined;
    const rawAmount = omAmount?.value ?? omAmount?.montant ?? omPayload.montant ?? omPayload.totalAmount;
    const receivedAmount = rawAmount !== undefined && rawAmount !== null && Number.isFinite(Number(rawAmount))
      ? Math.round(Number(rawAmount)) : null;

    const externalEventId = `${externalRef ?? piId}:${externalStatus ?? 'unknown'}`;

    // Log complet pour traçabilité argent réel — NE PAS SUPPRIMER
    console.log('[webhook-om] reçu:', JSON.stringify({
      piId, externalStatus, externalRef, isSuccess, receivedAmount,
      payloadKeys: Object.keys(omPayload),
    }));

    const { data: result, error: rpcError } = await supabase.rpc('process_payment_webhook', {
      p_external_event_id: externalEventId,
      p_payment_intent_id: piId,
      p_source:            'orange_money',
      p_external_status:   externalStatus ?? '',
      p_external_ref:      externalRef ?? null,
      p_received_amount:   receivedAmount,
      p_is_success:        isSuccess,
      p_raw_payload:       omPayload,
    });

    if (rpcError) {
      console.error('[webhook-om] process_payment_webhook erreur DB:', rpcError.message);
      return new Response('Erreur serveur', { status: 500 });
    }

    if (result?.disputed) {
      console.error('[ALERTE PAIEMENT OM] montant incohérent — pi', piId, JSON.stringify(result));
    }

    // Notifier le prestataire que la commande est confirmée et payée
    if (result?.ok && !result?.already_processed && !result?.disputed && result?.order_id) {
      try {
        const { data: orderRow } = await supabase
          .from('orders')
          .select('shop_id, client_name, total')
          .eq('id', result.order_id)
          .maybeSingle();

        if (orderRow?.shop_id) {
          const { data: shopRow } = await supabase
            .from('shops')
            .select('merchant_id')
            .eq('id', orderRow.shop_id)
            .maybeSingle();

          if (shopRow?.merchant_id) {
            const montantFr = `${Number(orderRow.total).toLocaleString('fr-FR')} FCFA`;
            const body = `Paiement reçu — Commande de ${orderRow.client_name ?? 'Client'} · ${montantFr}`;
            await sendPushToUser(supabase, shopRow.merchant_id, {
              title:     'Paiement confirmé',
              body,
              data:      { type: 'commande', orderId: result.order_id },
              channelId: 'commandes',
            });
          }
        }
      } catch {
        // best-effort
      }
    }

    // Notification client terrain — paiement confirmé
    // ⚠ Prestataire notifié dans triggerTerrainPayout après payout réussi uniquement.
    if (result?.ok && !result?.already_processed && !result?.disputed && result?.reservation_id) {
      try {
        const { data: resaRow } = await supabase
          .from('reservations_terrain')
          .select('client_id, terrain_id, date_reservation, heure_debut, heure_fin')
          .eq('id', result.reservation_id)
          .maybeSingle();
        if (resaRow?.client_id) {
          const { data: terrainRow } = await supabase
            .from('terrains').select('nom').eq('id', resaRow.terrain_id).maybeSingle();
          const terrainNomR = (terrainRow?.nom as string | undefined) ?? 'Terrain';
          const heureStr    = resaRow.heure_debut ? String(resaRow.heure_debut).slice(0, 5) : '';
          const heureFinR   = resaRow.heure_fin   ? String(resaRow.heure_fin).slice(0, 5)   : '';
          const creneauR    = heureStr && heureFinR ? `${heureStr} → ${heureFinR}` : '';
          const notifBodyCR = creneauR
            ? `Ta réservation de ${terrainNomR} · ${creneauR} est confirmée ✓`
            : `Ta réservation de ${terrainNomR} est confirmée ✓`;
          await Promise.allSettled([
            sendPushToUser(supabase, resaRow.client_id, {
              title:     'Réservation confirmée ✓',
              body:      notifBodyCR,
              data:      { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
              channelId: 'commandes',
            }),
            supabase.from('notifications').insert({
              user_id: resaRow.client_id,
              type:    'reservation_terrain',
              title:   'Réservation confirmée ✓',
              body:    notifBodyCR,
              data:    { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
            }),
          ]);
        }
      } catch {
        // best-effort
      }
    }

    // Abonnement fitness ET réservation table : payment_intent sans order_id ni reservation_id terrain
    if (result?.ok && !result?.already_processed && !result?.disputed
        && !result?.order_id && !result?.reservation_id) {
      try {
        const { data: piData } = await supabase
          .from('payment_intents')
          .select('type, metadata, client_id, prestataire_id, montant_total')
          .eq('id', piId)
          .maybeSingle();

        // ── Réservation table 5 Étoiles ─────────────────────────────────────
        // Le payout (3 000 FCFA → restaurant) est suspendu jusqu'à l'acceptation du gérant.
        // confirm_order_from_payment a déjà mis payout_queue en 'queued' — on le met en pause.
        if (piData?.type === 'table_reservation') {
          await supabase
            .from('payout_queue')
            .update({ statut: 'cancelled' })
            .eq('payment_intent_id', piId)
            .eq('statut', 'queued');

          await supabase
            .from('table_reservations')
            .update({ paiement_statut: 'paye' })
            .eq('paiement_ref', piId);

          // Notifier le gérant : push bannière + in-app
          if (piData.prestataire_id) {
            const gerantTitle = 'Nouvelle réservation de table'
            const gerantBody  = 'Un client vient de payer son acompte. Acceptez ou refusez la réservation.'
            await Promise.allSettled([
              sendPushToUser(supabase, piData.prestataire_id, {
                title: gerantTitle, body: gerantBody,
                data: { type: 'table_reservation_nouvelle', pi_id: String(piId) },
                channelId: 'commandes',
              }),
              supabase.from('notifications').insert({
                user_id: piData.prestataire_id,
                type:    'order',
                title:   gerantTitle,
                body:    gerantBody,
                data:    { type: 'table_reservation_nouvelle', pi_id: String(piId) },
              }),
            ])
          }

          console.log('[webhook-payment] table_reservation confirmée, payout suspendu pi', piId);
        }

        // ── Livraison ─────────────────────────────────────────────────────
        if (piData?.type === 'livraison') {
          const { data: lp } = await supabase
            .from('livraison_paiements')
            .select('*')
            .eq('payment_intent_id', piId)
            .maybeSingle();
          if (lp && !lp.livraison_id) {
            const { data: profil } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', lp.demandeur_id)
              .single();
            const demandeurType =
              profil?.role === 'merchant' || profil?.role === 'prestataire'
                ? 'prestataire'
                : 'client';
            const { data: nouvelleL, error: lErr } = await supabase
              .from('livraisons')
              .insert({
                demandeur_id:   lp.demandeur_id,
                demandeur_type: demandeurType,
                depart_label:   lp.depart_label,
                depart_lat:     lp.depart_lat,
                depart_lng:     lp.depart_lng,
                arrivee_label:  lp.arrivee_label,
                arrivee_lat:    lp.arrivee_lat,
                arrivee_lng:    lp.arrivee_lng,
                contact_nom:    lp.contact_nom ?? null,
                contact_tel:    lp.contact_tel ?? null,
                distance_km:    lp.distance_km,
                prix_livraison: lp.montant_calcule,
                statut:         'en_attente',
              })
              .select('id')
              .single();
            if (lErr) {
              console.error('[webhook-payment] livraison insert erreur:', lErr.message);
            } else {
              await supabase
                .from('livraison_paiements')
                .update({ livraison_id: nouvelleL.id })
                .eq('id', lp.id);
              const { data: livreurs } = await supabase
                .from('livreurs')
                .select('id')
                .eq('actif', true);
              const distKm = lp.distance_km ? `${Number(lp.distance_km).toFixed(1)} km` : '';
              for (const livreur of (livreurs ?? [])) {
                await sendPushToUser(supabase, livreur.id, {
                  title:     'Nouvelle livraison disponible',
                  body:      `${lp.depart_label} → ${lp.arrivee_label}${distKm ? ' · ' + distKm : ''}`,
                  data:      { type: 'livraison_nouvelle', livraisonId: String(nouvelleL.id) },
                  channelId: 'commandes',
                });
              }
              console.log('[webhook-payment] livraison créée pi', piId, 'id', nouvelleL.id, 'livreurs:', (livreurs ?? []).length);
            }
          }
        }

        if (!['table_reservation', 'livraison'].includes(piData?.type ?? '') && piData?.metadata) {
          const meta        = piData.metadata as Record<string, unknown>;
          const offreId     = meta.offre_id   as string;
          const offreNom    = meta.offre_nom   as string;
          const dureeJours  = Number(meta.duree_jours ?? 30);
          const dateAchat   = new Date();
          const dateExp     = new Date(dateAchat.getTime() + dureeJours * 86_400_000);

          const { data: existingAbo } = await supabase
            .from('fitness_abonnements_clients')
            .select('id')
            .eq('payment_intent_id', piId)
            .maybeSingle();

          if (!existingAbo) {
            const { error: aboInsertErr } = await supabase.from('fitness_abonnements_clients').insert({
              offre_id:          offreId,
              client_id:         piData.client_id,
              prestataire_id:    piData.prestataire_id,
              nom_offre:         offreNom,
              prix_paye:         piData.montant_total,
              date_achat:        dateAchat.toISOString(),
              date_expiration:   dateExp.toISOString(),
              statut:            'actif',
              payment_intent_id: piId,
            });
            if (aboInsertErr) {
              console.error('[webhook-fitness-om] insert erreur:', aboInsertErr.message);
            } else {

            const clientBody = `Ton abonnement « ${offreNom} » est actif jusqu'au ${dateExp.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`

            await supabase.from('notifications').insert({
              user_id: piData.client_id,
              type:    'payment',
              title:   'Abonnement activé',
              body:    clientBody,
              data:    { type: 'fitness_abonnement' },
            })

            // Push bannière au client
            const { data: cTokRows } = await supabase.from('push_tokens').select('token').eq('user_id', piData.client_id)
            const cTokens = ((cTokRows ?? []) as { token: string }[]).map(r => r.token)
            console.log('[abo-notif-om] client_id:', piData.client_id, 'tokens:', cTokens.length)
            if (cTokens.length > 0) {
              const eRes = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(cTokens.map(to => ({
                  to, title: 'Abonnement activé', body: clientBody,
                  data: { type: 'fitness_abonnement' }, sound: 'default',
                }))),
              }).catch(() => null)
              const eData = await eRes?.json().catch(() => null)
              console.log('[abo-notif-om] expo client response:', JSON.stringify(eData))
            }

            // In-app + push bannière au prestataire ("Nouvel abonné")
            const { data: cpRow } = await supabase.from('profiles').select('name').eq('id', piData.client_id as string).maybeSingle()
            const cName  = (cpRow?.name as string) ?? 'Un client'
            const pTitle = 'Nouvel abonné'
            const pBody  = `${cName} a souscrit à "${offreNom}".`

            await supabase.from('notifications').insert({
              user_id: piData.prestataire_id,
              type:    'commande',
              title:   pTitle,
              body:    pBody,
              data:    { type: 'fitness_abonnement_nouveau', offre_id: offreId },
            })

            const { data: pTokRows } = await supabase.from('push_tokens').select('token').eq('user_id', piData.prestataire_id)
            const pTokens = ((pTokRows ?? []) as { token: string }[]).map(r => r.token)
            console.log('[abo-notif-om] prestataire_id:', piData.prestataire_id, 'tokens:', pTokens.length)
            if (pTokens.length > 0) {
              const eRes2 = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(pTokens.map(to => ({
                  to, title: pTitle, body: pBody,
                  data: { type: 'fitness_abonnement_nouveau', offre_id: offreId },
                  sound: 'default', channelId: 'commandes',
                }))),
              }).catch(() => null)
              const eData2 = await eRes2?.json().catch(() => null)
              console.log('[abo-notif-om] expo prestataire response:', JSON.stringify(eData2))
            }

            console.log('[webhook-payment] fitness abonnement activé pi', piId, 'client', piData.client_id);
            } // end else (insert OK)
          }
        }
      } catch (fitErr) {
        console.error('[webhook-payment] fitness activation erreur:', fitErr instanceof Error ? fitErr.message : fitErr);
      }
    }

    // Push confirmation client OM (best-effort)
    if (result?.ok && !result?.already_processed && !result?.disputed) {
      try {
        const { data: piClient } = await supabase
          .from('payment_intents')
          .select('client_id, montant_total')
          .eq('id', piId)
          .maybeSingle()
        if (piClient?.client_id) {
          const montant = piClient.montant_total
            ? `${Number(piClient.montant_total).toLocaleString('fr-FR')} FCFA`
            : ''
          await sendPushToUser(supabase, piClient.client_id, {
            title:     'Paiement confirmé',
            body:      montant ? `Votre paiement de ${montant} a bien été reçu.` : 'Votre paiement a bien été reçu.',
            data:      { type: 'pay', pi_id: String(piId) },
            channelId: 'commandes',
          })
        }
      } catch {
        // best-effort
      }
    }

    // Reversement immédiat — sans attendre le cron 2 min
    if (result?.ok && !result?.already_processed && !result?.disputed) {
      triggerPayoutsNow();
    }

    // Orange attend toujours 200 (sinon elle retry en boucle)
    return new Response('OK', { status: 200 });
  }

  // ── Chemin Wave (HMAC) ───────────────────────────────────────────────────
  // Format attendu : Wave-Signature: t={timestamp},v1={hmac_sha256}
  // Payload signé  : timestamp (string) + raw body
  // Anti-rejeu     : timestamp rejeté si > 5 min dans le passé ou > 30 s dans le futur
  if (!waveSignature) {
    // Ping de santé Wave (pas de signature) — on accuse réception sans traiter
    console.log('[webhook] Ping santé Wave reçu (pas de Wave-Signature)');
    return new Response('OK', { status: 200 });
  }

  const source = 'wave' as const;

  if (!WAVE_WEBHOOK_SECRET) {
    console.error('[webhook] WAVE_WEBHOOK_SECRET non configuré');
    return new Response('Configuration manquante', { status: 500 });
  }

  // Parser "t=1639081943,v1=942119ae..."
  const sigParts   = waveSignature.split(',');
  const tPart      = sigParts.find(p => p.startsWith('t='));
  const v1Part     = sigParts.find(p => p.startsWith('v1='));
  const sigTs      = tPart  ? parseInt(tPart.slice(2),  10) : NaN;
  const sigReceived = v1Part ? v1Part.slice(3) : '';

  if (isNaN(sigTs) || !sigReceived) {
    console.error('[webhook] Format Wave-Signature invalide:', waveSignature.slice(0, 80));
    return new Response('Signature invalide', { status: 401 });
  }

  // Validation anti-rejeu (tolérance : 5 min passé, 30 s futur)
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - sigTs > 300 || sigTs - nowSec > 30) {
    console.error('[webhook] Timestamp Wave-Signature expiré — anti-rejeu', { sigTs, nowSec });
    await logAuditEvent(supabase, {
      action:      'webhook_expired_timestamp',
      targetTable: 'payment_intents',
      metadata:    { source, sigTs },
    });
    return new Response('Signature expirée', { status: 401 });
  }

  // HMAC-SHA256 sur payload = timestamp + raw body
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WAVE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const wavePayload = `${sigTs}${body}`;
  const mac         = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(wavePayload));
  const expected    = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (!timingSafeEqual(expected, sigReceived)) {
    console.error('[webhook] Signature Wave invalide — tentative rejetée');
    await logAuditEvent(supabase, {
      action:      'webhook_invalid_signature',
      targetTable: 'payment_intents',
      metadata:    { source },
    });
    return new Response('Signature invalide', { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[webhook] Body non-JSON');
    return new Response('Body invalide', { status: 400 });
  }

  // Wave envoie { type, data: { ... } } — on normalise vers un objet plat
  // pour supporter les deux structures (flat et enveloppée).
  const data = (payload.data && typeof payload.data === 'object')
    ? payload.data as Record<string, unknown>
    : payload;

  const piId: unknown = data.client_reference ?? data.order_id ?? (data.metadata as Record<string, unknown> | undefined)?.pi_id;
  if (!isUUID(piId)) {
    // Événement de test Wave sans client_reference valide — on accuse réception sans traiter
    console.log('[webhook] événement Wave sans payment_intent_id valide (test/ping) — payload keys:', Object.keys(data));
    return new Response('OK', { status: 200 });
  }

  const externalStatus = (data.payment_status ?? data.status) as string | undefined;
  const isSuccess      = ['succeeded', 'completed', 'success', 'SUCCESSFUL'].includes(externalStatus ?? '');
  const externalRef    = (data.id ?? data.transaction_id) as string | undefined;

  // 3. ID d'événement pour la déduplication (un même événement Wave/OM peut
  // être renvoyé plusieurs fois). 🔌 À ajuster avec l'ingénieur Wave/OM si un
  // champ "event_id" dédié existe — à défaut, (référence externe + statut)
  // identifie une livraison de webhook de façon stable.
  const externalEventId = `${externalRef ?? piId}:${externalStatus ?? 'unknown'}`;

  // 4. Montant reçu, pour vérification au FCFA près (null si absent du payload)
  const rawAmount = data.amount ?? data.client_amount ?? null;
  const receivedAmount = rawAmount !== null && rawAmount !== undefined && Number.isFinite(Number(rawAmount))
    ? Math.round(Number(rawAmount))
    : null;

  // ── Traitement atomique + idempotent (3 à 6) ──────────────────────────────
  const { data: result, error: rpcError } = await supabase.rpc('process_payment_webhook', {
    p_external_event_id: externalEventId,
    p_payment_intent_id: piId,
    p_source:            source,
    p_external_status:   String(externalStatus ?? ''),
    p_external_ref:      externalRef ?? null,
    p_received_amount:   receivedAmount,
    p_is_success:        isSuccess,
    p_raw_payload:       payload,
  });

  if (rpcError) {
    // 8. Échec inattendu : la transaction SQL a été annulée (rollback), rien
    // n'a changé. On répond en erreur pour que Wave/OM réessaie plus tard.
    console.error('[webhook] process_payment_webhook erreur DB:', rpcError.message);
    return new Response('Erreur serveur', { status: 500 });
  }

  if (result?.disputed) {
    console.error('[ALERTE PAIEMENT] montant incohérent — payment_intent', piId, JSON.stringify(result));
  } else if (!result?.ok && result?.error === 'payment_intent_not_found') {
    // Peut être un abonnement visibilité (client_reference = sub.id dans le checkout Wave)
    if (isSuccess) {
      try {
        const { data: visSub } = await supabase
          .from('visibility_subscriptions')
          .select('id, shop_id, merchant_id, status, offer_type, amount, plan_id, plan_duration_days, product_ids, product_id, all_products, metadata, transaction_id')
          .eq('id', String(piId))
          .eq('status', 'pending')
          .maybeSingle();

        if (visSub) {
          const expectedAmount = Math.round(Number(visSub.amount));
          if (receivedAmount !== null && receivedAmount !== expectedAmount) {
            console.error('[webhook-visibility] montant incohérent Wave', piId,
              { received: receivedAmount, expected: expectedAmount });
          } else {
            const durationDays: number = visSub.plan_duration_days ?? 30;
            const now       = new Date();
            const expiresAt = new Date(now.getTime() + durationDays * 86_400_000);

            await supabase.from('visibility_subscriptions')
              .update({
                status:         'active',
                started_at:     now.toISOString(),
                expires_at:     expiresAt.toISOString(),
                paid_at:        now.toISOString(),
                transaction_id: externalRef ?? visSub.transaction_id,
              })
              .eq('id', String(piId))
              .eq('status', 'pending');

            const offerType = (visSub.offer_type as string) ?? 'quartier';

            if (offerType === 'recherche') {
              await supabase.rpc('grant_recherche_boost',
                { p_shop_id: visSub.shop_id, p_days: durationDays }).catch(() => null);
            } else if (offerType === 'carte') {
              await supabase.rpc('grant_carte_pin',
                { p_shop_id: visSub.shop_id, p_days: durationDays }).catch(() => null);
            } else if (offerType === 'annonce') {
              type AdMeta = { format: string; titre?: string | null; corps?: string | null; imageUrl?: string | null; durationHours: number; estMin: number; estMax: number };
              const meta = visSub.metadata as AdMeta | null;
              if (meta?.format && meta.durationHours) {
                const adExp = new Date(Date.now() + meta.durationHours * 3_600_000).toISOString();
                await supabase.from('sponsored_ads').insert({
                  shop_id: visSub.shop_id, merchant_id: visSub.merchant_id,
                  format: meta.format, titre: meta.titre ?? null, corps: meta.corps ?? null,
                  image_url: meta.imageUrl ?? null,
                  budget_credits: Math.round(Number(visSub.amount)),
                  duration_hours: meta.durationHours,
                  estimated_views_min: meta.estMin, estimated_views_max: meta.estMax,
                  expires_at: adExp, status: 'active',
                }).catch(() => null);
              } else {
                await supabase.rpc('increment_shop_credit',
                  { p_shop_id: visSub.shop_id, p_amount: Math.round(Number(visSub.amount)) }).catch(() => null);
              }
            } else {
              // quartier
              await supabase.from('shops').update({
                is_featured:           true,
                featured_product_id:   visSub.all_products ? null : ((visSub.product_ids as string[] | null)?.[0] ?? (visSub.product_id as string | null) ?? null),
                featured_product_ids:  visSub.all_products ? [] : ((visSub.product_ids as string[] | null) ?? []),
                featured_all_products: !!(visSub.all_products as boolean),
              }).eq('id', visSub.shop_id).catch(() => null);

              const paidIds: string[] = visSub.all_products ? [] : ((visSub.product_ids as string[] | null) ?? []);
              if (paidIds.length > 0) {
                const { data: prodDetails } = await supabase
                  .from('products').select('id, name, price, emoji, photo_url').in('id', paidIds);
                if (prodDetails?.length) {
                  await supabase.from('carrousel_offre_quartier').delete()
                    .eq('prestataire_id', visSub.merchant_id).eq('is_paid_pack', true);
                  const rows = paidIds.map((id, idx) => {
                    const p = (prodDetails as { id: string; name: string; price: number; emoji?: string; photo_url?: string }[]).find(pr => pr.id === id);
                    if (!p) return null;
                    return { prestataire_id: visSub.merchant_id, product_id: id, nom: p.name, prix: p.price,
                      image_url: typeof p.photo_url === 'string' && p.photo_url.startsWith('http') ? p.photo_url : (p.emoji ?? ''),
                      rang_prestataire: null, ordre: idx, periode: 'paid', est_actif: true, is_paid_pack: true };
                  }).filter(Boolean);
                  if (rows.length) await supabase.from('carrousel_offre_quartier').insert(rows).catch(() => null);
                }
              }
            }

            const OFFER_LBL: Record<string, string> = {
              quartier: "l'Offre du Quartier", recherche: 'Booster recherche',
              carte: 'Épingle dorée (carte)', annonce: 'Annonce Sponsorisée',
            };
            await supabase.from('notifications').insert({
              user_id: visSub.merchant_id, type: 'vip',
              title: 'Félicitations pour votre achat',
              body: `Votre abonnement « ${OFFER_LBL[offerType] ?? offerType} » est maintenant actif jusqu'au ${expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
              data: { subscription_id: String(piId), offer_type: offerType },
            }).catch(() => null);

            console.log('[webhook-visibility] abonnement activé via Wave —', piId, 'type', offerType);
          }
        } else {
          console.error('[webhook] payment_intent introuvable pour', piId, 'source', source);
        }
      } catch (visErr) {
        console.error('[webhook-visibility] erreur activation:', visErr instanceof Error ? visErr.message : visErr);
      }
    } else {
      console.error('[webhook] payment_intent introuvable pour', piId, 'source', source);
    }
  } else if (result?.already_processed) {
    console.log('[webhook] événement déjà traité (idempotence) — pi', piId);
  } else if (result?.ignored) {
    console.log('[webhook] événement ignoré (anti-rejeu) — pi', piId, 'statut', result.statut);
  }

  // ── Section 5 : anti-abus — log si > 100 webhooks/h pour ce payment_intent ──
  // Ne bloque jamais (Wave/OM doit toujours recevoir 200) : simple alerte.
  if (result?.error !== 'payment_intent_not_found') {
    const { data: rl } = await supabase.rpc('check_rate_limit', {
      p_key: `webhook:${piId}`,
      p_max_attempts: 100,
      p_window_seconds: 3600,
      p_block_seconds: 0,
    });
    if (rl?.allowed === false) {
      console.error('[ALERTE ANTI-ABUS] +100 webhooks/h pour payment_intent', piId);
      await supabase.from('payment_logs').insert({
        payment_intent_id: piId,
        event_type: 'webhook_abuse_alert',
        event_data: { source, count: rl.count ?? null, external_event_id: externalEventId },
      });
    }
  }

  // 7. Push de confirmation au client + au marchand (best-effort — ne bloque jamais la réponse)
  if (result?.ok && !result?.already_processed && !result?.ignored && !result?.disputed) {
    try {
      const { data: pi } = await supabase
        .from('payment_intents')
        .select('client_id, amount')
        .eq('id', piId)
        .maybeSingle()

      if (pi?.client_id) {
        const montant = pi.amount ? `${Number(pi.amount).toLocaleString('fr-FR')} FCFA` : ''
        await sendPushToUser(supabase, pi.client_id, {
          title: 'Paiement confirmé',
          body: montant
            ? `Votre paiement de ${montant} a bien été reçu.`
            : 'Votre paiement a bien été reçu.',
          data: { type: 'pay', pi_id: String(piId) },
          channelId: 'commandes',
        })
      }
    } catch {
      // best-effort
    }

    // Push marchand Wave (commandes classiques uniquement — table_reservation et fitness gérés séparément)
    if (result?.order_id) {
      try {
        const { data: orderRow } = await supabase
          .from('orders')
          .select('shop_id, client_name, total')
          .eq('id', result.order_id)
          .maybeSingle()

        if (orderRow?.shop_id) {
          const { data: shopRow } = await supabase
            .from('shops')
            .select('merchant_id')
            .eq('id', orderRow.shop_id)
            .maybeSingle()

          if (shopRow?.merchant_id) {
            const montantFr = `${Number(orderRow.total).toLocaleString('fr-FR')} FCFA`
            await sendPushToUser(supabase, shopRow.merchant_id, {
              title:     'Nouvelle commande',
              body:      `Paiement reçu — Commande de ${orderRow.client_name ?? 'Client'} · ${montantFr}`,
              data:      { type: 'commande', orderId: String(result.order_id) },
              channelId: 'commandes',
            })
          }
        }
      } catch {
        // best-effort
      }
    }

    // ── Terrain Wave — notification client uniquement ──────────────────────
    // ⚠ Prestataire notifié dans triggerTerrainPayout après payout réussi uniquement.
    if (result?.reservation_id) {
      try {
        const { data: resaRow } = await supabase
          .from('reservations_terrain')
          .select('client_id, terrain_id, date_reservation, heure_debut, heure_fin')
          .eq('id', result.reservation_id)
          .maybeSingle()
        if (resaRow?.client_id) {
          const { data: terrainRow } = await supabase
            .from('terrains').select('nom').eq('id', resaRow.terrain_id).maybeSingle()
          const terrainNomW = (terrainRow?.nom as string | undefined) ?? 'Terrain'
          const heureStr    = resaRow.heure_debut ? String(resaRow.heure_debut).slice(0, 5) : ''
          const heureFinW   = resaRow.heure_fin   ? String(resaRow.heure_fin).slice(0, 5)   : ''
          const creneauW    = heureStr && heureFinW ? `${heureStr} → ${heureFinW}` : ''
          const notifBodyCW = creneauW
            ? `Ta réservation de ${terrainNomW} · ${creneauW} est confirmée ✓`
            : `Ta réservation de ${terrainNomW} est confirmée ✓`
          await Promise.allSettled([
            sendPushToUser(supabase, resaRow.client_id, {
              title:     'Réservation confirmée ✓',
              body:      notifBodyCW,
              data:      { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
              channelId: 'commandes',
            }),
            supabase.from('notifications').insert({
              user_id: resaRow.client_id,
              type:    'reservation_terrain',
              title:   'Réservation confirmée ✓',
              body:    notifBodyCW,
              data:    { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
            }),
          ])
        }
      } catch {
        // best-effort
      }
    }

    // ── Livraison Wave ─────────────────────────────────────────────────────
    if (!result?.order_id && !result?.reservation_id) {
      try {
        const { data: piLivData } = await supabase
          .from('payment_intents')
          .select('type')
          .eq('id', piId)
          .maybeSingle()
        if (piLivData?.type === 'livraison') {
          const { data: lp } = await supabase
            .from('livraison_paiements')
            .select('*')
            .eq('payment_intent_id', piId)
            .maybeSingle()
          if (lp && !lp.livraison_id) {
            const { data: profil } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', lp.demandeur_id)
              .single()
            const demandeurType =
              profil?.role === 'merchant' || profil?.role === 'prestataire'
                ? 'prestataire'
                : 'client'
            const { data: nouvelleL, error: lErr } = await supabase
              .from('livraisons')
              .insert({
                demandeur_id:   lp.demandeur_id,
                demandeur_type: demandeurType,
                depart_label:   lp.depart_label,
                depart_lat:     lp.depart_lat,
                depart_lng:     lp.depart_lng,
                arrivee_label:  lp.arrivee_label,
                arrivee_lat:    lp.arrivee_lat,
                arrivee_lng:    lp.arrivee_lng,
                contact_nom:    lp.contact_nom ?? null,
                contact_tel:    lp.contact_tel ?? null,
                distance_km:    lp.distance_km,
                prix_livraison: lp.montant_calcule,
                statut:         'en_attente',
              })
              .select('id')
              .single()
            if (lErr) {
              console.error('[webhook-payment] livraison insert erreur:', lErr.message)
            } else {
              // Verrouillage optimiste : l'UPDATE n'écrit que si livraison_id est encore null.
              // Si un webhook concurrent a déjà pris la main, on supprime la livraison créée.
              const { data: claimed } = await supabase
                .from('livraison_paiements')
                .update({ livraison_id: nouvelleL.id })
                .eq('id', lp.id)
                .is('livraison_id', null)
                .select('id')
              if (!claimed || claimed.length === 0) {
                console.warn('[webhook-payment] livraison doublon détecté, rollback', piId)
                await supabase.from('livraisons').delete().eq('id', nouvelleL.id)
              } else {
              const { data: livreurs } = await supabase
                .from('livreurs')
                .select('id')
                .eq('actif', true)
              const distKm = lp.distance_km ? `${Number(lp.distance_km).toFixed(1)} km` : ''
              for (const livreur of (livreurs ?? [])) {
                await sendPushToUser(supabase, livreur.id, {
                  title:     'Nouvelle livraison disponible',
                  body:      `${lp.depart_label} → ${lp.arrivee_label}${distKm ? ' · ' + distKm : ''}`,
                  data:      { type: 'livraison_nouvelle', livraisonId: String(nouvelleL.id) },
                  channelId: 'commandes',
                })
              }
              console.log('[webhook-payment] livraison créée pi', piId, 'id', nouvelleL.id, 'livreurs:', (livreurs ?? []).length)
              } // end else (claimed)
            }
          }
        }
      } catch {
        // best-effort
      }
    }

    // ── Fitness abonnement Wave ───────────────────────────────────────────────
    if (!result?.order_id && !result?.reservation_id) {
      try {
        const { data: piDataW } = await supabase
          .from('payment_intents')
          .select('type, metadata, client_id, prestataire_id, montant_total')
          .eq('id', piId)
          .maybeSingle();

        if (!['table_reservation', 'livraison'].includes(piDataW?.type ?? '') && piDataW?.metadata) {
          const metaW       = piDataW.metadata as Record<string, unknown>;
          const offreIdW    = metaW.offre_id   as string;
          const offreNomW   = metaW.offre_nom  as string;
          const dureeJoursW = Number(metaW.duree_jours ?? 30);
          const dateAchatW  = new Date();
          const dateExpW    = new Date(dateAchatW.getTime() + dureeJoursW * 86_400_000);

          if (offreIdW && offreNomW) {
            const { data: existingAboW } = await supabase
              .from('fitness_abonnements_clients')
              .select('id')
              .eq('payment_intent_id', piId)
              .maybeSingle();

            if (!existingAboW) {
              const { error: aboErrW } = await supabase.from('fitness_abonnements_clients').insert({
                offre_id:          offreIdW,
                client_id:         piDataW.client_id,
                prestataire_id:    piDataW.prestataire_id,
                nom_offre:         offreNomW,
                prix_paye:         piDataW.montant_total,
                date_achat:        dateAchatW.toISOString(),
                date_expiration:   dateExpW.toISOString(),
                statut:            'actif',
                payment_intent_id: piId,
              });
              if (aboErrW) {
                console.error('[webhook-fitness-wave] insert erreur:', aboErrW.message);
              } else {
                const clientBodyW = `Ton abonnement « ${offreNomW} » est actif jusqu'au ${dateExpW.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
                await supabase.from('notifications').insert({
                  user_id: piDataW.client_id,
                  type:    'payment',
                  title:   'Abonnement activé',
                  body:    clientBodyW,
                  data:    { type: 'fitness_abonnement' },
                });
                console.log('[webhook-fitness-wave] fitness abonnement activé pi', piId, 'client', piDataW.client_id);
              }
            }
          }
        }
      } catch (fitErrW) {
        console.error('[webhook-fitness-wave]', fitErrW instanceof Error ? fitErrW.message : fitErrW);
      }
    }
  }

  // Reversement immédiat — sans attendre le cron 2 min
  if (result?.ok && !result?.already_processed && !result?.ignored && !result?.disputed) {
    triggerPayoutsNow();
  }

  // 8. Répondre 200 OK rapidement à Wave/OM dans tous les cas gérés
  // (idempotence, anti-rejeu, échec, dispute, succès) : le retraitement se
  // ferait en double sinon. Seule une vraie erreur serveur (ci-dessus) renvoie 500.
  return new Response('OK', { status: 200 });
});

// Comparaison HMAC en temps constant — évite les timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
