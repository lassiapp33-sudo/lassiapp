/**
 * Edge Function — Suppression de compte LASSİ
 * Déployer : supabase functions deploy delete-account
 *
 * Utilise service_role → jamais exposé à l'app.
 * La clé SUPABASE_SERVICE_ROLE_KEY est automatiquement injectée par Supabase.
 *
 * Flux :
 *  1. Vérifie le JWT de l'utilisateur
 *  2. Récupère son rôle (client ou merchant)
 *  3. Si merchant : supprime la boutique (CASCADE → produits, commandes, dettes, conversations)
 *  4. Supprime le profil (CASCADE → notifications, favoris, conversations client)
 *  5. Supprime l'entrée auth.users → libère email + numéro pour réinscription
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── 1. Authentifier via le JWT utilisateur ─────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return fail('Token manquant', 401);

    // Client public pour vérifier le JWT
    const sbPublic = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: authErr } = await sbPublic.auth.getUser(token);
    if (authErr || !user) return fail('Non autorisé', 401);

    const userId = user.id;

    // Client service_role pour les opérations admin
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 2. Récupérer le rôle pour savoir si c'est un commerçant ───────────
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    const isMerchant = profile?.role === 'merchant';

    // ── 3. Commerçant : supprimer la boutique en premier ───────────────────
    // La suppression CASCADE couvre : produits, commandes, order_items,
    // dettes, debt_transactions, conversations, messages.
    if (isMerchant) {
      const { error: shopErr } = await sb
        .from('shops')
        .delete()
        .eq('merchant_id', userId);

      if (shopErr) {
        console.error('[delete-account] shops delete:', shopErr);
        // Non bloquant : on continue même si la boutique n'existait pas
      }
    }

    // ── 4. Supprimer le profil ─────────────────────────────────────────────
    // CASCADE couvre : notifications, favorites, conversations (client),
    // recompenses_attribuees, classements (prestataire + client).
    const { error: profileErr } = await sb
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileErr) {
      console.error('[delete-account] profile delete:', profileErr);
      return fail('Impossible de supprimer le profil', 500);
    }

    // ── 5. Supprimer de auth.users → libère email + numéro ────────────────
    // Après cette opération, le même numéro peut être réutilisé à l'inscription.
    const { error: authDeleteErr } = await sb.auth.admin.deleteUser(userId);
    if (authDeleteErr) {
      console.error('[delete-account] auth.deleteUser:', authDeleteErr);
      return fail('Impossible de supprimer le compte auth', 500);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('[delete-account] unexpected:', e);
    return fail('Erreur interne', 500);
  }
});

function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
