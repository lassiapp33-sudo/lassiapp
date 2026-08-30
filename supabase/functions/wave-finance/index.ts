// Edge Function admin : finances Wave LASSI
// Lit payment_intents + payout_queue (moyen_paiement='wave') depuis la DB.
// Contrairement à OM, pas d'appel API Wave pour le solde — tout est dans la DB.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders as buildCorsHeaders } from '../_shared/cors.ts';
import { waveRequestPayout } from '../_shared/waveProxy.ts';

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Vérification admin
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt!);
  if (authErr || !user) return json({ error: 'Non autorisé' }, 401);
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return json({ error: 'Accès admin requis' }, 403);

  try {
    const url    = new URL(req.url);
    const action = url.searchParams.get('action') ?? 'all';
    const days   = parseInt(url.searchParams.get('days') ?? '30', 10);
    const since  = new Date(Date.now() - days * 86_400_000).toISOString();

    // ── Payout manuel admin ─────────────────────────────────────────────────────
    if (action === 'payout' && req.method === 'POST') {
      const body  = await req.json();
      const phone = (body.phone ?? '').replace(/\s/g, '');
      const amt   = parseInt(body.amount ?? '0', 10);

      if (!/^7[05678][0-9]{7}$/.test(phone)) return json({ error: 'Numéro invalide' }, 400);
      if (!amt || amt < 100)                   return json({ error: 'Montant minimum 100 FCFA' }, 400);

      const idempKey = `admin_manual_payout_${Date.now()}`;
      const res = await waveRequestPayout({
        receive_amount: String(amt),
        currency:       'XOF',
        mobile:         `+221${phone}`,
        name:           body.name ?? 'Prestataire LASSI',
        national_id:    body.national_id ?? undefined,
        payment_reason: body.reason ?? 'Reversement manuel LASSI',
        client_reference: idempKey,
      }, idempKey);

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(`Wave payout error: ${err.message ?? JSON.stringify(err)}`);
      }
      const data = await res.json();
      return json({ success: true, reference: data.id ?? idempKey });
    }

    // ── Données financières Wave ────────────────────────────────────────────────
    const [piRes, pqRes] = await Promise.all([
      // Paiements Wave
      supabase
        .from('payment_intents')
        .select('id, created_at, statut, montant_total, commission_lassi, prix_base, external_ref, moyen_paiement, type, client_id, prestataire_id')
        .eq('moyen_paiement', 'wave')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200),
      // Reversements Wave — filtre via join payment_intents (payout_queue n'a pas moyen_paiement)
      supabase
        .from('payout_queue')
        .select('id, created_at, statut, montant, prestataire_id, payment_intent_id, attempts, last_error, payment_intents!inner(moyen_paiement)')
        .eq('payment_intents.moyen_paiement', 'wave')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    // Exclure les données demo (WV-DEMO-*) du reporting production
    const pis = (piRes.data ?? []).filter(p => !p.external_ref?.startsWith('WV-DEMO-'));
    // Aplatir : supprimer l'objet payment_intents nested du join
    const pqs = (pqRes.data ?? []).map(({ payment_intents: _pi, ...rest }) => rest);

    // Récupérer les noms des profils (clients + prestataires)
    const allUserIds = [...new Set([
      ...pis.map(p => p.client_id).filter(Boolean),
      ...pis.map(p => p.prestataire_id).filter(Boolean),
      ...pqs.map(p => p.prestataire_id).filter(Boolean),
    ])] as string[];

    let profileMap: Record<string, string> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', allUserIds);
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]));
    }

    // Summary
    const confirmed = pis.filter(p => ['confirmed', 'split_done'].includes(p.statut));
    const payoutsPaid = pqs.filter(p => p.statut === 'paid');
    const payoutsPending = pqs.filter(p => ['queued', 'processing', 'failed'].includes(p.statut));

    const sum = (arr: typeof pis, field: 'montant_total' | 'commission_lassi') =>
      arr.reduce((s, p) => s + Number(p[field] ?? 0), 0);
    const sumPq = (arr: typeof pqs) =>
      arr.reduce((s, p) => s + Number(p.montant ?? 0), 0);

    return json({
      summary: {
        total_collected:  sum(confirmed, 'montant_total'),
        total_commission: sum(confirmed, 'commission_lassi'),
        total_payouts:    sumPq(payoutsPaid),
        pending_payouts:  sumPq(payoutsPending),
        count_collected:  confirmed.length,
        count_payouts:    payoutsPaid.length,
        count_pending:    payoutsPending.length,
        count_initiated:  pis.filter(p => p.statut === 'initiated').length,
        count_failed:     pis.filter(p => p.statut === 'failed').length,
      },
      transactions: pis.map(p => ({
        ...p,
        client_name:      profileMap[p.client_id]     ?? null,
        prestataire_name: profileMap[p.prestataire_id] ?? null,
      })),
      payouts: pqs.map(p => ({
        ...p,
        prestataire_name: profileMap[p.prestataire_id] ?? null,
      })),
    });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur';
    console.error('[wave-finance]', msg);
    return json({ error: msg }, 500);
  }
});
