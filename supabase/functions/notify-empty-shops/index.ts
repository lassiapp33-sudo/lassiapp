// Edge Function — notifie les prestataires dont la boutique est VIDE
// (aucun produit dans `products` ET aucun service dans `beauty_services`).
//
// Envoie :
//   1. une notification in-app (table notifications, type='setup_shop')
//      → déclenche le modal NotifCardModal avec bouton "Joindre le service client" (WhatsApp)
//   2. un push Expo (hors-app) sur tous les appareils du prestataire.
//
// Auth : service_role (appel interne) OU compte admin (is_admin=true).
//
// Body (tous optionnels) :
//   { userIds?: string[], dryRun?: boolean }
//   - userIds : cible exactement ces prestataires (mode TEST). Sinon → toutes les boutiques vides.
//   - dryRun  : calcule et renvoie la cible SANS insérer ni pousser.
//
// Déployer : supabase functions deploy notify-empty-shops

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPushTokens, sendExpoPush } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const WA_NUMBER = '221761890003'; // service client WhatsApp

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pushTitle(shopName: string): string {
  return `Bonjour ${shopName}, ta boutique n'a aucun produit ou service — les clients ne peuvent pas commander`;
}

// Corps affiché dans le modal in-app
function modalBody(shop: string): string {
  return (
    `Ta boutique ${shop} est encore vide. Sans produits ou services, tes clients ne peuvent pas voir ce que tu vends ni passer commande. Ton lien de site web ne montrera rien non plus.\n\n` +
    `C'est simple à faire : ouvre LASSI → Sama boutique → Ajouter un produit. Quelques minutes suffisent !\n\n` +
    `Un souci ? On est là.`
  );
}

// deno-lint-ignore no-explicit-any
async function fetchAll(sb: any, table: string, columns: string, filter?: (q: any) => any): Promise<any[]> {
  const out: any[] = [];
  const step = 1000;
  let from = 0;
  while (true) {
    let q = sb.from(table).select(columns).range(from, from + step - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < step) break;
    from += step;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SRK);

    // ─── Auth : service_role OU admin ────────────────────────────────────────
    const token = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
    let jwtRole: string | null = null;
    let jwtSub:  string | null = null;
    try {
      const p = JSON.parse(atob(token.split('.')[1] ?? ''));
      jwtRole = p?.role ?? null;
      jwtSub  = p?.sub  ?? null;
    } catch { /* token malformé */ }

    if (jwtRole !== 'service_role') {
      if (!jwtSub) return fail('Non autorisé', 401);
      const { data: prof } = await sb.from('profiles').select('is_admin').eq('id', jwtSub).single();
      if (!prof?.is_admin) return fail('Accès réservé aux administrateurs', 403);
    }

    const { userIds, phones, dryRun } = (await req.json().catch(() => ({}))) as {
      userIds?: string[];
      phones?:  string[];
      dryRun?:  boolean;
    };

    // Résolution phones → userIds
    const resolvedIds = new Set<string>(Array.isArray(userIds) ? userIds : []);
    if (Array.isArray(phones) && phones.length > 0) {
      for (const raw of phones) {
        const tail = raw.replace(/\D/g, '').slice(-9);
        if (!tail) continue;
        const { data } = await sb.from('profiles').select('id').ilike('phone', `%${tail}`);
        for (const p of data ?? []) resolvedIds.add(p.id);
      }
    }
    // Si phones/userIds fournis mais aucun profil trouvé → erreur (évite la campagne accidentelle)
    const hasFilter = (Array.isArray(userIds) && userIds.length > 0) || (Array.isArray(phones) && phones.length > 0);
    if (hasFilter && resolvedIds.size === 0) return fail('Aucun profil trouvé pour les identifiants fournis', 404);
    const effectiveIds = resolvedIds.size > 0 ? [...resolvedIds] : null;

    // ─── Détermination des prestataires cibles ───────────────────────────────
    // Un couple (merchant_id → shop_name) par prestataire à notifier.
    const targets = new Map<string, { shopId: string; shopName: string }>();

    if (effectiveIds) {
      // Mode TEST : cible exactement ces user_ids.
      const shops = await fetchAll(sb, 'shops', 'id,merchant_id,name',
        (q: any) => q.in('merchant_id', effectiveIds));
      for (const s of shops) {
        if (!targets.has(s.merchant_id)) targets.set(s.merchant_id, { shopId: s.id, shopName: s.name });
      }
      for (const uid of effectiveIds) {
        if (!targets.has(uid)) targets.set(uid, { shopId: '', shopName: 'ta boutique' });
      }
    } else {
      // Mode CAMPAGNE : toutes les boutiques sans contenu (has_content = false),
      // hors comptes admin. has_content est maintenu par triggers DB.
      const shops = await fetchAll(sb, 'shops', 'id,merchant_id,name',
        (q: any) => q.eq('has_content', false).eq('is_admin_account', false));

      for (const s of shops) {
        if (!targets.has(s.merchant_id)) targets.set(s.merchant_id, { shopId: s.id, shopName: s.name });
      }
    }

    const targetList = [...targets.entries()].map(([userId, v]) => ({ userId, ...v }));

    if (dryRun) {
      return ok({ dryRun: true, count: targetList.length, targets: targetList });
    }

    // ─── Envoi : notif in-app + push, par prestataire ────────────────────────
    let notifs = 0;
    let pushed = 0;

    for (const t of targetList) {
      const body = modalBody(t.shopName);

      // 1. Notification in-app (modal + Realtime)
      const title = pushTitle(t.shopName);
      const { error: insErr } = await sb.from('notifications').insert({
        user_id: t.userId,
        type:    'setup_shop',
        title,
        body,
        data:    {
          type:      'setup_shop',
          shop_name: t.shopName,
          shop_id:   t.shopId || null,
          target_id: t.shopId || null,
          wa_number: WA_NUMBER,
        },
        is_read: false,
      });
      if (!insErr) notifs++;

      // 2. Push Expo (hors-app), best-effort
      try {
        const tokens = await getPushTokens(sb, t.userId);
        if (tokens.length > 0) {
          await sendExpoPush(tokens.map(to => ({
            to,
            sound: 'default',
            title,
            body:  'Ajoute tes produits ou services pour que tes clients puissent commander.',
            data:  { type: 'setup_shop', shop_id: t.shopId || null },
          })));
          pushed++;
        }
      } catch { /* best-effort */ }
    }

    return ok({ sent: true, targets: targetList.length, notifsInserted: notifs, pushedUsers: pushed });

  } catch (e) {
    console.error('[notify-empty-shops]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
