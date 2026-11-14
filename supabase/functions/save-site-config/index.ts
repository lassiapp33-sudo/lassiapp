/**
 * Edge Function — Site Builder : sauvegarde de la personnalisation vitrine
 * Déployer : supabase functions deploy save-site-config
 *
 * PRÉSENTATION SEULE. N'écrit QUE shops.site_config (template/tokens/displayName).
 * Ne touche jamais aux données métier (produits, prix, horaires).
 *
 * Flux :
 *  1. Vérifie le JWT utilisateur (merchant).
 *  2. Vérifie que shopId appartient bien à l'appelant (merchant_id = uid).
 *  3. Valide/assainit la config contre un schéma blanc (ids connus + accent hex).
 *     Tout id inconnu ⇒ défaut. Impossible d'injecter des valeurs libres.
 *  4. Config == défaut ⇒ écrit NULL (rendu historique). Sinon écrit l'objet.
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')              ?? '';
const SUPABASE_SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON = Deno.env.get('SUPABASE_ANON_KEY')        ?? '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Schéma blanc (MIROIR de src/config/siteThemes.ts + preview.ts) ───────────
const FONT_IDS = ['cormorant', 'dmsans', 'playfair', 'lora', 'inter', 'poppins', 'montserrat', 'spacegrotesk', 'rubik'];
const PALETTE_IDS = ['classic', 'noir', 'sable', 'foret', 'ardoise', 'cosmetic'];
const TEMPLATE_IDS = ['classic', 'cosmetic'];
const SECTION_IDS = ['products', 'services', 'terrains'];
const CARD_STYLES = ['bordered', 'shadow', 'flat'];
const HERO_STYLES = ['split', 'centered', 'minimal'];
const HEX6 = /^#[0-9a-fA-F]{6}$/;
const DEF = { template: 'classic', palette: 'classic', accent: '#FDCF34', fontHeading: 'cormorant', fontBody: 'dmsans' };
const DEF_LAYOUT = { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' };

interface CleanLayout { order: string[]; cols: number; card: string; hero: string }
interface CleanConfig { template: string; tokens: { palette: string; accent: string; fontHeading: string; fontBody: string }; layout: CleanLayout; displayName?: string }

function sanitizeLayout(raw: unknown): CleanLayout {
  const lo = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  let order = [...DEF_LAYOUT.order];
  if (Array.isArray(lo.order)) {
    const arr = (lo.order as unknown[]).filter((x): x is string => typeof x === 'string');
    const uniq = Array.from(new Set(arr));
    if (uniq.length === SECTION_IDS.length && uniq.every(x => SECTION_IDS.includes(x))) order = uniq;
  }
  const cols = lo.cols === 2 ? 2 : 3;
  const card = typeof lo.card === 'string' && CARD_STYLES.includes(lo.card) ? lo.card : DEF_LAYOUT.card;
  const hero = typeof lo.hero === 'string' && HERO_STYLES.includes(lo.hero) ? lo.hero : DEF_LAYOUT.hero;
  return { order, cols, card, hero };
}

function sanitize(raw: unknown): CleanConfig {
  const sc = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const t = sc.tokens && typeof sc.tokens === 'object' ? sc.tokens as Record<string, unknown> : {};
  const palette = typeof t.palette === 'string' && PALETTE_IDS.includes(t.palette) ? t.palette : DEF.palette;
  const accent = typeof t.accent === 'string' && HEX6.test(t.accent) ? t.accent : DEF.accent;
  const fontHeading = typeof t.fontHeading === 'string' && FONT_IDS.includes(t.fontHeading) ? t.fontHeading : DEF.fontHeading;
  const fontBody = typeof t.fontBody === 'string' && FONT_IDS.includes(t.fontBody) ? t.fontBody : DEF.fontBody;
  const template = typeof sc.template === 'string' && TEMPLATE_IDS.includes(sc.template) ? sc.template : DEF.template;
  const name = typeof sc.displayName === 'string' ? sc.displayName.trim().slice(0, 60) : '';
  const out: CleanConfig = { template, tokens: { palette, accent, fontHeading, fontBody }, layout: sanitizeLayout(sc.layout) };
  if (name) out.displayName = name;
  return out;
}

function isDefault(c: CleanConfig): boolean {
  const l = c.layout;
  const layoutDef =
    l.cols === DEF_LAYOUT.cols && l.card === DEF_LAYOUT.card && l.hero === DEF_LAYOUT.hero &&
    l.order.length === DEF_LAYOUT.order.length && l.order.every((x, i) => x === DEF_LAYOUT.order[i]);
  return (
    c.template === DEF.template &&
    c.tokens.palette === DEF.palette &&
    c.tokens.accent.toUpperCase() === DEF.accent.toUpperCase() &&
    c.tokens.fontHeading === DEF.fontHeading &&
    c.tokens.fontBody === DEF.fontBody &&
    layoutDef &&
    !c.displayName
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const fail = (msg: string, code = 400) =>
    new Response(JSON.stringify({ error: msg }), { status: code, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    if (req.method !== 'POST') return fail('Méthode non autorisée', 405);

    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return fail('Token manquant', 401);

    const sbPublic = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: { user }, error: authErr } = await sbPublic.auth.getUser(token);
    if (authErr || !user) return fail('Non autorisé', 401);

    const body = await req.json().catch(() => ({}));
    const shopId = typeof body?.shopId === 'string' ? body.shopId : '';
    if (!shopId) return fail('shopId manquant', 400);

    const sb = createClient(SUPABASE_URL, SUPABASE_SRK, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Propriété : la boutique doit appartenir à l'appelant.
    const { data: shop, error: shopErr } = await sb
      .from('shops')
      .select('id, merchant_id')
      .eq('id', shopId)
      .single();
    if (shopErr || !shop) return fail('Boutique introuvable', 404);
    if (shop.merchant_id !== user.id) return fail('Accès refusé', 403);

    const clean = sanitize(body?.site_config);
    const value = isDefault(clean) ? null : clean;

    const { error: upErr } = await sb
      .from('shops')
      .update({ site_config: value })
      .eq('id', shopId);
    if (upErr) return fail('Échec de la sauvegarde', 500);

    return new Response(JSON.stringify({ success: true, site_config: value }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erreur serveur', 500);
  }
});
