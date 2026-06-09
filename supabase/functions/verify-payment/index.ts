// ============================================================
// EDGE FUNCTION : verify-payment
// Vérifie qu'un paiement est bien confirmé avant de valider la commande
// ============================================================
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token!);
    if (error || !user) return new Response(JSON.stringify({ success: false, error: 'Non autorisé' }), { status: 401 });

    const { paymentIntentId } = await req.json();

    // Récupérer le payment_intent
    const { data: pi } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', paymentIntentId)
      .eq('client_id', user.id)
      .single();

    if (!pi) return new Response(JSON.stringify({ success: false, error: 'Introuvable' }), { status: 404 });

    const confirmed = ['confirmed', 'split_done', 'simulated'].includes(pi.statut);

    // Log vérification
    await supabase.from('payment_logs').insert({
      payment_intent_id: paymentIntentId,
      event_type: 'verify_check',
      event_data: { statut: pi.statut, confirmed },
    });

    return new Response(JSON.stringify({
      success:      true,
      confirmed,
      statut:       pi.statut,
      montantTotal: pi.montant_total,
      commission:   pi.commission_lassi,
      prixBase:     pi.prix_base,
      mode:         pi.statut === 'simulated' ? 'simulation' : 'production',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    return new Response(JSON.stringify({ success: false, error: msg }), { status: 500 });
  }
});
