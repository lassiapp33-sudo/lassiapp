// Edge Function — annonce "ta boutique a maintenant son lien de partage"
// à TOUS les prestataires (une boutique = un prestataire).
//
// Envoie :
//   1. une notification in-app (table notifications, type='share_vitrine')
//      → déclenche le modal statique NotifCardModal (fermeture manuelle).
//   2. un push Expo (hors-app) sur tous les appareils du prestataire.
//
// Auth : service_role (cron pg_cron) OU compte admin (is_admin=true).
//
// Body (tous optionnels) :
//   { userIds?: string[], phones?: string[], dryRun?: boolean }
//   - userIds : cible exactement ces prestataires (mode DEMO/TEST).
//   - phones  : cible par n° de tél (match sur les 9 derniers chiffres).
//   - dryRun  : calcule la cible SANS insérer ni pousser.
//   - aucun   : CAMPAGNE → tous les prestataires.
//
// Déployer : supabase functions deploy notify-share-vitrine

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPushTokens, sendExpoPush } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const WEB_BASE = 'https://s.lassi.tech';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TITLE = 'Ta boutique a maintenant son site web - Recupere-le dans LASSI';

// Corps affiché dans le modal in-app ({slug} interpolé par prestataire)
function modalBody(slug: string): string {
  return (
    `${WEB_BASE}/${slug}\n\n` +
    `Avec ce lien, tu peux :\n` +
    `- Le partager partout — WhatsApp, TikTok, Facebook, Instagram, statut…\n` +
    `- Tes clients voient tes produits et tes prix directement dans le navigateur, sans installer l'app\n` +
    `- Ils peuvent commander et payer (Wave / Orange Money) même sans compte\n\n` +
    `Comment récupérer ton lien :\n` +
    `Ouvre l'app LASSI → sama boutique → bouton Partager (ou Copier le lien).\n\n` +
    `Colle-le dans ta bio, tes statuts, tes groupes clients… et laisse les commandes arriver.\n\n` +
    `À toi de jouer !`
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

    // Résolution des n° de tél → user_ids (match sur les 9 derniers chiffres)
    const resolvedIds = new Set<string>(Array.isArray(userIds) ? userIds : []);
    if (Array.isArray(phones) && phones.length > 0) {
      for (const raw of phones) {
        const tail = raw.replace(/\D/g, '').slice(-9);
        if (!tail) continue;
        const { data } = await sb.from('profiles').select('id').ilike('phone', `%${tail}`);
        for (const p of data ?? []) resolvedIds.add(p.id);
      }
    }

    // ─── Détermination des prestataires cibles (userId → slug) ───────────────
    const targets = new Map<string, { slug: string }>();

    if (resolvedIds.size > 0) {
      // Mode DEMO/TEST : cible exactement ces user_ids.
      const ids = [...resolvedIds];
      const shops = await fetchAll(sb, 'shops', 'merchant_id,slug',
        (q: any) => q.in('merchant_id', ids));
      for (const s of shops) {
        if (s.merchant_id && !targets.has(s.merchant_id)) {
          targets.set(s.merchant_id, { slug: s.slug || 'ta-boutique' });
        }
      }
      // user_ids sans boutique → slug générique
      for (const uid of ids) {
        if (!targets.has(uid)) targets.set(uid, { slug: 'ta-boutique' });
      }
    } else {
      // Mode CAMPAGNE : tous les prestataires (hors comptes admin).
      const shops = await fetchAll(sb, 'shops', 'merchant_id,slug,is_admin_account');
      for (const s of shops) {
        if (s.is_admin_account) continue;
        if (!s.merchant_id) continue;
        if (!targets.has(s.merchant_id)) targets.set(s.merchant_id, { slug: s.slug || 'ta-boutique' });
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
      const body = modalBody(t.slug);

      // 1. Notification in-app (modal statique + Realtime)
      const { error: insErr } = await sb.from('notifications').insert({
        user_id: t.userId,
        type:    'share_vitrine',
        title:   TITLE,
        body,
        data:    {
          type: 'share_vitrine',
          slug: t.slug,
          url:  `${WEB_BASE}/${t.slug}`,
        },
        is_read: false,
      });
      if (!insErr) notifs++;

      // Push hors-app (best-effort)
      try {
        const tokens = await getPushTokens(sb, t.userId);
        if (tokens.length > 0) {
          await sendExpoPush(tokens.map(to => ({
            to,
            sound:            'default',
            channelId:        'commandes-v2',
            priority:         'high' as const,
            _contentAvailable: false,
            title: TITLE,
            body:  'Ta boutique a maintenant son site web. Ouvre l\'app pour récupérer ton lien.',
            data:  { type: 'share_vitrine', slug: t.slug },
          })));
          pushed++;
        }
      } catch { /* best-effort */ }
    }

    return ok({ sent: true, targets: targetList.length, notifsInserted: notifs, pushedUsers: pushed });

  } catch (e) {
    console.error('[notify-share-vitrine]', e);
    return fail((e as Error).message || 'Erreur interne', 500);
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), { headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function fail(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
