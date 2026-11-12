// Edge Function — notifie les prestataires que les photos de leurs produits
// ont été perdues (incident cleanup-storage) et les invite à les rajouter.
//
// Objectif double :
//   1. Informer honnêtement (push + in-app) — message d'excuse.
//   2. Déclencher l'ouverture de l'app → la récupération auto (runImageRecovery)
//      scanne le cache du téléphone et ré-uploade les images encore présentes.
//      → Le marchand remet la photo manuellement S'IL le veut ; s'il ne le fait
//        pas, l'image est récupérée automatiquement depuis son cache si dispo.
//
// Cible : prestataires ayant AU MOINS un produit (donc ayant eu des photos),
//         hors comptes admin.
//
// Envoie :
//   1. notification in-app (table notifications, type='setup_shop' → modal statique
//      NotifCardModal + bouton "Joindre le service client" WhatsApp).
//   2. push Expo (hors-app) sur tous les appareils du prestataire.
//
// Auth : service_role (appel interne) OU compte admin (is_admin=true).
//
// Body (tous optionnels) :
//   { userIds?: string[], phones?: string[], dryRun?: boolean, platformFilter?: 'ios'|'android' }
//   - userIds/phones : cible exactement ces prestataires (mode TEST).
//   - dryRun         : calcule la cible SANS insérer ni pousser.
//   - aucun          : CAMPAGNE → tous les prestataires avec produits.
//
// Déployer : supabase functions deploy notify-photos-lost

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPushTokens, sendExpoPush } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const WA_NUMBER = '221761890003'; // service client WhatsApp

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TITLE = 'Tes photos produits ont disparu ?';

const BODY =
  'Désolés 🙏 — suite à un incident de notre côté, les photos de tes produits ont été perdues. ' +
  'Tes produits, prix et commandes sont intacts, seules les photos sont parties. ' +
  'Ouvre ta boutique et rajoute la photo de chaque produit en quelques secondes.';

// Corps court pour le push (hors-app)
const PUSH_BODY =
  'Désolés 🙏 — suite à un incident, les photos de tes produits sont parties. ' +
  'Ouvre ta boutique et rajoute-les en quelques secondes.';

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

    const { userIds, phones, dryRun, platformFilter } = (await req.json().catch(() => ({}))) as {
      userIds?: string[];
      phones?:  string[];
      dryRun?:  boolean;
      platformFilter?: 'ios' | 'android';
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
    const hasFilter = (Array.isArray(userIds) && userIds.length > 0) || (Array.isArray(phones) && phones.length > 0);
    if (hasFilter && resolvedIds.size === 0) return fail('Aucun profil trouvé pour les identifiants fournis', 404);
    const effectiveIds = resolvedIds.size > 0 ? [...resolvedIds] : null;

    // ─── Détermination des prestataires cibles (merchant_id → shopId/shopName) ─
    const targets = new Map<string, { shopId: string; shopName: string }>();

    if (effectiveIds) {
      // Mode TEST / ciblage explicite : exactement ces user_ids.
      // Chunk le .in() (100 ids max) — sinon URL trop longue → erreur http2.
      const CHUNK = 100;
      for (let i = 0; i < effectiveIds.length; i += CHUNK) {
        const slice = effectiveIds.slice(i, i + CHUNK);
        const shops = await fetchAll(sb, 'shops', 'id,merchant_id,name',
          (q: any) => q.in('merchant_id', slice));
        for (const s of shops) {
          if (!targets.has(s.merchant_id)) targets.set(s.merchant_id, { shopId: s.id, shopName: s.name });
        }
      }
      for (const uid of effectiveIds) {
        if (!targets.has(uid)) targets.set(uid, { shopId: '', shopName: 'ta boutique' });
      }
    } else {
      // Mode CAMPAGNE : toutes les boutiques ayant AU MOINS un produit, hors admin.
      // NB : le ciblage FIN des marchands réellement impactés (image manquante /
      // fichier supprimé du bucket) se fait en amont via userIds (storage.objects
      // n'est pas exposé à PostgREST, donc non interrogeable ici).
      const shops = await fetchAll(sb, 'shops', 'id,merchant_id,name,is_admin_account',
        (q: any) => q.eq('is_admin_account', false));
      const shopById = new Map<string, { merchant_id: string; name: string }>();
      for (const s of shops) {
        if (s.merchant_id) shopById.set(s.id, { merchant_id: s.merchant_id, name: s.name });
      }
      // Shops ayant au moins un produit (distinct shop_id dans products)
      const prodRows = await fetchAll(sb, 'products', 'shop_id');
      const shopsWithProducts = new Set<string>();
      for (const r of prodRows) { if (r.shop_id) shopsWithProducts.add(r.shop_id); }

      for (const shopId of shopsWithProducts) {
        const s = shopById.get(shopId);
        if (!s) continue; // shop admin ou introuvable
        if (!targets.has(s.merchant_id)) targets.set(s.merchant_id, { shopId, shopName: s.name });
      }
    }

    const targetList = [...targets.entries()].map(([userId, v]) => ({ userId, ...v }));

    if (dryRun) {
      return ok({ dryRun: true, count: targetList.length, targets: targetList.slice(0, 20) });
    }

    // ─── Envoi : notif in-app + push, par prestataire ────────────────────────
    let notifs = 0;
    let pushed = 0;

    for (const t of targetList) {
      // 1. Notification in-app (bannière + bouton "Ouvrir le catalogue" → boutique)
      const { error: insErr } = await sb.from('notifications').insert({
        user_id: t.userId,
        type:    'photos_lost',
        title:   TITLE,
        body:    BODY,
        data:    {
          type:      'photos_lost',
          shop_name: t.shopName,
          shop_id:   t.shopId || null,
          target_id: t.shopId || null,
          wa_number: WA_NUMBER,
          reason:    'photos_lost',
        },
        is_read: false,
      });
      if (!insErr) notifs++;

      // 2. Push Expo (hors-app), best-effort — l'ouverture déclenche runImageRecovery
      try {
        let tokens = await getPushTokens(sb, t.userId);
        if (platformFilter) {
          const { data: filtered } = await sb.from('push_tokens')
            .select('token').eq('user_id', t.userId).eq('platform', platformFilter);
          const allowed = new Set((filtered ?? []).map((r: { token: string }) => r.token));
          tokens = tokens.filter(tk => allowed.has(tk));
        }
        if (tokens.length > 0) {
          await sendExpoPush(tokens.map(to => ({
            to,
            sound:             'default',
            channelId:         'commandes-v2',
            priority:          'high' as const,
            _contentAvailable: true,
            title: TITLE,
            body:  PUSH_BODY,
            data:  { type: 'photos_lost', shop_id: t.shopId || null, reason: 'photos_lost' },
          })));
          pushed++;
        }
      } catch { /* best-effort */ }
    }

    return ok({ sent: true, targets: targetList.length, notifsInserted: notifs, pushedUsers: pushed });

  } catch (e) {
    console.error('[notify-photos-lost]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
