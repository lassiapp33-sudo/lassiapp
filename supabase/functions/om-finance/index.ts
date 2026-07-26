// Edge Function admin : solde + transactions du compte OM LASSI
// Auth : JWT admin (Bearer token) — même vérification que les autres EF admin
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getOmToken, OM_BASE_URL } from '../_shared/omAuth.ts';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';

const OM_RETAILER_MSISDN = Deno.env.get('OM_RETAILER_MSISDN') ?? '770926843';
const OM_MERCHANT_CODE   = Deno.env.get('OM_MERCHANT_CODE')   ?? '';

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Vérification admin
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt!);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Non autorisé' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: profile } = await supabase
    .from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) {
    return new Response(JSON.stringify({ error: 'Accès admin requis' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url    = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'all';
    const size   = url.searchParams.get('size')   ?? '50';
    const from   = url.searchParams.get('from')   ?? '';

    const omToken = await getOmToken();
    const headers = { 'Authorization': `Bearer ${omToken}`, 'Content-Type': 'application/json' };

    const result: Record<string, unknown> = {};

    // Solde + profil
    if (action === 'all' || action === 'balance') {
      const r   = await fetch(
        `${OM_BASE_URL}/api/eWallet/v1/account?msisdn=${OM_RETAILER_MSISDN}&type=retailer`,
        { headers }
      );
      const acc = await r.json() as Record<string, unknown>;
      result.balance   = (acc.balance as Record<string, unknown>)?.value ?? 0;
      result.msisdn    = OM_RETAILER_MSISDN;
      result.name      = `${acc.firstName ?? ''} ${acc.lastName ?? ''}`.trim();
      result.barred    = acc.barred;
      result.suspended = acc.suspended;
    }

    // Transactions
    if (action === 'all' || action === 'transactions') {
      let txUrl = `${OM_BASE_URL}/api/eWallet/v1/transactions?size=${size}`;
      if (from) txUrl += `&fromDateTime=${encodeURIComponent(from)}`;

      const r    = await fetch(txUrl, { headers });
      const raw  = await r.json() as Array<Record<string, unknown>>;
      const list = Array.isArray(raw) ? raw : [];

      // Séparer entrées (paiements clients) et sorties (reversements prestataires)
      const income  = list.filter(t => t.type === 'MERCHANT_PAYMENT');
      const payouts = list.filter(t => t.type === 'CASHIN');

      const sum = (arr: Array<Record<string, unknown>>) =>
        arr.filter(t => t.status === 'SUCCESS')
           .reduce((s, t) => s + Number((t.amount as Record<string, unknown>)?.value ?? 0), 0);

      result.transactions  = list;
      result.summary = {
        total_income:      sum(income),
        total_payouts:     sum(payouts),
        net_commission:    sum(income) - sum(payouts),
        count_income:      income.length,
        count_payouts:     payouts.length,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
