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

const WAVE_WEBHOOK_SECRET = Deno.env.get('WAVE_WEBHOOK_SECRET') ?? '';
const OM_WEBHOOK_SECRET   = Deno.env.get('OM_WEBHOOK_SECRET')   ?? '';

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

  // ── Redirects navigateur Orange (callbackSuccessUrl / callbackCancelUrl) ──
  // Orange redirige le navigateur sur ces URLs après le paiement web.
  // On renvoie une page HTML qui redirige vers l'app LASSI via deep link.
  if (req.method === 'GET') {
    const result = url.searchParams.get('result') ?? 'cancel';
    const piIdRaw = url.searchParams.get('pi_id') ?? '';
    // Valider UUID avant toute injection dans HTML (protection XSS)
    const piId = isUUID(piIdRaw) ? piIdRaw : '';
    const deepLink = result === 'success'
      ? `lassiapp://paiement/succes?pi=${encodeURIComponent(piId)}`
      : `lassiapp://paiement/echec?pi=${encodeURIComponent(piId)}`;
    const deepLinkEncoded = deepLink.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${deepLinkEncoded}">
<title>LASSI — Redirection</title></head><body>
<p>Redirection vers l'application LASSI...</p>
<a href="${deepLinkEncoded}">Ouvrir LASSI</a>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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

    // Notifier le prestataire terrain (réservation confirmée et payée)
    if (result?.ok && !result?.already_processed && !result?.disputed && result?.reservation_id) {
      try {
        const { data: resaRow } = await supabase
          .from('reservations_terrain')
          .select('prestataire_id, terrain_id, prix_total, date_reservation, heure_debut')
          .eq('id', result.reservation_id)
          .maybeSingle();
        if (resaRow?.prestataire_id) {
          const { data: terrainRow } = await supabase
            .from('terrains')
            .select('nom')
            .eq('id', resaRow.terrain_id)
            .maybeSingle();
          const montantFr = `${Number(resaRow.prix_total).toLocaleString('fr-FR')} FCFA`;
          const heureStr  = resaRow.heure_debut ? String(resaRow.heure_debut).slice(0, 5) : '';
          const bodyParts = [terrainRow?.nom, resaRow.date_reservation, heureStr, montantFr].filter(Boolean);
          await sendPushToUser(supabase, resaRow.prestataire_id, {
            title:     'Nouvelle réservation terrain',
            body:      `Paiement reçu — ${bodyParts.join(' · ')}`,
            data:      { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
            channelId: 'commandes',
          });
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

          // Notifier le gérant
          if (piData.prestataire_id) {
            await sendPushToUser(supabase, piData.prestataire_id, {
              title:     'Nouvelle réservation de table',
              body:      'Un client vient de payer son acompte. Acceptez ou refusez la réservation.',
              data:      { type: 'table_reservation_nouvelle', pi_id: String(piId) },
              channelId: 'commandes',
            });
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
            await supabase.from('fitness_abonnements_clients').insert({
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
    console.error('[webhook] payment_intent introuvable pour', piId, 'source', source);
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

    // ── Terrain Wave — prestataire notifié quand réservation confirmée ────
    if (result?.reservation_id) {
      try {
        const { data: resaRow } = await supabase
          .from('reservations_terrain')
          .select('prestataire_id, terrain_id, prix_total, date_reservation, heure_debut')
          .eq('id', result.reservation_id)
          .maybeSingle()
        if (resaRow?.prestataire_id) {
          const { data: terrainRow } = await supabase
            .from('terrains')
            .select('nom')
            .eq('id', resaRow.terrain_id)
            .maybeSingle()
          const montantFr = `${Number(resaRow.prix_total).toLocaleString('fr-FR')} FCFA`
          const heureStr  = resaRow.heure_debut ? String(resaRow.heure_debut).slice(0, 5) : ''
          const bodyParts = [terrainRow?.nom, resaRow.date_reservation, heureStr, montantFr].filter(Boolean)
          await sendPushToUser(supabase, resaRow.prestataire_id, {
            title:     'Nouvelle réservation terrain',
            body:      `Paiement reçu — ${bodyParts.join(' · ')}`,
            data:      { type: 'reservation_terrain', reservationId: String(result.reservation_id) },
            channelId: 'commandes',
          })
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
