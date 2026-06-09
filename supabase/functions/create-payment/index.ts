// ============================================================
// EDGE FUNCTION : create-payment
// Crée le payment_intent + initie le paiement Wave/OM
// Conçue pour être branchée facilement par l'ingénieur Wave/OM
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Authentification
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
    if (authError || !user) return errorResponse('Non autorisé', 401);

    // 2. Paramètres
    const body = await req.json();
    const { orderId, prestataireId, prixBase, moyenPaiement, idempotencyKey } = body;

    // 3. Validation stricte
    if (!orderId || !prestataireId || !prixBase || !moyenPaiement || !idempotencyKey) {
      return errorResponse('Paramètres manquants', 400);
    }
    if (!Number.isInteger(prixBase) || prixBase < 100 || prixBase > 5_000_000) {
      return errorResponse('Montant invalide', 400);
    }
    if (!['wave', 'orange_money'].includes(moyenPaiement)) {
      return errorResponse('Moyen de paiement invalide', 400);
    }

    // 4. Recalcul serveur (JAMAIS faire confiance au client)
    const commission  = Math.ceil(prixBase * 0.01);
    const montantTotal = prixBase + commission;

    // 5. Créer payment_intent (idempotent)
    const { data: piId, error: piError } = await supabase.rpc('create_payment_intent', {
      p_order_id:        orderId,
      p_client_id:       user.id,
      p_prestataire_id:  prestataireId,
      p_prix_base:       prixBase,
      p_moyen_paiement:  moyenPaiement,
      p_idempotency_key: idempotencyKey,
    });
    if (piError) throw new Error(piError.message);

    // 6. Initier le paiement
    let paymentResult;

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

    } else {
      // ======================================================
      // MODE PRODUCTION — ORANGE MONEY
      // 🔌 L'ingénieur OM active cette branche en ajoutant OM_API_KEY
      // ======================================================
      paymentResult = await initiateOrangeMoneyPayment({
        piId, montantTotal, prixBase, commission, prestataireId,
      });
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

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
