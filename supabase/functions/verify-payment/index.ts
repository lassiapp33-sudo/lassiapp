// ============================================================
// EDGE FUNCTION : verify-payment
// Vérifie qu'un paiement est bien confirmé avant de valider la commande
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { isUUID } from '../_shared/validation.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token!);
    if (error || !user) return new Response(JSON.stringify({ success: false, error: 'Non autorisé' }), { status: 401 });

    const { paymentIntentId } = await req.json();

    if (!isUUID(paymentIntentId)) {
      return new Response(JSON.stringify({ success: false, error: 'paymentIntentId invalide' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Récupérer le payment_intent
    const { data: pi } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .eq('client_id', user.id)
      .single();

    if (!pi) return new Response(JSON.stringify({ success: false, error: 'Introuvable' }), { status: 404 });

    // En production réelle (clés Wave ou OM_RETAILER_MSISDN présentes), seuls 'confirmed'
    // et 'split_done' valident. En sandbox OM (OM_BASE_URL = sandbox.orange-sonatel.com),
    // 'initiated' est aussi accepté car le webhook OM sandbox n'arrive pas toujours.
    const WAVE_API_KEY       = Deno.env.get('WAVE_API_KEY') ?? '';
    const OM_RETAILER_MSISDN = Deno.env.get('OM_RETAILER_MSISDN') ?? '';
    const OM_BASE_URL        = Deno.env.get('OM_BASE_URL') ?? '';
    const IS_PRODUCTION  = !!(WAVE_API_KEY || OM_RETAILER_MSISDN);
    const IS_OM_SANDBOX  = OM_BASE_URL.includes('sandbox');

    const confirmedStatuses = IS_PRODUCTION
      ? ['confirmed', 'split_done']
      : IS_OM_SANDBOX
        ? ['confirmed', 'split_done', 'simulated', 'initiated']
        : ['confirmed', 'split_done', 'simulated'];
    const confirmed = confirmedStatuses.includes(pi.statut);

    const resolvedMode = pi.statut === 'simulated'
      ? 'simulation'
      : pi.statut === 'initiated' && IS_OM_SANDBOX
        ? 'sandbox-om'
        : 'production';

    // Log vérification
    await supabase.from('payment_logs').insert({
      payment_intent_id: paymentIntentId,
      event_type: 'verify_check',
      event_data: { statut: pi.statut, confirmed, mode: resolvedMode },
    });

    return new Response(JSON.stringify({
      success:      true,
      confirmed,
      statut:       pi.statut,
      montantTotal: pi.montant_total,
      commission:   pi.commission_lassi,
      prixBase:     pi.prix_base,
      mode:         resolvedMode,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
