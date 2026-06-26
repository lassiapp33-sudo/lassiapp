// ============================================================
// EDGE FUNCTION : process-payouts (reversement automatique)
// Section 3.3 — à appeler par un cron toutes les 1-2 minutes
// (pg_cron + pg_net, ou planificateur externe avec en-tête
// X-Cron-Secret = CRON_SECRET).
//
// Pour chaque payout 'queued' (verrouillé par payout_queue_claim_batch
// avec FOR UPDATE SKIP LOCKED — deux exécutions concurrentes ne traitent
// jamais la même ligne) :
//   1. Recharger les montants depuis payment_intents (jamais depuis une
//      valeur potentiellement modifiée) + vérifier l'invariant comptable
//      gross_amount == commission_amount + merchant_amount.
//   2. Vérifier que le payment_intent est bien 'split_done' (sinon doute
//      → STOP, pas de reversement).
//   3. Vérifier le numéro Wave/OM du prestataire (format sénégalais valide).
//   4. Appel API payout avec idempotency_key = payout_{payout_id} (Wave/OM
//      refusent eux-mêmes un double envoi avec la même clé).
//   5. Succès → payout_queue_mark_paid (statut 'paid' + external_payout_ref).
//      Échec  → payout_queue_mark_failure (backoff exponentiel, max 5
//      tentatives puis 'failed' + alerte admin).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 🔌 Mêmes clés que create-payment. Sans elles → mode simulation.
const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? '';
const WAVE_MERCHANT_ID = Deno.env.get('WAVE_MERCHANT_ID') ?? '';
// OM Sonatel : Cash In vers le prestataire (POST /api/eWallet/v1/cashins)
// Requiert OM_RETAILER_MSISDN + OM_RETAILER_PIN_ENCRYPTED (PIN de LASSI chiffré RSA)
const OM_RETAILER_MSISDN      = Deno.env.get('OM_RETAILER_MSISDN')      ?? '';
const OM_RETAILER_PIN_ENCRYPTED = Deno.env.get('OM_RETAILER_PIN_ENCRYPTED') ?? '';
const IS_PRODUCTION            = (WAVE_API_KEY !== '' && WAVE_MERCHANT_ID !== '') ||
                                  (OM_RETAILER_MSISDN !== '' && OM_RETAILER_PIN_ENCRYPTED !== '');

// Secret partagé avec le planificateur (cron). OBLIGATOIRE en production.
// Si absent, l'endpoint répond 503 et refuse toute exécution.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const BATCH_LIMIT = 20;

// Numéro sénégalais : 9 chiffres commençant par 70/75/76/77/78
const PHONE_RE = /^7[05678][0-9]{7}$/;

serve(async (req) => {
  // Endpoint financier critique : accès interdit si CRON_SECRET absent ou incorrect.
  // Ne jamais laisser passer une requête non authentifiée sur un endpoint de virement.
  if (!CRON_SECRET) {
    console.error('[process-payouts] CRON_SECRET non configuré — endpoint désactivé par sécurité');
    return new Response('Service non disponible (configuration manquante)', { status: 503 });
  }
  if (req.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return new Response('Non autorisé', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: batch, error: claimError } = await supabase.rpc('payout_queue_claim_batch', {
    p_limit: BATCH_LIMIT,
  });

  if (claimError) {
    console.error('[process-payouts] payout_queue_claim_batch erreur DB:', claimError.message);
    return new Response('Erreur serveur', { status: 500 });
  }

  const results = { processed: 0, paid: 0, retried: 0, failed: 0 };

  for (const payout of batch ?? []) {
    results.processed++;

    // 1. Invariant comptable : gross_amount == commission_amount + merchant_amount
    //    (déjà garanti par la contrainte check_montants sur payment_intents,
    //    double vérification défensive ici)
    const invariantOk =
      payout.montant_total === payout.prix_base + payout.commission_lassi &&
      payout.montant === payout.prix_base;

    if (!invariantOk) {
      // Section 9 : ne jamais logger la ligne complète (contient
      // prestataire_phone) — uniquement les montants utiles au diagnostic.
      console.error('[ALERTE PAIEMENT] payout', payout.id, 'incohérence de montant — STOP', JSON.stringify({
        montant_total: payout.montant_total,
        montant: payout.montant,
        prix_base: payout.prix_base,
        commission_lassi: payout.commission_lassi,
        payment_intent_statut: payout.payment_intent_statut,
      }));
      await supabase.rpc('payout_queue_mark_failure', {
        p_payout_id: payout.id,
        p_error:     'amount_invariant_violation',
        p_terminal:  true,
      });
      results.failed++;
      continue;
    }

    // 2. Le payment_intent doit être au stade 'split_done' (paiement encaissé
    //    et split effectué). Sinon → doute, on ne reverse jamais.
    if (payout.payment_intent_statut !== 'split_done') {
      console.error('[ALERTE PAIEMENT] payout', payout.id, 'payment_intent statut=', payout.payment_intent_statut, '— STOP');
      await supabase.rpc('payout_queue_mark_failure', {
        p_payout_id: payout.id,
        p_error:     `payment_intent_not_split_done:${payout.payment_intent_statut}`,
        p_terminal:  true,
      });
      results.failed++;
      continue;
    }

    // 3. Numéro Wave/OM du prestataire : présent et au format valide
    const phone = (payout.prestataire_phone ?? '').trim();
    if (!PHONE_RE.test(phone)) {
      // Section 9 : ne jamais logger le numéro de téléphone (donnée
      // financière sensible) — seule la longueur aide au diagnostic.
      console.error('[ALERTE PAIEMENT] payout', payout.id, `numéro prestataire invalide (longueur=${phone.length}) — STOP`);
      await supabase.rpc('payout_queue_mark_failure', {
        p_payout_id: payout.id,
        p_error:     'invalid_prestataire_phone',
        p_terminal:  true,
      });
      results.failed++;
      continue;
    }

    // 4. Appel API payout (idempotency_key = payout_{id})
    let payoutRef: string;
    try {
      if (!IS_PRODUCTION) {
        payoutRef = await simulatePayout(payout.id, payout.montant);
      } else if (payout.moyen_paiement === 'wave') {
        payoutRef = await sendWavePayout({ payoutId: payout.id, montant: payout.montant, phone });
      } else {
        payoutRef = await sendOrangeMoneyPayout({ payoutId: payout.id, montant: payout.montant, phone });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur fournisseur de paiement';
      console.error('[process-payouts] échec appel fournisseur, payout', payout.id, msg);
      await supabase.rpc('payout_queue_mark_failure', {
        p_payout_id: payout.id,
        p_error:     msg,
        p_terminal:  false,
      });
      results.retried++;
      continue;
    }

    // 5. Succès → marquer payé
    const { data: markResult, error: markError } = await supabase.rpc('payout_queue_mark_paid', {
      p_payout_id:    payout.id,
      p_external_ref: payoutRef,
    });

    if (markError) {
      console.error('[process-payouts] payout_queue_mark_paid erreur DB pour', payout.id, markError.message);
      results.failed++;
      continue;
    }

    // Race condition : payout annulé par process_refund APRÈS l'envoi des fonds.
    // L'événement 'payout_sent_after_cancel' est déjà créé dans payment_logs par
    // payout_queue_mark_paid. On logue ici pour visibilité dans les logs Edge Function.
    if (markResult?.error === 'payout_sent_after_cancel') {
      console.error('[ALERTE PAIEMENT] payout', payout.id, 'envoyé (ref', payoutRef, ') mais annulé entre-temps — récupération manuelle requise');
      results.failed++;
      continue;
    }

    if (!markResult?.ok) {
      console.error('[process-payouts] payout_queue_mark_paid état inattendu pour', payout.id, JSON.stringify(markResult));
      results.failed++;
      continue;
    }

    results.paid++;
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

// ============================================================
// SIMULATION (mode démo sans clés API)
// ============================================================
async function simulatePayout(payoutId: string, _montant: number): Promise<string> {
  await new Promise(r => setTimeout(r, 200));
  return `SIM-PAYOUT-${Date.now()}-${payoutId.slice(0, 8).toUpperCase()}`;
}

// ============================================================
// WAVE PAYOUT (transfert vers le prestataire)
// 🔌 À compléter par l'ingénieur Wave avec leur spec API exacte (B2C/payout)
// ============================================================
async function sendWavePayout(params: { payoutId: string; montant: number; phone: string }): Promise<string> {
  const response = await fetch('https://api.wave.com/v1/payout', {
    method: 'POST',
    headers: {
      'Authorization':   `Bearer ${WAVE_API_KEY}`,
      'Content-Type':    'application/json',
      // Idempotence côté fournisseur : un retry réseau ne doit jamais
      // déclencher un second envoi pour le même payout.
      'Idempotency-Key': `payout_${params.payoutId}`,
    },
    body: JSON.stringify({
      currency:    'XOF',
      amount:      params.montant,
      merchant_id: WAVE_MERCHANT_ID,
      receiver:    `+221${params.phone}`,
      client_reference: params.payoutId,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Wave payout error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.id ?? data.transaction_id;
}

// ============================================================
// ORANGE MONEY SONATEL — Cash In (POST /api/eWallet/v1/cashins)
// LASSI (retailer/partner) envoie de l'argent vers le prestataire (customer).
//
// Prérequis :
//   OM_RETAILER_MSISDN        = numéro OM de LASSI (9 chiffres, ex: 781234567)
//   OM_RETAILER_PIN_ENCRYPTED = PIN de LASSI chiffré RSA avec la clé publique
//                               Orange (GET /api/account/v1/publicKeys)
//                               Longueur attendue : 344 caractères base64
// ============================================================
async function sendOrangeMoneyPayout(params: { payoutId: string; montant: number; phone: string }): Promise<string> {
  const { getOmToken, OM_BASE_URL } = await import('../_shared/omAuth.ts');
  const omToken = await getOmToken();

  const response = await fetch(`${OM_BASE_URL}/api/eWallet/v1/cashins`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${omToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      partner: {
        idType:           'MSISDN',
        id:               OM_RETAILER_MSISDN,
        encryptedPinCode: OM_RETAILER_PIN_ENCRYPTED,
      },
      customer: {
        idType: 'MSISDN',
        id:     params.phone,  // numéro du prestataire (9 chiffres)
      },
      amount: {
        value: params.montant,
        unit:  'XOF',
      },
      reference:           params.payoutId,
      receiveNotification: false,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OM payout error (${response.status}): ${err.detail ?? JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.transactionId ?? data.requestId ?? params.payoutId;
}
