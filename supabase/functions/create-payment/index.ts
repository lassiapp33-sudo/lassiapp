// ============================================================
// EDGE FUNCTION : create-payment (initiate-payment)
// Crée le payment_intent + initie le paiement Wave/OM
//
// Section 3.1 — sécurité bancaire :
//   Le client n'envoie QUE { orderId, moyenPaiement }. Aucun montant ni
//   prestataire ne vient du client : le RPC initiate_order_payment recharge
//   la commande, recalcule le montant depuis les vraies lignes (order_items)
//   et dérive le prestataire depuis la boutique.
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isUUID } from '../_shared/validation.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

// ============================================================
// 🔌 POINT D'ENTRÉE POUR L'INGÉNIEUR WAVE/OM
// Ces 4 variables suffisent pour activer le paiement réel :
//
// WAVE_API_KEY=your_wave_api_key_here
// WAVE_MERCHANT_ID=your_wave_merchant_id_here
// OM_API_KEY=your_orange_money_api_key_here
// OM_MERCHANT_CODE=your_om_merchant_code_here
//
// Sans ces clés → mode simulation automatique (démo fonctionnelle)
// ============================================================
const WAVE_API_KEY    = Deno.env.get('WAVE_API_KEY')    ?? '';
const WAVE_MERCHANT_ID = Deno.env.get('WAVE_MERCHANT_ID') ?? '';
const OM_API_KEY      = Deno.env.get('OM_API_KEY')      ?? '';
const OM_MERCHANT_CODE = Deno.env.get('OM_MERCHANT_CODE') ?? '';

const IS_PRODUCTION = WAVE_API_KEY !== '' || OM_API_KEY !== '';

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  const errorResponse = (message: string, status: number) =>
    new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Authentification — rejeter si non authentifié
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
    if (authError || !user) return errorResponse('Non autorisé', 401);

    // 2. Paramètres : UNIQUEMENT order_id + moyen de paiement (jamais de montant client)
    const body = await req.json();
    const { orderId, moyenPaiement } = body;

    if (!orderId || !moyenPaiement) {
      return errorResponse('Paramètres manquants', 400);
    }
    if (!isUUID(orderId)) {
      return errorResponse('orderId invalide', 400);
    }
    if (!['wave', 'orange_money'].includes(moyenPaiement)) {
      return errorResponse('Moyen de paiement invalide', 400);
    }

    // 3-5. Recharger la commande, recalculer le montant depuis les vraies
    // lignes, vérifier la cohérence (propriété, statut, plafond, déjà payée)
    // — tout est fait côté serveur dans initiate_order_payment.
    const { data: initResult, error: initError } = await supabase.rpc('initiate_order_payment', {
      p_order_id:       orderId,
      p_client_id:      user.id,
      p_moyen_paiement: moyenPaiement,
    });
    if (initError) throw new Error(initError.message);

    if (!initResult?.ok) {
      if (initResult?.error === 'amount_mismatch') {
        // Ne devrait jamais arriver (create-order recalcule déjà depuis les
        // produits) — en cas de doute, on bloque et on trace pour audit.
        console.error('[create-payment] AMOUNT_MISMATCH order=', orderId, JSON.stringify(initResult));
      }
      const { message, status } = mapInitiateError(initResult?.error);
      return errorResponse(message, status);
    }

    const piId          = initResult.payment_intent_id as string;
    const prixBase      = initResult.prix_base as number;
    const commission    = initResult.commission as number;
    const montantTotal  = initResult.montant_total as number;
    const prestataireId = initResult.prestataire_id as string;

    // 6-9. Initier le paiement chez le fournisseur
    let paymentResult;

    try {
      if (!IS_PRODUCTION) {
        // ======================================================
        // MODE SIMULATION — Démo fonctionnelle sans API réelle
        // L'ingénieur Wave/OM peut voir tout le flux fonctionner
        // ======================================================
        paymentResult = await simulatePaiement(piId, montantTotal, moyenPaiement);

        await supabase.from('payment_intents').update({
          statut:       'simulated',
          external_ref: paymentResult.ref,
          updated_at:   new Date().toISOString(),
        }).eq('id', piId);

      } else if (moyenPaiement === 'wave') {
        // ======================================================
        // MODE PRODUCTION — WAVE
        // 🔌 L'ingénieur Wave active cette branche en ajoutant WAVE_API_KEY
        // ======================================================
        paymentResult = await initiateWavePayment({
          piId, montantTotal, prixBase, commission, prestataireId,
        });

        // 8. Stocker le checkout_id Wave + passer en 'initiated'
        await supabase.from('payment_intents').update({
          statut:       'initiated',
          external_ref: paymentResult.ref,
          updated_at:   new Date().toISOString(),
        }).eq('id', piId);

      } else {
        // ======================================================
        // MODE PRODUCTION — ORANGE MONEY
        // 🔌 L'ingénieur OM active cette branche en ajoutant OM_API_KEY
        // ======================================================
        paymentResult = await initiateOrangeMoneyPayment({
          piId, montantTotal, prixBase, commission, prestataireId,
        });

        // 8. Stocker le checkout_id OM + passer en 'initiated'
        await supabase.from('payment_intents').update({
          statut:       'initiated',
          external_ref: paymentResult.ref,
          updated_at:   new Date().toISOString(),
        }).eq('id', piId);
      }
    } catch (apiErr: unknown) {
      // 10. L'appel au fournisseur a échoué : marquer failed, logguer,
      // ne JAMAIS laisser de transaction fantôme en 'pending'.
      const apiMsg = apiErr instanceof Error ? apiErr.message : 'Erreur fournisseur de paiement';
      console.error('[create-payment] échec appel fournisseur', moyenPaiement, apiMsg);

      await supabase.from('payment_intents').update({
        statut:     'failed',
        updated_at: new Date().toISOString(),
      }).eq('id', piId);

      await supabase.from('payment_logs').insert({
        payment_intent_id: piId,
        event_type: 'failed',
        event_data: { error: apiMsg, moyen_paiement: moyenPaiement, mode: 'production' },
      });

      return errorResponse('Le paiement n\'a pas pu être initié. Réessayez dans quelques instants.', 502);
    }

    // Log
    await supabase.from('payment_logs').insert({
      payment_intent_id: piId,
      event_type: IS_PRODUCTION ? 'initiated' : 'simulated',
      event_data: {
        montant_total: montantTotal,
        commission,
        prix_base:    prixBase,
        external_ref: paymentResult.ref,
        mode: IS_PRODUCTION ? 'production' : 'simulation',
      },
    });

    // 9. Retourner les infos nécessaires au paiement (URL + récap d'affichage)
    return new Response(JSON.stringify({
      success:         true,
      paymentIntentId: piId,
      montantTotal,
      commission,
      prixBase,
      paymentRef:      paymentResult.ref,
      redirectUrl:     paymentResult.redirectUrl ?? null,
      mode:            IS_PRODUCTION ? 'production' : 'simulation',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[create-payment]', msg);
    return errorResponse(msg, 500);
  }
});

// ============================================================
// Traduction des erreurs métier d'initiate_order_payment
// ============================================================
function mapInitiateError(err: string | undefined): { message: string; status: number } {
  switch (err) {
    case 'order_not_found':   return { message: 'Commande introuvable', status: 404 };
    case 'forbidden':         return { message: 'Cette commande ne vous appartient pas', status: 403 };
    case 'order_not_payable': return { message: 'Cette commande n\'est plus en attente de paiement', status: 409 };
    case 'already_paid':      return { message: 'Cette commande a déjà été payée', status: 409 };
    case 'invalid_method':    return { message: 'Moyen de paiement invalide', status: 400 };
    case 'invalid_amount':    return { message: 'Montant de commande invalide', status: 422 };
    case 'amount_mismatch':   return { message: 'Incohérence détectée sur cette commande, contactez le support', status: 409 };
    case 'shop_not_found':    return { message: 'Boutique introuvable', status: 500 };
    default:                  return { message: 'Paiement impossible', status: 400 };
  }
}

// ============================================================
// SIMULATION (mode démo sans clés API)
// ============================================================
async function simulatePaiement(piId: string, _montant: number, _moyen: string) {
  await new Promise(r => setTimeout(r, 800)); // simule latence réseau
  return {
    ref:         `SIM-${Date.now()}-${piId.slice(0, 8).toUpperCase()}`,
    redirectUrl: null,
    status:      'simulated',
  };
}

// ============================================================
// WAVE PAYMENT INTEGRATION
// 🔌 À compléter par l'ingénieur Wave avec leur spec API exacte
// ============================================================
async function initiateWavePayment(params: {
  piId: string; montantTotal: number; prixBase: number;
  commission: number; prestataireId: string;
}) {
  // Structure du split Wave (à confirmer avec l'ingénieur Wave) :
  // Le merchant principal (LASSİ) reçoit montantTotal
  // puis Wave split : prixBase → prestataire, commission → LASSİ

  const response = await fetch('https://api.wave.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WAVE_API_KEY}`,
      'Content-Type': 'application/json',
      // Idempotence côté fournisseur : un retry réseau de notre part ne doit
      // jamais créer deux sessions de paiement pour le même payment_intent.
      'Idempotency-Key': params.piId,
    },
    body: JSON.stringify({
      currency:     'XOF',
      amount:       params.montantTotal,
      merchant_id:  WAVE_MERCHANT_ID,
      error_url:    'lassiapp://paiement/echec',
      success_url:  `lassiapp://paiement/succes?pi=${params.piId}`,
      split_config: {
        beneficiaire_prestataire: params.prestataireId,
        montant_prestataire:      params.prixBase,
        montant_lassi:            params.commission,
      },
      client_reference: params.piId,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Wave error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return {
    ref:         data.id ?? data.transaction_id,
    redirectUrl: data.wave_launch_url ?? data.checkout_url,
    status:      data.payment_status,
  };
}

// ============================================================
// ORANGE MONEY PAYMENT INTEGRATION
// 🔌 À compléter par l'ingénieur OM avec leur spec API exacte
// ============================================================
async function initiateOrangeMoneyPayment(params: {
  piId: string; montantTotal: number; prixBase: number;
  commission: number; prestataireId: string;
}) {
  const response = await fetch('https://api.orange.com/orange-money-webpay/dev/v1/webpayment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OM_API_KEY}`,
      'Content-Type': 'application/json',
      // Idempotence côté fournisseur : un retry réseau de notre part ne doit
      // jamais créer deux sessions de paiement pour le même payment_intent.
      'Idempotency-Key': params.piId,
    },
    body: JSON.stringify({
      merchant_key: OM_MERCHANT_CODE,
      currency:     'OUV',
      order_id:     params.piId,
      amount:       params.montantTotal,
      return_url:   `lassiapp://paiement/succes?pi=${params.piId}`,
      cancel_url:   'lassiapp://paiement/echec',
      notif_url:    `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-payment`,
      split: {
        recipient_id:     params.prestataireId,
        recipient_amount: params.prixBase,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OM error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return {
    ref:         data.pay_token ?? data.notif_token,
    redirectUrl: data.payment_url,
    status:      data.status,
  };
}
