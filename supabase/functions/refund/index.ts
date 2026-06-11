// ============================================================
// EDGE FUNCTION : refund (remboursement) — admin-only
// Section 3.4
//
// Appelée depuis lassi-admin par un compte is_admin = true.
//   1. process_refund() côté DB : idempotent (un remboursement ne peut
//      être déclenché 2 fois), bloqué si payment_intent en statut
//      'disputed' (litige à trancher d'abord), plafonné à montant_total
//      (gross_amount), tracé dans payment_logs, et annule tout
//      reversement prestataire pas encore parti.
//   2. Appel API remboursement Wave/OM (best-effort — la décision métier
//      est déjà actée en base à l'étape 1 ; un échec fournisseur est
//      loggué pour suivi manuel, sans annuler le remboursement DB).
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 🔌 Mêmes clés que create-payment. Sans elles → mode simulation.
const WAVE_API_KEY     = Deno.env.get('WAVE_API_KEY')     ?? '';
const OM_API_KEY       = Deno.env.get('OM_API_KEY')       ?? '';
const OM_MERCHANT_CODE = Deno.env.get('OM_MERCHANT_CODE') ?? '';
const IS_PRODUCTION    = WAVE_API_KEY !== '' || OM_API_KEY !== '';

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authentification
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return errorResponse('Non autorisé', 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 2. Vérification is_admin côté serveur
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, name')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) return errorResponse('Accès refusé — droits admin requis', 403);

    // 3. Paramètres
    const { paymentIntentId, reason } = await req.json();
    if (!paymentIntentId) return errorResponse('paymentIntentId requis', 400);

    // 4. Remboursement DB : idempotent, bloqué si disputed, plafonné, tracé
    const { data: result, error: rpcError } = await admin.rpc('process_refund', {
      p_payment_intent_id: paymentIntentId,
      p_admin_id:          user.id,
      p_reason:            reason ?? null,
    });
    if (rpcError) throw new Error(rpcError.message);

    if (!result?.ok) {
      const { message, status } = mapRefundError(result?.error);
      return errorResponse(message, status);
    }

    if (result.already_done) {
      return new Response(JSON.stringify({
        success: true, alreadyDone: true, refundedAmount: result.refunded_amount,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 5. Appel API remboursement fournisseur (best-effort)
    let providerRef: string | null = null;
    try {
      if (!IS_PRODUCTION) {
        providerRef = await simulateRefund(paymentIntentId);
      } else if (result.moyen_paiement === 'wave') {
        providerRef = await refundWave({ paymentIntentId, externalRef: result.external_ref, montant: result.refunded_amount });
      } else {
        providerRef = await refundOrangeMoney({ paymentIntentId, externalRef: result.external_ref, montant: result.refunded_amount });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur fournisseur de paiement';
      console.error('[ALERTE PAIEMENT] échec remboursement fournisseur', paymentIntentId, msg);
      await admin.from('payment_logs').insert({
        payment_intent_id: paymentIntentId,
        event_type:        'refund_provider_failed',
        event_data:        { error: msg, alert: true },
      });
    }

    // 6. Journal audit admin
    await admin.from('admin_actions_log').insert({
      admin_id:       user.id,
      action:         'refund_payment',
      target_user_id: result.client_id,
      details: {
        payment_intent_id: paymentIntentId,
        amount:            result.refunded_amount,
        reason:            reason ?? null,
        provider_ref:      providerRef,
        admin_name:        profile.name,
      },
    });

    // 7. Notifier le client
    if (result.client_id) {
      await admin.from('notifications').insert({
        user_id: result.client_id,
        type:    'payment',
        title:   'Remboursement effectué',
        body:    `Tu as été remboursé de ${result.refunded_amount} FCFA.`,
        data:    { payment_intent_id: paymentIntentId },
      });
    }

    return new Response(JSON.stringify({
      success: true, refundedAmount: result.refunded_amount, providerRef,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[refund]', msg);
    return errorResponse(msg, 500);
  }
});

// ============================================================
// Traduction des erreurs métier de process_refund
// ============================================================
function mapRefundError(err: string | undefined): { message: string; status: number } {
  switch (err) {
    case 'payment_intent_not_found': return { message: 'Transaction introuvable', status: 404 };
    case 'disputed':                 return { message: 'Litige en cours — à trancher avant tout remboursement', status: 409 };
    case 'not_refundable':           return { message: 'Cette transaction ne peut pas être remboursée', status: 409 };
    default:                         return { message: 'Remboursement impossible', status: 400 };
  }
}

// ============================================================
// SIMULATION (mode démo sans clés API)
// ============================================================
async function simulateRefund(paymentIntentId: string): Promise<string> {
  await new Promise(r => setTimeout(r, 200));
  return `SIM-REFUND-${Date.now()}-${paymentIntentId.slice(0, 8).toUpperCase()}`;
}

// ============================================================
// WAVE REFUND
// 🔌 À compléter par l'ingénieur Wave avec leur spec API exacte
// ============================================================
async function refundWave(params: { paymentIntentId: string; externalRef: string | null; montant: number }): Promise<string> {
  const response = await fetch(`https://api.wave.com/v1/checkout/sessions/${params.externalRef}/refund`, {
    method: 'POST',
    headers: {
      'Authorization':   `Bearer ${WAVE_API_KEY}`,
      'Content-Type':    'application/json',
      // Idempotence côté fournisseur : un retry réseau ne doit jamais
      // déclencher un second remboursement pour le même payment_intent.
      'Idempotency-Key': `refund_${params.paymentIntentId}`,
    },
    body: JSON.stringify({ amount: params.montant }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Wave refund error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.id ?? data.transaction_id;
}

// ============================================================
// ORANGE MONEY REFUND
// 🔌 À compléter par l'ingénieur OM avec leur spec API exacte
// ============================================================
async function refundOrangeMoney(params: { paymentIntentId: string; externalRef: string | null; montant: number }): Promise<string> {
  const response = await fetch('https://api.orange.com/orange-money-webpay/dev/v1/refund', {
    method: 'POST',
    headers: {
      'Authorization':   `Bearer ${OM_API_KEY}`,
      'Content-Type':    'application/json',
      'Idempotency-Key': `refund_${params.paymentIntentId}`,
    },
    body: JSON.stringify({
      merchant_key: OM_MERCHANT_CODE,
      pay_token:    params.externalRef,
      amount:       params.montant,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OM refund error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.transaction_id ?? data.pay_token;
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
