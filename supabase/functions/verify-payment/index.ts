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

    // Même logique que create-payment : IS_PRODUCTION = true dès qu'un fournisseur
    // réel est configuré. Empêche d'accepter 'initiated' comme confirmé quand OM
    // sandbox a créé le payment_intent mais aucun vrai paiement n'a eu lieu.
    const WAVE_API_KEY      = Deno.env.get('WAVE_API_KEY')      ?? '';
    const WAVE_PROXY_URL    = Deno.env.get('WAVE_PROXY_URL')    ?? '';
    const OM_CLIENT_ID      = Deno.env.get('OM_CLIENT_ID')      ?? '';
    const OM_CLIENT_SECRET  = Deno.env.get('OM_CLIENT_SECRET')  ?? '';
    const OM_MERCHANT_CODE  = Deno.env.get('OM_MERCHANT_CODE')  ?? '';
    const OM_BASE_URL       = Deno.env.get('OM_BASE_URL')       ?? '';
    const IS_WAVE_READY = WAVE_API_KEY !== '' || WAVE_PROXY_URL !== '';
    const IS_OM_READY   = !!(OM_CLIENT_ID && OM_CLIENT_SECRET && OM_MERCHANT_CODE);
    const IS_PRODUCTION = IS_WAVE_READY || IS_OM_READY;
    const IS_OM_SANDBOX = OM_BASE_URL.includes('sandbox');

    // 'simulated' = méthode non configurée en prod (démo du flux côté client) → toujours ok.
    // 'initiated' = paiement envoyé au fournisseur mais webhook non reçu :
    //   → accepté UNIQUEMENT en mode démo pur (aucun fournisseur configuré)
    //   → refusé en production pour éviter les confirmations sans vrai paiement.
    const confirmedStatuses = IS_PRODUCTION
      ? ['confirmed', 'split_done', 'simulated']
      : ['confirmed', 'split_done', 'simulated', 'initiated'];
    const confirmed = confirmedStatuses.includes(pi.statut);

    const resolvedMode = pi.statut === 'simulated'
      ? 'simulation'
      : pi.statut === 'initiated' && IS_OM_SANDBOX
        ? 'sandbox-om'
        : 'production';

    // En mode simulation (méthode non configurée), confirmer l'ordre côté serveur
    // car aucun webhook ne viendra changer le statut. Idempotent : confirm_order_from_payment
    // ignore les appels successifs si déjà en 'split_done'.
    if (confirmed && pi.statut === 'simulated') {
      await supabase.rpc('confirm_order_from_payment', { p_payment_intent_id: paymentIntentId });
    }

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
