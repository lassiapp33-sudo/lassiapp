// ─────────────────────────────────────────────────────────────────────────────
// Vercel Edge Function — Vitrine + CHECKOUT INVITÉ + Aperçu OG sur s.lassi.tech
//
// https://s.lassi.tech/<slug> :
//   • Robots WhatsApp/Facebook → carte OpenGraph (anti-arnaque).
//   • Humains → VITRINE avec PANIER : le client choisit les produits, saisit
//     nom + téléphone (+ adresse/note), paie Wave/OM — SANS app, SANS compte.
//     La commande arrive dans l'app DU MARCHAND (EF create-guest-order).
//   • Boutons store = OPTIONNELS (télécharger l'app), pas l'objectif.
//
// https://s.lassi.tech/commande?id=<orderId>&s=ok|ko :
//   • Page de confirmation (poll du statut de la commande).
//
// Fichier SANS import externe (bundler edge zéro-config Vercel). Le JS client est
// écrit en concaténation (jamais de backticks) pour ne pas entrer en conflit avec
// l'interpolation ${} du template serveur.
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore - process.env injecté par le runtime edge Vercel
declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: 'edge' };

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.lassiapp.lassiapp';
const APPSTORE_URL = process.env.APPSTORE_URL || 'https://apps.apple.com/app/id6802453488';
const BRAND_BG = '#14152A';
const BRAND_GOLD = '#FDCF34';

// Échappe </script dans les blocs JS inline pour éviter que le parser HTML
// ferme le <script> prématurément si une chaîne de caractères contient ce tag.
// À appliquer sur TOUT JS embedé dans un <script> serveur.
function safeScript(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script');
}

// Commission LASSİ 1% — aligné sur Lassi/src/config/payment.ts (calculerPrixClient)
// ET sur le total recalculé par create-guest-order (subtotal + ceil(subtotal*1%)).
const COMMISSION_RATE = 0.01;
function prixClient(base: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const b = Math.round(base);
  return b + Math.ceil(b * COMMISSION_RATE);
}

// ─────────────────────────────────────────────────────────────────────────────
// SITE BUILDER — thème vitrine piloté par shops.site_config (PRÉSENTATION SEULE).
// site_config absent/invalide ⇒ thème DÉFAUT = rendu historique EXACT (charte
// LASSİ + Cormorant/DM Sans). Schéma blanc : tout id inconnu retombe sur le
// défaut ; l'accent est la seule valeur libre et doit être un hex #RRGGBB validé.
// Catalogues = miroir de src/config/siteThemes.ts (app) — enrichis en Phase 3.
// ─────────────────────────────────────────────────────────────────────────────
interface SiteFont { family: string; stack: string; css2: string; }
const SITE_FONTS: Record<string, SiteFont> = {
  cormorant: { family: 'Cormorant Garamond', stack: "'Cormorant Garamond',Georgia,serif", css2: 'Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400' },
  dmsans:    { family: 'DM Sans', stack: "'DM Sans',system-ui,sans-serif", css2: 'DM+Sans:wght@300;400;500;600' },
  playfair:  { family: 'Playfair Display', stack: "'Playfair Display',Georgia,serif", css2: 'Playfair+Display:wght@400;500;600;700' },
  lora:      { family: 'Lora', stack: "'Lora',Georgia,serif", css2: 'Lora:wght@400;500;600' },
  inter:     { family: 'Inter', stack: "'Inter',system-ui,sans-serif", css2: 'Inter:wght@300;400;500;600;700' },
  poppins:   { family: 'Poppins', stack: "'Poppins',system-ui,sans-serif", css2: 'Poppins:wght@300;400;500;600' },
  montserrat:{ family: 'Montserrat', stack: "'Montserrat',system-ui,sans-serif", css2: 'Montserrat:wght@300;400;500;600;700' },
  spacegrotesk:{ family: 'Space Grotesk', stack: "'Space Grotesk',system-ui,sans-serif", css2: 'Space+Grotesk:wght@300;400;500;600;700' },
  rubik:     { family: 'Rubik', stack: "'Rubik',system-ui,sans-serif", css2: 'Rubik:wght@400;500;600;700' },
  unbounded: { family: 'Unbounded', stack: "'Unbounded',system-ui,sans-serif", css2: 'Unbounded:wght@500;700' },
  plusjakarta: { family: 'Plus Jakarta Sans', stack: "'Plus Jakarta Sans',system-ui,sans-serif", css2: 'Plus+Jakarta+Sans:wght@400;500;600;700' },
  jost:      { family: 'Jost', stack: "'Jost',system-ui,sans-serif", css2: 'Jost:wght@400;500;600;700' },
  manrope:   { family: 'Manrope', stack: "'Manrope',system-ui,sans-serif", css2: 'Manrope:wght@400;500;600;700' },
  fraunces:  { family: 'Fraunces', stack: "'Fraunces',Georgia,serif", css2: 'Fraunces:wght@400;500;600;700' },
  bebas:     { family: 'Bebas Neue', stack: "'Bebas Neue',Impact,sans-serif", css2: 'Bebas+Neue' },
  outfit:    { family: 'Outfit', stack: "'Outfit',system-ui,sans-serif", css2: 'Outfit:wght@300;400;500;600;700' },
  oswald:    { family: 'Oswald', stack: "'Oswald',Impact,system-ui,sans-serif", css2: 'Oswald:wght@400;500;600;700' },
  anton:     { family: 'Anton', stack: "'Anton',Impact,system-ui,sans-serif", css2: 'Anton' },
  cinzel:    { family: 'Cinzel', stack: "'Cinzel',Georgia,serif", css2: 'Cinzel:wght@400;500;600;700' },
  syne:      { family: 'Syne', stack: "'Syne',system-ui,sans-serif", css2: 'Syne:wght@400;500;600;700;800' },
};
const DEFAULT_HEADING = 'cormorant';
const DEFAULT_BODY = 'dmsans';

interface SitePalette { d: string; w: string; g: string; m: string; b: string; }
// d=texte/boutons foncés · w=fond page · g=fond doux · m=texte secondaire · b=bordures.
// Toutes garanties lisibles (texte foncé sur fond clair). Accent = token séparé.
const SITE_PALETTES: Record<string, SitePalette> = {
  classic: { d: '#14152A', w: '#FFFFFF', g: '#f5f4f0', m: '#8a8880', b: '#e8e5de' },
  noir:    { d: '#1a1a1a', w: '#FFFFFF', g: '#f4f4f4', m: '#8a8a8a', b: '#e6e6e6' },
  sable:   { d: '#2b2118', w: '#FBF8F3', g: '#f1ece3', m: '#9a8d7a', b: '#e6ddcf' },
  foret:   { d: '#14241c', w: '#FFFFFF', g: '#eef3f0', m: '#7d8a83', b: '#dde7e2' },
  ardoise: { d: '#1b2430', w: '#FFFFFF', g: '#eef1f5', m: '#7e8794', b: '#dde3ea' },
  cosmetic: { d: '#171313', w: '#FFFFFF', g: '#f6f6f7', m: '#6e6e75', b: '#ececed' },
  pottery: { d: '#201d1d', w: '#FFFFFF', g: '#f4f4f5', m: '#696767', b: '#eaeaec' },
  furniture: { d: '#152420', w: '#FFFFFF', g: '#EEF4F5', m: '#6b7b78', b: '#e4ecec' },
  garderobe: { d: '#1b1b1f', w: '#FFFFFF', g: '#f5f5f6', m: '#7c7c82', b: '#e8e8ea' },
  sac:     { d: '#1a1a1a', w: '#FFFFFF', g: '#f4f3f1', m: '#86868b', b: '#e9e7e3' },
  // Palettes à fond coloré / sombre : changent le site dans son ensemble.
  encre:     { d: '#FFFFFF', w: '#14152A', g: '#1e2036', m: '#9a9cb5', b: '#2c2e48' },
  onyx:      { d: '#FFFFFF', w: '#121212', g: '#1d1d1d', m: '#9a9a9a', b: '#2a2a2a' },
  emerauded: { d: '#FFFFFF', w: '#0F2A22', g: '#163A2F', m: '#8fb5a8', b: '#245043' },
  bordeaux:  { d: '#FFFFFF', w: '#2A1216', g: '#3A1A1F', m: '#c79aa0', b: '#4d2429' },
  nuitbleue: { d: '#FFFFFF', w: '#0E1B33', g: '#172644', m: '#93a2c0', b: '#243a5e' },
  creme:     { d: '#3A2E22', w: '#FDF6EC', g: '#F6ECE0', m: '#9a8d7a', b: '#ece0cf' },
  lavande:   { d: '#241F33', w: '#F4F1FB', g: '#EBE6F6', m: '#8f87a3', b: '#e0d9f0' },
  ocean:     { d: '#0F2F3A', w: '#EAF4F7', g: '#DCECF1', m: '#6f8d96', b: '#cfe2e8' },
  rosepoudre:{ d: '#3A1E27', w: '#FDF0F3', g: '#F8E1E8', m: '#b48e98', b: '#f0d2dc' },
};
const DEFAULT_PALETTE = 'classic';
const DEFAULT_ACCENT = BRAND_GOLD; // #FDCF34
const SITE_TEMPLATES = ['classic', 'cosmetic', 'furniture', 'garderobe', 'sac', 'tresse', 'ferme', 'grill', 'bar']; // Phase 3 — #1 cosmetic (beauté), #2 furniture (maison & mobilier), #3 garderobe (mode / prêt-à-porter), #4 sac (maroquinerie / bagagerie) ; bar = restaurant/lounge (BRAISE)
const HEX6 = /^#[0-9a-fA-F]{6}$/;

// ── Layout (Phase 2) — agencement des conteneurs, présentation seule ─────────
// order = permutation des 3 blocs de contenu (données jamais masquées).
const SECTION_IDS = ['products', 'services', 'terrains'];
const CARD_STYLES = ['bordered', 'shadow', 'flat'];
const HERO_STYLES = ['split', 'centered', 'minimal'];
const DEFAULT_LAYOUT = { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' };

interface SiteLayout { order: string[]; cols: number; card: string; hero: string }
interface SiteSocial { facebook: string; tiktok: string; instagram: string }
interface ResolvedTheme {
  template: string; y: string; d: string; w: string; g: string; m: string; b: string;
  fh: string; fb: string; fontsLink: string; displayName: string | null; layout: SiteLayout; social: SiteSocial;
  video: string;
}

// Valide une URL de vidéo de présentation : https uniquement, bornée, extension média.
function cleanVideoUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s || s.length > 500) return '';
  if (!/^https:\/\//i.test(s)) return '';
  if (/[\s"'<>]/.test(s)) return '';
  return s;
}

// Valide un lien réseau social : http(s) uniquement, longueur bornée. Sinon ''.
function cleanSocialUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s || s.length > 300) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  if (/[\s"'<>]/.test(s)) return '';
  return s;
}
function resolveSocial(raw: unknown): SiteSocial {
  const s = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    facebook: cleanSocialUrl(s.facebook),
    tiktok: cleanSocialUrl(s.tiktok),
    instagram: cleanSocialUrl(s.instagram),
  };
}

// Valide le layout : permutation stricte des 3 blocs (aucun ajout/retrait), sinon défaut.
function resolveLayout(raw: unknown): SiteLayout {
  const d = DEFAULT_LAYOUT;
  const lo = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  let order = d.order;
  if (Array.isArray(lo.order)) {
    const arr = (lo.order as unknown[]).filter((x): x is string => typeof x === 'string');
    const uniq = Array.from(new Set(arr));
    // Doit contenir exactement les 3 ids connus (permutation) — sinon on garde le défaut.
    if (uniq.length === SECTION_IDS.length && uniq.every(x => SECTION_IDS.includes(x))) order = uniq;
  }
  const cols = lo.cols === 2 ? 2 : 3;
  const card = typeof lo.card === 'string' && CARD_STYLES.includes(lo.card) ? lo.card : d.card;
  const hero = typeof lo.hero === 'string' && HERO_STYLES.includes(lo.hero) ? lo.hero : d.hero;
  return { order, cols, card, hero };
}

// Résout shops.site_config → tokens validés. Entrée nulle/invalide ⇒ DÉFAUT exact.
function resolveTheme(raw: unknown): ResolvedTheme {
  const sc = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const tokens = sc.tokens && typeof sc.tokens === 'object' ? sc.tokens as Record<string, unknown> : {};

  const headId = typeof tokens.fontHeading === 'string' && SITE_FONTS[tokens.fontHeading] ? tokens.fontHeading : DEFAULT_HEADING;
  const bodyId = typeof tokens.fontBody === 'string' && SITE_FONTS[tokens.fontBody] ? tokens.fontBody : DEFAULT_BODY;
  const fh = SITE_FONTS[headId];
  const fb = SITE_FONTS[bodyId];

  const palId = typeof tokens.palette === 'string' && SITE_PALETTES[tokens.palette] ? tokens.palette : DEFAULT_PALETTE;
  const pal = SITE_PALETTES[palId];
  const accent = typeof tokens.accent === 'string' && HEX6.test(tokens.accent) ? tokens.accent : DEFAULT_ACCENT;

  const template = typeof sc.template === 'string' && SITE_TEMPLATES.indexOf(sc.template) >= 0 ? sc.template : 'classic';
  const displayName = typeof sc.displayName === 'string' && sc.displayName.trim() ? clip(sc.displayName.trim(), 60) : null;

  // Google Fonts : heading puis body, dédupliqués si même famille.
  const families = fh.css2 === fb.css2 ? [fh.css2] : [fh.css2, fb.css2];
  const q = families.map(c => 'family=' + c).join('&');
  const fontsLink = '<link href="https://fonts.googleapis.com/css2?' + q + '&display=swap" rel="stylesheet">';

  const layout = resolveLayout(sc.layout);
  const social = resolveSocial(sc.social);

  const video = cleanVideoUrl(sc.heroVideo);

  return { template, y: accent, d: pal.d, w: pal.w, g: pal.g, m: pal.m, b: pal.b, fh: fh.stack, fb: fb.stack, fontsLink, displayName, layout, social, video };
}

const CAT_LABELS: Record<string, string> = {
  stores: 'Commerçants', tangana: 'Tangana / Ndéki / Soupe', bakery: 'Boulangeries',
  food: 'Restos & Boissons', fruiterie: 'Fruiterie', hair: 'Beauté & Soins', sport: 'Sport',
};
const SUBCAT_LABELS: Record<string, string> = {
  nexx_sow: 'Nexx sow', sombi_ak_thiere: 'Sombi ak Thiéré', alimentation: 'Alimentation / Boutique',
  quincaillerie: 'Quincaillerie', tangana: 'Tangana', ndeki: 'Ndéki (Mama)', soupe: 'Soupe',
  cafe_wass: 'Café ak Thé', maison_electromenager: 'Maison & Électroménager', beignet_fataya: 'Beignet ak Fataya', boulangerie: 'Boulangerie',
  patisserie: 'Pâtisserie', restaurant: 'Restaurant', fastfood: 'Fast-food', malibu: 'Malibu',
  dibiterie: 'Dibiterie', seras: 'Séraas', jus: 'Jus & Boissons', snack: 'Snack & Gourmandise',
  fruits: 'Fruits frais', fruits_marines: 'Fruits marinés', hommes: 'Barber', femmes: 'Tresses',
  parfumerie: 'Parfumerie', esthetique: 'Esthétique & Ongles', soins_bio: 'Soins & Bio',
  musculation: 'Musculation / Fitness', reservation_terrain_foot: 'Réservation de terrain foot',
  reservation_terrain_basket: 'Réservation de terrain basket', arts_martiaux: 'Arts martiaux',
};

function categoryLabel(category: string | null, subcategories: unknown): string {
  let subs: string[] = [];
  if (Array.isArray(subcategories)) subs = subcategories as string[];
  else if (typeof subcategories === 'string') {
    try { const p = JSON.parse(subcategories); if (Array.isArray(p)) subs = p; } catch { /* ignore */ }
  }
  const labels = subs.map(id => SUBCAT_LABELS[id]).filter(Boolean);
  if (labels.length) return labels.join(' · ');
  if (category && CAT_LABELS[category]) return CAT_LABELS[category];
  return 'Boutique';
}

interface Shop {
  id: string; name: string | null; logo_url: string | null; description: string | null;
  zone: string | null; category: string | null; subcategories: unknown; slug: string;
  shop_type: string | null;
  merchant_id: string | null; opening_hours: unknown; is_manually_closed: boolean | null;
  site_config: unknown;
  gallery_urls: unknown; cover_url: string | null;
  phone: string | null;
  latitude?: number | null; longitude?: number | null;
}
interface Product {
  id: string; name: string | null; description: string | null;
  emoji: string | null; photo_url: string | null; price: number | null;
  category: string | null;
  images?: string[] | null;
  sizes?: string[] | null;
  colors?: string[] | null;
  stock_quantity?: number | null;
}
// Prestation/service (non commandable via panier web — réservation/abonnement dans l'app).
interface ServiceItem {
  id: string; name: string; description: string | null;
  price: number; category: string; meta: string; kind: 'beauty' | 'fitness';
  image_url?: string | null;
}
interface Terrain {
  id: string; nom: string | null; description: string | null;
  prix_horaire: number | null; sport_type: string | null; adresse: string | null;
  images: string[] | null;
}

// ── Regroupement produits par catégorie (miroir shopStore) ───────────────────
// Normalise l'id de catégorie, préserve l'ordre d'apparition, libellés = app.
const PROD_CAT_LABELS: Record<string, string> = {
  petitdej: 'Petit-déj', boissons: 'Boissons', plats: 'Plats', autres: 'Autres',
  catalogue: 'Catalogue', prestations: 'Prestations', formules: 'Formules',
  produits: 'Produits', abonnements: 'Abonnements', tarif: 'Tarif', menus: 'Menus',
  entrees: 'Entrées', desserts: 'Desserts', snack: 'Snack', accompagnements: 'Accompagnements',
  visage: 'Visage', corps: 'Corps', huiles_serums: 'Huiles & Sérums', soins_cibles: 'Soins ciblés',
};
function normCatId(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}
function prodCatTitle(id: string): string {
  return PROD_CAT_LABELS[id] ?? id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
function groupProducts(products: Product[]): { id: string; title: string; items: Product[] }[] {
  const order: string[] = [];
  const map: Record<string, Product[]> = {};
  for (const p of products) {
    const id = normCatId(p.category ?? '') || 'autres';
    if (!map[id]) { map[id] = []; order.push(id); }
    map[id].push(p);
  }
  return order.map(id => ({ id, title: prodCatTitle(id), items: map[id] }));
}

export default async function handler(
  req: Request,
  ctx: { waitUntil(p: Promise<unknown>): void },
): Promise<Response> {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') ?? '').trim();

  // robots.txt — autorise le crawl + pointe vers le sitemap (SEO Google).
  if (slug === 'robots.txt') {
    const body =
      'User-agent: *\n' +
      'Allow: /\n' +
      'Sitemap: https://s.lassi.tech/sitemap.xml\n';
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    });
  }

  // Vérification Google Search Console (méthode « fichier HTML »).
  // UNIQUEMENT le token exact fourni par Google — tout autre google*.html doit 404
  // (sinon Google détecte un catch-all et refuse "site peut-être piraté").
  if (slug === 'google6e77e14024a30e5f.html') {
    return new Response('google-site-verification: google6e77e14024a30e5f.html', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // sitemap.xml — liste toutes les vitrines avec contenu (has_content=true) pour
  // que Google les découvre et les indexe par nom de boutique.
  if (slug === 'sitemap.xml') {
    return new Response(await renderSitemap(url), {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    });
  }

  // Page de confirmation post-paiement (invité).
  if (slug === 'commande' || slug === 'merci') {
    return new Response(renderConfirmation(url), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // Proxy reçu — évite CORS/auth depuis le navigateur mobile
  if (slug === 'receipt') {
    const rId   = (url.searchParams.get('id') ?? '').trim();
    const rType = url.searchParams.get('type') ?? '';
    if (!rId) return new Response('Missing id', { status: 400 });
    const ah: Record<string, string> = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
    try {
      if (rType === 'terrain') {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-guest-terrain-reservation?receipt=${encodeURIComponent(rId)}`, { headers: ah });
        const d = await r.json() as Record<string, unknown>;
        if (!d?.success) return new Response('Reçu introuvable', { status: 404 });
        const G = '#FDCF34', K = '#14152A';
        const e2 = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu terrain — LASSİ</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:${K};padding:40px 32px}.logo{font-size:22px;font-weight:800;letter-spacing:-1px;margin-bottom:4px}.logo span{color:${G}}.logo-sub{font-size:11px;color:#999;margin-bottom:28px}h1{font-size:18px;font-weight:700;margin:0 0 4px}p.sub{color:#777;font-size:13px;margin:0 0 24px;line-height:1.5}.card{border:1.5px solid #e8e5de;border-radius:14px;padding:16px 18px;margin-bottom:20px}.row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #f0ede7;font-size:13px}.row:last-child{border-bottom:none;font-weight:700;font-size:14.5px;padding-top:10px}.lbl{color:#888;flex-shrink:0}.val{text-align:right;word-break:break-word}.code{font-family:monospace;font-size:22px;letter-spacing:4px;background:${K};color:${G};padding:10px 20px;border-radius:10px;display:block;text-align:center;font-weight:700;margin:20px 0 6px}.hint{font-size:11px;color:#999;text-align:center;margin-bottom:16px}.pbtn{display:block;width:100%;margin:10px 0;background:${G};color:${K};border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer}.footer{font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:14px;margin-top:10px}@media print{.pbtn{display:none!important}}</style></head><body><div class="logo">LASS<span>İ</span></div><div class="logo-sub">lassi.tech</div><h1>Reçu de réservation terrain</h1><p class="sub">Montre ce document à l'accueil du terrain.</p><div class="card"><div class="row"><span class="lbl">Terrain</span><span class="val">${e2(d.sport_emoji)} ${e2(d.terrain_nom)}</span></div><div class="row"><span class="lbl">Date</span><span class="val">${e2(d.date_label)}</span></div><div class="row"><span class="lbl">Créneau</span><span class="val">${e2(d.heure_debut)} → ${e2(d.heure_fin)}</span></div><div class="row"><span class="lbl">Client</span><span class="val">${e2(d.client_name)}</span></div><div class="row"><span class="lbl">Établissement</span><span class="val">${e2(d.prestataire_name)}</span></div><div class="row"><span class="lbl">Montant payé</span><span class="val">${e2(d.montant_label)}</span></div></div><div class="code">${e2(d.receipt_code)}</div><div class="hint">Code unique — valide jusqu'à la fin du créneau</div><button class="pbtn" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="footer">LASSİ • lassi.tech • Transaction sécurisée</div></body></html>`;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      } else if (rType === 'abonnement') {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-guest-subscription?pdf=${encodeURIComponent(rId)}`, { headers: ah });
        if (!r.ok) return new Response('Reçu introuvable', { status: 404 });
        const buf = await r.arrayBuffer();
        return new Response(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="recu-abonnement-lassi.pdf"', 'Cache-Control': 'no-store' } });
      } else if (rType === 'beauty') {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-guest-reservation?receipt=${encodeURIComponent(rId)}`, { headers: ah });
        const d = await r.json() as Record<string, unknown>;
        if (!d?.success) return new Response('Reçu introuvable', { status: 404 });
        const G = '#FDCF34', K = '#14152A';
        const e2 = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu beauté — LASSİ</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:${K};padding:40px 32px}.logo{font-size:22px;font-weight:800;letter-spacing:-1px;margin-bottom:4px}.logo span{color:${G}}.logo-sub{font-size:11px;color:#999;margin-bottom:28px}h1{font-size:18px;font-weight:700;margin:0 0 4px}p.sub{color:#777;font-size:13px;margin:0 0 24px;line-height:1.5}.card{border:1.5px solid #e8e5de;border-radius:14px;padding:16px 18px;margin-bottom:20px}.row{display:flex;justify-content:space-between;gap:8px;padding:7px 0;border-bottom:1px solid #f0ede7;font-size:13px}.row:last-child{border-bottom:none;font-weight:700;font-size:14.5px;padding-top:10px}.lbl{color:#888;flex-shrink:0}.val{text-align:right;word-break:break-word}.code{font-family:monospace;font-size:22px;letter-spacing:4px;background:${K};color:${G};padding:10px 20px;border-radius:10px;display:block;text-align:center;font-weight:700;margin:20px 0 6px}.hint{font-size:11px;color:#999;text-align:center;margin-bottom:16px}.pbtn{display:block;width:100%;margin:10px 0;background:${G};color:${K};border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer}.footer{font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:14px;margin-top:10px}@media print{.pbtn{display:none!important}}</style></head><body><div class="logo">LASS<span>İ</span></div><div class="logo-sub">lassi.tech</div><h1>Reçu de réservation beauté</h1><p class="sub">Présente ce document au prestataire à ton rendez-vous.</p><div class="card"><div class="row"><span class="lbl">Service</span><span class="val">✂️ ${e2(d.service_nom)}</span></div><div class="row"><span class="lbl">Date</span><span class="val">${e2(d.date_label)}</span></div><div class="row"><span class="lbl">Créneau</span><span class="val">${e2(d.heure_debut)} → ${e2(d.heure_fin)}</span></div><div class="row"><span class="lbl">Client</span><span class="val">${e2(d.client_name)}</span></div><div class="row"><span class="lbl">Établissement</span><span class="val">${e2(d.prestataire_name)}</span></div><div class="row"><span class="lbl">Montant payé</span><span class="val">${e2(d.montant_label)}</span></div></div><div class="code">${e2(d.receipt_code)}</div><div class="hint">Code unique — présente-le au prestataire le jour J</div><button class="pbtn" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="footer">LASSİ • lassi.tech • Transaction sécurisée</div></body></html>`;
        return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      } else {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/create-guest-order?receipt=${encodeURIComponent(rId)}`, { headers: ah });
        if (!r.ok) return new Response('Reçu introuvable', { status: 404 });
        const buf = await r.arrayBuffer();
        return new Response(buf, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="recu-lassi.pdf"', 'Cache-Control': 'no-store' } });
      }
    } catch (_) {
      return new Response('Erreur serveur', { status: 500 });
    }
  }

  // Pages de retour après paiement Wave/OM pour réservation terrain.
  if (slug === 'paiement-terrain-succes') {
    const G = BRAND_GOLD, K = BRAND_BG;
    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paiement confirmé — LASSİ</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:' + K + ';color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#1e2040;border:1px solid #2a2d4a;border-radius:20px;padding:36px 28px;max-width:380px;width:100%;text-align:center}.icon{font-size:56px;margin-bottom:20px}.title{font-size:22px;font-weight:700;margin-bottom:12px;color:' + G + '}.body{font-size:14px;color:#aaa;line-height:1.6;margin-bottom:32px}.btn{display:block;background:' + G + ';color:' + K + ';text-decoration:none;font-weight:700;font-size:15px;padding:16px 24px;border-radius:12px;margin:0 auto}</style></head><body><div class="card"><div class="icon">✅</div><h1 class="title">Paiement confirmé !</h1><p class="body">Ta réservation terrain est confirmée. Retourne dans l\'application pour voir ton billet QR.</p><a class="btn" href="lassiapp://">Retour à l\'application LASSI</a></div></body></html>';
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (slug === 'paiement-terrain-echec') {
    const G = BRAND_GOLD, K = BRAND_BG;
    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Paiement échoué — LASSİ</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:' + K + ';color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#1e2040;border:1px solid #2a2d4a;border-radius:20px;padding:36px 28px;max-width:380px;width:100%;text-align:center}.icon{font-size:56px;margin-bottom:20px}.title{font-size:22px;font-weight:700;margin-bottom:12px;color:#ff6b6b}.body{font-size:14px;color:#aaa;line-height:1.6;margin-bottom:32px}.btn{display:block;background:' + G + ';color:' + K + ';text-decoration:none;font-weight:700;font-size:15px;padding:16px 24px;border-radius:12px;margin:0 auto}</style></head><body><div class="card"><div class="icon">❌</div><h1 class="title">Paiement annulé</h1><p class="body">Le paiement n\'a pas abouti. Retourne dans l\'application pour réessayer.</p><a class="btn" href="lassiapp://">Retour à l\'application LASSI</a></div></body></html>';
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // Carte statique proxifiée : évite l'iframe cross-origin (openstreetmap.org) qui
  // casse la WebView sur vieux Android (CA Let's Encrypt non reconnue → SSL error).
  // L'image est servie depuis s.lassi.tech (certificat déjà accepté par l'appareil).
  if (slug === 'staticmap') {
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lng = parseFloat(url.searchParams.get('lng') ?? '');
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return new Response('bad coords', { status: 400 });
    }
    // Wikimedia Maps : rendu statique OSM fiable, centré sur le point (sans clé).
    const src = `https://maps.wikimedia.org/img/osm-intl,15,${lat},${lng},640x360.png`;
    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#e9e3d8"/><g fill="none" stroke="#cfc6b6" stroke-width="2"><path d="M0 120H640M0 240H640M213 0V360M426 0V360"/></g><g transform="translate(320 168)"><path d="M0 40C-22 10-22-16 0-16 22-16 22 10 0 40Z" fill="#FF7648"/><circle cx="0" cy="4" r="7" fill="#fff"/></g></svg>`;
    try {
      const r = await fetch(src, { headers: { 'User-Agent': 'LASSI-vitrine/1.0 (https://lassi.tech)' } });
      if (!r.ok) throw new Error('map ' + r.status);
      const buf = await r.arrayBuffer();
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': r.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      });
    } catch {
      return new Response(fallbackSvg, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
      });
    }
  }

  // Page réservation terrain invité web.
  if (slug === 'terrain') {
    return new Response(renderTerrainPage(url), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // APERÇU DÉMO d'un template : s.lassi.tech/__demo?t=cosmetic
  // Rend le template choisi avec un jeu de données fictif COHÉRENT (boutique démo
  // de l'univers du template). Sert au prestataire à voir le style avant d'appliquer.
  if (slug === '__demo') {
    const t = (url.searchParams.get('t') ?? 'cosmetic').trim();
    const base = `${url.protocol}//${url.host}`;
    const demo = buildDemo(t, base);
    return new Response(
      renderHtml(demo.shop, demo.products, demo.services ?? [], [], demo.shop.slug, base, [], []),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    );
  }

  // GARDE-FOU PERMANENT : si l'URL contient ?id=<uuid>&s=ok|ko, c'est une page de
  // confirmation de paiement — on NE redirige JAMAIS vers lassi.tech dans ce cas,
  // même si vercel.json n'injecte pas ?slug=commande (protection contre toute régression config).
  const _gfId = url.searchParams.get('id') ?? '';
  const _gfS  = url.searchParams.get('s') ?? '';
  if (_gfId && (_gfS === 'ok' || _gfS === 'ko')) {
    return new Response(renderConfirmation(url), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  if (!slug) return Response.redirect('https://lassi.tech', 302);

  const shop = await fetchShop(slug);
  const bot = isCrawler(req.headers.get('user-agent') ?? '');

  // Aperçu live Site Builder : ?draft=<JSON encodé> force le THÈME (présentation
  // seule). Les données restent réelles (par slug). Un aperçu n'est jamais loggé
  // comme un vrai clic, ni mis en cache. Objet invalide => ignoré (thème réel).
  let draftConfig: Record<string, unknown> | null = null;
  const draftRaw = url.searchParams.get('draft');
  if (draftRaw) {
    try { const d = JSON.parse(draftRaw); if (d && typeof d === 'object' && !Array.isArray(d)) draftConfig = d as Record<string, unknown>; } catch { /* ignore */ }
  }
  if (draftConfig && shop) shop.site_config = draftConfig;

  const [products, services, terrains] = shop
    ? await Promise.all([fetchProducts(shop.id), fetchServices(shop.merchant_id, shop.shop_type), fetchTerrains(shop.merchant_id, shop.shop_type)])
    : [[], [], []];
  const dailySpecial = shop ? await fetchDailySpecials(shop.id) : [];
  const promos = shop ? await fetchPromos(shop.id) : [];

  if (!bot && shop && !draftConfig) {
    const p = logClic(slug, detectSource(req));
    if (ctx?.waitUntil) ctx.waitUntil(p);
  }

  const base = `${url.protocol}//${url.host}`;
  let html = renderHtml(shop, products, services, terrains as Terrain[], slug, base, dailySpecial as { id: string; name: string; price: number; photo_url?: string | null }[], promos);

  // Overrides éditeur avancé (texte/style/menu/animations) — appliqués côté client
  // par un script runtime, template-agnostique. Présents = vitrine publique aussi.
  const overrides = shop && shop.site_config && typeof shop.site_config === 'object'
    ? (shop.site_config as Record<string, unknown>).overrides : null;
  const editMode = !!draftConfig && url.searchParams.get('edit') === '1';
  const hasOv = overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0;

  if (hasOv || editMode) {
    let inject = LED_CORE;
    if (hasOv) inject += `<script>window.__ledApply(${JSON.stringify(overrides)});</script>`;
    if (editMode) {
      // Conteneurs réels : indique à l'éditeur quelles sections existent vraiment
      // pour cette boutique (ne pas proposer Prestations/Terrains si absents).
      const has = { products: products.length > 0, services: services.length > 0, terrains: terrains.length > 0 };
      inject += `<script>window.__lassiHas=${JSON.stringify(has)};</script>` + EDIT_OVERLAY;
    }
    html = html.replace('</body>', inject + '</body>');
  }

  return new Response(html, {
    status: shop ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Draft/édition jamais caché ; public avec overrides caché court (cosmétique).
      'Cache-Control': draftConfig ? 'no-store' : 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    },
  });
}

// ─── Noyau d'édition (LED_CORE) ──────────────────────────────────────────────
// Partagé par l'application des overrides (public) et l'overlay d'édition (draft).
// Attribue une clé stable (t0,t1,…) à chaque élément porteur de texte direct, dans
// l'ordre du document (déterministe car le rendu serveur est identique), et expose
// __ledLeaves / __ledApply. Base des animations (classes CSS, état final visible).
const LED_CORE = `<style id="led-core-style">
@keyframes ledFade{from{opacity:0}to{opacity:1}}
@keyframes ledUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes ledLeft{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
@keyframes ledZoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes ledRight{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@keyframes ledPop{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes ledRotate{from{opacity:0;transform:rotate(-8deg) scale(.9)}to{opacity:1;transform:none}}
@keyframes ledBlur{from{opacity:0;filter:blur(10px)}to{opacity:1;filter:blur(0)}}
@keyframes ledFlip{from{opacity:0;transform:perspective(600px) rotateX(70deg)}to{opacity:1;transform:none}}
@keyframes ledDown{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}
@keyframes ledBounce{0%{opacity:0;transform:translateY(-24px)}60%{opacity:1;transform:translateY(8px)}80%{transform:translateY(-4px)}100%{transform:translateY(0)}}
@keyframes ledPulse{0%{opacity:0;transform:scale(.9)}50%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
@keyframes ledSwing{0%{opacity:0;transform:rotate(10deg)}40%{opacity:1;transform:rotate(-7deg)}70%{transform:rotate(4deg)}100%{transform:rotate(0)}}
@keyframes ledReveal{from{opacity:0;clip-path:inset(0 100% 0 0)}to{opacity:1;clip-path:inset(0 0 0 0)}}
@keyframes ledFlipY{from{opacity:0;transform:perspective(600px) rotateY(90deg)}to{opacity:1;transform:none}}
@keyframes ledZoomOut{from{opacity:0;transform:scale(1.2)}to{opacity:1;transform:none}}
@keyframes ledWobble{0%{opacity:0;transform:translateX(-18px) rotate(-4deg)}50%{opacity:1;transform:translateX(10px) rotate(3deg)}70%{transform:translateX(-6px) rotate(-2deg)}100%{transform:none}}
@keyframes ledGlow{from{opacity:0;filter:brightness(2.4) saturate(1.6)}to{opacity:1;filter:none}}
.led-a-fade{animation:ledFade .6s ease both}
.led-a-fade-up{animation:ledUp .6s ease both}
.led-a-fade-left{animation:ledLeft .6s ease both}
.led-a-zoom{animation:ledZoom .6s ease both}
.led-a-fade-right{animation:ledRight .6s ease both}
.led-a-pop{animation:ledPop .6s cubic-bezier(.34,1.56,.64,1) both}
.led-a-rotate{animation:ledRotate .6s ease both}
.led-a-blur{animation:ledBlur .7s ease both}
.led-a-flip{animation:ledFlip .7s ease both}
.led-a-fade-down{animation:ledDown .6s ease both}
.led-a-bounce{animation:ledBounce .8s ease both}
.led-a-pulse{animation:ledPulse .7s ease both}
.led-a-swing{animation:ledSwing .8s ease both}
.led-a-reveal{animation:ledReveal .7s ease both}
.led-a-flip-y{animation:ledFlipY .7s ease both}
.led-a-zoom-out{animation:ledZoomOut .6s ease both}
.led-a-wobble{animation:ledWobble .9s ease both}
.led-a-glow{animation:ledGlow .8s ease both}
</style>
<script>(function(){
  var FONTS={cormorant:"'Cormorant Garamond',serif",playfair:"'Playfair Display',serif",lora:"Lora,serif",dmsans:"'DM Sans',sans-serif",inter:"Inter,sans-serif",poppins:"Poppins,sans-serif",montserrat:"Montserrat,sans-serif",spacegrotesk:"'Space Grotesk',sans-serif",rubik:"Rubik,sans-serif",unbounded:"Unbounded,cursive",plusjakarta:"'Plus Jakarta Sans',sans-serif",jost:"Jost,sans-serif",manrope:"Manrope,sans-serif",fraunces:"Fraunces,serif",bebas:"'Bebas Neue',sans-serif",outfit:"Outfit,sans-serif"};
  var ANIM={fade:'led-a-fade','fade-up':'led-a-fade-up','fade-left':'led-a-fade-left',zoom:'led-a-zoom','fade-right':'led-a-fade-right',pop:'led-a-pop',rotate:'led-a-rotate',blur:'led-a-blur',flip:'led-a-flip','fade-down':'led-a-fade-down',bounce:'led-a-bounce',pulse:'led-a-pulse',swing:'led-a-swing',reveal:'led-a-reveal','flip-y':'led-a-flip-y','zoom-out':'led-a-zoom-out',wobble:'led-a-wobble',glow:'led-a-glow'};
  function lum(hex){var m=/^#?([0-9a-f]{6})$/i.exec(hex||'');if(!m)return '#fff';var n=parseInt(m[1],16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;return (r*299+g*587+b*114)/1000>150?'#14152A':'#fff';}
  function leaves(){
    var out=[], w=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT,null);
    var el;
    while(el=w.nextNode()){
      var tn=el.tagName;
      if(tn==='SCRIPT'||tn==='STYLE'||tn==='NAV') continue;
      if(el.id==='lassi-ed-badge'||el.className&&(''+el.className).indexOf&&(''+el.className).indexOf('led-tag')>=0) continue;
      var has=false, cn=el.childNodes;
      for(var i=0;i<cn.length;i++){ if(cn[i].nodeType===3 && cn[i].textContent.trim()){ has=true; break; } }
      if(has) out.push(el);
    }
    return out;
  }
  window.__ledLeaves=leaves;
  window.__ledApply=function(ov){
    try{
      var L=leaves();
      L.forEach(function(el,i){ el.setAttribute('data-k','t'+i); });
      ov=ov||{};
      var tx=ov.text||{}, st=ov.style||{}, an=ov.anim||{};
      L.forEach(function(el){
        var k=el.getAttribute('data-k');
        if(tx[k]!=null){ // remplace uniquement le 1er noeud texte, garde les enfants
          var done=false, cn=el.childNodes;
          for(var i=0;i<cn.length;i++){ if(cn[i].nodeType===3 && cn[i].textContent.trim()){ cn[i].textContent=tx[k]; done=true; break; } }
          if(!done) el.textContent=tx[k];
        }
        var s=st[k];
        if(s){
          if(s.size) el.style.fontSize=s.size+'px';
          if(s.font&&FONTS[s.font]) el.style.fontFamily=FONTS[s.font];
          if(s.color){
            var isBtn=/(^|\\s)(btn|cta)/i.test(el.className||'')||el.tagName==='BUTTON'||(el.tagName==='A'&&/btn|cta/i.test(el.className||''));
            if(isBtn){ el.style.backgroundColor=s.color; el.style.borderColor=s.color; el.style.color=lum(s.color); }
            else el.style.color=s.color;
          }
        }
        // Retire TOUTE anim précédemment posée avant d'appliquer la courante
        // (sinon changer d'animation empile les classes → c'est l'ancienne qui gagne).
        for(var ak in ANIM) el.classList.remove(ANIM[ak]);
        if(an[k]&&ANIM[an[k]]){ el.classList.add(ANIM[an[k]]); }
      });
      // Menu
      var nav=document.querySelector('nav');
      if(nav){
        var links=[].slice.call(nav.querySelectorAll('a'));
        (ov.menuHidden||[]).forEach(function(n){ if(links[n]) links[n].style.display='none'; });
        var ms=ov.menuStyle;
        if(ms){ links.forEach(function(a){ if(ms.size)a.style.fontSize=ms.size+'px'; if(ms.color)a.style.color=ms.color; if(ms.font&&FONTS[ms.font])a.style.fontFamily=FONTS[ms.font]; }); }
      }
      // Icônes décoratives supprimables (.led-ic) : clé stable data-ic, masquées si listées.
      var icons=[].slice.call(document.querySelectorAll('.led-ic'));
      icons.forEach(function(el,i){ if(!el.hasAttribute('data-ic')) el.setAttribute('data-ic','i'+i); });
      var ih=ov.iconHidden||[];
      icons.forEach(function(el){ el.style.display = ih.indexOf(el.getAttribute('data-ic'))>=0 ? 'none' : ''; });
      // Tuiles catégories (conteneurs carrés image/texte) : clé stable data-c
      // (posée UNE fois, jamais réassignée → l'ordre peut changer), puis forme
      // (carré/arrondi), animation d'entrée et réordonnancement dans la grille.
      var conts=[].slice.call(document.querySelectorAll('.fn-room,.sc-type,.gd-cat-card,.cx-banner'));
      conts.forEach(function(el,i){ if(!el.hasAttribute('data-c')) el.setAttribute('data-c','c'+i); });
      var co=ov.cont||{};
      conts.forEach(function(el){
        for(var ak in ANIM) el.classList.remove(ANIM[ak]); // retire l'anim précédente
        var c=co[el.getAttribute('data-c')]; if(!c) return;
        if(c.shape==='sq') el.style.borderRadius='0';
        else if(c.shape==='rd') el.style.borderRadius='22px';
        if(c.anim&&ANIM[c.anim]) el.classList.add(ANIM[c.anim]);
      });
      // Conteneurs supprimés (masqués) : clés cN listées dans contHidden.
      var cx=ov.contHidden||[];
      conts.forEach(function(el){
        if(cx.indexOf(el.getAttribute('data-c'))>=0) el.style.display='none';
        else if(el.style.display==='none') el.style.display='';
      });
      var order=ov.contOrder;
      if(order&&order.length){
        var map={}; conts.forEach(function(el){ map[el.getAttribute('data-c')]=el; });
        order.forEach(function(k){ var el=map[k]; if(el&&el.parentNode) el.parentNode.appendChild(el); });
      }
    }catch(e){}
  };
})();</script>`;

// ─── Animations d'entrée au scroll (REVEAL) ──────────────────────────────────
// Universel, template-agnostique : on cible des rôles clés (accroche, titres,
// cartes, notes) et on les révèle en fondu+translation quand ils entrent dans le
// viewport, avec une cascade légère entre frères. Dosé : pas tout l'écran, juste
// les points focaux. Respecte prefers-reduced-motion et n'écrase jamais une
// animation manuelle (led-a-*). Sans JS : tout reste visible (état masqué posé
// par JS uniquement).
const REVEAL = `<style id="lx-reveal-style">
.lx-rv{opacity:0;transform:translateY(26px);transition:opacity .72s cubic-bezier(.22,.61,.36,1),transform .72s cubic-bezier(.22,.61,.36,1);will-change:opacity,transform}
.lx-rv.lx-z{transform:scale(.96)}
.lx-rv.lx-in{opacity:1;transform:none}
/* Boutons d'action : respiration fluide continue — tous SAUF « Ajouter » (.add). */
@keyframes lxCta{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}
.cx-btn,.cx-btn-outline,.cx-play,.fn-btn,.gd-btn,.gd-head-cta,.sc-foot-cta,.svcbtn,.bookbtn,.btn,.fm-btn,.fm-btn-outline,.fm-head-cta,.gr-btn{animation:lxCta 2.8s ease-in-out infinite;will-change:transform}
.add{animation:none!important}
@media(prefers-reduced-motion:reduce){.lx-rv{opacity:1!important;transform:none!important;transition:none!important}.cx-btn,.cx-btn-outline,.cx-play,.fn-btn,.gd-btn,.gd-head-cta,.sc-foot-cta,.svcbtn,.bookbtn,.btn,.fm-btn,.fm-btn-outline,.fm-head-cta,.gr-btn{animation:none!important}}
</style>
<script>(function(){
  try{
    if(document.body&&document.body.classList.contains('lassi-ed'))return;
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    if(!('IntersectionObserver'in window))return;
    // Points focaux présents dans tous les templates (classic + pleins). Les
    // templates pleins préfixent leurs classes (cx-/fn-/gd-/sc-) : motifs d'attribut
    // pour couvrir accroche, titres de héro et en-têtes de section quel que soit le préfixe.
    var SOFT='.shop-cat,.hero-title,.hero-desc,.hours-block,.promo-banner,.catalog-title,.sectitle,.cathead,.appnote,.foot,.about,.closed-notice,'
      +'[class*="-eyebrow"],[class*="-hero-title"],[class*="-hero-sub"],[class*="-sec-head"],[class*="-rooms-top"],[class*="-types-head"],[class*="-mat-l"],'
      +'.fm-hero-in,.fm-testi,.fm-ab-hero-txt,.fm-ab-intro,.fm-ab-split-txt,.fm-insta h2,.fm-insta-tag,'
      +'.gr-hero-in,.gr-h2,.gr-lead,.gr-news,.gr-foot-info,.gr-ill-wrap';
    var CARDS='.prod,.terrain-card,.fm-band-img,.fm-band-mid,.fm-gtile,.fm-insta-tile,.fm-ab-hero-img,.fm-ab-split-img,.gr-col,.gr-gtile';
    function tag(sel,zoom){
      [].slice.call(document.querySelectorAll(sel)).forEach(function(el){
        if(el.__lxrv)return;
        if(el.closest&&(el.closest('.cx-bento')||el.closest('.lx-fx-bento')||el.closest('.lx-fx-stagger')))return; // bento/stagger gèrent leur propre entrée
        if(/lx-fx-/.test(''+(el.className||'')))return; // élément piloté par un effet SCROLLFX dédié
        if(/led-a-/.test(''+(el.className||'')))return; // respecte l'anim manuelle
        el.__lxrv=1; el.classList.add('lx-rv'); if(zoom)el.classList.add('lx-z');
      });
    }
    tag(SOFT,false); tag(CARDS,true);
    var io=new IntersectionObserver(function(ents){
      ents.forEach(function(e){
        if(!e.isIntersecting)return;
        var el=e.target, sibs=[], p=el.parentNode;
        if(p){ for(var i=0;i<p.children.length;i++){ if(p.children[i].classList&&p.children[i].classList.contains('lx-rv'))sibs.push(p.children[i]); } }
        var idx=sibs.indexOf(el); if(idx<0)idx=0;
        el.style.transitionDelay=(Math.min(idx,6)*70)+'ms';
        el.classList.add('lx-in');
        io.unobserve(el);
      });
    },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    [].slice.call(document.querySelectorAll('.lx-rv')).forEach(function(el){io.observe(el);});
  }catch(e){}
})();</script>`;

// Script client de la réservation de table (template grill) — autonome, lit #gr-resa-cfg.
// Appelle l'EF create-guest-table-reservation (créneaux → acompte Wave/OM → polling).
const GR_RESA_JS = `(function(){
  var cfgEl=document.getElementById('gr-resa-cfg'); if(!cfgEl) return;
  var CFG; try{CFG=JSON.parse(cfgEl.textContent);}catch(e){return;}
  var EP=CFG.url+'/functions/v1/create-guest-table-reservation';
  var H={apikey:CFG.key,Authorization:'Bearer '+CFG.key};
  var $=function(id){return document.getElementById(id);};
  var MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var JOURS=["lun","mar","mer","jeu","ven","sam","dim"];
  var st={date:null,slot:null,moyen:null,piId:null,poll:null,weekdays:null,calY:0,calM:0};

  // Nombre de personnes
  var nb=$('grNb'); for(var i=1;i<=12;i++){var o=document.createElement('option');o.value=i;o.textContent=i+(i>1?" personnes":" personne");nb.appendChild(o);} nb.value=2;

  var DEMO = CFG.slug==='__demo';
  // Jours ouverts (calendrier) — chargé une fois
  if(DEMO){ st.weekdays=[0,1,2,3,4,5,6]; }
  else fetch(EP+'?slug='+encodeURIComponent(CFG.slug)+'&weekdays=1',{headers:H})
    .then(function(r){return r.json();}).then(function(j){
      if(j && j.success){ st.weekdays = j.reservation_enabled===false ? [] : (j.available_weekdays||[]); }
      else st.weekdays=[];
    }).catch(function(){st.weekdays=[];});

  var now=new Date(); st.calY=now.getFullYear(); st.calM=now.getMonth();
  function iso(y,m,day){return y+"-"+String(m+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");}

  function closePops(){ $('grCal').hidden=true; $('grHours').hidden=true; }
  document.addEventListener('click',function(e){ if(!e.target.closest('.gr-resa-field')) closePops(); });

  // ── Calendrier ──
  $('grDateBtn').addEventListener('click',function(e){e.stopPropagation(); var c=$('grCal'); var show=c.hidden; closePops(); if(show){renderCal(); c.hidden=false;}});
  function renderCal(){
    var c=$('grCal'); var first=new Date(st.calY,st.calM,1); var start=(first.getDay()+6)%7; // lundi=0
    var days=new Date(st.calY,st.calM+1,0).getDate();
    var t=new Date(); t.setHours(0,0,0,0);
    var html='<div class="gr-cal-head"><button type="button" class="gr-cal-nav" data-nav="-1">‹</button><span>'+MOIS[st.calM]+' '+st.calY+'</span><button type="button" class="gr-cal-nav" data-nav="1">›</button></div>';
    html+='<div class="gr-cal-grid">'; JOURS.forEach(function(j){html+='<span class="gr-cal-dow">'+j+'</span>';});
    for(var k=0;k<start;k++) html+='<span></span>';
    for(var dnum=1;dnum<=days;dnum++){
      var dt=new Date(st.calY,st.calM,dnum); dt.setHours(0,0,0,0);
      var dow=dt.getDay(); // 0=dim..6=sam (comme EXTRACT DOW serveur)
      var futur = dt.getTime()>=t.getTime();
      var ok = futur && st.weekdays && st.weekdays.indexOf(dow)>=0;
      var cls = ok ? "gr-cal-d on-ok" : "gr-cal-d on-no";
      html+='<button type="button" class="'+cls+'" '+(ok?('data-d="'+iso(st.calY,st.calM,dnum)+'"'):'disabled')+'>'+dnum+'</button>';
    }
    html+='</div>'; c.innerHTML=html;
    [].forEach.call(c.querySelectorAll('.gr-cal-nav'),function(b){b.addEventListener('click',function(e){e.stopPropagation(); st.calM+=parseInt(b.getAttribute('data-nav'),10); if(st.calM<0){st.calM=11;st.calY--;} if(st.calM>11){st.calM=0;st.calY++;} renderCal();});});
    [].forEach.call(c.querySelectorAll('.gr-cal-d.on-ok'),function(b){b.addEventListener('click',function(e){e.stopPropagation(); selectDate(b.getAttribute('data-d'));});});
  }
  function fmtDate(s){var p=s.split("-");return p[2]+"/"+p[1]+"/"+p[0];}
  function selectDate(dstr){
    st.date=dstr; st.slot=null; $('grDateLbl').textContent=fmtDate(dstr); closePops();
    var gw=$('grGridWrap'); if(gw) gw.hidden=false;
    loadHours();
  }

  // ── Heures (grille vert libre / rouge pris) ──
  function renderSlots(box,s){
    box.innerHTML='';
    s.forEach(function(x){
      var b=document.createElement('button'); b.type='button';
      b.className='gr-hour '+(x.available?'on-ok':'on-no'); b.textContent=x.heure_debut;
      if(x.available){ b.addEventListener('click',function(e){e.stopPropagation(); st.slot=x; [].forEach.call(box.querySelectorAll('.gr-hour'),function(y){y.classList.remove('sel');}); b.classList.add('sel'); var hs=$('grHourSel'); if(hs){var sp=hs.querySelector('span'); if(sp)sp.textContent=x.heure_debut; else hs.textContent=x.heure_debut;} }); }
      else { b.disabled=true; }
      box.appendChild(b);
    });
  }
  function loadHours(){
    var box=$('grHours');
    if(DEMO){
      var times=["09:30","09:45","10:00","10:15","10:30","10:45","11:00","11:15","11:30","11:45","12:00","12:15","12:30","12:45","13:00"];
      renderSlots(box, times.map(function(t,i){return {heure_debut:t,slot_id:null,available:i>=7};}));
      return;
    }
    box.innerHTML='<span class="gr-resa-hint">Chargement…</span>';
    fetch(EP+'?slug='+encodeURIComponent(CFG.slug)+'&date='+encodeURIComponent(st.date),{headers:H})
      .then(function(r){return r.json();}).then(function(j){
        if(j.reservation_enabled===false){box.innerHTML='<span class="gr-resa-hint">Réservation non disponible.</span>';return;}
        if(j.closed){box.innerHTML='<span class="gr-resa-hint">Fermé ce jour.</span>';return;}
        var s=j.slots||[]; if(!s.length){box.innerHTML='<span class="gr-resa-hint">Aucun créneau ce jour.</span>';return;}
        box.innerHTML='';
        s.forEach(function(x){
          var b=document.createElement('button'); b.type='button';
          b.className='gr-hour '+(x.available?'on-ok':'on-no'); b.textContent=x.heure_debut;
          if(x.available){ b.addEventListener('click',function(e){e.stopPropagation(); st.slot=x; [].forEach.call(box.querySelectorAll('.gr-hour'),function(y){y.classList.remove('sel');}); b.classList.add('sel'); var hs=$('grHourSel'); if(hs)hs.textContent=x.heure_debut; }); }
          else { b.disabled=true; }
          box.appendChild(b);
        });
      }).catch(function(){box.innerHTML='<span class="gr-resa-hint">Erreur de chargement.</span>';});
  }

  // ── Modale finale (nom/tél/paiement) ──
  var ov=$('grResaOv');
  function openModal(){ov.hidden=false;document.body.style.overflow="hidden";}
  function closeModal(){ov.hidden=true;document.body.style.overflow="";if(st.poll){clearInterval(st.poll);st.poll=null;}}
  $('grResaX').addEventListener('click',closeModal);
  ov.addEventListener('click',function(e){if(e.target===ov)closeModal();});
  var c2=$('grClose2'); if(c2)c2.addEventListener('click',closeModal);
  document.querySelectorAll('.gr-resa-pay').forEach(function(b){b.addEventListener('click',function(){st.moyen=b.getAttribute('data-m');document.querySelectorAll('.gr-resa-pay').forEach(function(x){x.classList.remove('on');});b.classList.add('on');});});

  $('grFind').addEventListener('click',function(){
    var m=$('grBarMsg'); m.textContent="";
    if(st.weekdays && st.weekdays.length===0){ m.textContent="La réservation n'est pas encore disponible pour ce restaurant."; return; }
    if(!st.date){ m.textContent="Choisissez une date."; return; }
    if(!st.slot){ m.textContent="Choisissez une heure."; return; }
    $('grRecap').innerHTML='<b>'+nb.options[nb.selectedIndex].text+'</b> · <b>'+fmtDate(st.date)+'</b> · <b>'+st.slot.heure_debut+'</b>';
    $('grResaStep1').hidden=false; $('grResaStep2').hidden=true; $('grResaDone').hidden=true;
    openModal();
  });

  function digitsOk(p){return /^7[015678][0-9]{7}$/.test(p.replace(/[^0-9]/g,'').replace(/^221/,''));}
  $('grSubmit').addEventListener('click',function(){
    var msg=$('grMsg'); msg.textContent='';
    var name=$('grName').value.trim(); if(name.length<2){msg.textContent="Entrez votre nom.";return;}
    var phone=$('grPhone').value; if(!digitsOk(phone)){msg.textContent="Numéro invalide (77 xxx xx xx).";return;}
    if(!st.moyen){msg.textContent="Choisissez un moyen de paiement.";return;}
    var btn=this; btn.disabled=true; btn.textContent="Création…";
    fetch(EP,{method:'POST',headers:Object.assign({'Content-Type':'application/json'},H),body:JSON.stringify({slug:CFG.slug,date:st.date,timeSlotId:st.slot.slot_id||null,heureDebut:st.slot.heure_debut,nbPersonnes:parseInt(nb.value,10),name:name,phone:phone,moyenPaiement:st.moyen,idempotencyKey:'web-'+Date.now()})})
      .then(function(r){return r.json();})
      .then(function(j){
        btn.disabled=false; btn.textContent="Payer l'acompte · 2100 F";
        if(!j.success){msg.textContent=j.error||"Erreur. Réessayez.";return;}
        st.piId=j.piId;
        $('grResaStep1').hidden=true; $('grResaStep2').hidden=false;
        if(j.qrCode){var q=$('grQr');q.src=j.qrCode;q.hidden=false;}
        if(j.redirectUrl){ try{window.open(j.redirectUrl,'_blank');}catch(e){} }
        if(j.mode==='simulation'){showDone();return;}
        startPoll();
      }).catch(function(){btn.disabled=false;btn.textContent="Payer l'acompte · 2100 F";msg.textContent="Erreur réseau.";});
  });
  function startPoll(){ if(st.poll)clearInterval(st.poll); st.poll=setInterval(check,3500); }
  function check(){ if(!st.piId)return; fetch(EP+'?status='+encodeURIComponent(st.piId),{headers:H}).then(function(r){return r.json();}).then(function(j){if(j.paid)showDone();}).catch(function(){}); }
  var chk=$('grCheck'); if(chk)chk.addEventListener('click',check);
  function showDone(){ if(st.poll){clearInterval(st.poll);st.poll=null;} $('grResaStep2').hidden=true; $('grResaStep1').hidden=true; $('grResaDone').hidden=false; }
  if(DEMO){ var gw0=$('grGridWrap'); if(gw0){ var dl=$('grDateLbl'); if(dl)dl.textContent="18/11/2026"; gw0.hidden=false; loadHours(); } }
})();`;

// ─── Moteur d'animations conteneur réutilisable (SCROLLFX) ───────────────────
// Bibliothèque générique pilotée par classes/attributs, injectée une fois pour
// TOUS les templates. Chaque template active l'effet voulu en posant la classe :
//   .lx-fx-bento / .lx-fx-piece      → Bento Grid Magnetic Assembly
//   .lx-fx-beam (contient rect.lx-fx-beam-rect) → Border Beam / Perimeter Trace
//   [data-pll="0.12"]                → Parallax (dérive translateY)
//   .lx-fx-curtain                   → Clip-path Curtain Reveal
//   .lx-fx-zoom                      → Zoom Apple (scale .88→1 + radius)
//   .lx-fx-count[data-target][data-suffix] → Counter-Up
// Respecte prefers-reduced-motion et le mode édition.
const SCROLLFX = `<style id="lx-fx-style">
.lx-fx-piece{opacity:0;transform:translate3d(var(--tx,0),var(--ty,0),0) rotate(var(--rot,0)) scale(.92);transition:transform .95s cubic-bezier(.16,1,.3,1),opacity .75s ease;transition-delay:calc(var(--bd,0)*80ms);will-change:transform,opacity}
.lx-fx-bento.lx-in .lx-fx-piece{opacity:1;transform:none}
.lx-fx-beam{position:relative}
.lx-fx-beam>.lx-fx-beam-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;overflow:visible}
.lx-fx-beam-rect{fill:none;stroke-width:3;stroke-linecap:round;width:calc(100% - 3px);height:calc(100% - 3px);will-change:stroke-dashoffset}
[data-pll]{will-change:transform}
.lx-fx-zoom{will-change:transform,border-radius;transform:scale(.66);border-radius:30px;overflow:hidden;transition:transform 1.05s cubic-bezier(.16,1,.3,1),border-radius 1.05s cubic-bezier(.16,1,.3,1)}
.lx-fx-zoom.lx-in{transform:none;border-radius:16px}
.lx-fx-zin{display:inline-block;transform:scale(.6);opacity:0;transition:transform .9s cubic-bezier(.16,1,.3,1),opacity .55s ease}
.lx-fx-zin.lx-in{transform:none;opacity:1}
.lx-fx-curtain{clip-path:inset(14% 14% 14% 14% round 26px);will-change:clip-path}
.lx-fx-expand{width:72%;margin-left:auto;margin-right:auto;border-radius:32px;overflow:hidden;will-change:width,border-radius}
.lx-fx-mask-l{display:block;overflow:hidden}
.lx-fx-mask-l>span{display:block;transform:translateY(115%);transition:transform .9s cubic-bezier(.16,1,.3,1);will-change:transform}
.lx-fx-mask.lx-in .lx-fx-mask-l>span{transform:none}
.lx-fx-draw{will-change:stroke-dashoffset}
.lx-fx-hl{background-image:linear-gradient(90deg,var(--hl-on,#141414) var(--p,0%),var(--hl-off,rgba(20,20,20,.22)) var(--p,0%));-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;will-change:background-image}
.lx-fx-sitem{opacity:0;transform:translateY(38px) scale(.95);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);will-change:opacity,transform}
.lx-fx-stagger.lx-in .lx-fx-sitem{opacity:1;transform:none}
.lx-fx-kb{background-size:112%!important;animation:lxKen 22s ease-in-out infinite alternate}
@keyframes lxKen{from{background-size:112%;background-position:50% 50%}to{background-size:130%;background-position:52% 47%}}
@media(prefers-reduced-motion:reduce){.lx-fx-piece{opacity:1!important;transform:none!important}.lx-fx-beam-rect{display:none}.lx-fx-zoom{transform:none!important}.lx-fx-curtain{clip-path:none!important}[data-pll]{transform:none!important}.lx-fx-mask-l>span{transform:none!important}.lx-fx-sitem{opacity:1!important;transform:none!important}.lx-fx-hl{background:none!important;color:var(--hl-on,#141414)!important;-webkit-text-fill-color:var(--hl-on,#141414)!important}.lx-fx-kb{animation:none!important;background-size:cover!important}}
</style>
<script>(function(){
  try{
    if(document.body&&document.body.classList.contains('lassi-ed'))return;
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
    var clamp=function(v,a,b){return v<a?a:v>b?b:v;};
    // Bento magnétique
    if('IntersectionObserver'in window){
      var dirs=[[-70,0,-3],[0,-65,4],[70,0,3.5],[0,65,-4],[55,45,2.5],[-55,45,-2.5],[45,-55,3],[-45,-55,-3]];
      [].slice.call(document.querySelectorAll('.lx-fx-bento')).forEach(function(b){
        [].slice.call(b.querySelectorAll('.lx-fx-piece')).forEach(function(p,i){var d=dirs[i%dirs.length];p.style.setProperty('--tx',d[0]+'px');p.style.setProperty('--ty',d[1]+'px');p.style.setProperty('--rot',d[2]+'deg');p.style.setProperty('--bd',i);});
      });
      var ioF=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lx-in');ioF.unobserve(e.target);}});},{threshold:.18});
      [].slice.call(document.querySelectorAll('.lx-fx-bento')).forEach(function(b){ioF.observe(b);});
      // Counter-up
      function cnt(el){var tg=parseFloat(el.getAttribute('data-target'))||0,sf=el.getAttribute('data-suffix')||'',st=null;function s(ts){if(st===null)st=ts;var p=Math.min((ts-st)/1400,1),e=1-Math.pow(1-p,3);el.textContent=Math.round(tg*e)+sf;if(p<1)requestAnimationFrame(s);}requestAnimationFrame(s);}
      var ioC=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){cnt(e.target);ioC.unobserve(e.target);}});},{threshold:.4});
      [].slice.call(document.querySelectorAll('.lx-fx-count')).forEach(function(el){ioC.observe(el);});
      // Zoom-in d'entrée (one-shot) : scale .66 -> 1
      var ioZ=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lx-in');ioZ.unobserve(e.target);}});},{threshold:.15});
      [].slice.call(document.querySelectorAll('.lx-fx-zoom,.lx-fx-zin,.lx-fx-mask')).forEach(function(el){ioZ.observe(el);});
      // Staggered reveal (cascade)
      [].slice.call(document.querySelectorAll('.lx-fx-stagger')).forEach(function(c){
        [].slice.call(c.querySelectorAll('.prod,.cathead,.ds-card,.sectitle')).forEach(function(el,i){el.classList.add('lx-fx-sitem');el.style.transitionDelay=(i*80)+'ms';});
      });
      var ioS=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('lx-in');ioS.unobserve(e.target);}});},{threshold:.12});
      [].slice.call(document.querySelectorAll('.lx-fx-stagger')).forEach(function(c){ioS.observe(c);});
    }
    // Border beam (périmètre)
    var beams=[].slice.call(document.querySelectorAll('.lx-fx-beam')).map(function(w){return {w:w,r:w.querySelector('.lx-fx-beam-rect'),len:0};});
    function meas(){beams.forEach(function(it){if(!it.r)return;var bx=it.w.getBoundingClientRect(),ww=Math.max(0,bx.width-3),hh=Math.max(0,bx.height-3),rr=16,per=2*(ww+hh-4*rr)+2*Math.PI*rr;it.len=per;it.r.style.strokeDasharray=per;it.r.style.strokeDashoffset=per;});}
    meas();window.addEventListener('resize',meas,{passive:true});
    // Parallax + zoom + curtain + beam : boucle scroll unique
    var plls=[].slice.call(document.querySelectorAll('[data-pll]'));
    var curts=[].slice.call(document.querySelectorAll('.lx-fx-curtain'));
    var exps=[].slice.call(document.querySelectorAll('.lx-fx-expand'));
    var draws=[].slice.call(document.querySelectorAll('.lx-fx-draw')).map(function(p){var L=0;try{L=p.getTotalLength();}catch(e){}p.style.strokeDasharray=L;p.style.strokeDashoffset=L;return {p:p,len:L};});
    var hls=[].slice.call(document.querySelectorAll('.lx-fx-hl'));
    var ticking=false;
    function frame(){
      ticking=false;var vh=window.innerHeight;
      draws.forEach(function(it){if(it.len<=0)return;var r=it.p.getBoundingClientRect(),s=vh*0.9,en=vh*0.3,pr=clamp((s-r.top)/(s-en),0,1);it.p.style.strokeDashoffset=(it.len*(1-pr)).toFixed(1);});
      hls.forEach(function(el){var r=el.getBoundingClientRect(),s=vh*0.82,en=vh*0.4,pr=clamp((s-r.top)/(s-en),0,1);el.style.setProperty('--p',(pr*100).toFixed(1)+'%');});
      plls.forEach(function(el){var r=el.getBoundingClientRect();if(r.bottom>0&&r.top<vh){var sp=parseFloat(el.getAttribute('data-pll'))||0.1;var p=(r.top+r.height/2-vh/2);el.style.transform='translateY('+(p*-sp).toFixed(1)+'px)';}});
      curts.forEach(function(el){var r=el.getBoundingClientRect();var s=vh*0.92,en=vh*0.22,p=clamp((s-r.top)/(s-en),0,1);var iv=(14*(1-p)).toFixed(1),rd=(26-20*p).toFixed(0);el.style.clipPath='inset('+iv+'% '+iv+'% '+iv+'% '+iv+'% round '+rd+'px)';});
      beams.forEach(function(it){if(!it.r||it.len<=0)return;var r=it.w.getBoundingClientRect(),s=vh*0.9,en=vh*0.25,p=clamp((s-r.top)/(s-en),0,1);it.r.style.strokeDashoffset=(it.len*(1-p)).toFixed(1);});
      exps.forEach(function(el){var r=el.getBoundingClientRect();var s=vh*0.92,en=vh*0.22,p=clamp((s-r.top)/(s-en),0,1);el.style.width=(72+28*p).toFixed(2)+'%';el.style.borderRadius=(32*(1-p)).toFixed(1)+'px';});
    }
    function onS(){if(!ticking){ticking=true;requestAnimationFrame(frame);}}
    if(plls.length||curts.length||beams.length||exps.length||draws.length||hls.length){window.addEventListener('scroll',onS,{passive:true});window.addEventListener('resize',onS,{passive:true});frame();}
  }catch(e){}
})();</script>`;

// ─── Overlay mode édition ────────────────────────────────────────────────────
// Injecté après LED_CORE en contexte éditeur (draft + edit=1). Surligne les blocs,
// rend le texte éditable inline, et poste la sélection/les éditions à l'app RN.
const EDIT_OVERLAY = `<style id="lassi-edit-style">
.lassi-ed section,.lassi-ed nav{outline:1.5px dashed rgba(61,139,253,.4);outline-offset:-2px}
.lassi-ed [data-k]{cursor:text}
.lassi-ed [data-k].led-sel{outline:2px solid #3D8BFD;outline-offset:2px;border-radius:3px}
.lassi-ed nav.led-sel{outline:2.5px solid #3D8BFD;outline-offset:-2px}
.lassi-ed .led-ic{cursor:pointer}
.lassi-ed .led-ic.led-sel{outline:2px solid #3D8BFD;outline-offset:3px;border-radius:4px}
.lassi-ed.lassi-preview section,.lassi-ed.lassi-preview nav{outline:none!important}
.lassi-ed.lassi-preview [data-k].led-sel{outline:none!important}
</style>
<script>(function(){
  var doc=document, body=doc.body; body.classList.add('lassi-ed');
  // Dézoom ~50% en mode édition : le prestataire voit une grande partie du site
  // d'un coup. On double la largeur du viewport → tout le rendu passe à moitié taille.
  // getBoundingClientRect/scrollTo restent cohérents (même repère CSS).
  try{
    var mv=doc.querySelector('meta[name="viewport"]');
    if(!mv){ mv=doc.createElement('meta'); mv.setAttribute('name','viewport'); (doc.head||doc.documentElement).appendChild(mv); }
    mv.setAttribute('content','width='+Math.round((window.innerWidth||375)/0.75)+', user-scalable=no');
  }catch(e){}
  function post(m){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}}
  // S'assure que les clés existent même sans overrides (applique un objet vide).
  if(window.__ledApply) window.__ledApply({});
  var leaves=(window.__ledLeaves?window.__ledLeaves():[]);
  var sel=null, selC=null;
  // Amène l'élément sélectionné tout en haut de la zone d'aperçu visible (sous
  // l'en-tête fixe), là où le prestataire voit ce qu'il écrit en temps réel.
  function scrollSel(smooth,target){
    var t=target||sel;
    if(!t) return;
    try{
      var r=t.getBoundingClientRect();
      // Marge = hauteur de l'en-tête collé (sticky/fixed). C'est le <header> qui est
      // sticky (il CONTIENT le <nav>), pas le <nav> lui-même → on mesure le header,
      // sinon l'élément édité se retrouve CACHÉ derrière la barre collée en haut.
      var stickyH=0;
      [doc.querySelector('header'), doc.querySelector('nav')].forEach(function(el){
        if(!el) return;
        var s=getComputedStyle(el);
        if(s.position==='fixed'||s.position==='sticky'){ var h=el.getBoundingClientRect().height; if(h>stickyH) stickyH=h; }
      });
      var margin=stickyH+20;
      var top=r.top+window.scrollY-margin;
      window.scrollTo({top:top<0?0:top, behavior:smooth?'smooth':'auto'});
    }catch(e){}
  }
  function selectLeaf(el){
    if(sel) sel.classList.remove('led-sel');
    if(selC){ selC.classList.remove('led-sel'); selC=null; }
    sel=el; el.classList.add('led-sel');
    var cs=getComputedStyle(el), r=el.getBoundingClientRect();
    post({type:'led:text', key:el.getAttribute('data-k'),
      text:(el.textContent||'').trim().slice(0,200),
      size:Math.round(parseFloat(cs.fontSize)||16),
      color:rgbHex(cs.color), y:Math.round(r.top+window.scrollY)});
    scrollSel(true);
  }
  function rgbHex(c){var m=/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c||'');if(!m)return '';function h(n){n=(+n).toString(16);return n.length<2?'0'+n:n;}return '#'+h(m[1])+h(m[2])+h(m[3]);}
  // Appelé par l'app RN (focus champ / ouverture clavier) : repositionne l'élément
  // édité en haut de l'aperçu visible. Le clavier change innerHeight → on re-scrolle.
  window.__ledScrollTo=function(key){
    try{ var el=doc.querySelector('[data-k="'+key+'"]'); if(el){ sel=el; scrollSel(true); } }catch(e){}
  };
  // Clavier ouvert/fermé (resize du viewport) → garder l'élément édité visible.
  window.addEventListener('resize',function(){ scrollSel(false); setTimeout(function(){scrollSel(false);},120); });
  // Texte éditable inline : édition directe dans la page, commit au blur.
  leaves.forEach(function(el){
    el.setAttribute('contenteditable','true'); el.style.outlineColor='transparent';
    var isBtn=el.tagName==='BUTTON'||el.tagName==='A';
    if(isBtn){
      // Boutons/liens : empêche la navigation en mode édition, rend sélectionnable.
      el.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); selectLeaf(el); el.focus(); },true);
    }
    el.addEventListener('focus',function(){ selectLeaf(el); });
    el.addEventListener('input',function(){
      post({type:'led:textChange', key:el.getAttribute('data-k'), text:(el.textContent||'').slice(0,200)});
    });
  });
  // Sélection du menu.
  var nav=doc.querySelector('nav');
  if(nav){
    nav.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      if(sel) sel.classList.remove('led-sel'); sel=nav; nav.classList.add('led-sel');
      var links=[].slice.call(nav.querySelectorAll('a')).map(function(a,i){return {i:i,label:(a.textContent||'').trim().slice(0,30)};});
      post({type:'led:menu', items:links});
    },true);
  }
  // Tuiles catégories (conteneurs carrés image/texte) : sélectionnables pour
  // réordonner (flèches côté app), changer la forme (carré/arrondi) et animer.
  var conts=[].slice.call(doc.querySelectorAll('.fn-room,.sc-type,.gd-cat-card,.cx-banner'));
  conts.forEach(function(el,i){
    if(!el.hasAttribute('data-c')) el.setAttribute('data-c','c'+i);
    el.setAttribute('contenteditable','false');
    el.style.cursor='pointer';
    // Le conteneur est UNE unité tappable : on neutralise l'édition de texte des
    // enfants (sinon le tap place le curseur dans le texte → onglet Texte au lieu
    // de Conteneur). contenteditable OFF partout dedans → le clic remonte au
    // conteneur et ouvre l'onglet Conteneur de façon fiable (ne bloque pas le scroll).
    [].slice.call(el.querySelectorAll('[contenteditable]')).forEach(function(c){ c.setAttribute('contenteditable','false'); c.style.cursor='pointer'; });
    el.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); selectCont(el); },true);
  });
  function selectCont(el){
    if(sel){ sel.classList.remove('led-sel'); sel=null; }
    if(selC) selC.classList.remove('led-sel');
    selC=el; el.classList.add('led-sel');
    var sibs=[].slice.call(el.parentNode.children).filter(function(x){return x.hasAttribute&&x.hasAttribute('data-c');});
    var gtc=getComputedStyle(el.parentNode).gridTemplateColumns;
    var cols=(gtc&&gtc!=='none')?gtc.split(' ').length:1;
    post({type:'led:container', key:el.getAttribute('data-c'),
      index:sibs.indexOf(el), count:sibs.length, cols:cols,
      order:sibs.map(function(s){return s.getAttribute('data-c');})});
    scrollSel(true, el);
  }
  // Icônes décoratives supprimables (.led-ic) : sélectionnables pour suppression.
  var edIcons=[].slice.call(doc.querySelectorAll('.led-ic'));
  edIcons.forEach(function(el,i){
    if(!el.hasAttribute('data-ic')) el.setAttribute('data-ic','i'+i);
    el.style.cursor='pointer'; el.setAttribute('contenteditable','false');
    el.addEventListener('click',function(e){ e.preventDefault(); e.stopPropagation(); selectIcon(el); },true);
  });
  function selectIcon(el){
    if(sel){ sel.classList.remove('led-sel'); sel=null; }
    if(selC){ selC.classList.remove('led-sel'); selC=null; }
    el.classList.add('led-sel');
    post({type:'led:icon', key:el.getAttribute('data-ic')});
    scrollSel(true, el);
  }
  post({type:'led:ready', has:(window.__lassiHas||null)});
})();</script>`;

// Génère le sitemap XML de toutes les vitrines publiables (slug + has_content).
// Pagination REST (1000 lignes/req) pour couvrir tout le parc boutiques.
async function renderSitemap(url: URL): Promise<string> {
  const base = `${url.protocol}//${url.host}`;
  const slugs: string[] = [];
  try {
    const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Range: '0-4999' };
    const q =
      `${SUPABASE_URL}/rest/v1/shops?has_content=eq.true&slug=not.is.null` +
      `&select=slug&order=slug.asc`;
    const res = await fetch(q, { headers: H });
    if (res.ok) {
      const rows = (await res.json()) as { slug: string | null }[];
      for (const r of rows ?? []) {
        const s = (r.slug ?? '').trim();
        if (s) slugs.push(s);
      }
    }
  } catch { /* sitemap vide tolérable */ }

  const urls = slugs.map(s =>
    `  <url><loc>${escXml(base + '/' + encodeURIComponent(s))}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls + (urls ? '\n' : '') +
    `</urlset>\n`;
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function fetchShop(slug: string): Promise<Shop | null> {
  try {
    const q =
      `${SUPABASE_URL}/rest/v1/shops?slug=eq.${encodeURIComponent(slug)}` +
      `&select=id,name,logo_url,description,zone,category,subcategories,slug,shop_type,merchant_id,opening_hours,is_manually_closed,site_config,gallery_urls,cover_url,phone,latitude,longitude&limit=1`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Shop[];
    return rows[0] ?? null;
  } catch { return null; }
}

async function fetchProducts(shopId: string): Promise<Product[]> {
  const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const base = `${SUPABASE_URL}/rest/v1/products?shop_id=eq.${encodeURIComponent(shopId)}&stock=eq.in&order=created_at.asc&limit=48`;
  // `images` est une colonne récente : si la migration n'est pas encore appliquée en prod,
  // PostgREST renvoie 400 (42703). On retombe alors sur le select sans `images` pour ne
  // JAMAIS vider la vitrine (fallback [photo_url] géré par productImages()).
  const SELECT_FULL = '&select=id,name,description,emoji,photo_url,price,category,images,sizes,colors,stock_quantity';
  const SELECT_LEGACY = '&select=id,name,description,emoji,photo_url,price,category,sizes,colors,stock_quantity';
  try {
    let res = await fetch(base + SELECT_FULL, { headers: H });
    if (!res.ok) res = await fetch(base + SELECT_LEGACY, { headers: H });
    if (!res.ok) return [];
    const rows = (await res.json()) as Product[];
    return (rows ?? []).filter(p => (p.name ?? '').trim().length > 0 && Number(p.price) > 0);
  } catch { return []; }
}

// Prestations/services d'un prestataire — beauté (réservable) + fitness (abonnements).
// Clés = shops.merchant_id = prestataire_id. RLS lecture publique (actif=true).
// IMPORTANT : beauty_services / fitness_abonnement_offres n'ont PAS de shop_id,
// seulement prestataire_id. Un prestataire multi-boutiques verrait donc les mêmes
// services sur CHAQUE vitrine. On scope par le type de la boutique courante :
//   - 'services'     (beauté) → beauty_services uniquement
//   - 'memberships'  (sport)  → fitness_abonnement_offres uniquement
//   - 'products' / autre      → aucun service (boutique produits)
async function fetchServices(merchantId: string | null, shopType: string | null): Promise<ServiceItem[]> {
  if (!merchantId) return [];
  const wantBeauty = shopType === 'services';
  const wantFitness = shopType === 'memberships';
  if (!wantBeauty && !wantFitness) return [];
  const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const mid = encodeURIComponent(merchantId);
  const out: ServiceItem[] = [];
  const [beauty, fitness] = await Promise.all([
    wantBeauty
      ? fetch(`${SUPABASE_URL}/rest/v1/beauty_services?prestataire_id=eq.${mid}&actif=eq.true&order=created_at.asc&limit=48&select=id,nom,description,prix,duree_minutes,categorie,image_url`, { headers: H })
          .then(r => r.ok ? r.json() : []).catch(() => [])
      : Promise.resolve([]),
    wantFitness
      ? fetch(`${SUPABASE_URL}/rest/v1/fitness_abonnement_offres?prestataire_id=eq.${mid}&actif=eq.true&order=prix.asc&limit=48&select=id,nom,description,prix,duree_jours,categorie_tab`, { headers: H })
          .then(r => r.ok ? r.json() : []).catch(() => [])
      : Promise.resolve([]),
  ]) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];

  for (const r of beauty ?? []) {
    const price = Math.round(Number(r.prix));
    const nom = String(r.nom ?? '').trim();
    if (!nom || !(price > 0)) continue;
    const dm = Number(r.duree_minutes);
    out.push({
      id: String(r.id), name: nom, description: (r.description as string) ?? null, price,
      category: String(r.categorie ?? 'Prestations') || 'Prestations',
      meta: dm > 0 ? `${Math.round(dm)} min · réservable` : 'Réservable', kind: 'beauty',
      image_url: (r.image_url as string) || null,
    });
  }
  for (const r of fitness ?? []) {
    const price = Math.round(Number(r.prix));
    const nom = String(r.nom ?? '').trim();
    if (!nom || !(price > 0)) continue;
    const dj = Number(r.duree_jours);
    const catTab = String(r.categorie_tab ?? '').toLowerCase();
    const category = catTab === 'abonnements' ? 'Abonnements' : 'Formules';
    out.push({
      id: String(r.id), name: nom, description: (r.description as string) ?? null, price,
      category, meta: dj > 0 ? `${Math.round(dj)} jours` : category === 'Abonnements' ? 'Abonnement' : 'Formule', kind: 'fitness',
    });
  }
  return out;
}

async function fetchTerrains(merchantId: string | null, shopType: string | null): Promise<Terrain[]> {
  if (!merchantId) return [];
  // Les terrains n'ont que prestataire_id : réservés aux boutiques sport (memberships).
  if (shopType !== 'memberships') return [];
  try {
    const q = `${SUPABASE_URL}/rest/v1/terrains?prestataire_id=eq.${encodeURIComponent(merchantId)}&actif=eq.true&order=created_at.asc&limit=20&select=id,nom,description,prix_horaire,sport_type,adresse,images`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return [];
    return (await res.json()) as Terrain[];
  } catch { return []; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPromos(shopId: string): Promise<any[]> {
  try {
    const now = new Date().toISOString();
    const q = SUPABASE_URL + '/rest/v1/promotions?shop_id=eq.' + encodeURIComponent(shopId) + '&actif=eq.true&or=(date_fin.is.null,date_fin.gte.' + encodeURIComponent(now) + ')&select=id,titre,type,valeur,montant_min&limit=10';
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
    if (!res.ok) return [];
    return (await res.json()) ?? [];
  } catch { return []; }
}

async function fetchDailySpecials(shopId: string): Promise<{ id: string; name: string; price: number; photo_url?: string | null }[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = `${SUPABASE_URL}/rest/v1/daily_specials?shop_id=eq.${encodeURIComponent(shopId)}&date=eq.${today}&select=id,name,price,photo_url&limit=20`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return [];
    return await res.json() as { id: string; name: string; price: number; photo_url?: string | null }[];
  } catch { return []; }
}

function groupServices(items: ServiceItem[]): { title: string; items: ServiceItem[] }[] {
  const order: string[] = [];
  const map: Record<string, ServiceItem[]> = {};
  for (const s of items) {
    const key = (s.category || 'Prestations').trim();
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(s);
  }
  return order.map(k => ({ title: k, items: map[k] }));
}

async function logClic(slug: string, source: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/log-clic-partage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ slug, source }),
    });
  } catch { /* silencieux */ }
}

function isCrawler(ua: string): boolean {
  return /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|pinterest|redditbot|applebot|googlebot|bingbot|vkshare|embedly|quora link preview|skypeuripreview|snapchat/i.test(ua);
}
function detectSource(req: Request): string {
  const ua = (req.headers.get('user-agent') ?? '').toLowerCase();
  const ref = (req.headers.get('referer') ?? '').toLowerCase();
  const s = new URL(req.url).searchParams.get('s');
  if (s) return s;
  if (ua.includes('whatsapp') || ref.includes('whatsapp')) return 'whatsapp';
  if (ref.includes('facebook') || ref.includes('instagram')) return 'social';
  return 'lien';
}
function initialAvatar(name: string): string {
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) +
    '&background=FDCF34&color=14152A&size=512&length=1&bold=true&format=png';
}

// Pool d'images pour les templates : galerie du prestataire d'abord (cover + gallery_urls),
// puis photos produits en complément. Les emplacements image des templates y puisent
// dans l'ordre → toujours remplis même si la galerie est courte.
function buildImagePool(shop: Shop, products: Product[]): string[] {
  const out: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === 'string' && u.startsWith('http') && !out.includes(u)) out.push(u);
  };
  push(shop.cover_url);
  if (Array.isArray(shop.gallery_urls)) for (const u of shop.gallery_urls) push(u);
  for (const p of products) push(p.photo_url);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// APERÇU DÉMO — données fictives cohérentes par template (univers natif).
// Cosmetic → « Yaram bu rafet », soins/cosmétiques naturels (Dakar). Images =
// /assets/demo/cosmetic/* servies par Vercel. Aucune donnée réelle, aucun appel DB.
// ─────────────────────────────────────────────────────────────────────────────
function buildDemo(templateId: string, base: string): { shop: Shop; products: Product[]; services?: ServiceItem[] } {
  const t = SITE_TEMPLATES.indexOf(templateId) >= 0 ? templateId : 'cosmetic';
  const img = (f: string) => `${base}/assets/demo/${t}/${f}`;

  if (t === 'tresse') {
    const site_config = {
      template: 'tresse',
      tokens: { palette: 'tresse', accent: '#E0785C', fontHeading: 'poppins', fontBody: 'inter' },
      layout: { order: ['services', 'products', 'terrains'], cols: 2, card: 'shadow', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-tresse', name: 'Awa Tresses', logo_url: img('logo.png'),
      description: "Salon de tresses & coiffures protectrices. Nattes collées, tresses au fil, twists et tissages réalisés avec soin. Réservez votre créneau en ligne, paiement sécurisé.",
      zone: 'Dakar · Grand Yoff', category: 'hair', shop_type: 'services',
      subcategories: ['tresses', 'nattes', 'tissages'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.jpg'), img('p1.jpg'), img('p2.jpg'), img('p3.jpg'), img('p4.jpg'), img('p5.jpg')],
      cover_url: null, phone: '77 123 45 67', latitude: 14.7419, longitude: -17.4692,
    };
    const S = (id: string, name: string, price: number, description: string, min: number, photo: string): ServiceItem =>
      ({ id, name, description, price, category: 'Prestations', meta: `${min} min · réservable`, kind: 'beauty', image_url: img(photo) });
    const services: ServiceItem[] = [
      S('t1', 'Nattes collées', 8000, 'Nattes collées simples ou stylées, finitions nettes et durables.', 120, 'p1.jpg'),
      S('t2', 'Tresses au fil', 10000, 'Tresses au fil traditionnelles, motifs au choix.', 150, 'p2.jpg'),
      S('t3', 'Twists / Vanilles', 12000, 'Twists et vanilles soignés, idéal coiffure protectrice.', 180, 'p3.jpg'),
      S('t4', 'Tissage pose', 15000, 'Pose de tissage nette avec fermeture discrète.', 150, 'p4.jpg'),
      S('t5', 'Box braids', 18000, 'Box braids fines ou moyennes, longueur au choix.', 240, 'p5.jpg'),
      S('t6', 'Soin & shampoing', 5000, 'Shampoing, soin profond et brushing avant coiffure.', 60, 'p6.jpg'),
    ];
    return { shop, products: [], services };
  }

  if (t === 'ferme') {
    const site_config = {
      template: 'ferme',
      tokens: { palette: 'creme', accent: '#35663E', fontHeading: 'cormorant', fontBody: 'cormorant' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-ferme', name: 'Ferme Avicole Arno', logo_url: img('logo.png'),
      description: "Ferme familiale d'élevage à Dakar. Volaille, bétail et petit élevage nourris naturellement, sans hormones. Commande en ligne, livraison ou retrait à la ferme — paiement sécurisé.",
      zone: 'Dakar · Sangalkam', category: 'stores', shop_type: 'products',
      subcategories: ['volaille', 'betail', 'petit_elevage'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('bg.jpg'), img('hero.jpg'), img('g1.jpg'), img('g2.jpg'), img('g3.jpg'), img('g4.jpg'), img('g5.jpg'), img('g6.jpg')],
      cover_url: null, phone: '77 123 45 67', latitude: 14.7845, longitude: -17.2258,
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('fm1', 'Œufs fermiers (plateau de 30)', 2500, 'Œufs frais de poules élevées au sol, ramassés chaque matin. Jaune bien orangé.', 'volaille', 'oeufs.jpg'),
      P('fm2', 'Poule pondeuse', 4000, 'Poule locale en pleine ponte, robuste et bien nourrie. Idéale basse-cour ou table.', 'volaille', 'poules.jpg'),
      P('fm3', 'Coq fermier', 5500, 'Coq de ferme élevé en plein air, chair ferme et goût prononcé.', 'volaille', 'coq.jpg'),
      P('fm4', 'Pintade', 6000, 'Pintade fermière élevée en liberté, chair fine et savoureuse.', 'volaille', 'pintade.jpg'),
      P('fm5', 'Pigeons (la paire)', 5000, 'Pigeons de chair ou de reproduction, en bonne santé, prêts à l\'élevage.', 'petit_elevage', 'pigeons.jpg'),
      P('fm6', 'Lapin fermier', 6000, 'Lapin élevé au grain et à la verdure. Viande maigre et tendre.', 'petit_elevage', 'lapins.jpg'),
      P('fm7', 'Chèvre', 45000, 'Chèvre locale en bonne santé, idéale lait, reproduction ou cérémonie.', 'betail', 'chevre.jpg'),
      P('fm8', 'Mouton', 75000, 'Mouton bien portant, bien nourri. Parfait pour Tabaski, baptême ou cérémonie.', 'betail', 'moutons.jpg'),
      P('fm9', 'Bœuf', 450000, 'Bœuf de pâturage, robuste et bien engraissé. Pour cérémonie ou boucherie.', 'betail', 'boeuf.jpg'),
      P('fm10', 'Autruche', 180000, 'Autruche d\'élevage, pièce rare. Sur commande, renseignements à la ferme.', 'petit_elevage', 'autruche.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'grill') {
    const site_config = {
      template: 'grill',
      tokens: { palette: 'onyx', accent: '#C9A24B', fontHeading: 'anton', fontBody: 'cormorant' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'flat', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-grill', name: 'Au Grill', logo_url: null,
      description: "Grill traditionnel, touche moderne. Les meilleures viandes, grillées avec exigence, au cœur de la ville. Cuisine française généreuse, cave soignée et ambiance chaleureuse.",
      zone: 'Dakar · Plateau', category: 'stores', shop_type: 'products',
      subcategories: ['viandes', 'entrees', 'boissons'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.jpg'), img('g1.jpg'), img('g2.jpg'), img('g3.jpg'), img('g4.jpg'), img('g5.jpg'), img('g6.jpg'), img('g7.jpg'), img('g8.jpg'), img('band.jpg')],
      cover_url: null, phone: '33 821 45 67', latitude: 14.6680, longitude: -17.4360,
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('gr1', 'Entrecôte grillée', 9000, 'Entrecôte maturée grillée au feu de bois, beurre maître d\'hôtel et frites maison.', 'viandes', 'g1.jpg'),
      P('gr2', 'Côte de bœuf (500g)', 15000, 'Côte de bœuf à partager, grillée à la perfection, sel de Guérande et légumes de saison.', 'viandes', 'g4.jpg'),
      P('gr3', 'Tartare de bœuf', 7500, 'Bœuf coupé au couteau, préparé minute, condiments et frites croustillantes.', 'viandes', 'g5.jpg'),
      P('gr4', 'Magret de canard', 8500, 'Magret rôti, sauce au miel et épices, écrasé de pommes de terre.', 'viandes', 'g8.jpg'),
      P('gr5', 'Planche de charcuterie', 6500, 'Sélection de charcuteries fines et fromages affinés, pain de campagne.', 'entrees', 'g2.jpg'),
      P('gr6', 'Brochettes de bœuf', 5500, 'Brochettes marinées grillées, légumes croquants et sauce chimichurri.', 'entrees', 'g3.jpg'),
      P('gr7', 'Cocktail maison', 4000, 'Création du barman, spiritueux premium et agrumes frais.', 'boissons', 'g2.jpg'),
      P('gr8', 'Bière pression', 2500, 'Bière blonde artisanale servie bien fraîche à la pression.', 'boissons', 'g3.jpg'),
      P('gr9', 'Whisky sélection', 5000, 'Sélection de whiskies d\'exception, servis sur mesure.', 'boissons', 'g7.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'cosmetic') {
    const site_config = {
      template: 'cosmetic',
      tokens: { palette: 'cosmetic', accent: '#D98664', fontHeading: 'rubik', fontBody: 'rubik' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
    };
    const shop: Shop = {
      id: 'demo-cosmetic', name: 'Yaram bu rafet', logo_url: null,
      description: "Soins naturels & cosmétiques bio à base de karité, curcuma et huiles végétales. Pour une peau éclatante, nourrie et unifiée — fabriqué à Dakar.",
      zone: 'Dakar · Almadies', category: 'hair', shop_type: 'services',
      subcategories: ['soins_bio', 'parfumerie', 'esthetique'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero-model.png'), img('banner1.jpg'), img('banner2.jpg'), img('hero.jpg')],
      cover_url: null, phone: '77 123 45 67',
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('c1', 'Sérum Éclat Curcuma', 8500, 'Sérum visage au curcuma bio. Illumine, unifie et ravive l\'éclat naturel du teint.', 'visage', 'p1.jpg'),
      P('c2', 'Crème Hydratante Karité', 6500, 'Crème visage riche au beurre de karité. Nourrit en profondeur et protège.', 'visage', 'p8.jpg'),
      P('c3', 'Savon Gommant Miel', 4000, 'Savon exfoliant au miel et à l\'abricot. Peau douce, nette et lumineuse.', 'corps', 'p2.jpg'),
      P('c4', 'Savon Noir Africain', 3500, 'Savon noir traditionnel. Nettoie, purifie et équilibre la peau au quotidien.', 'corps', 'p3.jpg'),
      P('c5', 'Lait Corps Teint Marron', 6000, 'Lait hydratant lait & coco. Sublime, nourrit et unifie le teint.', 'corps', 'banner2.jpg'),
      P('c6', 'Huile de Soin L\'Harmonieuse', 7000, 'Huiles végétales bio (nigelle, noisette, dattier). Idéale peaux mixtes à grasses.', 'huiles_serums', 'p5.jpg'),
      P('c7', 'Huile de Coco Bio', 4500, 'Huile de coco 100% bio, pression à froid. Usage multiple cheveux & corps.', 'huiles_serums', 'p7.jpg'),
      P('c8', 'Gel Raffermissant Caféine', 9000, 'Gel corps à la caféine naturelle. Raffermit, tonifie et lisse la peau.', 'soins_cibles', 'p4.jpg'),
      P('c9', 'Lait Clarifiant Pili-Pili', 5500, 'Lait clarifiant au pili-pili. Purifie, illumine et unifie le teint.', 'soins_cibles', 'p6.jpg'),
      P('c10', 'Coffret Rituel Éclat', 15000, 'Coffret complet : nettoyant, sérum et crème. Le rituel éclat au quotidien.', 'soins_cibles', 'banner1.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'furniture') {
    const site_config = {
      template: 'furniture',
      tokens: { palette: 'furniture', accent: '#274C4F', fontHeading: 'jost', fontBody: 'jost' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-furniture', name: 'An Ka Taa — Maison & Mobilier', logo_url: null,
      description: "Mobilier d'exception, matières nobles et savoir-faire local. Pièces choisies pour sublimer votre intérieur — commande en ligne, retrait ou livraison à Dakar.",
      zone: 'Dakar · Sénégal', category: 'stores', shop_type: 'products',
      subcategories: ['salon', 'fauteuils', 'tables', 'rangement', 'deco'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.jpg'), img('banner1.jpg'), img('banner2.jpg')],
      cover_url: null, phone: '76 189 00 03',
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('f1', 'Fauteuil Galet', 230000, 'Fauteuil sculptural aux courbes enveloppantes. Confort et caractère pour votre salon.', 'fauteuils', 'p1.jpg'),
      P('f2', 'Chaise Lounge', 175000, 'Chaise lounge au design épuré. Assise ergonomique, piètement bois massif.', 'fauteuils', 'p2.jpg'),
      P('f3', 'Enfilade Rétro', 385000, 'Enfilade en bois massif, lignes vintage. Rangement élégant pour la salle à manger.', 'rangement', 'p3.jpg'),
      P('f4', 'Fauteuils Dune', 420000, 'Paire de fauteuils outdoor aux formes douces. Résistants et raffinés.', 'salon', 'p4.jpg'),
      P('f5', 'Table d\'Appoint', 95000, 'Petite table d\'appoint en bois. Pratique et design, à côté du canapé.', 'tables', 'p5.jpg'),
      P('f6', 'Buffet Mollis', 750000, 'Buffet spacieux à finition soignée. Ample rangement et allure intemporelle.', 'rangement', 'p6.jpg'),
      P('f7', 'Table Basse Noyer', 145000, 'Table basse en noyer, plateau galbé et piètement fuselé. Pièce centrale du salon.', 'tables', 'p7.jpg'),
      P('f8', 'Lampe d\'Appoint', 68000, 'Lampe d\'appoint au style chaleureux. Lumière douce pour vos soirées.', 'deco', 'p8.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'garderobe') {
    const site_config = {
      template: 'garderobe',
      tokens: { palette: 'garderobe', accent: '#E4322B', fontHeading: 'poppins', fontBody: 'poppins' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-garderobe', name: 'Sañse — Mode & Prêt-à-porter', logo_url: null,
      description: "Prêt-à-porter, streetwear & accessoires sélectionnés. Vêtements, sneakers et pièces tendance livrées à Dakar — commande en ligne, paiement sécurisé, retrait ou livraison.",
      zone: 'Dakar · Sénégal', category: 'stores', shop_type: 'products',
      subcategories: ['homme', 'femme', 'sneakers', 'accessoires', 'nouveautes'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.png'), img('banner1.jpg'), img('p1.jpg'), img('p2.jpg')],
      cover_url: null, phone: '76 189 00 03',
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('g1', 'Casquette Snapback', 8000, 'Casquette snapback ajustable, logo brodé. Finition premium, style streetwear.', 'accessoires', 'p1.jpg'),
      P('g2', 'Sneakers Low', 35000, 'Baskets basses en cuir souple. Semelle confort, coloris sobre, parfaites au quotidien.', 'sneakers', 'p2.jpg'),
      P('g3', 'T-shirt Graphique', 12000, 'T-shirt coton bio, impression graphique. Coupe droite, toucher doux et respirant.', 'homme', 'p3.jpg'),
      P('g4', 'Lunettes Rétro', 9500, 'Lunettes de soleil rétro, verres UV400. Monture légère et intemporelle.', 'accessoires', 'p4.jpg'),
      P('g5', 'Pull Oversize', 22000, 'Pull maille oversize, chaud et douillet. Idéal pour un look casual et cosy.', 'femme', 'p5.jpg'),
      P('g6', 'Sweat à Capuche', 18000, 'Hoodie molletonné, poche kangourou. Confort maximal, style urbain.', 'homme', 'p6.jpg'),
      P('g7', 'Chemise Lin', 16000, 'Chemise en lin léger, coupe régulière. Fraîcheur et élégance pour vos sorties.', 'femme', 'p7.jpg'),
      P('g8', 'Ceinture Cuir', 7000, 'Ceinture cuir véritable, boucle métal. Accessoire durable qui habille toute tenue.', 'accessoires', 'p8.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'sac') {
    const site_config = {
      template: 'sac',
      tokens: { palette: 'sac', accent: '#FDCF34', fontHeading: 'poppins', fontBody: 'inter' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-sac', name: 'Modu — Maroquinerie & Bagagerie', logo_url: null,
      description: "Sacs, sacs à dos et bagagerie en cuir et toile. Pièces robustes et élégantes pour la ville comme le voyage — commande en ligne, paiement sécurisé, retrait ou livraison à Dakar.",
      zone: 'Dakar · Sénégal', category: 'stores', shop_type: 'products',
      subcategories: ['sacs_a_dos', 'sacs_main', 'bagages', 'accessoires', 'nouveautes'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.jpg'), img('banner1.jpg'), img('banner2.jpg'), img('banner3.jpg')],
      cover_url: null, phone: '76 189 00 03',
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('s1', 'Sac à Dos Voyageur', 32000, 'Sac à dos en toile enduite et cuir. Grand volume, compartiment ordinateur, finitions robustes.', 'sacs_a_dos', 'p1.jpg'),
      P('s2', 'Sac à Dos Urbain', 26000, 'Sac à dos compact pour la ville. Léger, résistant à l\'eau, bretelles confort.', 'sacs_a_dos', 'p2.jpg'),
      P('s3', 'Sac à Main Cuir', 38000, 'Sac à main en cuir pleine fleur. Élégant et spacieux, bandoulière amovible.', 'sacs_main', 'p3.jpg'),
      P('s4', 'Besace Bandoulière', 22000, 'Besace en cuir souple. Format tablette, idéale au quotidien, port croisé.', 'sacs_main', 'p4.jpg'),
      P('s5', 'Sac de Voyage', 45000, 'Sac de voyage en toile et cuir. Grande capacité, double anse, bandoulière.', 'bagages', 'p5.jpg'),
      P('s6', 'Valise Cabine', 58000, 'Valise cabine rigide 4 roues. Format avion, serrure TSA, coque résistante.', 'bagages', 'p6.jpg'),
      P('s7', 'Pochette Cuir', 12000, 'Pochette en cuir à glissière. Range l\'essentiel avec style, finition soignée.', 'accessoires', 'p7.jpg'),
      P('s8', 'Sac Banane', 9500, 'Sac banane toile résistante. Port taille ou épaule, pratique et tendance.', 'accessoires', 'p8.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'bar') {
    const site_config = {
      template: 'bar',
      tokens: { palette: 'onyx', accent: '#D68B1A', fontHeading: 'syne', fontBody: 'jost' },
      layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'flat', hero: 'centered' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-bar', name: 'BRAISE', logo_url: null,
      description: "Une cuisine du feu, pensée comme un art. Pièces maturées, produits de saison et dressages précis dans une salle intime et chaleureuse. Chez BRAISE, chaque dîner est une cérémonie.",
      zone: 'Dakar · Almadies', category: 'stores', shop_type: 'products',
      subcategories: ['entrees', 'viandes', 'poissons', 'desserts', 'boissons'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [img('hero.jpg'), img('g1.jpg'), img('g2.jpg'), img('g3.jpg'), img('g4.jpg'), img('g5.jpg'), img('g6.jpg'), img('g7.jpg'), img('g8.jpg'), img('band.jpg')],
      cover_url: null, phone: '77 123 45 67', latitude: 14.7430, longitude: -17.5140,
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: img(photo), price, category });
    const products: Product[] = [
      P('ba1', 'Tartare de bœuf au couteau', 6500, 'Bœuf local, câpres, jaune d\'œuf fumé, pain grillé.', 'entrees', 'g1.jpg'),
      P('ba2', 'Gambas flambées', 7000, 'Ail, piquillos, persil plat, citron confit.', 'entrees', 'g3.jpg'),
      P('ba3', 'Côte de bœuf maturée (40j)', 24000, 'Pour deux · jus corsé, légumes grillés, os à moelle.', 'viandes', 'g1.jpg'),
      P('ba4', 'Entrecôte grillée', 11000, 'Beurre maître d\'hôtel, frites maison.', 'viandes', 'g4.jpg'),
      P('ba5', 'Agneau confit 7 heures', 12500, 'Épices douces, semoule parfumée, jus réduit.', 'viandes', 'g2.jpg'),
      P('ba6', 'Thiof rôti sur l\'arête', 13000, 'Beurre blanc citronné, légumes de saison.', 'poissons', 'g5.jpg'),
      P('ba7', 'Pavé de capitaine grillé', 10500, 'Émulsion de yassa, riz vapeur.', 'poissons', 'g6.jpg'),
      P('ba8', 'Fondant chocolat & braise', 4000, 'Glace vanille, éclats de cacao torréfié.', 'desserts', 'g7.jpg'),
      P('ba9', 'Cocktail signature « Braise »', 5000, 'Rhum ambré, fruits rouges, épices, fumée.', 'boissons', 'g2.jpg'),
    ];
    return { shop, products };
  }

  if (t === 'classic') {
    // Démo du template classique (par défaut) — boutique « Déco & Mode » avec un
    // vrai catalogue réparti en catégories. Réutilise les images démo garderobe.
    const gimg = (f: string) => `${base}/assets/demo/garderobe/${f}`;
    const site_config = {
      template: 'classic',
      tokens: { palette: 'classic', accent: '#14152A', fontHeading: 'poppins', fontBody: 'inter' },
      layout: { order: ['products', 'services', 'terrains'], cols: 2, card: 'shadow', hero: 'split' },
      social: { facebook: 'https://facebook.com', tiktok: 'https://tiktok.com', instagram: 'https://instagram.com' },
    };
    const shop: Shop = {
      id: 'demo-classic', name: 'Déco & Mode', logo_url: gimg('hero.png'),
      description: "Vêtements, accessoires et objets déco sélectionnés avec soin. Commande en ligne, paiement sécurisé Wave & Orange Money, retrait ou livraison à Dakar.",
      zone: 'Dakar · Médina', category: 'stores', shop_type: 'products',
      subcategories: ['vêtements', 'accessoires', 'déco'],
      slug: '__demo', merchant_id: 'demo', opening_hours: null, is_manually_closed: false,
      site_config, gallery_urls: [gimg('hero.png'), gimg('p1.jpg'), gimg('p2.jpg'), gimg('p3.jpg'), gimg('p4.jpg'), gimg('p5.jpg')],
      cover_url: null, phone: '77 123 45 67', latitude: 14.6937, longitude: -17.4441,
    };
    const P = (id: string, name: string, price: number, description: string, category: string, photo: string): Product =>
      ({ id, name, description, emoji: null, photo_url: gimg(photo), price, category, sizes: null, colors: null, stock_quantity: null });
    const products: Product[] = [
      P('c1', 'Robe wax élégante', 18000, 'Robe en wax, coupe ajustée, finitions soignées.', 'Vêtements', 'p1.jpg'),
      P('c2', 'Chemise lin homme', 14000, 'Chemise en lin respirante, idéale climat chaud.', 'Vêtements', 'p2.jpg'),
      P('c3', 'Ensemble bogolan', 22000, 'Ensemble bogolan artisanal, pièce unique.', 'Vêtements', 'p3.jpg'),
      P('c4', 'Sac à main cuir', 25000, 'Sac en cuir véritable, anse renforcée.', 'Accessoires', 'p4.jpg'),
      P('c5', 'Foulard soie imprimé', 8000, 'Foulard en soie, motifs colorés exclusifs.', 'Accessoires', 'p5.jpg'),
      P('c6', 'Montre classique', 30000, 'Montre élégante bracelet cuir, étanche.', 'Accessoires', 'p6.jpg'),
      P('c7', 'Vase céramique', 12000, 'Vase décoratif en céramique émaillée.', 'Déco', 'p7.jpg'),
      P('c8', 'Coussin brodé main', 9000, 'Coussin brodé à la main, motifs traditionnels.', 'Déco', 'p8.jpg'),
    ];
    return { shop, products };
  }

  // Fallback générique (autres templates — démo minimale).
  const shop: Shop = {
    id: 'demo', name: 'Boutique Démo', logo_url: null, description: 'Aperçu du template.',
    zone: 'Dakar', category: 'stores', shop_type: 'products', subcategories: [], slug: '__demo', merchant_id: 'demo',
    opening_hours: null, is_manually_closed: false, site_config: { template: t },
    gallery_urls: [], cover_url: null, phone: '',
  };
  return { shop, products: [] };
}

function renderHtml(shop: Shop | null, products: Product[], services: ServiceItem[], terrains: Terrain[], slug: string, base: string, dailySpecial: { id: string; name: string; price: number; photo_url?: string | null }[] = [], // eslint-disable-next-line @typescript-eslint/no-explicit-any
promos: any[] = []): string {
  const canonical = `${base}/${encodeURIComponent(slug)}`;
  if (!shop) {
    return page({
      title: 'Boutique introuvable — LASSİ', desc: "Cette boutique n'est plus disponible sur LASSİ.",
      ogImage: initialAvatar('LASSI'), canonical, base, name: 'Boutique introuvable', zone: '', cat: '', logo: '', slug, products: [], services: [], terrains: [], shopStatus: null, dailySpecial: [], promos: [], siteConfig: null, gallery: [], phone: '',
    });
  }
  // Nom affiché : displayName du Site Builder s'il est défini, sinon shops.name.
  // (shops.name reste intact partout ailleurs — app/admin/paiements.)
  const siteName = resolveTheme(shop.site_config).displayName;
  const name = siteName || shop.name?.trim() || 'Boutique';
  const zone = shop.zone?.trim() || '';
  const cat = categoryLabel(shop.category, shop.subcategories);
  const logo = shop.logo_url?.trim() || '';
  const nb = products.length + services.length + terrains.length;
  const descRaw = shop.description?.trim() ||
    `${name}${zone ? ' · ' + zone : ''}${cat ? ' · ' + cat : ''}.` +
      (nb ? ` ${nb} offre${nb > 1 ? 's' : ''} — commandez ou réservez.` : '');
  const shopStatus = computeShopStatus(shop.opening_hours, shop.is_manually_closed);
  return page({
    title: `${name} — sur LASSİ`, desc: clip(descRaw.replace(/\s+/g, ' '), 180),
    ogImage: logo || initialAvatar(name), canonical, base, name, zone, cat, logo, slug, products, services, terrains, shopStatus, dailySpecial, promos, siteConfig: shop.site_config, gallery: buildImagePool(shop, products), phone: (shop.phone ?? '').trim(),
    lat: typeof shop.latitude === 'number' ? shop.latitude : null, lng: typeof shop.longitude === 'number' ? shop.longitude : null, shopId: shop.id,
  });
}

// URLs réelles d'un produit (images[] si non vide, sinon [photo_url]). Max 3.
function productImages(p: Product): string[] {
  const list = Array.isArray(p.images)
    ? p.images.filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
    : [];
  if (list.length > 0) return list.slice(0, 3);
  return typeof p.photo_url === 'string' && p.photo_url.startsWith('http') ? [p.photo_url] : [];
}

function productVisual(p: Product): string {
  const url = productImages(p)[0] || '';
  if (url) return `<img class="pimg" src="${escAttr(url)}" alt="${escAttr(p.name ?? '')}" loading="lazy">`;
  const emoji = (p.emoji && p.emoji.trim()) || (p.photo_url && !p.photo_url.startsWith('http') ? p.photo_url : '') || '🛍️';
  return `<div class="pemoji">${esc(emoji)}</div>`;
}

// Carte produit = ajout au panier (data-* lus par le JS). data-base = prix BRUT
// prestataire (le total client = somme base + ceil(1%) = exactement le montant EF).
// data-sizes / data-colors = JSON si habillement, sinon vide.
function productCard(p: Product): string {
  const base = Math.round(Number(p.price));
  const desc = (p.description ?? '').trim();
  const sizesJson = p.sizes && p.sizes.length > 0 ? JSON.stringify(p.sizes) : '';
  const colorsJson = p.colors && p.colors.length > 0 ? JSON.stringify(p.colors) : '';
  const stockAttr = p.stock_quantity != null ? String(p.stock_quantity) : '';
  const hasVariants = sizesJson !== '' || colorsJson !== '';
  const imgsJson = JSON.stringify(productImages(p));
  return `<div class="prod" data-id="${escAttr(p.id)}" data-name="${escAttr(p.name ?? '')}" data-base="${base}" data-sizes="${escAttr(sizesJson)}" data-colors="${escAttr(colorsJson)}" data-stock="${escAttr(stockAttr)}" data-images="${escAttr(imgsJson)}" data-desc="${escAttr(desc)}">
    <div class="pimgzone">${productVisual(p)}</div>
    <div class="pbody">
      <div class="pname">${esc(clip(p.name ?? '', 48))}</div>
      ${desc ? `<div class="pdesc">${esc(clip(desc, 60))}</div>` : ''}
      <div class="pprice">${fmtPrice(base)}</div>
      ${stockAttr !== '' ? `<div class="pstock">${stockAttr} restant${Number(stockAttr) > 1 ? 's' : ''}</div>` : ''}
      <div class="stepper" data-id="${escAttr(p.id)}" data-variants="${hasVariants ? '1' : ''}">
        <button class="add" type="button" aria-label="Ajouter">Ajouter</button>
        ${!hasVariants ? `<span class="qtybox" hidden><button class="minus" type="button">−</button><b class="q">0</b><button class="plus" type="button">+</button></span>` : ''}
      </div>
    </div>
  </div>`;
}

// Carte prestation beauté (réservable web).
function serviceCard(s: ServiceItem, _deep: string): string {
  const sub = s.description ? `${s.meta} · ${s.description}` : s.meta;
  const imgUrl = typeof s.image_url === 'string' && s.image_url.startsWith('http') ? s.image_url : '';
  const visual = imgUrl
    ? `<div class="pimgzone svc-imgzone"><img class="pimg" src="${escAttr(imgUrl)}" alt="${escAttr(s.name)}" loading="lazy"></div>`
    : '';
  const head = `<div class="pname">${esc(clip(s.name, 48))}</div>
      <div class="pdesc">${esc(clip(sub, 64))}</div>
      <div class="pprice">${fmtPrice(s.price)}</div>`;
  return `<div class="prod svc book" data-svc="${escAttr(s.id)}" data-name="${escAttr(s.name)}" data-price="${prixClient(s.price)}" data-meta="${escAttr(s.meta)}" data-min="${Math.max(0, Math.round(s.price))}">
    ${visual}<div class="pbody">${head}
      <button class="svcbtn bookbtn" type="button">Réserver</button></div></div>`;
}

const SPORT_EMOJI: Record<string, string> = {
  football: '⚽', basketball: '🏀', tennis: '🎾', volleyball: '🏐', autre: '🏟',
};

function terrainCard(t: Terrain, base: string): string {
  const emoji = SPORT_EMOJI[t.sport_type ?? ''] ?? '🏟';
  const prix = Math.round(Number(t.prix_horaire ?? 0));
  const prixClient = prix + Math.ceil(prix * COMMISSION_RATE);
  const link = `${base}/terrain?id=${encodeURIComponent(t.id)}`;
  const desc = t.description ? `<div class="pdesc">${esc(clip(t.description, 60))}</div>` : '';
  const addr = t.adresse ? `<div class="terrain-addr">📍 ${esc(clip(t.adresse, 50))}</div>` : '';
  const imgUrl = Array.isArray(t.images) && t.images.length > 0 && typeof t.images[0] === 'string' ? t.images[0] : null;
  const visual = imgUrl
    ? `<img class="terrain-img" src="${escAttr(imgUrl)}" alt="${escAttr(t.nom ?? 'Terrain')}" loading="lazy">`
    : `<div class="terrain-emoji-box">${emoji}</div>`;
  return `<div class="terrain-card">
    ${visual}
    <div class="terrain-body">
      <div class="pname">${esc(t.nom ?? 'Terrain')}</div>
      ${desc}${addr}
      <div class="terrain-prix">${fmtPrice(prix)} <span class="terrain-unit">/ heure</span></div>
    </div>
    <a class="terrain-btn" href="${escAttr(link)}">Réserver un créneau →</a>
  </div>`;
}

// Carte abonnement / formule fitness (style light, bouton Réserver, paiement web direct).
function fitnessCard(s: ServiceItem): string {
  const total = prixClient(s.price);
  return `<div class="abocard" data-offreid="${escAttr(s.id)}" data-nom="${escAttr(s.name)}" data-prix="${total}" data-meta="${escAttr(s.meta)}">
    <div class="abo-left">
      <div class="abonom">${esc(clip(s.name, 48))}</div>
      <div class="abometa">⏱ ${esc(s.meta)}</div>
    </div>
    <div class="abo-right">
      <div class="aboprix">${fmtPrice(s.price)}</div>
      <button class="abo-btn" type="button">Réserver</button>
    </div>
  </div>`;
}

function page(o: {
  title: string; desc: string; ogImage: string; canonical: string; base: string;
  name: string; zone: string; cat: string; logo: string; slug: string; products: Product[]; services: ServiceItem[];
  terrains: Terrain[];
  shopStatus: ShopStatusResult | null;
  dailySpecial: { id: string; name: string; price: number; photo_url?: string | null }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promos: any[];
  siteConfig: unknown;
  gallery: string[];
  phone: string;
  lat?: number | null; lng?: number | null; shopId?: string;
}): string {
  const deep = `https://lassi.tech/p/${encodeURIComponent(o.slug)}`;
  const theme = resolveTheme(o.siteConfig);
  // Template EXCLUSIF verrouillé par slug (jamais sélectionnable ailleurs) :
  // Les Délices de Fa reçoit le template « cafefa » quoi qu'il y ait en base.
  if (o.slug === 'les-delices-de-fa') (theme as { template: string }).template = 'cafefa';
  if (o.slug === 'udebi-atelier') (theme as { template: string }).template = 'udebi';
  // Logo : vrai logo uploadé du prestataire si présent, sinon logo LASSİ (jamais
  // d'emoji/initiale décorative). lassiLogo sert de repli partout dans les templates.
  const lassiLogo = `${o.base}/assets/lassi-logo.png`;
  const logoSrc = o.logo || lassiLogo;
  const avatar = `<img class="shop-logo" src="${escAttr(logoSrc)}" alt="${escAttr(o.name)}">`;
  const hasProducts = o.products.length > 0;
  const hasServices = o.services.length > 0;
  const hasBeauty   = o.services.some(s => s.kind === 'beauty');
  const hasFitness  = o.services.some(s => s.kind === 'fitness');
  const hasTerrains = o.terrains.length > 0;
  const hasCatalog = hasProducts || hasServices || hasTerrains;
  const st = o.shopStatus;
  const isOpen = st ? st.isOpen : true;
  let hoursHtml = '';
  if (st) {
    if (st.todayClosed || (!st.todayOpen && !st.isOpen && !st.isPause)) {
      hoursHtml = `<div class="hours-status h-closed">${esc(st.label)}</div>`;
    } else if (st.isPause) {
      hoursHtml = `<div class="hours-status h-pause">${esc(st.label)}${st.pauseNextChange ? ' · ' + esc(st.pauseNextChange) : ''}</div>`;
    } else if (st.isOpen && st.todayOpen) {
      hoursHtml = `<div class="hours-status h-open">Ouvert · Ferme à ${fmtHr(st.todayClose)}</div><div class="hours-time">${fmtHr(st.todayOpen)} – ${fmtHr(st.todayClose)}</div>`;
    } else if (!st.isOpen && st.todayOpen) {
      hoursHtml = `<div class="hours-status h-closed">${esc(st.label)} · Ouvre à ${fmtHr(st.todayOpen)}</div>`;
    }
  }
  const groups = groupProducts(o.products);
  const multiCat = groups.length > 1;
  const hasDailySpecials = o.dailySpecial.length > 0;
  const hasTabNav = multiCat || hasDailySpecials;
  const catnav = hasTabNav
    ? `<div class="catnav"><button class="chip sel" type="button" data-cat="__all">Tout</button>` +
      (hasDailySpecials ? `<button class="chip" type="button" data-cat="plat-du-jour">Plat du jour</button>` : '') +
      groups.map(g => `<button class="chip" type="button" data-cat="${escAttr(g.id)}">${esc(g.title)}</button>`).join('') +
      `</div>`
    : '';
  const dsSection = hasDailySpecials
    ? `<div class="catsec" data-cat="plat-du-jour">` +
      o.dailySpecial.map(ds =>
        `<div class="ds-card" data-ds-id="${escAttr(ds.id)}" data-ds-name="${escAttr(ds.name)}" data-ds-price="${ds.price}">` +
        (ds.photo_url ? `<img class="ds-img" src="${escAttr(ds.photo_url)}" alt="${escAttr(ds.name)}" loading="lazy">` : '') +
        `<div class="ds-info"><div class="ds-name">${esc(ds.name)}</div><div class="ds-price">${fmtPrice(ds.price)}</div></div>` +
        `<button class="ds-btn" type="button">Commander</button></div>`).join('') +
      `</div>`
    : '';
  const grid = !hasProducts ? '' : hasTabNav
    ? groups.map(g =>
        `<div class="catsec" data-cat="${escAttr(g.id)}">` +
        `<div class="cathead"><span class="cathead-title">${esc(g.title)}</span><span class="cathead-count">${g.items.length}</span></div>` +
        `<div class="grid">${g.items.map(productCard).join('')}</div></div>`).join('')
    : (groups.length > 0 ? `<div class="cathead"><span class="cathead-title">${esc(groups[0].title)}</span><span class="cathead-count">${o.products.length}</span></div>` : '') +
      `<div class="grid">${o.products.map(productCard).join('')}</div>`;

  // Section prestations/services — beauté (grille) + fitness (liste sombre).
  const svcGroups    = groupServices(o.services);
  const beautyGroups = svcGroups.filter(g => g.items.some(s => s.kind === 'beauty'));
  const fitGroups    = svcGroups.filter(g => g.items.some(s => s.kind === 'fitness'));
  const svcSection = !hasServices ? '' :
    `<div class="sectitle">${hasProducts ? 'Prestations &amp; services' : 'Choisis ta prestation'} · ${o.services.length}</div>` +
    beautyGroups.map(g =>
      `<div class="cathead"><span class="cathead-title">${esc(g.title)}</span><span class="cathead-count">${g.items.length}</span></div>` +
      `<div class="grid">${g.items.map(s => serviceCard(s, deep)).join('')}</div>`).join('') +
    fitGroups.map(g =>
      `<div class="cathead"><span class="cathead-title">${esc(g.title)}</span><span class="cathead-count">${g.items.length}</span></div>` +
      `<div class="abolist">${g.items.map(fitnessCard).join('')}</div>`).join('');

  const terrainSection = !hasTerrains ? '' :
    `<div class="sectitle">Nos terrains · ${o.terrains.length}</div>` +
    `<div class="terrain-list">${o.terrains.map(t => terrainCard(t, o.base)).join('')}</div>`;

  const storeButtons = `<div class="cta">
      <a class="store primary" href="${APPSTORE_URL}">
        <svg viewBox="0 0 24 24"><path d="M16.365 1.43c0 1.14-.417 2.2-1.25 3.06-.95.99-2.08 1.56-3.2 1.47-.14-1.09.43-2.26 1.22-3.05.89-.9 2.33-1.57 3.23-1.48zM20.9 17.1c-.55 1.27-.81 1.83-1.52 2.96-.99 1.57-2.38 3.53-4.1 3.54-1.53.02-1.92-.99-4-.98-2.08.01-2.51 1-4.04.97-1.72-.01-3.04-1.77-4.03-3.34C-.5 16.73-.78 11.08 1.38 8.17c1.07-1.46 2.76-2.38 4.36-2.38 1.63 0 2.66 1 4.01 1 1.31 0 2.11-1 4-1 1.43 0 2.94.78 4.02 2.12-3.53 1.94-2.95 6.98 1.13 9.19z"/></svg>
        <span class="txt"><small>Télécharger dans l'</small><strong>App Store</strong></span>
      </a>
      <a class="store" href="${PLAY_URL}">
        <svg viewBox="0 0 24 24"><path d="M3.6 1.8c-.32.34-.51.86-.51 1.53v17.34c0 .67.19 1.19.53 1.52l.06.05L13.5 12.4v-.23L3.68 1.75l-.08.05z" fill="#00D0FF"/><path d="M17.2 15.7l-3.7-3.3v-.24l3.7-3.3.08.05 4.37 2.48c1.25.71 1.25 1.87 0 2.58l-4.37 2.48-.08.02z" fill="#FFCE00"/><path d="M17.28 15.65l-3.78-3.38L3.6 22.2c.41.44 1.09.49 1.86.06l11.82-6.61" fill="#FF3A44"/><path d="M17.28 8.9L5.46 2.3C4.69 1.86 4.01 1.92 3.6 2.36l9.9 9.91 3.78-3.37z" fill="#00F076"/></svg>
        <span class="txt"><small>Disponible sur</small><strong>Google Play</strong></span>
      </a>
    </div>`;

  const foot = hasProducts
    ? `<p class="foot">Commande &amp; paie ici en sécurité (Wave / Orange Money). <b>${esc(o.name)}</b> te rappelle pour le retrait ou la livraison.</p>`
    : hasTerrains
      ? `<p class="foot">Réserve ton créneau en ligne et paie directement (Wave / Orange Money). Présente-toi sur place à l'heure choisie.</p>`
      : `<p class="foot">Réserve tes prestations dans l'app <b>LASSİ</b> — créneaux, paiement sécurisé et rappel automatique.</p>`;

  const promosHtml = o.promos.length > 0
    ? o.promos.map(p => {
        const suffix = p.type === 'pourcentage' ? ' -' + p.valeur + '%'
          : p.type === 'montant_fixe' ? ' -' + fmtPrice(p.valeur)
          : '';
        const min = p.montant_min > 0 ? ' (des ' + fmtPrice(p.montant_min) + ')' : '';
        return '<div class="promo-banner"><span class="promo-ico">&#x1F3F7;</span><span class="promo-txt">' + esc(p.titre) + suffix + min + '</span></div>';
      }).join('')
    : '';
  const shopHeader = `
    <section class="hero">
      <div class="hero-left">
        ${o.cat ? `<div class="shop-cat">${esc(o.cat)}</div>` : ''}
        <h1 class="hero-title lx-fx-mask"><span class="lx-fx-mask-l"><span>${esc(o.name)}</span></span></h1>
        ${o.desc ? `<p class="hero-desc">${esc(clip(o.desc, 200))}</p>` : ''}
        ${hoursHtml ? `<div class="hours-block"><div class="hours-label">Horaires aujourd'hui</div>${hoursHtml}</div>` : ''}
        ${promosHtml}
      </div>
      <div class="hero-img">
        ${o.zone ? `<div class="zone-badge">📍 ${esc(o.zone)}</div>` : ''}
        <span class="lx-fx-zin">${avatar}</span>
      </div>
    </section>
    <div class="divider"></div>
  `;
  const closedNotice = !isOpen ? (
    st && st.isPause ? `
    <div class="closed-notice closed-pause">
      <div class="cn-label">${esc(st.label)}</div>
      ${st.pauseNextChange ? `<div class="cn-sub">${esc(st.pauseNextChange)}</div>` : ''}
    </div>
  ` : `
    <div class="closed-notice">
      <div class="cn-label">${esc(st ? st.label : 'Fermé')}</div>
      ${st && st.todayOpen && !st.todayClosed ? `<div class="cn-sub">Ouvre à ${fmtHr(st.todayOpen)}</div>` : ''}
    </div>
  `) : '';
  const catalogCls = !isOpen ? ' closed-overlay' : '';
  const totalItems = o.products.length + (hasDailySpecials ? o.dailySpecial.length : 0);
  // Phase 2 — ordre des conteneurs piloté par layout.order (données jamais masquées).
  const sectionMap: Record<string, string> = {
    products: `${catnav}${dsSection}${grid}`,
    services: svcSection,
    terrains: terrainSection,
  };
  const orderedSections = theme.layout.order.map(k => sectionMap[k] ?? '').join('\n      ');
  const classicBody = hasCatalog ? `
    ${shopHeader}
    ${closedNotice}
    <div class="catalog${catalogCls}">
      <h2 class="catalog-title lx-fx-mask"><span class="lx-fx-mask-l"><span>Faites-vous plaisir</span></span></h2>
      <div class="lx-fx-stagger">${orderedSections}</div>
    </div>
    <div class="appnote">Découvrez tous les commerçants autour de vous sur l'application LASSİ</div>
    ${storeButtons}
    ${foot}
  ` : `
    ${shopHeader}
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;text-align:center">
      <a class="btn" href="${escAttr(deep)}">Ouvrir dans LASSİ</a>
      ${storeButtons}
      <p class="foot">Consultez la boutique, <b>commandez dans l'app LASSİ</b>.</p>
    </div>
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « COSMETIC » — structure landing beauté (réf Cosmetic.html).
  // Les vraies données du shop sont RÉ-AGENCÉES dans cette structure ; les
  // emplacements image puisent dans le pool galerie→produits (o.gallery).
  // Le catalogue (grid .prod + modals + JS) est réutilisé tel quel → commerce OK.
  // ═══════════════════════════════════════════════════════════════════════════
  const gal = o.gallery;
  const pick = (i: number): string => gal.length ? gal[i % gal.length] : (o.logo || '');
  const bg = (u: string): string => u ? `style="background-image:url('${u.replace(/['")\\]/g, '')}')"` : '';
  // Réseaux sociaux (saisis par le prestataire, validés http(s)) — icônes cliquables.
  const _soc = theme.social;
  const _socIco = (href: string, name: string, file: string): string =>
    href ? `<a class="soc" href="${escAttr(href)}" target="_blank" rel="noopener nofollow" title="${name}" aria-label="${name}"><img src="/assets/social/${file}" alt="${name}"></a>` : '';
  const socialHtml = (_soc.facebook || _soc.tiktok || _soc.instagram)
    ? `<div class="soc-row">${_socIco(_soc.facebook, 'Facebook', 'facebook.png')}${_socIco(_soc.tiktok, 'TikTok', 'tiktok.png')}${_socIco(_soc.instagram, 'Instagram', 'instagram.png')}</div>`
    : '';
  const featItems = (o.cat ? o.cat.split('·').map(s => s.trim()).filter(Boolean) : []).slice(0, 4);
  const heroImg = pick(0);
  const cxHeadCta = hasProducts ? 'Commander' : hasTerrains ? 'Réserver' : 'Découvrir';
  const cxStatCount = hasProducts ? o.products.length : hasServices ? o.services.length : o.terrains.length;
  const cxStats = `
    <div class="cx-stats">
      <div class="cx-stat"><b><span class="cx-count" data-target="${cxStatCount}" data-suffix="+">0</span></b><span>${hasProducts ? 'Produits' : hasServices ? 'Prestations' : 'Terrains'}</span></div>
      <div class="cx-stat"><b><span class="cx-count" data-target="100" data-suffix="%">0</span></b><span>Naturel &amp; bio</span></div>
      <div class="cx-stat"><b><span class="cx-count" data-target="24" data-suffix="/7">0</span></b><span>Commande en ligne</span></div>
    </div>`;
  const cxBeam = (grad: string) => `<svg class="cx-beam" preserveAspectRatio="none"><defs><linearGradient id="${grad}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#22D3EE"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#2563EB"/></linearGradient></defs><rect class="cx-beam-rect" x="1.5" y="1.5" rx="16" ry="16" stroke="url(#${grad})"/></svg>`;
  const cxBanners = `
    <section class="cx-banners">
      <a class="cx-banner cx-beam-card" href="#cx-shop" ${bg(pick(1))}>
        ${cxBeam('cxBeamA')}
        <div class="cx-banner-in">
          <span class="cx-banner-k">Peau éclatante</span>
          <h3>Chacune mérite de se sentir belle et confiante</h3>
          <span class="cx-banner-cta">Acheter</span>
        </div>
      </a>
      <a class="cx-banner cx-beam-card" href="#cx-shop" ${bg(pick(2))}>
        ${cxBeam('cxBeamB')}
        <div class="cx-banner-in">
          <span class="cx-banner-k">Rituel éclat</span>
          <h3>La beauté est l'éternité qui se contemple</h3>
          <span class="cx-banner-cta">Acheter</span>
        </div>
      </a>
    </section>`;
  // Section « Meilleures ventes » : tuile éditoriale + grille des premiers produits
  // (cartes réutilisées = bouton « Ajouter » au panier fonctionnel).
  const cxBest = hasProducts ? `
    <section class="cx-best">
      <div class="cx-sec-head">
        <span class="cx-sec-k">Nos coups de cœur</span>
        <h2 class="cx-sec-title">Nos Meilleures Ventes</h2>
        <p class="cx-sec-sub">Les favoris de nos clientes, sélectionnés rien que pour toi.</p>
      </div>
      <div class="cx-best-grid cx-bento">
        <div class="cx-best-feature cx-bento-piece" ${bg(pick(3))}>
          <div class="cx-best-feature-ov"></div>
          <div class="cx-best-feature-in">
            <span class="cx-eyebrow light">Soins naturels</span>
            <h3>Découvre le pouvoir de la beauté naturelle</h3>
            <a class="cx-btn light" href="#cx-shop">Voir la boutique</a>
          </div>
        </div>
        <div class="cx-best-products grid">
          ${o.products.slice(0, 6).map((p) => productCard(p).replace('class="prod', 'class="prod cx-bento-piece')).join('')}
        </div>
      </div>
    </section>` : '';
  const icoDrop = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c3.2 4 6 7 6 10a6 6 0 11-12 0c0-3 2.8-6 6-10z"/></svg>';
  const icoShield = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.2-3 7.3-7 9-4-1.7-7-4.8-7-9V6l7-3z"/><path d="M9.3 12l2 2 3.4-3.6"/></svg>';
  const icoSpark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.1 6.4L20.5 12l-6.4 2.1L12 20.5l-2.1-6.4L3.5 12l6.4-2.1z"/></svg>';
  const cxFeature = `
    <section id="cx-about" class="cx-feature">
      <div class="cx-feature-top">
        <div class="cx-feature-head">
          <h2 class="cx-mask"><span class="cx-mask-l"><span>Une peau éclatante</span></span><span class="cx-mask-l"><span>au quotidien</span></span></h2>
          <p>Des soins naturels, pensés pour révéler l'éclat de ta peau jour après jour.</p>
          <a class="cx-btn-outline" href="#cx-shop">En savoir plus</a>
        </div>
        <div class="cx-feature-seal"><span class="cx-seal-star">&#10038;</span><span class="cx-seal-txt">Produit<br>naturel</span></div>
      </div>
      <div class="cx-feature-hero cx-zoom"><img src="/assets/demo/cosmetic/feature.jpg" alt="Nos produits" loading="lazy"></div>
      <div class="cx-feature-icons">
        <div class="cx-fico"><span class="cx-fico-ic">${icoDrop}</span><b>Hydratation</b><small>Nourrit et hydrate la peau en profondeur, pour une sensation de confort durable.</small></div>
        <div class="cx-fico"><span class="cx-fico-ic">${icoShield}</span><b>Protection</b><small>Protège ta peau des agressions extérieures et préserve son éclat naturel.</small></div>
        <div class="cx-fico"><span class="cx-fico-ic">${icoSpark}</span><b>Anti-âge</b><small>Raffermit et lisse la peau pour un teint visiblement plus jeune et éclatant.</small></div>
      </div>
    </section>`;
  const cxPerks = `
    <section class="cx-perks">
      <div class="cx-perk"><b>Paiement sécurisé</b><span>Wave &amp; Orange Money</span></div>
      <div class="cx-perk"><b>Retrait / livraison</b><span>${esc(o.zone || 'À Dakar')}</span></div>
      <div class="cx-perk"><b>Qualité garantie</b><span>produits sélectionnés</span></div>
      <div class="cx-perk"><b>Rappel automatique</b><span>après ta commande</span></div>
    </section>`;
  const cxFoot = `
    <footer id="cx-contact" class="cx-foot">
      <div class="cx-foot-brand">
        <div class="cx-logo">${esc(o.name)}</div>
        <p>${esc(clip(o.desc || `${o.name} — soins & cosmétiques, commande & paiement sécurisé.`, 130))}</p>
      </div>
      <div class="cx-foot-col">
        <h4>Infos</h4>
        ${o.cat ? `<p>${esc(o.cat)}</p>` : ''}
        ${o.zone ? `<p>📍 ${esc(o.zone)}</p>` : ''}
        ${o.phone ? `<p>✆ ${esc(o.phone)}</p>` : ''}
        ${hoursHtml ? `<div class="cx-foot-hours">${hoursHtml}</div>` : ''}
      </div>
      <div class="cx-foot-col">
        <h4>Commander</h4>
        <p>Wave · Orange Money</p>
        <p>Retrait sur place ou livraison</p>
        <a class="cx-foot-cta" href="#cx-shop">Voir la boutique →</a>
        ${socialHtml}
      </div>
    </footer>
    <div class="cx-copy">© 2026 ${esc(o.name)} · Tous droits réservés</div>`;
  const telHref = o.phone ? 'tel:' + o.phone.replace(/[^0-9+]/g, '') : '';
  const cxCall = o.phone ? `
      <a class="cx-call" href="${telHref}">
        <span class="cx-call-ic">✆</span>
        <span class="cx-call-txt"><small>Une question&nbsp;?</small><b>${esc(o.phone)}</b></span>
      </a>` : '';
  const cxCatOptions = (groups.length ? groups : [{ id: '', title: hasServices ? 'Nos prestations' : 'Nos produits' }])
    .map(g => `<option>${esc(g.title)}</option>`).join('');
  const cosmeticBody = `
    <header class="cx-head" id="cx-top">
      <div class="cx-top">
        <div class="cx-logo"><img class="cx-logo-img" src="${escAttr(logoSrc)}" alt="${escAttr(o.name)}"><span>${esc(o.name)}</span></div>
        <label class="cx-cat">
          <select onchange="location.hash='#cx-shop'">
            <option>Toutes catégories</option>
            ${cxCatOptions}
          </select>
        </label>
        ${cxCall}
      </div>
      <div class="cx-navrow">
        <nav class="cx-nav">
          <a href="#cx-top">Accueil</a>
          <a href="#cx-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
          <a href="#cx-about">À propos</a>
          <a href="#cx-contact">Contact</a>
        </nav>
        <div class="cx-icons">
          <span class="cx-ic" title="Rechercher"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
          <span class="cx-ic" title="Favoris"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></span>
          <a class="cx-ic cx-cart" href="#cx-shop" title="Panier"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></a>
        </div>
      </div>
    </header>
    <section class="cx-hero">
      <div class="cx-hero-txt">
        <span class="cx-eyebrow">OFFRES LIMITÉES DISPONIBLES</span>
        <h1 class="cx-hero-title">La beauté inspirée<br>par la nature</h1>
        <p class="cx-hero-sub">${esc(clip(o.desc || `Des soins naturels pensés pour sublimer ta peau au quotidien. Commande en ligne, paiement sécurisé, retrait ou livraison.`, 150))}</p>
        <div class="cx-hero-cta">
          <a class="cx-btn" href="#cx-shop">${hasProducts ? 'Visiter la boutique' : hasTerrains ? 'Réserver' : 'Découvrir'}</a>
          <a class="cx-play" href="#cx-about"><span class="cx-play-ic">&#9654;</span> Voir la vidéo</a>
        </div>
        ${cxStats}
      </div>
      <div class="cx-hero-img">
        ${heroImg ? `<img class="cx-hero-model" src="${escAttr(heroImg)}" alt="${escAttr(o.name)}">` : ''}
        <div class="cx-hero-badge">✓ Produits naturels</div>
      </div>
    </section>
    ${gal.length >= 2 ? cxBanners : ''}
    ${cxBest}
    ${closedNotice}
    <section id="cx-shop" class="cx-shop${catalogCls}">
      <div class="cx-sec-head">
        <span class="cx-sec-k">Notre catalogue</span>
        <h2 class="cx-sec-title">${hasProducts ? 'Tous nos produits' : hasServices ? 'Nos prestations' : 'Nos terrains'}</h2>
      </div>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    ${gal.length >= 1 ? cxFeature : ''}
    ${cxPerks}
    ${cxFoot}
    <style>
      .cx-zoom{will-change:transform,border-radius;transform:scale(.88);border-radius:34px;overflow:hidden;transition:box-shadow .4s ease}
      .cx-zoom img{border-radius:0!important}
      .cx-hero-model,.cx-hero-badge{will-change:transform}
      .cx-mask-l{display:block;overflow:hidden}
      .cx-mask-l>span{display:block;transform:translateY(115%);transition:transform .9s cubic-bezier(.16,1,.3,1);will-change:transform}
      .cx-mask-l:nth-child(2)>span{transition-delay:.14s}
      .cx-mask.cx-in .cx-mask-l>span{transform:translateY(0)}
      /* Border Beam — tracé lumineux du périmètre */
      .cx-beam-card{position:relative}
      .cx-beam{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;overflow:visible}
      .cx-beam-rect{fill:none;stroke-width:3;stroke-linecap:round;width:calc(100% - 3px);height:calc(100% - 3px);will-change:stroke-dashoffset;filter:drop-shadow(0 0 6px rgba(34,211,238,.9))}
      /* Bento — assemblage magnétique */
      .cx-bento-piece{opacity:0;transform:translate3d(var(--tx,0),var(--ty,0),0) rotate(var(--rot,0)) scale(.92);transition:transform .95s cubic-bezier(.16,1,.3,1),opacity .75s ease;transition-delay:calc(var(--bd,0) * 80ms);will-change:transform,opacity}
      .cx-bento.cx-in .cx-bento-piece{opacity:1;transform:translate3d(0,0,0) rotate(0) scale(1)}
      @media(prefers-reduced-motion:reduce){.cx-zoom{transform:none!important;border-radius:14px!important}.cx-mask-l>span{transform:none!important}.cx-bento-piece{opacity:1!important;transform:none!important}.cx-beam-rect{display:none}}
    </style>
    <script>(function(){
      try{
        if(document.body&&document.body.classList.contains('lassi-ed'))return;
        if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
        var model=document.querySelector('.cx-hero-model');
        var badge=document.querySelector('.cx-hero-badge');
        var zoom=document.querySelector('.cx-zoom');
        var ticking=false;
        function clamp(v,a,b){return v<a?a:v>b?b:v;}
        function frame(){
          ticking=false;
          var vh=window.innerHeight;
          // Parallax hero : dérive douce, calques à vitesses opposées
          if(model){
            var r=model.getBoundingClientRect();
            if(r.bottom>0&&r.top<vh){ var p=(r.top+r.height/2-vh/2); model.style.transform='translateY('+(p*-0.07).toFixed(1)+'px)'; }
          }
          if(badge){
            var rb=badge.getBoundingClientRect();
            if(rb.bottom>0&&rb.top<vh){ var pb=(rb.top+rb.height/2-vh/2); badge.style.transform='translateY('+(pb*0.12).toFixed(1)+'px)'; }
          }
          // Zoom Apple : scale .88->1 + coins qui s'arrondissent en se centrant
          if(zoom){
            var rz=zoom.getBoundingClientRect();
            if(rz.bottom>0&&rz.top<vh){
              var dist=Math.abs((rz.top+rz.height/2)-vh/2)/(vh/2);
              var t=clamp(1-dist,0,1); // 1 = centré
              zoom.style.transform='scale('+(0.88+0.12*t).toFixed(3)+')';
              zoom.style.borderRadius=(34-20*t).toFixed(0)+'px';
            }
          }
        }
        function onScroll(){ if(!ticking){ ticking=true; requestAnimationFrame(frame); } }
        window.addEventListener('scroll',onScroll,{passive:true});
        window.addEventListener('resize',onScroll,{passive:true});
        frame();
        // Counter-up sur les stats + Text reveal (mask) du titre feature
        if('IntersectionObserver'in window){
          function count(el){
            var target=parseFloat(el.getAttribute('data-target'))||0;
            var suf=el.getAttribute('data-suffix')||'';
            var start=null,dur=1400;
            function step(ts){
              if(start===null)start=ts;
              var p=Math.min((ts-start)/dur,1);
              var e=1-Math.pow(1-p,3); // easeOutCubic
              el.textContent=Math.round(target*e)+suf;
              if(p<1)requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          }
          var io2=new IntersectionObserver(function(ents){
            ents.forEach(function(e){
              if(!e.isIntersecting)return;
              var t=e.target;
              if(t.classList.contains('cx-count'))count(t);
              else t.classList.add('cx-in');
              io2.unobserve(t);
            });
          },{threshold:.4});
          [].slice.call(document.querySelectorAll('.cx-count,.cx-mask')).forEach(function(el){io2.observe(el);});
          // Bento : assemblage magnétique — directions N/S/E/O + inclinaison + délai
          var bentos=[].slice.call(document.querySelectorAll('.cx-bento'));
          bentos.forEach(function(b){
            var pieces=[].slice.call(b.querySelectorAll('.cx-bento-piece'));
            var dirs=[[-70,0,-3],[0,-65,4],[70,0,3.5],[0,65,-4],[55,45,2.5],[-55,45,-2.5],[45,-55,3]];
            pieces.forEach(function(p,i){var d=dirs[i%dirs.length];p.style.setProperty('--tx',d[0]+'px');p.style.setProperty('--ty',d[1]+'px');p.style.setProperty('--rot',d[2]+'deg');p.style.setProperty('--bd',i);});
          });
          var ioB=new IntersectionObserver(function(ents){ents.forEach(function(e){if(e.isIntersecting){e.target.classList.add('cx-in');ioB.unobserve(e.target);}});},{threshold:.18});
          bentos.forEach(function(b){ioB.observe(b);});
        }
        // Border Beam — tracé du périmètre lié au scroll
        var beams=[].slice.call(document.querySelectorAll('.cx-beam-card')).map(function(w){return {w:w,r:w.querySelector('.cx-beam-rect'),len:0};});
        function measureBeams(){beams.forEach(function(it){if(!it.r)return;var bx=it.w.getBoundingClientRect();var ww=Math.max(0,bx.width-3),hh=Math.max(0,bx.height-3),rr=16;var per=2*(ww+hh-4*rr)+2*Math.PI*rr;it.len=per;it.r.style.strokeDasharray=per;it.r.style.strokeDashoffset=per;});}
        measureBeams();window.addEventListener('resize',measureBeams,{passive:true});
        function beamFrame(){var vh=window.innerHeight;beams.forEach(function(it){if(!it.r||it.len<=0)return;var r=it.w.getBoundingClientRect();var s=vh*0.9,en=vh*0.25;var p=Math.min(Math.max((s-r.top)/(s-en),0),1);it.r.style.strokeDashoffset=(it.len*(1-p)).toFixed(1);});}
        if(beams.length){window.addEventListener('scroll',function(){requestAnimationFrame(beamFrame);},{passive:true});beamFrame();}
      }catch(e){}
    })();</script>
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « FURNITURE » — Maison & Mobilier (réf Furniture.html).
  // Header 2 rangées, hero mint + collage, catalogue réel réutilisé, bande
  // « parcourir par catégorie » (sombre), bande matières, footer + réseaux.
  // ═══════════════════════════════════════════════════════════════════════════
  const fnRate = 1 + COMMISSION_RATE;
  const fnPrice = (p: Product): string => fmtPrice(Math.round(p.price * fnRate));
  const fnCard = (i: number): string => {
    const p = o.products[i];
    if (!p) return `<div class="fn-pcard fn-empty" ${bg(pick(i))}></div>`;
    return `<div class="fn-pcard"><span class="fn-pt">${esc(clip(p.name, 24))}</span><span class="fn-pp">${fnPrice(p)}</span><div class="fn-pim" ${bg(p.photo_url || pick(i))}></div><span class="fn-arrow">&#8594;</span></div>`;
  };
  const fnCats = (groups.length ? groups : [{ id: '', title: hasServices ? 'Prestations' : 'Boutique' }]).slice(0, 7);
  const fnRoomItems = (groups.length ? groups : []).slice(0, 3);
  const fnRooms = (gal.length >= 2 && fnRoomItems.length >= 3) ? `
    <section class="fn-rooms"><div class="fn-rooms-in">
      <div class="fn-rooms-top"><h2>Parcourir par catégorie</h2><p>Trouvez l'inspiration pour chaque espace de votre maison.</p></div>
      <div class="fn-rooms-grid lx-fx-bento">
        ${fnRoomItems.map((r, i) => `<a class="fn-room lx-fx-piece ${i === 0 ? 'big' : ''}" href="#cx-shop" ${bg(pick(i))}><span class="fn-chip"><b>${esc(r.title)}</b></span></a>`).join('')}
      </div>
    </div></section>` : '';
  const fnMaterials = gal.length >= 1 ? `
    <section class="fn-materials" id="fn-about"><div class="fn-mat">
      <div class="fn-mat-l">
        <h2>Un savoir-faire d'exception commence par les meilleures matières</h2>
        <p>${esc(clip(o.desc || `Matières nobles et finitions soignées. Chaque pièce de ${o.name} est pensée pour durer et traverser les années avec élégance.`, 170))}</p>
        <a class="fn-btn" href="#cx-shop">${cxHeadCta}</a>
      </div>
      <div class="fn-mat-gal"><div class="fn-mg lx-fx-curtain" ${bg(pick(0))}></div><div class="fn-mg lx-fx-curtain" ${bg(pick(1))}></div><div class="fn-mg lx-fx-curtain" ${bg(pick(2))}></div></div>
    </div></section>` : '';
  const fnFoot = `
    <footer id="fn-contact" class="fn-foot">
      <div class="fn-foot-grid">
        <div class="fn-foot-brand">
          ${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<div class="fn-foot-logo">${esc(o.name)}</div>`}
          <p>${esc(clip(o.desc || `${o.name} sur LASSİ — commande & paiement sécurisé.`, 130))}</p>
        </div>
        <div class="fn-foot-col"><h4>Boutique</h4>${fnCats.slice(0, 4).map(g => `<a href="#cx-shop">${esc(g.title)}</a>`).join('')}</div>
        <div class="fn-foot-col"><h4>Infos</h4>${o.cat ? `<p>${esc(o.cat)}</p>` : ''}${o.zone ? `<p>📍 ${esc(o.zone)}</p>` : ''}${o.phone ? `<p>✆ ${esc(o.phone)}</p>` : ''}${hoursHtml ? `<div class="fn-foot-hours">${hoursHtml}</div>` : ''}</div>
        <div class="fn-foot-col"><h4>Nous suivre</h4><p>Wave · Orange Money</p>${socialHtml}</div>
      </div>
      <div class="fn-copy">© 2026 ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>`;
  const furnitureBody = `
    <header class="fn-head" id="fn-top">
      <div class="fn-h1">
        <a class="fn-logo" href="#fn-top">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(o.name)}</span>`}</a>
        <div class="fn-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> <span>Rechercher</span></div>
        <nav class="fn-nav">
          <a href="#fn-top">Accueil</a>
          <a href="#cx-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
          <a href="#fn-about">À propos</a>
          <a href="#fn-contact">Contact</a>
        </nav>
        <a class="fn-cart" href="#cx-shop"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> <span>Panier</span></a>
      </div>
      <div class="fn-h2">
        <div class="fn-cats">${fnCats.map(g => `<a href="#cx-shop">${esc(g.title)}</a>`).join('')}</div>
        <div class="fn-info">${o.zone ? `<div>Adresse<b>${esc(o.zone)}</b></div>` : ''}${o.phone ? `<div>Téléphone<b>${esc(o.phone)}</b></div>` : ''}</div>
      </div>
    </header>
    <section class="fn-hero-sec"><div class="fn-hero">
      <div class="fn-hero-l">
        <h1>${esc(o.name)}</h1>
        <p>${esc(clip(o.desc || `Pièces d'exception et savoir-faire local. Commandez en ligne, paiement sécurisé.`, 115))}</p>
        <div class="fn-hero-cta"><a class="fn-btn" href="#cx-shop">${cxHeadCta}</a>${hoursHtml ? `<div class="fn-hours">${hoursHtml}</div>` : ''}</div>
      </div>
      <div class="fn-collage">
        ${fnCard(0)}${fnCard(1)}
        <div class="fn-big" ${bg(pick(0))}></div>
        <div class="fn-promo"><p>Paiement sécurisé Wave &amp; Orange Money.</p><a href="#cx-shop">Découvrir &#8594;</a></div>
      </div>
    </div></section>
    ${closedNotice}
    <section id="cx-shop" class="fn-shop${catalogCls}">
      <div class="fn-sec-head"><span class="fn-k">Notre sélection</span><h2>${hasProducts ? 'La boutique' : hasServices ? 'Nos prestations' : 'Nos terrains'}</h2></div>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    ${fnRooms}
    ${fnMaterials}
    ${fnFoot}
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « GARDEROBE » — Mode & Prêt-à-porter (réf boutique fashion).
  // Header sombre (logo / nav / icônes), hero clair avec visuel détouré + 3
  // atouts, bande sombre 4 perks, catalogue réel réutilisé, footer + réseaux.
  // ═══════════════════════════════════════════════════════════════════════════
  const gdCats = (groups.length ? groups : [{ id: '', title: hasServices ? 'Prestations' : 'Boutique' }]).slice(0, 6);
  const gdFeats = ['Qualité garantie', 'Paiement sécurisé', 'Livraison rapide'];
  const gdPerkItems = [
    ['Paiement sécurisé', 'Wave &amp; Orange Money'],
    ['Retrait / livraison', esc(o.zone || 'À Dakar')],
    ['Qualité garantie', 'pièces sélectionnées'],
    ['Support client', 'rappel après commande'],
  ].map(([b, s]) => `<div class="gd-perk"><div><b>${b}</b><small>${s}</small></div></div>`).join('');
  const gdPerks = `
    <section class="gd-perks"><div class="gd-marq"><div class="gd-marq-track">${gdPerkItems}${gdPerkItems}${gdPerkItems}</div></div></section>`;
  const gdFoot = `
    <footer id="gd-contact" class="gd-foot">
      <div class="gd-foot-grid">
        <div class="gd-foot-brand">
          ${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<div class="gd-foot-logo">${esc(o.name)}</div>`}
          <p>${esc(clip(o.desc || `${o.name} — mode & prêt-à-porter. Commande & paiement sécurisé sur LASSİ.`, 140))}</p>
          ${socialHtml}
        </div>
        <div class="gd-foot-col"><h4>Boutique</h4>${gdCats.slice(0, 4).map(g => `<a href="#gd-shop">${esc(g.title)}</a>`).join('')}</div>
        <div class="gd-foot-col"><h4>Infos</h4>${o.cat ? `<p>${esc(o.cat)}</p>` : ''}${o.zone ? `<p>${esc(o.zone)}</p>` : ''}${o.phone ? `<p>${esc(o.phone)}</p>` : ''}${hoursHtml ? `<div class="gd-foot-hours">${hoursHtml}</div>` : ''}</div>
        <div class="gd-foot-col"><h4>Commander</h4><p>Wave · Orange Money</p><p>Retrait sur place ou livraison</p><a class="gd-foot-cta" href="#gd-shop">Voir la boutique</a></div>
      </div>
      <div class="gd-copy">© 2026 ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>`;
  // Bande « Parcourir par catégorie » (sombre) — vraies catégories + images galerie.
  const gdCatCards = (groups.length >= 3 && gal.length >= 1) ? `
    <section class="gd-cats-sec"><div class="gd-cats-wrap">
      <div class="gd-sec-head light"><span class="gd-k light">Nos rayons</span><h2>Parcourir par catégorie</h2></div>
      <div class="gd-cats-grid lx-fx-bento">
        ${groups.slice(0, 3).map((g, i) => `<a class="gd-cat-card lx-fx-piece" href="#gd-shop" ${bg(pick(i))}><span class="gd-cat-ov"></span><span class="gd-cat-info"><small>${g.items.length} article${g.items.length > 1 ? 's' : ''}</small><b>${esc(g.title)}</b></span></a>`).join('')}
      </div>
    </div></section>` : '';
  // Bloc éditorial « la maison » — boîte sombre sur grand visuel + signature = nom boutique.
  const gdEditorial = gal.length >= 1 ? `
    <section class="gd-edito" id="gd-about">
      <div class="gd-edito-img lx-fx-curtain" ${bg(pick(1))}></div>
      <div class="gd-edito-box">
        <span class="gd-k light">La maison</span>
        <h2>Le style qui te ressemble</h2>
        <p>${esc(clip(o.desc || `${o.name} sélectionne des pièces tendance et durables. Commande en ligne, paiement sécurisé Wave & Orange Money, retrait ou livraison à Dakar.`, 210))}</p>
        <span class="gd-sign">${esc(o.name)}</span>
      </div>
    </section>` : '';
  // Bande « offres » — 3 produits réels (cartes fonctionnelles) + panneau CTA.
  const gdDealItems = o.products.slice(0, 3);
  const gdDealTitle = o.promos.length ? clip(o.promos[0].titre, 40) : 'Nos pièces phares';
  const gdDeals = (gdDealItems.length >= 3) ? `
    <section class="gd-deals"><div class="gd-deals-wrap">
      <div class="gd-deals-grid grid">${gdDealItems.map(productCard).join('')}</div>
      <div class="gd-deals-panel lx-fx-beam">
        <svg class="lx-fx-beam-svg" preserveAspectRatio="none"><defs><linearGradient id="gdBeam" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#22D3EE"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#2563EB"/></linearGradient></defs><rect class="lx-fx-beam-rect" x="1.5" y="1.5" rx="16" ry="16" stroke="url(#gdBeam)" style="filter:drop-shadow(0 0 6px rgba(34,211,238,.9))"/></svg>
        <span class="gd-deals-k">Sélection</span>
        <h3>${esc(gdDealTitle)}</h3>
        <p>Nos coups de cœur du moment. Commande en ligne, paiement sécurisé Wave &amp; Orange Money, retrait ou livraison.</p>
        <a class="gd-btn" href="#gd-shop">Voir tout</a>
      </div>
    </div></section>` : '';
  const garderobeBody = `
    <header class="gd-head" id="gd-top">
      <div class="gd-head-in">
        <a class="gd-logo" href="#gd-top">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(o.name)}</span>`}</a>
        <nav class="gd-nav">
          <a href="#gd-top">Accueil</a>
          <a href="#gd-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
          <a href="#gd-about">À propos</a>
          <a href="#gd-contact">Contact</a>
        </nav>
        <a class="gd-head-cta" href="#gd-shop">${cxHeadCta === 'Commander' ? 'Boutique' : cxHeadCta}</a>
      </div>
    </header>
    <section class="gd-hero">
      <div class="gd-hero-l">
        <span class="gd-eyebrow">${esc(o.name)}</span>
        <h1 class="gd-hero-title">La nouvelle collection<br>est arrivée</h1>
        <p class="gd-hero-sub">${esc(clip(o.desc || `Vêtements, sneakers et accessoires tendance. Commande en ligne, paiement sécurisé, retrait ou livraison.`, 160))}</p>
        <div class="gd-feats">${gdFeats.map(f => `<span class="gd-feat">${esc(f)}</span>`).join('')}</div>
        <div class="gd-hero-cta"><span class="lx-fx-zin"><a class="gd-btn" href="#gd-shop">${cxHeadCta === 'Commander' ? 'Explorer la boutique' : cxHeadCta}</a></span>${hoursHtml ? `<div class="gd-hours">${hoursHtml}</div>` : ''}</div>
      </div>
      <div class="gd-hero-r">
        ${heroImg ? `<img class="gd-hero-img" data-pll="0.07" src="${escAttr(heroImg)}" alt="${escAttr(o.name)}">` : ''}
      </div>
    </section>
    ${gdPerks}
    ${closedNotice}
    <section id="gd-shop" class="gd-shop${catalogCls}" >
      <div class="gd-sec-head"><span class="gd-k">Notre sélection</span><h2>${hasProducts ? 'Nouveautés' : hasServices ? 'Nos prestations' : 'Nos terrains'}</h2></div>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    ${gdCatCards}
    ${gdEditorial}
    ${gdDeals}
    ${gdFoot}
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « SAC » — Maroquinerie & Bagagerie (réf « Modern Shop »).
  // Header clair logo centré + nav, hero split (texte + grand visuel), bloc
  // discount + carte à propos, grille « catégories » 4 visuels, catalogue réel.
  // ═══════════════════════════════════════════════════════════════════════════
  const scCats = (groups.length ? groups : [{ id: '', title: hasServices ? 'Prestations' : 'Boutique' }]).slice(0, 5);
  const scTypeItems = (groups.length ? groups : []).slice(0, 4);
  const scTypes = (gal.length >= 2 && scTypeItems.length >= 3) ? `
    <section class="sc-types" id="sc-types"><div class="sc-types-in">
      <div class="sc-types-head"><h2>Nos catégories</h2><p>Trouvez le sac fait pour vous.</p></div>
      <div class="sc-types-grid lx-fx-bento">
        ${scTypeItems.map((r, i) => {
          const d = (r.items[0]?.description || '').trim();
          const sub = d ? clip(d, 78) : `${r.items.length} modèle${r.items.length > 1 ? 's' : ''} disponible${r.items.length > 1 ? 's' : ''}`;
          return `<a class="sc-type lx-fx-piece" href="#sc-shop" ${bg(pick(i))}><span class="sc-type-ov"><b>${esc(r.title)}</b><small>${esc(sub)}</small></span></a>`;
        }).join('')}
      </div>
    </div></section>` : '';
  const scFoot = `
    <footer id="sc-contact" class="sc-foot">
      <div class="sc-foot-grid">
        <div class="sc-foot-brand">
          ${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<div class="sc-foot-logo">${esc(o.name)}</div>`}
          <p>${esc(clip(o.desc || `${o.name} — maroquinerie & bagagerie. Commande & paiement sécurisé sur LASSİ.`, 140))}</p>
          ${socialHtml}
        </div>
        <div class="sc-foot-col"><h4>Boutique</h4>${scCats.slice(0, 4).map(g => `<a href="#sc-shop">${esc(g.title)}</a>`).join('')}</div>
        <div class="sc-foot-col"><h4>Infos</h4>${o.cat ? `<p>${esc(o.cat)}</p>` : ''}${o.zone ? `<p>📍 ${esc(o.zone)}</p>` : ''}${o.phone ? `<p>✆ ${esc(o.phone)}</p>` : ''}${hoursHtml ? `<div class="sc-foot-hours">${hoursHtml}</div>` : ''}</div>
        <div class="sc-foot-col"><h4>Commander</h4><p>Wave · Orange Money</p><p>Retrait sur place ou livraison</p><a class="sc-foot-cta" href="#sc-shop">Voir la boutique →</a></div>
      </div>
      <div class="sc-copy">© 2026 ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>`;
  const sacBody = `
    <header class="sc-head" id="sc-top">
      <div class="sc-head-top">
        <div class="sc-head-side sc-head-social">${socialHtml || '<span class="sc-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>'}</div>
        <a class="sc-logo" href="#sc-top">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(o.name)}</span>`}</a>
        <div class="sc-head-side sc-head-tools"><span class="sc-ic" title="Rechercher"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span><a class="sc-ic sc-cart" href="#sc-shop" title="Panier"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></a></div>
      </div>
      <nav class="sc-nav">
        <a class="sc-nav-active" href="#sc-top">Accueil</a>
        <a href="#sc-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
        <a href="#sc-types">Catégories</a>
        <a href="#sc-about">À propos</a>
        <a href="#sc-contact">Contact</a>
      </nav>
    </header>
    <section class="sc-hero sc-hero-kb" ${bg(pick(0))}>
      <div class="sc-hero-ov"></div>
      <div class="sc-hero-in">
        <div class="sc-hero-l">
          <span class="sc-eyebrow">${o.cat ? esc(o.cat) : 'Nouvelle collection'}</span>
          <h1>${esc(o.name)}</h1>
          <p>${esc(clip(o.desc || `Sacs, sacs à dos et bagagerie robustes et élégants. Commande en ligne, paiement sécurisé.`, 150))}</p>
          <div class="sc-hero-cta"><a class="sc-btn" href="#sc-shop">${cxHeadCta === 'Commander' ? 'Voir la collection' : cxHeadCta}</a>${hoursHtml ? `<div class="sc-hours">${hoursHtml}</div>` : ''}</div>
        </div>
        <button class="sc-play" type="button" data-video="${escAttr(theme.video)}" data-scroll="#sc-shop" aria-label="Lecture vidéo">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </button>
      </div>
    </section>
    ${theme.video ? `<div class="sc-vlb" id="sc-vlb"><div class="sc-vlb-in"><button class="sc-vlb-x" type="button" aria-label="Fermer">&#10005;</button><video id="sc-vlb-video" src="${escAttr(theme.video)}" controls playsinline preload="metadata"></video></div></div>` : ''}
    <script>(function(){
      var pb=document.querySelector('.sc-play'); if(!pb) return;
      pb.addEventListener('click',function(){
        // En mode édition (overlay actif) : ne JAMAIS lire la vidéo — ouvrir le
        // panneau Médias dans l'app pour ajouter/retirer la vidéo. En aperçu/public : lecture.
        if(document.body.classList.contains('lassi-ed')){
          try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'led:openMedia'}));}catch(e){}
          return;
        }
        var v=pb.getAttribute('data-video');
        if(v){ var lb=document.getElementById('sc-vlb'), vd=document.getElementById('sc-vlb-video'); if(lb){ lb.classList.add('on'); try{vd.currentTime=0;vd.play();}catch(e){} } }
        else { var t=document.querySelector(pb.getAttribute('data-scroll')); if(t) t.scrollIntoView({behavior:'smooth'}); }
      });
      var lb=document.getElementById('sc-vlb');
      if(lb){ function close(){ lb.classList.remove('on'); var vd=document.getElementById('sc-vlb-video'); try{vd.pause();}catch(e){} }
        lb.addEventListener('click',function(e){ if(e.target===lb||e.target.className==='sc-vlb-x') close(); });
      }
    })();</script>
    <section class="sc-feature"><div class="sc-feature-in lx-fx-expand">
      <div class="sc-fcard lx-fx-beam">
        <svg class="lx-fx-beam-svg" preserveAspectRatio="none"><defs><linearGradient id="scBeam" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#22D3EE"/><stop offset="50%" stop-color="#ffffff"/><stop offset="100%" stop-color="#2563EB"/></linearGradient></defs><rect class="lx-fx-beam-rect" x="1.5" y="1.5" rx="16" ry="16" stroke="url(#scBeam)" style="filter:drop-shadow(0 0 6px rgba(34,211,238,.9))"/></svg>
        <div class="sc-fcard-top"><img class="sc-avatar" src="${escAttr(o.logo || (o.slug === '__demo' ? `${o.base}/assets/demo/sac/avatar.jpg` : initialAvatar(o.name)))}" alt="${escAttr(o.name)}"><div><b>${esc(o.name)}</b><small>${esc(o.cat || o.zone || 'Maroquinerie')}</small></div></div>
        <h2>Le sac qui vous suit partout</h2>
        <p>${esc(clip(o.desc || `${o.name} sélectionne des pièces durables et bien finies. Commande en ligne, paiement sécurisé Wave & Orange Money, retrait ou livraison à Dakar.`, 170))}</p>
      </div>
      <div class="sc-promo lx-fx-curtain" ${bg(pick(1))}><div class="sc-promo-ov">
        <span class="sc-promo-k">Paiement sécurisé</span>
        <h3>Paiement sécurisé Wave &amp; Orange Money</h3>
        <p>Commande en ligne, retrait sur place ou livraison à ${esc(o.zone || 'Dakar')}. Paiement 100% sécurisé.</p>
        <a class="sc-btn sc-btn-dark" href="#sc-shop">Découvrir &#8594;</a>
      </div></div>
    </div></section>
    ${scTypes}
    ${closedNotice}
    <section id="sc-shop" class="sc-shop${catalogCls}">
      <div class="sc-sec-head"><span class="sc-k">Notre sélection</span><h2>${hasProducts ? 'La boutique' : hasServices ? 'Nos prestations' : 'Nos terrains'}</h2></div>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    <section class="sc-about" id="sc-about"><div class="sc-about-in lx-fx-expand">
      <div class="sc-about-img" ${bg(pick(2))}></div>
      <div class="sc-about-txt">
        <span class="sc-k">À propos</span>
        <h2>Robuste, élégant, pensé pour durer</h2>
        <p>${esc(clip(o.desc || `${o.name} — maroquinerie & bagagerie. Des matières nobles et des finitions soignées, pour la ville comme le voyage. Commande en ligne, paiement sécurisé, retrait ou livraison à Dakar.`, 180))}</p>
        <a class="sc-btn" href="#sc-shop">${cxHeadCta === 'Commander' ? 'Voir la collection' : cxHeadCta}</a>
      </div>
    </div></section>
    ${scFoot}
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « TRESSE » — Salon de tresses / coiffure (réf Wix « Promeneur
  // de chien »). Fond crème, immense titre manuscrit (Amatic SC), accent corail,
  // décorations ligne-claire. Orienté SERVICES : « Mes services » est la section
  // navigable (ancre #tr-services) où se trouvent les prestations réservables.
  // ═══════════════════════════════════════════════════════════════════════════
  const trTagline = o.cat || 'Votre salon de tresses';
  const trAboutImg = pick(0);
  // Icône patte en ligne-claire (contour), fidèle au style du template de référence.
  const trPaws = `<svg class="tr-paw" viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="8.5" cy="12" rx="2.3" ry="3.1" transform="rotate(-18 8.5 12)"/><ellipse cx="14" cy="8.5" rx="2.2" ry="3" transform="rotate(-6 14 8.5)"/><ellipse cx="19.5" cy="9.5" rx="2.2" ry="3" transform="rotate(8 19.5 9.5)"/><ellipse cx="24" cy="13.5" rx="2.1" ry="2.8" transform="rotate(20 24 13.5)"/><path d="M16 16c-3.6 0-6.4 2.6-6.4 5.6 0 2.5 2.6 3.9 6.4 3.9s6.4-1.4 6.4-3.9c0-3-2.8-5.6-6.4-5.6z"/></svg>`;
  // Galerie « conteneurs » = images de la galerie du prestataire (jamais les services).
  const trGal = o.gallery.slice(0, 6);
  const trGallery = trGal.length ? `
    <section class="tr-gallery" id="tr-gallery">
      <div class="tr-gallery-head"><span class="tr-deco-sm">${trPaws}</span><h2 class="tr-h2">La galerie</h2></div>
      <div class="tr-gallery-grid lx-fx-bento">${trGal.map(u => `<div class="tr-gtile lx-fx-piece" ${bg(u)}></div>`).join('')}</div>
    </section>` : '';
  // Carte emplacement : si lat/lng définis → carte OpenStreetMap + repère. Sinon →
  // bouton « Définir votre emplacement » visible UNIQUEMENT en mode édition (prestataire).
  const hasLoc = typeof o.lat === 'number' && typeof o.lng === 'number';
  const trMap = hasLoc
    ? `<a class="tr-map-link" href="https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}" target="_blank" rel="noopener"><img class="tr-map" loading="lazy" alt="Emplacement ${escAttr(o.name)}" src="/staticmap?lat=${o.lat}&amp;lng=${o.lng}"><span class="tr-map-pin"><svg viewBox="0 0 24 24" width="36" height="36" fill="#FF7648" stroke="#fff" stroke-width="1.5"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#fff" stroke="none"/></svg></span><span class="tr-map-open">Voir l'itinéraire →</span></a>`
    : `<div class="tr-map tr-map-empty"><div class="tr-map-empty-in">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <button class="tr-loc-btn" type="button" onclick="(function(){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'led:setLocation'}));}catch(e){}})()">Définir votre emplacement</button>
        <p class="tr-map-hint">Emplacement bientôt disponible.</p>
      </div></div>`;
  // Ciseaux ligne-claire (remplace l'« os » du template de référence).
  const trScissors = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8" y1="7.2" x2="20" y2="16.5"/><line x1="8" y1="16.8" x2="20" y2="7.5"/><line x1="7.6" y1="7.6" x2="16" y2="12"/></svg>`;
  // Séparateur = trait courbe en pointillés + ciseau à côté (fidèle à la référence).
  const trSep = `<div class="tr-sep" aria-hidden="true"><svg class="tr-sep-curve" viewBox="0 0 320 44" fill="none" preserveAspectRatio="none"><path d="M4 40 C 100 2, 220 2, 316 40" stroke="currentColor" stroke-width="2" stroke-dasharray="2 9" stroke-linecap="round"/><path class="lx-fx-draw" d="M4 40 C 100 2, 220 2, 316 40" stroke="var(--tr-coral)" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg><span class="tr-sep-ic">${trScissors}</span></div>`;
  // Long séparateur pointillé qui TRAVERSE de l'« À propos » jusqu'à « Réserver »
  // (grande courbe verticale, ciseau en bas), fidèle à la référence.
  const trSepLong = `<div class="tr-sep-long" aria-hidden="true"><svg class="tr-sep-long-curve" viewBox="0 0 160 300" fill="none" preserveAspectRatio="none"><path d="M120 0 C 20 70, 150 150, 70 220 C 20 265, 90 285, 80 300" stroke="currentColor" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/><path class="lx-fx-draw" d="M120 0 C 20 70, 150 150, 70 220 C 20 265, 90 285, 80 300" stroke="var(--tr-coral)" stroke-width="2.6" stroke-linecap="round" fill="none"/></svg><span class="tr-sep-long-ic">${trScissors}</span></div>`;
  // Conteneur « réservation » mis en avant (image + détails + Réserver), 1re prestation.
  const fs = o.services[0];
  const fsImg = fs && typeof fs.image_url === 'string' && fs.image_url.startsWith('http') ? fs.image_url : pick(1);
  const trReserve = fs ? `
    <section class="tr-reserve" id="tr-reserve">
      <div class="tr-reserve-head"><h2 class="tr-h2 lx-fx-hl" style="--hl-on:var(--tr-ink);--hl-off:rgba(43,40,34,.22)">Réservez une prestation</h2>${trSep}</div>
      <div class="tr-feat prod svc book" data-svc="${escAttr(fs.id)}" data-name="${escAttr(fs.name)}" data-price="${prixClient(fs.price)}" data-meta="${escAttr(fs.meta)}" data-min="${Math.max(0, Math.round(fs.price))}">
        <div class="tr-feat-img" ${bg(fsImg)}></div>
        <div class="tr-feat-body">
          <h3 class="tr-feat-name">${esc(clip(fs.name, 40))}</h3>
          ${fs.description ? `<p class="tr-feat-desc">${esc(clip(fs.description, 120))}</p>` : ''}
          <div class="tr-feat-meta">${esc(fs.meta)}</div>
          <div class="tr-feat-price">${fmtPrice(fs.price)}</div>
          <button class="svcbtn bookbtn tr-feat-btn" type="button">Réserver</button>
        </div>
      </div>
      <div class="tr-reserve-cta"><a class="tr-cta" href="#tr-services" data-trnav="services">En savoir plus</a></div>
    </section>` : '';
  // Banc public + lampadaire en ligne-claire (icône exacte de la référence),
  // précédé d'un long tracé pointillé qui descend vers le banc.
  const trBench = `<svg class="tr-bench" viewBox="0 0 170 96" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="150" y1="92" x2="150" y2="20"/><path d="M150 20 a11 11 0 0 1 11 11"/><circle cx="161" cy="31" r="6.5"/><line x1="142" y1="92" x2="158" y2="92"/>
    <line x1="18" y1="42" x2="112" y2="42"/><line x1="18" y1="60" x2="112" y2="60"/>
    <line x1="18" y1="42" x2="18" y2="60"/><line x1="40" y1="42" x2="40" y2="60"/><line x1="65" y1="42" x2="65" y2="60"/><line x1="90" y1="42" x2="90" y2="60"/><line x1="112" y1="42" x2="112" y2="60"/>
    <path d="M18 42 L10 50 L10 66"/><path d="M112 42 L120 50 L120 66"/>
    <line x1="28" y1="60" x2="24" y2="84"/><line x1="28" y1="60" x2="40" y2="84"/><line x1="102" y1="60" x2="98" y2="84"/><line x1="102" y1="60" x2="114" y2="84"/>
    <line x1="18" y1="66" x2="120" y2="66"/>
  </svg>`;
  const trContactDeco = `<div class="tr-contact-deco" aria-hidden="true">
    <svg class="tr-contact-path" viewBox="0 0 640 130" fill="none" preserveAspectRatio="none"><path d="M12 14 C 230 120, 380 6, 520 96 C 560 122, 600 120, 612 112" stroke="currentColor" stroke-width="2" stroke-dasharray="2 10" stroke-linecap="round"/></svg>
    <span class="tr-bench-ic">${trBench}</span>
  </div>`;
  const trContact = `
    <section class="tr-contact" id="tr-contact">
      ${trContactDeco}
      <div class="tr-contact-in">
        <div class="tr-contact-txt">
          <h2 class="tr-h2">Contact</h2>
          ${o.phone ? `<p>✆ <a href="tel:${escAttr(o.phone.replace(/\s+/g, ''))}">${esc(o.phone)}</a></p>` : ''}
          ${o.zone ? `<p>📍 ${esc(o.zone)}</p>` : ''}
          ${hoursHtml ? `<div class="tr-hours">${hoursHtml}</div>` : ''}
          ${socialHtml}
        </div>
        <div class="tr-contact-map">${trMap}</div>
      </div>
    </section>`;
  const tresseBody = `
    <header class="tr-head" id="tr-top">
      <a class="tr-brand" href="#tr-top" data-trnav="home">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(clip(o.name, 22))}</span>`}</a>
      <nav class="tr-nav">
        <a class="tr-nav-active" href="#tr-top" data-trnav="home">Accueil</a>
        <a href="#tr-about" data-trnav="home">À propos</a>
        <a href="#tr-services" data-trnav="services">Mes services</a>
        <a href="#tr-contact" data-trnav="home">Contact</a>
      </nav>
      ${o.phone ? `<a class="tr-phone" href="tel:${escAttr(o.phone.replace(/\s+/g, ''))}">${esc(o.phone)}</a>` : `<span class="tr-phone">Sur rendez-vous</span>`}
    </header>

    <div class="tr-page tr-page-home">
    <section class="tr-hero">
      <span class="tr-deco tr-deco-1">${trPaws}</span>
      <span class="tr-deco tr-deco-2">${trPaws}</span>
      <span class="tr-deco tr-deco-3"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><line x1="8" y1="7.2" x2="20" y2="16.5"/><line x1="8" y1="16.8" x2="20" y2="7.5"/><line x1="7.6" y1="7.6" x2="16" y2="12"/></svg></span>
      <div class="tr-hero-in">
        ${o.logo ? `<img class="tr-hero-logo" src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : ''}
        <h1 class="tr-hero-name lx-fx-mask"><span class="lx-fx-mask-l"><span>${esc(clip(o.name, 16))}</span></span></h1>
        <div class="tr-hero-tag">${esc(clip(trTagline, 40))}</div>
        <a class="tr-cta" href="#tr-services" data-trnav="services">Prendre rendez-vous</a>
      </div>
      <span class="tr-path" aria-hidden="true"></span>
    </section>

    <section class="tr-about" id="tr-about">
      <div class="tr-about-txt">
        <h2 class="tr-h2 lx-fx-hl" style="--hl-on:var(--tr-ink);--hl-off:rgba(43,40,34,.22)">À propos</h2>
        <p>${esc(clip(o.desc || `${o.name}, votre salon de tresses. Prestations soignées, finitions nettes et conseils personnalisés. Réservez votre créneau en ligne et payez en toute sécurité.`, 240))}</p>
        <p>${esc(clip(`Tresses, nattes, tissages et coiffures protectrices — chaque prestation est réalisée avec soin${o.zone ? ' à ' + o.zone : ''}. Retrouvez toutes mes prestations dans l'onglet « Mes services ».`, 200))}</p>
      </div>
      <div class="tr-about-img lx-fx-curtain">${trAboutImg ? `<img src="${escAttr(trAboutImg)}" alt="${escAttr(o.name)}" loading="lazy">` : ''}</div>
    </section>

    ${trSepLong}
    ${trReserve}
    ${trSep}
    ${trGallery}
    ${trSep}
    ${trContact}
    </div>

    <div class="tr-page tr-page-services" hidden>
      ${closedNotice}
      <section class="tr-services${catalogCls}">
        <div class="tr-services-head">
          <span class="tr-deco-sm">${trScissors}</span>
          <h2 class="tr-h2 lx-fx-hl" style="--hl-on:var(--tr-ink);--hl-off:rgba(43,40,34,.22)">Mes services</h2>
          <p>Réservez la prestation qui vous convient, paiement sécurisé Wave &amp; Orange Money.</p>
          ${trSep}
        </div>
        <div class="lx-fx-stagger">${catnav}${dsSection}${grid}
        ${svcSection}</div>
        ${terrainSection}
      </section>
    </div>

    <footer class="tr-foot">
      <div class="tr-foot-in">
        <div class="tr-foot-name">${esc(o.name)}</div>
        <p>Réservation &amp; paiement en ligne · Wave · Orange Money</p>
        <a class="tr-cta tr-cta-sm" href="https://lassi.tech" target="_blank" rel="noopener">Télécharger l'application</a>
      </div>
      <div class="tr-copy">© 2026 ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>

    <script>(function(){
      var home=document.querySelector('.tr-page-home'), svc=document.querySelector('.tr-page-services');
      if(!home||!svc) return;
      function show(which, anchor, active){
        var toSvc = which==='services';
        svc.hidden=!toSvc; home.hidden=toSvc;
        document.querySelectorAll('.tr-nav a').forEach(function(a){ a.classList.toggle('tr-nav-active', a===active); });
        if(anchor){ var t=document.querySelector(anchor); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); }, 60); return; } }
        window.scrollTo({top:0,behavior:'smooth'});
      }
      document.querySelectorAll('[data-trnav]').forEach(function(a){
        a.addEventListener('click', function(e){
          // En mode édition, laisser l'overlay gérer la sélection de texte sur les liens.
          if(document.body.classList.contains('lassi-ed')) return;
          e.preventDefault();
          var w=a.getAttribute('data-trnav'); var h=a.getAttribute('href')||'';
          show(w, (w==='home' && h.indexOf('#tr-')===0 && h!=='#tr-top') ? h : null, a.closest('.tr-nav')?a:null);
        });
      });
    })();</script>
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « FERME » — Ferme agricole / élevage (réf Wix « Ferme Arno »).
  // Fond crème, titres Oswald condensés MAJ, texte serif (Cormorant), accent vert
  // forêt + bloc orange. Disposition fidèle : hero plein écran image + overlay,
  // bande 3 colonnes (histoire / produits frais / visite), boutique (catalogue réel),
  // témoignages, grille Instagram, footer à 3 colonnes + silhouette.
  // ═══════════════════════════════════════════════════════════════════════════
  const fmHenIco = '<img class="fm-hen" src="/assets/ferme/hen.png" alt="">';
  const fmTags = ['100% Naturel', 'Libre parcours', 'Sans OGM'];
  const fmEggImg = (o.products.find(p => /uf/i.test(p.name))?.photo_url) || pick(1);
  const fmVisitImg = pick(2);
  // Bande 3 colonnes (sous le hero) — histoire / bloc produits frais / visite.
  const fmBand = `
    <section class="fm-band lx-fx-expand">
      <a class="fm-band-img" href="#fm-ab-top" data-fmnav="about" ${bg(fmEggImg)}><span class="fm-band-card lx-fx-zin"><b>La Ferme</b><small>Notre histoire</small></span></a>
      <div class="fm-band-mid">
        <span class="fm-seal">Produits frais de la ferme</span>
        <h3>Produits<br>frais</h3>
        <p>${esc(clip(o.desc || `Œufs, volaille et viande de notre élevage familial, nourris naturellement et récoltés chaque jour.`, 150))}</p>
        <span class="lx-fx-zin"><a class="fm-btn" href="#fm-shop" data-fmnav="shop">Commander</a></span>
      </div>
      <a class="fm-band-img" href="#fm-contact" ${bg(fmVisitImg)}><span class="fm-band-card lx-fx-zin"><b>Rendez-nous visite</b><small>Notre adresse</small></span></a>
    </section>`;
  // Témoignages (statique, décor poulet).
  const fmTesti = `
    <section class="fm-testi" id="fm-about">
      <span class="fm-testi-ic">${fmHenIco}</span>
      <h2>Témoignages de nos clients</h2>
      <p class="fm-quote lx-fx-hl" style="--hl-on:var(--fm-ink);--hl-off:rgba(46,69,55,.2)">« Des produits d'une fraîcheur exceptionnelle. Les œufs et la volaille de ${esc(clip(o.name, 30))} sont incomparables — on sent le vrai goût de la ferme. »</p>
      <p class="fm-testi-who">Arthur Perrier&nbsp; /&nbsp; ${esc(o.zone || 'Dakar')}</p>
    </section>`;
  // Grille Instagram (galerie + produits).
  const fmInstaPool = [...gal.slice(1), ...o.products.map(p => p.photo_url || '').filter(Boolean)].filter(Boolean).slice(0, 8);
  const fmInsta = fmInstaPool.length >= 4 ? `
    <section class="fm-insta" id="fm-insta">
      <h2>Suivez-nous sur Instagram</h2>
      <p class="fm-insta-tag">#${esc((o.name || 'ferme').toLowerCase().replace(/[^a-z0-9]/g, ''))}</p>
      <div class="fm-insta-grid lx-fx-bento">${fmInstaPool.map(u => `<div class="fm-insta-tile lx-fx-piece" ${bg(u)}></div>`).join('')}</div>
    </section>` : '';
  const fmFoot = `
    <footer id="fm-contact" class="fm-foot">
      <div class="fm-foot-in">
        <div class="fm-foot-logo">${fmHenIco}</div>
        <div class="fm-foot-col">
          <h4>Détails</h4>
          ${o.zone ? `<p>${esc(o.zone)}</p>` : ''}
          ${o.phone ? `<p>${esc(o.phone)}</p>` : ''}
          ${o.cat ? `<p>${esc(o.cat)}</p>` : ''}
          ${hoursHtml ? `<div class="fm-foot-hours">${hoursHtml}</div>` : ''}
        </div>
        <div class="fm-foot-col">
          <h4>Boutique</h4>
          <p><a href="#fm-shop" data-fmnav="shop">Acheter des produits</a></p>
          <p><a href="#fm-ab-top" data-fmnav="about">À propos de la ferme</a></p>
          <p>Paiement Wave · Orange Money</p>
          <p>Livraison ou retrait à la ferme</p>
        </div>
        <div class="fm-foot-soc">${socialHtml}<p>© 2026 par ${esc(o.name)}</p><p>Propulsé par LASSİ</p></div>
      </div>
    </footer>`;
  // Page « À propos » (séparée) — histoire (orange + photo), intro, bandes alternées.
  const fmAboutPage = `
    <div class="fm-page fm-page-about" hidden>
      <section class="fm-ab-hero" id="fm-ab-top">
        <div class="fm-ab-hero-txt">
          <span class="fm-k">Notre histoire</span>
          <h2>Une ferme familiale,<br>de génération en génération</h2>
          <p>${esc(clip(o.desc || `Depuis ses débuts, ${o.name} perpétue un savoir-faire d'élevage transmis de génération en génération — des bêtes élevées avec soin, nourries naturellement, dans le respect du vivant.`, 230))}</p>
        </div>
        <div class="fm-ab-hero-img" ${bg(pick(3))}></div>
      </section>
      <section class="fm-ab-intro">
        <span class="fm-testi-ic">${fmHenIco}</span>
        <h2>À propos de ${esc(clip(o.name, 30))}</h2>
        <div class="fm-ab-cols">
          <p>Notre ferme, c'est avant tout une passion pour le vivant et la qualité. Chaque animal est élevé en plein air, nourri sans hormones ni OGM et suivi au quotidien pour garantir des produits sains et savoureux.</p>
          <p>Œufs frais, volaille, bétail et petit élevage : nous sélectionnons le meilleur pour votre table. Commandez en ligne — nous livrons à ${esc(o.zone || 'Dakar')} ou vous accueillons directement à la ferme.</p>
        </div>
        <a class="fm-btn-outline" href="#fm-contact" data-fmnav="about">Visitez-nous</a>
      </section>
      <section class="fm-ab-split">
        <div class="fm-ab-split-img lx-fx-curtain" ${bg(pick(4))}></div>
        <div class="fm-ab-split-txt">
          <h3>100% biologique, libre parcours et sans OGM</h3>
          <p>Nos bêtes vivent en plein air et se nourrissent naturellement. Pas d'hormones, pas d'OGM — juste un élevage respectueux qui donne des produits au vrai goût de la ferme.</p>
        </div>
      </section>
      <section class="fm-ab-split reverse">
        <div class="fm-ab-split-txt">
          <h3>Un savoir-faire au service de la qualité</h3>
          <p>De l'éclosion à la récolte, chaque étape est maîtrisée avec exigence. Fraîcheur, traçabilité et bien-être animal sont au cœur de notre démarche quotidienne.</p>
        </div>
        <div class="fm-ab-split-img lx-fx-curtain" ${bg(pick(5))}></div>
      </section>
    </div>`;
  const fermeBody = `
    <header class="fm-head" id="fm-top">
      <nav class="fm-nav">
        <a href="#fm-ab-top" data-fmnav="about">À propos de la ferme</a>
        <a href="#fm-shop" data-fmnav="shop">Acheter des produits</a>
        <a href="#fm-insta" data-fmnav="home">Galerie</a>
        <a class="fm-nav-active" href="#fm-top" data-fmnav="home">Bonjour</a>
      </nav>
      <div class="fm-head-row">
      <a class="fm-logo" href="#fm-top" data-fmnav="home">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : ''}<span>${esc(clip(o.name, 26))}</span></a>
      <div class="fm-icons">
        <span class="fm-ic" title="Compte"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>
        <a class="fm-ic fm-cart" href="#fm-shop" data-fmnav="shop" title="Panier"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></a>
      </div>
      </div>
    </header>

    <div class="fm-page fm-page-home">
    <section class="fm-hero lx-fx-kb" ${bg(heroImg)}>
      <div class="fm-hero-ov"></div>
      <div class="fm-hero-in">
        <span class="fm-hero-year">— ${esc(o.zone || 'Ferme & terroir')} —</span>
        <h1 class="fm-hero-title">${esc(o.name)}</h1>
        <div class="fm-hero-tags">${fmTags.map(t => esc(t)).join(' &nbsp;/&nbsp; ')}</div>
      </div>
    </section>
    ${fmBand}
    ${fmTesti}
    ${fmInsta}
    </div>

    <div class="fm-page fm-page-shop" hidden>
      ${closedNotice}
      <section id="fm-shop" class="fm-shop${catalogCls}">
        <div class="fm-sec-head"><span class="fm-k">Acheter des produits</span><h2 class="lx-fx-mask"><span class="lx-fx-mask-l"><span>${hasProducts ? 'Nos produits de la ferme' : hasServices ? 'Nos prestations' : 'Nos terrains'}</span></span></h2><p>Commande en ligne — livraison ou retrait à la ferme.</p></div>
        <div class="lx-fx-stagger">${catnav}${dsSection}${grid}
        ${svcSection}</div>
        ${terrainSection}
      </section>
    </div>

    ${fmAboutPage}

    ${fmFoot}

    <script>(function(){
      var pages={home:document.querySelector('.fm-page-home'),shop:document.querySelector('.fm-page-shop'),about:document.querySelector('.fm-page-about')};
      if(!pages.home) return;
      if(document.body.classList.contains('lassi-ed')){ if(pages.shop)pages.shop.hidden=false; if(pages.about)pages.about.hidden=false; return; }
      var active={home:'#fm-top',shop:'#fm-shop',about:'#fm-ab-top'};
      function show(which, anchor){
        Object.keys(pages).forEach(function(k){ if(pages[k]) pages[k].hidden=(k!==which); });
        document.querySelectorAll('.fm-nav a').forEach(function(a){ a.classList.toggle('fm-nav-active', a.getAttribute('href')===active[which]); });
        // Filet de sécurité : les animations d'entrée se déclenchent via IntersectionObserver
        // quand la page devient visible ; on garantit l'affichage au cas où (450ms).
        var pg=pages[which];
        if(pg) setTimeout(function(){ [].forEach.call(pg.querySelectorAll('.lx-rv:not(.lx-in),.lx-fx-stagger:not(.lx-in),.lx-fx-bento:not(.lx-in)'), function(el){ el.classList.add('lx-in'); }); }, 450);
        if(anchor){ var t=document.querySelector(anchor); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); },60); return; } }
        window.scrollTo({top:0,behavior:'smooth'});
      }
      document.querySelectorAll('[data-fmnav]').forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          var w=a.getAttribute('data-fmnav'); var h=a.getAttribute('href')||'';
          show(w, (h.indexOf('#fm-')===0 && h!=='#fm-top' && h!=='#fm-ab-top' && h!=='#fm-shop') ? h : null);
        });
      });
    })();</script>
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE PLEIN « GRILL » — Steakhouse / brasserie (réf Wix « Au Grill »).
  // Fond charbon sombre, or brossé, display ultra-bold (Anton) + serif gravé or
  // (Cinzel), illustrations line-art (couverts, bœuf, cocktail), galerie plein
  // cadre. Hero steak plein écran, « LE RESTAURANT » 3 colonnes, menu (catalogue
  // réel), galerie, bande viande, liste de diffusion, contact + carte.
  // ═══════════════════════════════════════════════════════════════════════════
  const grCocktail ='<svg class="gr-ill" viewBox="0 0 130 150" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 22h98L65 84z"/><line x1="65" y1="84" x2="65" y2="124"/><line x1="40" y1="124" x2="90" y2="124"/><line x1="78" y1="36" x2="106" y2="14"/><circle cx="108" cy="12" r="4.5"/></svg>';
  const grCols = [
    { n: '01', t: 'Grill traditionnel,<br>touche moderne', p: 'Un feu de bois, des cuissons maîtrisées et une carte qui revisite les classiques avec audace et générosité.' },
    { n: '02', t: 'Servir les<br>meilleures viandes', p: 'Des pièces maturées et sélectionnées avec soin auprès de nos éleveurs, pour une tendreté et un goût incomparables.' },
    { n: '03', t: 'Situé au cœur<br>de la ville', p: `${esc(o.zone || 'En plein centre')}, un cadre chaleureux pour vos dîners, vos tablées entre amis et vos grandes occasions.` },
  ];
  const grGalPool = [...gal.slice(1)].filter(Boolean).slice(0, 8);
  const grBandImg = gal.length ? gal[gal.length - 1] : (gal[0] || '');
  const grAboutBg = gal.length > 2 ? gal[2] : (gal[1] || gal[0] || ''); // photo cuisine derrière « LE RESTAURANT »
  const grillBody = `
    <header class="gr-head" id="gr-top">
      <div class="gr-navbar">
        <a class="gr-brand" href="#gr-top">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(clip(o.name, 22))}</span>`}</a>
        <nav class="gr-nav">
          <a class="gr-nav-active" href="#gr-top" data-grnav="home">Accueil</a>
          <a href="#gr-about" data-grnav="home">Chez nous</a>
          <a href="#gr-menu" data-grnav="menu">Menu</a>
          <a href="#gr-gallery" data-grnav="home">Galerie</a>
          <a href="#gr-resa-page" data-grnav="resa">Réservations</a>
        </nav>
        <a class="gr-ic gr-cart" href="#gr-menu" data-grnav="menu" title="Commander"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg></a>
      </div>
    </header>
    <div class="gr-page gr-page-home">
    <div class="gr-stack">
    <section class="gr-hero gr-slide" ${bg(heroImg)}>
      <div class="gr-hero-ov"></div>
      <div class="gr-hero-in">
        <h1 class="gr-hero-title">${esc(o.name)}</h1>
        <div class="gr-hero-sub">Grande cuisine française</div>
        <a class="gr-btn" href="#gr-menu" data-grnav="menu">Menu</a>
      </div>
    </section>
    <section class="gr-about gr-slide" id="gr-about" ${bg(grAboutBg)}>
      <div class="gr-about-ov"></div>
      <div class="gr-about-in">
        <h2 class="gr-h2 gr-gold">Le restaurant</h2>
        <div class="gr-cols">${grCols.map(c => `<div class="gr-col"><span class="gr-num">${c.n}</span><h3>${c.t}</h3><p>${esc(c.p)}</p></div>`).join('')}</div>
      </div>
    </section>
    <section class="gr-cutlery gr-slide" id="gr-reserve">
      <div class="gr-cutlery-in"><img src="/assets/grill/cutlery.jpg" alt=""></div>
      <h2 class="gr-h2 gr-light gr-resa-title">Réserver une table</h2>
      <p class="gr-resa-sub">Sélectionnez vos détails et nous ferons notre possible pour satisfaire votre demande.</p>
      <button type="button" class="gr-btn gr-btn-dark" data-grnav="resa" href="#gr-resa-page">Réserver une table</button>
    </section>
    <section class="gr-feature gr-slide" style="background-image:url('/assets/grill/beef.jpg')">
      <div class="gr-feature-ov"></div>
      <div class="gr-feature-in">
      <h2 class="gr-h2 gr-gold">Bifsteck + temps<br>= perfection</h2>
      <p class="gr-lead">${esc(clip(o.desc || `Le secret d'une viande d'exception : des pièces maturées avec patience, puis saisies au feu pour révéler toute leur saveur. Chez ${o.name}, le temps fait la perfection.`, 240))}</p>
      </div>
    </section>
    <section class="gr-drink gr-slide">
      <h2 class="gr-h2 gr-light">Prenez un verre</h2>
      <div class="gr-ill-wrap"><img class="gr-ill-img" src="/assets/grill/cocktail.png" alt="Cocktail"></div>
      <p class="gr-lead gr-dark">Cocktails signature, grands crus et spiritueux rares : notre bar prolonge l'expérience, avant ou après le repas.</p>
    </section>
    </div>
    ${grGalPool.length >= 4 ? `
    <section class="gr-gallery" id="gr-gallery">
      <h2 class="gr-h2 gr-gold">Galerie</h2>
      <div class="gr-gal-grid">${grGalPool.map(u => `<div class="gr-gtile" ${bg(u)}></div>`).join('')}</div>
    </section>` : ''}
    ${grBandImg ? `<div class="gr-band" ${bg(grBandImg)}></div>` : ''}
    <section class="gr-news">
      <h2 class="gr-h2 gr-gold gr-sm">Liste de diffusion</h2>
      <p class="gr-news-p">Recevez nos nouveautés, événements et suggestions du chef.</p>
      <div class="gr-news-form">
        <input class="gr-input" type="email" placeholder="Votre adresse e-mail" aria-label="E-mail">
        <a class="gr-btn" href="#gr-shop">S'abonner</a>
      </div>
    </section>
    <footer class="gr-foot" id="gr-contact">
      <h2 class="gr-h2 gr-light">Contact &amp; lieu</h2>
      <p class="gr-foot-sub">Réservez une table ou passez commande — nous vous accueillons avec plaisir.</p>
      <div class="gr-foot-info">
        ${o.zone ? `<div><b>Adresse</b><span>${esc(o.zone)}</span></div>` : ''}
        ${o.phone ? `<div><b>Téléphone</b><span>${esc(o.phone)}</span></div>` : ''}
        ${hoursHtml ? `<div class="gr-foot-hours"><b>Horaires</b>${hoursHtml}</div>` : ''}
      </div>
      <a class="gr-btn gr-foot-cta" href="#gr-menu" data-grnav="menu">Voir le menu</a>
      ${socialHtml}
      <div class="gr-copy">© 2026 ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>
    </div>
    <div class="gr-page gr-page-menu" id="gr-menu" hidden>
    ${closedNotice}
    <section id="gr-shop" class="gr-shop${catalogCls}">
      <div class="gr-crumb">Accueil › Menu</div>
      <h2 class="gr-h2 gr-gold">Notre menu</h2>
      <p class="gr-sub-ctr">${hasProducts ? 'Commande en ligne · retrait ou livraison' : hasServices ? 'Réservez votre prestation' : 'Nos terrains'}</p>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    </div>
    <div class="gr-page gr-page-resa" id="gr-resa-page" hidden>
    <section class="gr-resa-sec">
      <div class="gr-crumb">Accueil › Réservations</div>
      <h2 class="gr-h2 gr-gold">Effectuer une réservation</h2>
      <p class="gr-resa-sub2">Sélectionnez vos détails et nous ferons notre possible pour satisfaire votre demande.</p>
      <div class="gr-resa-bar">
        <div class="gr-resa-field">
          <label>Nombre de personnes</label>
          <select class="gr-resa-pick" id="grNb"></select>
        </div>
        <div class="gr-resa-field">
          <label>Date</label>
          <button type="button" class="gr-resa-pick gr-resa-trigger" id="grDateBtn"><span id="grDateLbl">Choisir une date</span><span class="gr-resa-ic">▾</span></button>
          <div class="gr-resa-pop gr-resa-cal" id="grCal" hidden></div>
        </div>
        <div class="gr-resa-field">
          <label>Heure</label>
          <div class="gr-resa-pick gr-resa-heuredisp" id="grHourSel"><span>—</span><span class="gr-resa-ic">▾</span></div>
        </div>
      </div>
      <div class="gr-resa-hr"></div>
      <div class="gr-resa-gridwrap" id="grGridWrap" hidden>
        <p class="gr-resa-gridlabel">Choisissez un créneau horaire :</p>
        <div class="gr-hours-grid" id="grHours"></div>
      </div>
      <button type="button" class="gr-btn gr-btn-dark gr-resa-find" id="grFind">Réserver</button>
      <p class="gr-resa-msg gr-resa-barmsg" id="grBarMsg"></p>
    </section>
    </div>
    <div class="gr-legal">
      <div class="gr-legal-links"><a href="#gr-reserve">Réservations</a><a href="#gr-menu" data-grnav="menu">Menu</a><a href="#gr-about" data-grnav="home">À propos</a></div>
      <div class="gr-legal-copy">© 2026 ${esc(o.name)} · Propulsé et sécurisé par LASSİ</div>
    </div>
    <div class="gr-resa-ov" id="grResaOv" hidden>
      <div class="gr-resa-modal" role="dialog" aria-modal="true">
        <button class="gr-resa-x" id="grResaX" type="button" aria-label="Fermer">×</button>
        <div id="grResaStep1">
          <h3 class="gr-resa-h">Finaliser la réservation</h3>
          <div class="gr-resa-recap" id="grRecap"></div>
          <p class="gr-resa-note">Acompte de 2000 F déduit de votre addition sur place · 100 F de frais de service.</p>
          <label class="gr-resa-lb">Votre nom</label>
          <input class="gr-resa-in" type="text" id="grName" maxlength="80" placeholder="Ex : Awa Diop">
          <label class="gr-resa-lb">Téléphone</label>
          <input class="gr-resa-in" type="tel" id="grPhone" inputmode="numeric" maxlength="14" placeholder="77 123 45 67">
          <label class="gr-resa-lb">Paiement de l'acompte</label>
          <div class="gr-resa-pays">
            <button class="gr-resa-pay" type="button" data-m="wave"><img src="/assets/wave.jpg" alt="">Wave</button>
            <button class="gr-resa-pay" type="button" data-m="orange_money"><img src="/assets/om.png" alt="">Orange Money</button>
          </div>
          <p class="gr-resa-msg" id="grMsg"></p>
          <button class="gr-btn gr-resa-submit" id="grSubmit" type="button">Payer l'acompte · 2100 F</button>
        </div>
        <div id="grResaStep2" hidden>
          <h3 class="gr-resa-h">En attente du paiement…</h3>
          <p class="gr-resa-note" id="grWaitMsg">Validez le paiement, puis revenez sur cette page.</p>
          <img id="grQr" alt="QR paiement" hidden style="display:block;margin:14px auto;max-width:220px">
          <div class="gr-resa-spin"></div>
          <button class="gr-btn gr-btn-dark gr-resa-submit" id="grCheck" type="button">J'ai payé — vérifier</button>
        </div>
        <div id="grResaDone" hidden>
          <h3 class="gr-resa-h">Demande envoyée ✓</h3>
          <p class="gr-resa-note">Votre acompte est payé. Le restaurant va confirmer votre table — vous serez notifié. Présentez-vous à l'heure choisie.</p>
          <button class="gr-btn gr-resa-submit" id="grClose2" type="button">Fermer</button>
        </div>
      </div>
    </div>
    <script id="gr-resa-cfg" type="application/json">${JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY, slug: o.slug })}</script>
    <script>${GR_RESA_JS}</script>
    <script>(function(){
      var pages={home:document.querySelector('.gr-page-home'),menu:document.querySelector('.gr-page-menu'),resa:document.querySelector('.gr-page-resa')};
      if(!pages.home||!pages.menu) return;
      if(document.body.classList.contains('lassi-ed')){ pages.menu.hidden=false; if(pages.resa)pages.resa.hidden=false; return; }
      document.querySelectorAll('[data-grnav]').forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          var w=a.getAttribute('data-grnav'); var h=a.getAttribute('href')||'';
          Object.keys(pages).forEach(function(k){ pages[k].hidden=(k!==w); });
          document.querySelectorAll('.gr-nav a').forEach(function(x){ x.classList.toggle('gr-nav-active', x.getAttribute('data-grnav')===w && (w!=='home'||x.getAttribute('href')==='#gr-top')); });
          var pg=pages[w]; setTimeout(function(){ [].forEach.call(pg.querySelectorAll('.lx-rv:not(.lx-in)'),function(el){el.classList.add('lx-in');}); },450);
          var an=(w==='home'&&h.indexOf('#gr-')===0&&h!=='#gr-top')?h:null;
          if(an){ var t=document.querySelector(an); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); },60); return; } }
          window.scrollTo({top:0,behavior:'smooth'});
        });
      });
      if(location.hash==='#gr-menu'){ pages.home.hidden=true; pages.menu.hidden=false; } else if(location.hash==='#gr-resa-page'){ pages.home.hidden=true; if(pages.resa)pages.resa.hidden=false; }
    })();</script>`;

  // ── Template BAR / Restaurant-Lounge (BRAISE) ───────────────────────────────
  // Home bespoke (arche + à propos + signatures + galerie bento + carte),
  // pages Menu & Réservation réutilisent VERBATIM les hooks grill (gr-page-*,
  // data-grnav, gr-resa-cfg, GR_RESA_JS) → réservation web réellement câblée
  // (EF create-guest-table-reservation : créneaux réels + acompte Wave/OM + notif).
  const baMark = '<svg class="ba-mark" viewBox="0 0 48 48"><g stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none"><circle cx="24" cy="24" r="6"/><line x1="24" y1="2" x2="24" y2="9"/><line x1="24" y1="39" x2="24" y2="46"/><line x1="2" y1="24" x2="9" y2="24"/><line x1="39" y1="24" x2="46" y2="24"/><line x1="8.5" y1="8.5" x2="13.4" y2="13.4"/><line x1="34.6" y1="34.6" x2="39.5" y2="39.5"/><line x1="39.5" y1="8.5" x2="34.6" y2="13.4"/><line x1="13.4" y1="34.6" x2="8.5" y2="39.5"/></g></svg>';
  const baSig1 = gal.length > 1 ? gal[1] : (gal[0] || '');
  const baSig2 = gal.length > 2 ? gal[2] : (gal[1] || gal[0] || '');
  const baBento = grGalPool.slice(0, 5);
  const baLat = o.lat, baLng = o.lng;
  const baMap = (typeof baLat === 'number' && typeof baLng === 'number')
    ? `<section class="ba-map">
        <iframe loading="lazy" title="${escAttr(o.name)}" src="https://www.openstreetmap.org/export/embed.html?bbox=${baLng - 0.012}%2C${baLat - 0.008}%2C${baLng + 0.012}%2C${baLat + 0.008}&layer=mapnik&marker=${baLat}%2C${baLng}"></iframe>
        <div class="ba-map-card">
          <svg class="ba-mc-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <b>${esc(clip(o.name, 28))}</b>${o.zone ? `<span>${esc(o.zone)}</span>` : ''}
          <a href="https://www.openstreetmap.org/?mlat=${baLat}&mlon=${baLng}#map=17/${baLat}/${baLng}" target="_blank" rel="noopener">Itinéraire →</a>
        </div>
      </section>` : '';

  const barBody = `
    <header class="ba-nav" id="ba-top">
      <div class="ba-nav-in">
        <a class="ba-brand" href="#ba-top" data-grnav="home">${baMark}${esc(clip(o.name, 20))}</a>
        <button type="button" class="ba-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
        <nav class="ba-menu">
          <a href="#gr-about" data-grnav="home">La maison</a>
          <a href="#gr-menu" data-grnav="menu">La carte</a>
          <a href="#gr-resa-page" data-grnav="resa">Réserver une table</a>
          <a href="#ba-contact" data-grnav="home">Contact</a>
        </nav>
      </div>
    </header>
    <script>(function(){
      var b=document.querySelector('.ba-burger'), m=document.querySelector('.ba-menu');
      if(!b||!m) return;
      if(document.body.classList.contains('lassi-ed')) return;
      b.addEventListener('click',function(e){ e.stopPropagation(); var open=m.classList.toggle('ba-menu-open'); b.setAttribute('aria-expanded', open?'true':'false'); });
      m.addEventListener('click',function(e){ if(e.target.closest('a')){ m.classList.remove('ba-menu-open'); b.setAttribute('aria-expanded','false'); } });
      document.addEventListener('click',function(){ m.classList.remove('ba-menu-open'); b.setAttribute('aria-expanded','false'); });
    })();</script>
    <div class="gr-page gr-page-home">
    <section class="ba-hero" ${bg(heroImg)}>
      <div class="ba-hero-bg"></div>
      <div class="ba-arch lx-rv">
        ${baMark.replace('class="ba-mark"','class="ba-mark led-ic"')}
        <div class="ba-hero-num">EST. ${new Date().getFullYear() - 2}</div>
        <div class="ba-hero-word">${esc(clip(o.name, 16))}</div>
        <div class="ba-hero-sub">${esc(clip(o.cat || 'Maison de feu & de saveurs', 60))}</div>
        <button type="button" class="ba-btn ba-btn-o" data-grnav="resa" href="#gr-resa-page">Réserver une table</button>
        ${o.zone ? `<div class="ba-hero-adr">${esc(o.zone)}</div>` : ''}
      </div>
    </section>
    <section class="ba-about lx-rv" id="gr-about">
      <div class="ba-about-l"><span class="ba-eyebrow">La maison</span><h2 class="ba-h24">Une table d'exception</h2></div>
      <p class="ba-body">${esc(clip(o.desc || `Une cuisine pensée comme un art : produits de saison, dressages précis et accueil chaleureux. Chez ${o.name}, chaque repas est une cérémonie.`, 300))}</p>
    </section>
    <div class="ba-sep"></div>
    <section class="ba-sechead lx-rv"><h2 class="ba-h2">Nos signatures</h2></section>
    <section class="ba-split lx-rv">
      <div class="ba-media" ${bg(baSig1)}></div>
      <div class="ba-txt">
        <span class="ba-eyebrow">Le plat signature</span>
        <h2 class="ba-h2">Notre spécialité maison</h2>
        <p class="ba-meta">Préparée avec soin, servie avec passion.</p>
        <button type="button" class="ba-btn ba-btn-o" data-grnav="resa" href="#gr-resa-page">Réserver une table</button>
      </div>
    </section>
    <section class="ba-split ba-split-rev lx-rv">
      <div class="ba-txt">
        <span class="ba-eyebrow">Les soirées</span>
        <h2 class="ba-h2">Menu du Chef</h2>
        <p class="ba-meta">Accords mets & vins · sur réservation.</p>
        <button type="button" class="ba-btn ba-btn-o" data-grnav="menu" href="#gr-menu">Voir la carte</button>
      </div>
      <div class="ba-media" ${bg(baSig2)}></div>
    </section>
    ${baBento.length >= 4 ? `
    <section class="ba-bento lx-rv">
      <h2 class="ba-h2 ba-ctr">L'art de la table</h2>
      <div class="ba-bento-grid">${baBento.map(u => `<div class="ba-tile" ${bg(u)}></div>`).join('')}</div>
    </section>` : ''}
    <section class="ba-news">
      <h2 class="ba-h2 ba-ctr">Restons en contact</h2>
      <p class="ba-body ba-ctr">Recevez nos menus de saison et événements.</p>
      <div class="ba-news-form"><input class="ba-input" type="email" placeholder="Votre adresse e-mail" aria-label="E-mail"><button type="button" class="ba-btn" data-grnav="resa" href="#gr-resa-page">S'inscrire</button></div>
    </section>
    ${baMap}
    <footer class="ba-foot" id="ba-contact">
      <div class="ba-foot-info">
        ${o.zone ? `<div><b>Adresse</b><span>${esc(o.zone)}</span></div>` : ''}
        ${o.phone ? `<div><b>Téléphone</b><span>${esc(o.phone)}</span></div>` : ''}
        ${hoursHtml ? `<div class="ba-foot-hours"><b>Horaires</b>${hoursHtml}</div>` : ''}
      </div>
      ${socialHtml}
      <div class="ba-copy">© ${new Date().getFullYear()} ${esc(o.name)} · Propulsé par LASSİ</div>
    </footer>
    </div>
    <div class="gr-page gr-page-menu" id="gr-menu" hidden>
    ${closedNotice}
    <section id="gr-shop" class="gr-shop${catalogCls}">
      <div class="gr-crumb">Accueil › La carte</div>
      <h2 class="gr-h2 gr-gold">La carte</h2>
      <p class="gr-sub-ctr">${hasProducts ? 'Commande en ligne · retrait ou livraison' : hasServices ? 'Réservez votre prestation' : 'Nos terrains'}</p>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
    </section>
    </div>
    <div class="gr-page gr-page-resa" id="gr-resa-page" hidden>
    <section class="gr-resa-sec">
      <div class="gr-crumb">Accueil › Réservations</div>
      <h2 class="gr-h2 gr-gold">Effectuer une réservation</h2>
      <p class="gr-resa-sub2">Sélectionnez vos détails et nous ferons notre possible pour satisfaire votre demande.</p>
      <div class="gr-resa-bar">
        <div class="gr-resa-field">
          <label>Nombre de personnes</label>
          <select class="gr-resa-pick" id="grNb"></select>
        </div>
        <div class="gr-resa-field">
          <label>Date</label>
          <button type="button" class="gr-resa-pick gr-resa-trigger" id="grDateBtn"><span id="grDateLbl">Choisir une date</span><span class="gr-resa-ic">▾</span></button>
          <div class="gr-resa-pop gr-resa-cal" id="grCal" hidden></div>
        </div>
        <div class="gr-resa-field">
          <label>Heure</label>
          <div class="gr-resa-pick gr-resa-heuredisp" id="grHourSel"><span>—</span><span class="gr-resa-ic">▾</span></div>
        </div>
      </div>
      <div class="gr-resa-hr"></div>
      <div class="gr-resa-gridwrap" id="grGridWrap" hidden>
        <p class="gr-resa-gridlabel">Choisissez un créneau horaire :</p>
        <div class="gr-hours-grid" id="grHours"></div>
      </div>
      <button type="button" class="gr-btn gr-btn-dark gr-resa-find" id="grFind">Réserver</button>
      <p class="gr-resa-msg gr-resa-barmsg" id="grBarMsg"></p>
    </section>
    </div>
    <div class="gr-resa-ov" id="grResaOv" hidden>
      <div class="gr-resa-modal" role="dialog" aria-modal="true">
        <button class="gr-resa-x" id="grResaX" type="button" aria-label="Fermer">×</button>
        <div id="grResaStep1">
          <h3 class="gr-resa-h">Finaliser la réservation</h3>
          <div class="gr-resa-recap" id="grRecap"></div>
          <p class="gr-resa-note">Acompte de 2000 F déduit de votre addition sur place · 100 F de frais de service.</p>
          <label class="gr-resa-lb">Votre nom</label>
          <input class="gr-resa-in" type="text" id="grName" maxlength="80" placeholder="Ex : Awa Diop">
          <label class="gr-resa-lb">Téléphone</label>
          <input class="gr-resa-in" type="tel" id="grPhone" inputmode="numeric" maxlength="14" placeholder="77 123 45 67">
          <label class="gr-resa-lb">Paiement de l'acompte</label>
          <div class="gr-resa-pays">
            <button class="gr-resa-pay" type="button" data-m="wave"><img src="/assets/wave.jpg" alt="">Wave</button>
            <button class="gr-resa-pay" type="button" data-m="orange_money"><img src="/assets/om.png" alt="">Orange Money</button>
          </div>
          <p class="gr-resa-msg" id="grMsg"></p>
          <button class="gr-btn gr-resa-submit" id="grSubmit" type="button">Payer l'acompte · 2100 F</button>
        </div>
        <div id="grResaStep2" hidden>
          <h3 class="gr-resa-h">En attente du paiement…</h3>
          <p class="gr-resa-note" id="grWaitMsg">Validez le paiement, puis revenez sur cette page.</p>
          <img id="grQr" alt="QR paiement" hidden style="display:block;margin:14px auto;max-width:220px">
          <div class="gr-resa-spin"></div>
          <button class="gr-btn gr-btn-dark gr-resa-submit" id="grCheck" type="button">J'ai payé — vérifier</button>
        </div>
        <div id="grResaDone" hidden>
          <h3 class="gr-resa-h">Demande envoyée ✓</h3>
          <p class="gr-resa-note">Votre acompte est payé. Le restaurant va confirmer votre table — vous serez notifié. Présentez-vous à l'heure choisie.</p>
          <button class="gr-btn gr-resa-submit" id="grClose2" type="button">Fermer</button>
        </div>
      </div>
    </div>
    <script id="gr-resa-cfg" type="application/json">${JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY, slug: o.slug })}</script>
    <script>${GR_RESA_JS}</script>
    <script>(function(){
      var pages={home:document.querySelector('.gr-page-home'),menu:document.querySelector('.gr-page-menu'),resa:document.querySelector('.gr-page-resa')};
      if(!pages.home||!pages.menu) return;
      if(document.body.classList.contains('lassi-ed')){ pages.menu.hidden=false; if(pages.resa)pages.resa.hidden=false; return; }
      document.querySelectorAll('[data-grnav]').forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          var w=a.getAttribute('data-grnav'); var h=a.getAttribute('href')||'';
          Object.keys(pages).forEach(function(k){ pages[k].hidden=(k!==w); });
          var pg=pages[w]; setTimeout(function(){ [].forEach.call(pg.querySelectorAll('.lx-rv:not(.lx-in)'),function(el){el.classList.add('lx-in');}); },300);
          var an=(w==='home'&&h.indexOf('#')===0&&h!=='#ba-top')?h:null;
          if(an){ var t=document.querySelector(an); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); },60); return; } }
          window.scrollTo({top:0,behavior:'smooth'});
        });
      });
      if(location.hash==='#gr-menu'){ pages.home.hidden=true; pages.menu.hidden=false; } else if(location.hash==='#gr-resa-page'){ pages.home.hidden=true; if(pages.resa)pages.resa.hidden=false; }
    })();</script>`;

  // ── Template EXCLUSIF « CAFEFA » (Les Délices de Fa) ────────────────────────
  // Réf : Wix « Cafe (Grunge) » — fond brun foncé, accent vert acide #C3FF5B,
  // titres Anton condensés, kickers IBM Plex Mono, corps IBM Plex Sans.
  // Verrouillé au slug les-delices-de-fa (voir force theme.template plus haut).
  // Images : /assets/fa/{bg1,bg2}.avif (textures) + {top1,top2}.jpg (collage haut).
  const faKicker = (o.cat ? o.cat.split('·')[0].trim() : 'Fast-food & Jus').toUpperCase();
  const faMarquee = ['CRÊPES & TACOS', 'BURGERS & PIZZAS', 'PÂTES & PENNE', 'BOXES À PARTAGER', 'JUS LOCAUX PRESSÉS', 'DIBITERIE'];
  const faMark = '<svg class="fa-mark" viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><path d="M24 2c2 6 2 9 0 14-2-5-2-8 0-14zm0 44c-2-6-2-9 0-14 2 5 2 8 0 14zM2 24c6-2 9-2 14 0-5 2-8 2-14 0zm44 0c-6 2-9 2-14 0 5-2 8-2 14 0zM8.5 8.5c5 2 7 4 9 9-5-2-7-4-9-9zm31 31c-5-2-7-4-9-9 5 2 7 4 9 9zm0-31c-2 5-4 7-9 9 2-5 4-7 9-9zm-31 31c2-5 4-7 9-9-2 5-4 7-9 9z"/><circle cx="24" cy="24" r="4"/></g></svg>';
  const faWords = esc(o.name).trim().split(/\s+/);
  const faMid = Math.ceil(faWords.length / 2);
  const faTitleHtml = faWords.slice(0, faMid).join(' ') + ' ' + faMark + ' ' + faWords.slice(faMid).join(' ');
  const faSigs = o.products.filter(p => p.photo_url && p.photo_url.trim()).sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 3);
  const faSigSection = faSigs.length >= 3 ? `
    <section class="fa-sig">
      <div class="fa-sig-grid">
        ${faSigs.map(p => `<article class="fa-card lx-rv">
          <img class="fa-card-img" loading="lazy" src="${escAttr(p.photo_url || '')}" alt="${escAttr(p.name || '')}">
          <div class="fa-card-body"><div class="fa-card-top"><h3 class="fa-card-name">${esc(p.name || '')}</h3><span class="fa-card-price">${fmtPrice(p.price)}</span></div>${p.description ? `<p class="fa-card-desc">${esc(clip(p.description, 90))}</p>` : ''}</div>
        </article>`).join('')}
      </div>
    </section>

    <section class="fa-house">
      <h2 class="fa-house-h lx-rv">Jusqu'au bout de la nuit</h2>
      <img class="fa-house-img lx-rv" loading="lazy" src="/assets/fa/house.png" alt="${escAttr(o.name)}">
      <p class="fa-house-p lx-rv">Du midi jusqu'au bout de la nuit, ${o.zone ? 'à ' + esc(o.zone) : 'au quartier'}. Un coin où chaque crêpe, chaque tacos et chaque box est préparé à la commande — pour se régaler, partager et savourer l'instant.</p>
    </section>` : '';
  const faBody = `
    <div class="fa-masthead" id="fa-top">
      <h1 class="fa-mast-title lx-rv">${faTitleHtml}</h1>
    </div>
    <nav class="fa-topnav">
      <a class="fa-on" href="#fa-top" data-fanav="home">Accueil</a>
      <a href="#fa-story" data-fanav="histoire">Notre histoire</a>
      <a href="#fa-menu" data-fanav="menu">Menu</a>
      <a href="#fa-contact" data-fanav="home">Contact</a>
    </nav>

    <div class="fa-page fa-page-home">
    <section class="fa-hero fa-hero-2col">
      <div class="fa-hero-img fa-hero-l lx-rv">
        <img src="/assets/fa/top1.jpg" alt="${escAttr(o.name)}">
        <span class="fa-hero-stamp">${esc(clip(o.name, 18))}</span>
      </div>
      <div class="fa-hero-mid lx-rv">
        <span class="fa-kick">${esc(faKicker)}${o.zone ? ' · ' + esc(o.zone.toUpperCase()) : ''}</span>
        <h2 class="fa-hero-h">Fait avec amour</h2>
        <p class="fa-hero-p">On a gardé tout ce qu'on aime : le croustillant, le fondant, l'envie qui monte — et on y a mis tout notre cœur. Pas de plats déjà préparés ni de plats qui attendent : ici, chaque commande est faite comme pour un proche.</p>
        <a class="fa-btn-out" href="#fa-menu" data-fanav="menu">Voir le menu →</a>
        ${hoursHtml ? `<div class="fa-hero-hours">${hoursHtml}</div>` : ''}
      </div>
    </section>

    <div class="fa-marquee" aria-hidden="true"><div class="fa-marquee-row">${(faMarquee.concat(faMarquee)).map(t => `<span>${esc(t)}</span><span class="fa-dot">✦</span>`).join('')}</div></div>

    <section class="fa-statement" id="fa-about">
      <div class="fa-about-ov"></div>
      <div class="fa-statement-in">
        <span class="fa-sm fa-sm-l"><svg viewBox="0 0 48 48" fill="currentColor"><path d="M24 7c-9 0-16 4.3-16 9.5h32C40 11.3 33 7 24 7z"/><rect x="7" y="20" width="34" height="5" rx="2.5"/><path d="M8 29h32c0 6.1-7.2 10.5-16 10.5S8 35.1 8 29z"/></svg></span>
        <span class="fa-sm fa-sm-r"><svg viewBox="0 0 48 48" fill="currentColor"><path d="M14 15h20l-2.1 24.8A3.3 3.3 0 0 1 28.6 43H19.4a3.3 3.3 0 0 1-3.3-3.2L14 15z"/><rect x="12" y="10" width="24" height="5" rx="2.5"/><rect x="22.6" y="2" width="2.8" height="8" rx="1.4"/></svg></span>
        <h2 class="fa-statement-h lx-rv">Plus qu'un fast-food,<br>un art de se régaler</h2>
      </div>
    </section>
${faSigSection}
    <section class="fa-reveal" id="fa-showcase">
      <div class="fa-reveal-sticky">
        <div class="fa-reveal-frame">
          <img src="/assets/fa/reveal.jpg" alt="${escAttr(o.name)}">
          <a class="fa-reveal-cta" href="#fa-menu" data-fanav="menu"><span>Commandez, on s'occupe du reste</span> →</a>
        </div>
      </div>
    </section>
    </div>

    <div class="fa-page fa-page-histoire" id="fa-story" hidden>
      <div class="fa-story-wrap">
        <img class="fa-story-photo lx-rv" loading="lazy" src="https://tsdemraszwtbzgtyjzum.supabase.co/storage/v1/object/public/gallery/463c5f18-d5dd-4b6a-955a-0bd33a9ba524/photo_1790213348769.jpg" alt="${escAttr(o.name)}">
        <p class="fa-story-sub lx-rv">L'histoire d'une battante qui a choisi le combat plutôt que la facilité.</p>
        <h2 class="fa-story-title lx-rv">Forgée dans <em>l'effort</em></h2>
        <div class="fa-story-body">
          <p class="lx-rv">Tout le monde voit les commandes qui s'empilent, les clients satisfaits, et se dit que c'est facile. Mais personne ne sait ce qu'il y a vraiment derrière ${esc(o.name)}.</p>
          <p class="lx-rv">Les nuits blanches à enchaîner les pâtes, les réveils à 6 heures du matin pour ne jamais rater une commande de séminaire. Gérer un fast-food quand on est une nouvelle entrepreneuse, c'est un combat de tous les jours. Le corps finit par lâcher : à force de stress et de fatigue, les hospitalisations presque chaque mois sont devenues mon lot quotidien tant la charge mentale est lourde.</p>
          <p class="lx-rv">Heureusement, au milieu de toutes ces difficultés, je ne suis pas seule. Mention spéciale à mon père, qui est toujours là pour m'aider, me soutenir et veiller sur moi à chaque instant.</p>
          <p class="lx-rv">Malgré les coups durs, les épreuves et la fatigue, je continue d'avancer. Je ne lâcherai rien, parce que chaque client satisfait me rappelle pourquoi j'ai créé ${esc(o.name)}. Merci du fond du cœur à tous ceux qui me soutiennent.❤️</p>
        </div>
        <div class="fa-story-cta lx-rv"><a class="fa-btn-out" href="#fa-menu" data-fanav="menu">Voir le menu →</a></div>
      </div>
    </div>

    <div class="fa-page fa-page-menu" id="fa-menu" hidden>
      <div class="fa-menu-head">
        <h2 class="fa-h2 fa-h2-c lx-rv">${hasProducts ? 'La carte' : hasServices ? 'Nos prestations' : 'Nos terrains'}</h2>
        <p class="fa-menu-sub lx-rv">${hasProducts ? 'Commande en ligne · retrait sur place ou livraison · paiement Wave / Orange Money' : hasServices ? 'Réserve ta prestation en ligne' : 'Réserve ton créneau'}</p>
      </div>
      ${closedNotice}
      <div class="fa-menu-body${catalogCls}">
        ${catnav}${dsSection}${grid}
        ${svcSection}
        ${terrainSection}
      </div>
    </div>

    <footer class="fa-foot2" id="fa-contact">
      <div class="fa-foot2-top">
        <div class="fa-foot2-info">
          ${o.phone ? `<a href="tel:${escAttr(o.phone.replace(/[^0-9+]/g, ''))}">${esc(o.phone)}</a>` : ''}
          ${o.zone ? `<span>${esc(o.zone)}</span>` : ''}
          ${hoursHtml ? `<div class="fa-foot2-hours">${hoursHtml}</div>` : ''}
        </div>
        <div class="fa-foot2-social"><a href="https://www.tiktok.com/@lesdelicesdefa0" target="_blank" rel="noopener">TikTok</a></div>
      </div>
      ${(o.lat != null && o.lng != null) ? `<a class="fa-foot2-maplink" href="https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}" target="_blank" rel="noopener"><img class="fa-foot2-map" loading="lazy" alt="Emplacement ${escAttr(o.name)}" src="/staticmap?lat=${o.lat}&amp;lng=${o.lng}"></a>` : ''}
      <div class="fa-foot2-big lx-rv"><img class="fa-foot2-logo" src="/assets/fa/logo.png" alt="Logo ${escAttr(o.name)}">${faTitleHtml}</div>
      <div class="fa-foot2-legal">
        <a href="#fa-menu" data-fanav="menu">Commander</a>
        <span class="fa-foot2-credit">© 2026 ${esc(o.name)} · Propulsé &amp; sécurisé par LASSİ</span>
      </div>
    </footer>

    <script>(function(){
      var pages={home:document.querySelector('.fa-page-home'),menu:document.querySelector('.fa-page-menu'),histoire:document.querySelector('.fa-page-histoire')};
      if(!pages.home||!pages.menu) return;
      var setPage=function(w){ for(var k in pages){ if(pages[k]) pages[k].hidden=(k!==w); } };
      var reveal=function(pg){ setTimeout(function(){ [].forEach.call(pg.querySelectorAll('.lx-rv:not(.lx-in)'),function(el){el.classList.add('lx-in');}); },300); };
      // Effet image qui grandit au scroll + CTA qui zoome (page Accueil).
      var sec=document.querySelector('.fa-reveal'), frame=sec&&sec.querySelector('.fa-reveal-frame'), rcta=sec&&sec.querySelector('.fa-reveal-cta');
      if(frame){ var upd=function(){ var r=sec.getBoundingClientRect(),vh=window.innerHeight,total=sec.offsetHeight-vh; var p=Math.min(1,Math.max(0,(-r.top)/(total||1))); frame.style.width=(60+40*p)+'%'; frame.style.height=(58+42*p)+'%'; frame.style.borderRadius=(22*(1-p))+'px'; if(rcta) rcta.style.transform='translate(-50%,-50%) scale('+(0.55+0.85*p)+')'; };
        upd(); window.addEventListener('scroll',upd,{passive:true}); window.addEventListener('resize',upd); }
      if(document.body.classList.contains('lassi-ed')){ pages.menu.hidden=false; if(frame){frame.style.width='94%';frame.style.height='80%';frame.style.borderRadius='8px';} return; }
      document.querySelectorAll('[data-fanav]').forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          var w=a.getAttribute('data-fanav'), h=a.getAttribute('href')||'';
          setPage(w);
          document.querySelectorAll('.fa-topnav a').forEach(function(x){ x.classList.toggle('fa-on', x.getAttribute('data-fanav')===w && (w!=='home'||x.getAttribute('href')==='#fa-top')); });
          reveal(pages[w]);
          var an=(w==='home'&&h.indexOf('#')===0&&h!=='#fa-top')?h:null;
          if(an){ var t=document.querySelector(an); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); },60); return; } }
          window.scrollTo({top:0,behavior:'smooth'});
        });
      });
      if(location.hash==='#fa-menu'){ pages.home.hidden=true; pages.menu.hidden=false; }
    })();</script>`;

  // ── Template EXCLUSIF « UDEBI » (Ûdebi Atelier) — mode épuré, sacs en perles ──
  // Réf Wix « Boutique de mode (Épuré) ». Images éditoriales : /assets/udebi/*.
  // Verrouillé au slug udebi-atelier. Accueil éditorial + page Boutique (panier réel).
  const U = `${o.base}/assets/udebi/`;
  const udLogo = `<img src="${U}logo.png" alt="${escAttr(o.name)}">`;
  const udBody = `
    <nav class="ud-nav">
      <a class="ud-brand" href="#ud-top" data-udnav="home">${udLogo}</a>
      <div class="ud-links">
        <a class="on" href="#ud-top" data-udnav="home">Accueil</a>
        <a href="#ud-shop" data-udnav="boutique">Boutique</a>
        <a href="#ud-contact" data-udnav="home">Contact</a>
      </div>
    </nav>

    <div class="ud-page ud-page-home" id="ud-top">
      <header class="ud-hero">
        <img class="ud-hero-img" src="${U}hero-bg.jpg" alt="${escAttr(o.name)}">
        <div class="ud-hero-in">
          <h1 class="ud-hero-h ud-serif">L'élégance,<br>perle après perle</h1>
          <p class="ud-hero-p">Sacs en perles 100 % faits main au Sénégal. Des pièces uniques, pensées pour sublimer chacune de vos tenues.</p>
          <a class="ud-btn" href="#ud-shop" data-udnav="boutique">Découvrir la collection</a>
        </div>
        <div class="ud-hero-card">
          <img src="${U}hero-card.jpg" alt="${escAttr(o.name)}">
          <div><div class="t ud-serif">Fait main · Sénégal</div><div class="s">Édition perles</div><a href="#ud-shop" data-udnav="boutique">Voir la boutique</a></div>
        </div>
      </header>

      <div class="ud-overlap">
        <div class="ud-front">
          <section class="ud-head rv"><h2 class="ud-serif">La Collection</h2><p>Chaque sac est façonné à la main, perle après perle — un accessoire rare, à votre image.</p></section>
          <div class="ud-coll rv rv-stag">
            ${['coll1.png', 'coll2.jpg', 'coll3.jpg'].map(img => `<article class="ud-cell"><img class="ud-cell-img" loading="lazy" src="${U}${img}" alt="${escAttr(o.name)}"><div class="ud-cell-cap"><a class="ud-cell-btn" href="#ud-shop" data-udnav="boutique">Commander</a></div></article>`).join('')}
          </div>
        </div>
        <section class="ud-grow">
          <img class="ud-grow-bg" src="${U}banner.jpg" alt="${escAttr(o.name)}">
          <div class="ud-banner-card"><h3 class="ud-serif">La Collection Limitée</h3><p>Des pièces issues de nos collections, assemblées à la main et disponibles pour un temps limité seulement.</p><a href="#ud-shop" data-udnav="boutique">Réservez la vôtre →</a></div>
        </section>
        <div class="ud-grow-spacer"></div>
      </div>

      <section class="ud-coveted">
        <div class="ud-coveted-head rv"><h2 class="ud-serif">Coups de cœur de l'atelier</h2></div>
        <div class="ud-cov-grid rv rv-stag">
          <article class="ud-cov-card"><video src="${U}video1.mp4" autoplay muted loop playsinline preload="metadata"></video><div class="ud-cov-cap"><div class="ud-cov-name ud-serif">Fait à la main</div><a class="ud-cov-link" href="#ud-shop" data-udnav="boutique">Découvrir</a></div></article>
          <article class="ud-cov-card"><video src="${U}video2.mp4" autoplay muted loop playsinline preload="metadata"></video><div class="ud-cov-cap"><div class="ud-cov-name ud-serif">Édition perles</div><a class="ud-cov-link" href="#ud-shop" data-udnav="boutique">Découvrir</a></div></article>
        </div>
      </section>

      <section class="ud-look">
        <div class="ud-look-grid rv rv-stag">
          <div class="ud-look-main"><img loading="lazy" src="${U}look-main.jpg" alt="${escAttr(o.name)}"><span class="ud-look-title ud-serif">Portez le look</span></div>
          <div class="ud-look-right">
            <article class="ud-look-card"><a class="ud-look-imgz" href="#ud-shop" data-udnav="boutique"><img loading="lazy" src="${U}look-1.jpg" alt="${escAttr(o.name)}"><img class="ud-look-hover" loading="lazy" src="${U}look-2.jpg" alt="${escAttr(o.name)}"></a><div class="ud-look-meta"><span class="ud-look-name ud-serif">Édition noire</span><a class="ud-look-link" href="#ud-shop" data-udnav="boutique">Commander</a></div></article>
            <article class="ud-look-card"><a class="ud-look-imgz" href="#ud-shop" data-udnav="boutique"><img loading="lazy" src="${U}look-3.png" alt="${escAttr(o.name)}"><img class="ud-look-hover" loading="lazy" src="${U}look-4.jpg" alt="${escAttr(o.name)}"></a><div class="ud-look-meta"><span class="ud-look-name ud-serif">Perles marbrées</span><a class="ud-look-link" href="#ud-shop" data-udnav="boutique">Commander</a></div></article>
          </div>
        </div>
      </section>

      <section class="ud-story">
        <div class="ud-story-text rv"><span class="k">Notre histoire</span><h2 class="ud-serif">L'art de la perle,<br>signé Ûdebi</h2><p>Ûdebi Atelier, c'est le sac en perles pensé comme un bijou : chaque pièce est assemblée à la main au Sénégal, perle après perle. Un savoir-faire sénégalais, des matières choisies — perles, bois, acrylique — et une élégance qui se porte du quotidien aux grandes cérémonies.</p><a class="ud-btn" href="#ud-shop" data-udnav="boutique">Découvrir la boutique</a></div>
        <div class="ud-story-img rv"><img loading="lazy" src="${U}story.jpg" alt="${escAttr(o.name)}"></div>
      </section>
    </div>

    <div class="ud-page ud-page-boutique" id="ud-shop" hidden>
      <section class="sh-head"><h1 class="ud-serif">La Boutique</h1><p>Tous nos sacs en perles, faits main au Sénégal. Des pièces uniques, en séries limitées — choisissez la vôtre, nous nous occupons du reste.</p></section>
      ${closedNotice}
      <div class="sh-wrap"><main class="sh-main"><div class="sh-main-top"><span class="sh-count">${o.products.length} pièce${o.products.length > 1 ? 's' : ''}</span><span class="sh-sort">Fait main · Sénégal</span></div>${grid}${svcSection}</main></div>
    </div>

    <footer class="ud-foot" id="ud-contact">
      <div class="ud-foot-grid">
        <div><h4 class="ud-serif">Rejoignez-nous</h4><p>Nouveautés, éditions limitées et coulisses de l'atelier — directement chez vous.</p>${o.phone ? `<p style="margin-top:14px">${esc(o.phone)}</p>` : ''}</div>
        <div class="ud-foot-col"><h4 class="ud-serif">Boutique</h4><a href="#ud-shop" data-udnav="boutique">Tous les sacs</a><a href="#ud-shop" data-udnav="boutique">Éditions perles</a><a href="#ud-shop" data-udnav="boutique">Mini sacs</a></div>
        <div class="ud-foot-col"><h4 class="ud-serif">Atelier</h4>${o.zone ? `<a href="#ud-top" data-udnav="home">${esc(o.zone)}</a>` : ''}${(o.lat != null && o.lng != null) ? `<a href="https://www.google.com/maps/search/?api=1&query=${o.lat}%2C${o.lng}" target="_blank" rel="noopener">Voir l'emplacement</a>` : ''}<a href="#ud-shop" data-udnav="boutique">Commander</a></div>
        <div class="ud-foot-col"><h4 class="ud-serif">Légal</h4><a href="#">Conditions</a><a href="#">Confidentialité</a><a href="#">Livraison &amp; retours</a></div>
      </div>
      <div class="ud-foot-word">${udLogo}</div>
      <div class="ud-foot-legal"><span>© 2026 ${esc(o.name)} — Sénégal</span><span>Propulsé &amp; sécurisé par LASSİ</span></div>
    </footer>

    <script>(function(){
      var pages={home:document.querySelector('.ud-page-home'),boutique:document.querySelector('.ud-page-boutique')};
      if(!pages.home||!pages.boutique) return;
      var isEd=document.body.classList.contains('lassi-ed');
      if(isEd){ pages.boutique.hidden=false; }
      var reveal=function(p){ if(!p) return; setTimeout(function(){ [].forEach.call(p.querySelectorAll('.rv:not(.in)'),function(el){ if(el.classList.contains('rv-stag')){[].forEach.call(el.children,function(c,i){c.style.setProperty('--i',i);});} el.classList.add('in'); }); },240); };
      reveal(pages.home);
      [].forEach.call(document.querySelectorAll('.ud-look-imgz'),function(z){
        var show=function(e){ e.preventDefault(); z.classList.add('show2'); };
        var hide=function(){ z.classList.remove('show2'); };
        z.addEventListener('touchstart',show,{passive:false});
        z.addEventListener('touchend',hide); z.addEventListener('touchcancel',hide);
        z.addEventListener('click',function(e){ e.preventDefault(); });
      });
      // carte "Collection Limitée" animée quand la bannière fixe se dévoile
      var spacer=pages.home.querySelector('.ud-grow-spacer'), card=pages.home.querySelector('.ud-grow .ud-banner-card');
      if(spacer&&card&&'IntersectionObserver' in window){ new IntersectionObserver(function(es){es.forEach(function(e){card.classList.toggle('in',e.isIntersecting);});},{threshold:.12}).observe(spacer); } else if(card){ card.classList.add('in'); }
      if(isEd) return;
      document.querySelectorAll('[data-udnav]').forEach(function(a){
        a.addEventListener('click',function(e){
          e.preventDefault();
          var w=a.getAttribute('data-udnav'), h=a.getAttribute('href')||'';
          pages.home.hidden=(w!=='home'); pages.boutique.hidden=(w!=='boutique');
          document.querySelectorAll('.ud-links a').forEach(function(x){ x.classList.toggle('on', x.getAttribute('data-udnav')===w && (w!=='home'||x.getAttribute('href')==='#ud-top')); });
          reveal(pages[w]);
          var an=(w==='home'&&h.indexOf('#')===0&&h!=='#ud-top')?h:null;
          if(an){ var t=document.querySelector(an); if(t){ setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); },60); return; } }
          window.scrollTo({top:0,behavior:'smooth'});
        });
      });
      if(location.hash==='#ud-shop'){ pages.home.hidden=true; pages.boutique.hidden=false; }
    })();</script>`;

  const body = theme.template === 'udebi' && hasCatalog ? udBody
    : theme.template === 'cafefa' && hasCatalog ? faBody
    : theme.template === 'furniture' && hasCatalog ? furnitureBody
    : theme.template === 'cosmetic' && hasCatalog ? cosmeticBody
    : theme.template === 'garderobe' && hasCatalog ? garderobeBody
    : theme.template === 'sac' && hasCatalog ? sacBody
    : theme.template === 'tresse' && hasCatalog ? tresseBody
    : theme.template === 'ferme' && hasCatalog ? fermeBody
    : theme.template === 'grill' && hasCatalog ? grillBody
    : theme.template === 'bar' && hasCatalog ? barBody
    : classicBody;

  const cfg = JSON.stringify({
    url: SUPABASE_URL, key: SUPABASE_ANON_KEY, slug: o.slug, shop: o.name, rate: COMMISSION_RATE,
    hasFitness,
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${escAttr(o.desc)}">
<link rel="canonical" href="${escAttr(o.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LASSİ">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${escAttr(o.title)}">
<meta property="og:description" content="${escAttr(o.desc)}">
<meta property="og:image" content="${escAttr(o.ogImage)}">
<meta property="og:image:alt" content="${escAttr(o.name)}">
<meta property="og:url" content="${escAttr(o.canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(o.title)}">
<meta name="twitter:description" content="${escAttr(o.desc)}">
<meta name="twitter:image" content="${escAttr(o.ogImage)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${theme.fontsLink}
${theme.template === 'tresse' ? '<link href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@400;700&family=Raleway:wght@300;400;500;600;700&display=swap" rel="stylesheet">' : ''}
${theme.template === 'grill' ? '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800;900&family=Cinzel:wght@500;600&display=swap" rel="stylesheet">' : ''}
${theme.template === 'bar' ? '<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">' : ''}
${theme.template === 'cafefa' ? '<link href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">' : ''}
${theme.template === 'udebi' ? '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">' : ''}
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  [hidden] { display:none !important; }
  :root { --y:${theme.y}; --d:${theme.d}; --w:${theme.w}; --g:${theme.g}; --m:${theme.m}; --b:${theme.b}; --fh:${theme.fh}; --fb:${theme.fb}; }
  body { background:var(--w); color:var(--d); font-family:var(--fb); font-size:15px; line-height:1.55; padding-bottom:${hasProducts ? '80px' : '0'}; }
  /* HERO */
  .hero { display:grid; grid-template-columns:1fr 1fr; min-height:80vh; align-items:stretch; }
  @media(max-width:680px){ .hero{grid-template-columns:1fr;min-height:auto;} .hero-img{order:-1;height:280px;} }
  .hero-left { display:flex; flex-direction:column; justify-content:center; padding:64px 52px 64px 48px; }
  @media(max-width:680px){ .hero-left{padding:36px 24px 32px;} }
  .shop-cat { font-size:11px; font-weight:500; letter-spacing:2.5px; text-transform:uppercase; color:var(--m); margin-bottom:18px; }
  .hero-title { font-family:var(--fh); font-size:clamp(36px,5vw,60px); font-weight:300; line-height:1.1; margin-bottom:22px; letter-spacing:-0.5px; }
  .hero-desc { font-size:15px; font-weight:300; color:var(--m); line-height:1.7; max-width:380px; margin-bottom:38px; }
  .hours-block { border-top:1px solid var(--b); padding-top:28px; }
  .hours-label { font-size:10px; font-weight:600; letter-spacing:2px; text-transform:uppercase; color:var(--m); margin-bottom:14px; }
  .hours-status { display:inline-flex; align-items:center; gap:9px; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:500; }
  .hours-status::before { content:''; width:7px; height:7px; border-radius:50%; flex:0 0 auto; }
  .h-open { background:rgba(34,197,94,.10); color:#166534; }
  .h-open::before { background:#22c55e; }
  .h-closed { background:rgba(100,100,100,.09); color:var(--m); }
  .h-closed::before { background:var(--m); }
  .h-pause { background:rgba(253,207,52,.15); color:#92610a; }
  .h-pause::before { background:var(--y); }
  .promo-banner { display:flex; align-items:flex-start; gap:8px; background:rgba(253,207,52,.13); border:1px solid rgba(253,207,52,.35); border-radius:10px; padding:10px 14px; margin-top:10px; }
  .promo-ico { font-size:15px; flex-shrink:0; margin-top:1px; }
  .promo-txt { font-size:13px; color:var(--d); line-height:1.4; }
  .hours-time { font-size:13px; color:var(--m); font-weight:300; margin-top:6px; }
  .hero-img { position:relative; background:#e8e7e3; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .shop-logo { width:80%; max-width:420px; aspect-ratio:1/1; object-fit:cover; border-radius:22%; }
  .logo-initial { width:min(60%,220px); aspect-ratio:1/1; border-radius:22%; display:flex; align-items:center; justify-content:center; background:var(--y); color:var(--d); font-family:var(--fh); font-size:min(90px,16vw); font-weight:300; }
  .verified-badge { position:absolute; bottom:24px; right:24px; background:var(--y); color:var(--d); font-size:11px; font-weight:600; padding:6px 14px; border-radius:999px; }
  .zone-badge { position:absolute; top:24px; left:24px; background:rgba(255,255,255,.9); color:var(--d); font-size:12px; font-weight:500; padding:6px 14px; border-radius:999px; border:1px solid var(--b); }
  .divider { width:100%; height:1px; background:var(--b); }
  /* CATALOG */
  .catalog { max-width:1100px; margin:0 auto; padding:56px 32px 32px; }
  @media(max-width:680px){ .catalog{padding:36px 20px 20px;} }
  .catalog-title { font-family:var(--fh); font-size:clamp(28px,4vw,44px); font-weight:300; line-height:1.1; letter-spacing:-0.3px; margin-bottom:32px; }
  .catnav { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none; margin-bottom:40px; }
  .catnav::-webkit-scrollbar { display:none; }
  .chip { flex:0 0 auto; padding:9px 20px; border-radius:999px; font-size:13px; font-weight:500; border:1.5px solid var(--b); background:transparent; color:var(--d); cursor:pointer; white-space:nowrap; font-family:inherit; }
  .chip.sel { background:var(--y); border-color:var(--y); }
  .catsec { margin-bottom:52px; }
  .cathead { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
  .cathead-title { font-family:var(--fh); font-size:22px; font-weight:400; }
  .cathead-count { font-size:12px; font-weight:500; color:var(--m); background:var(--g); padding:3px 10px; border-radius:999px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media(max-width:760px){ .grid{grid-template-columns:repeat(2,1fr);gap:14px;} }
  .prod { display:flex; flex-direction:column; border:1.5px solid var(--b); border-radius:18px; overflow:hidden; background:var(--w); }
  .prod.in { border-color:var(--y); }
  .pimgzone { width:100%; aspect-ratio:4/5; background:var(--g); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
  .svc-imgzone { aspect-ratio:4/3; }
  .pimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .prod { cursor:pointer; }
  .pemoji { font-size:46px; }
  /* Fiche produit agrandie */
  .pd-ov { position:fixed; inset:0; z-index:60; background:rgba(10,11,22,.6); display:flex; align-items:flex-end; justify-content:center; }
  .pd-card { position:relative; width:100%; max-width:480px; max-height:92vh; background:var(--w); border-radius:22px 22px 0 0; overflow:hidden; display:flex; flex-direction:column; animation:pdUp .22s ease; }
  @media(min-width:520px){ .pd-ov{align-items:center;} .pd-card{border-radius:22px;} }
  @keyframes pdUp { from{transform:translateY(40px);opacity:.4;} to{transform:translateY(0);opacity:1;} }
  .pd-x { position:absolute; top:12px; left:12px; z-index:3; width:38px; height:38px; border-radius:50%; border:none; background:rgba(20,21,42,.6); color:#fff; font-size:22px; line-height:1; cursor:pointer; }
  .pd-gallery { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; height:42vh; max-height:360px; background:var(--g); -webkit-overflow-scrolling:touch; }
  .pd-gallery img { flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:center; cursor:zoom-in; }
  .pd-gallery .pd-emoji { flex:0 0 100%; display:flex; align-items:center; justify-content:center; font-size:72px; }
  .pd-dots { display:flex; gap:6px; justify-content:center; padding:10px 0 0; }
  .pd-dots i { width:7px; height:7px; border-radius:50%; background:var(--b); transition:.2s; }
  .pd-dots i.on { background:var(--y); width:18px; border-radius:4px; }
  .pd-body { padding:14px 20px 4px; overflow:hidden; display:flex; flex-direction:column; }
  .pd-name { font-family:var(--fh); font-size:20px; line-height:1.25; }
  .pd-price { color:var(--y); font-weight:700; font-size:20px; margin-top:6px; }
  .pd-price .old { color:#9aa; font-weight:400; font-size:15px; text-decoration:line-through; margin-right:8px; }
  .pd-stock { font-size:12px; color:#8a8f9c; margin-top:4px; }
  .pd-desc { margin-top:12px; max-height:34vh; overflow-y:auto; font-size:14px; line-height:1.55; color:#555; white-space:pre-wrap; -webkit-overflow-scrolling:touch; }
  .pd-action { padding:14px 20px 24px; }
  .pd-add { display:block; width:100%; background:var(--y); color:var(--d); border:none; border-radius:12px; padding:15px; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit; }
  .pd-qty { display:flex; align-items:center; justify-content:center; gap:4px; background:var(--y); border-radius:12px; height:52px; }
  .pd-qty button { width:60px; height:52px; border:none; background:transparent; color:var(--d); font-size:24px; font-weight:700; cursor:pointer; }
  .pd-qty b { min-width:40px; text-align:center; font-size:18px; color:var(--d); }
  /* Image plein écran */
  .pf-ov { position:fixed; inset:0; z-index:70; background:rgba(6,7,18,.95); display:flex; align-items:center; justify-content:center; }
  .pf-img { max-width:100%; max-height:100%; object-fit:contain; }
  .pf-x { position:absolute; top:20px; right:20px; width:44px; height:44px; border-radius:50%; border:none; background:rgba(20,21,42,.8); color:#fff; font-size:24px; cursor:pointer; z-index:2; }
  .pbody { padding:14px 16px 16px; display:flex; flex-direction:column; gap:4px; flex:1; }
  .pname { font-family:var(--fh); font-size:16px; font-weight:400; line-height:1.2; }
  .pdesc { font-size:12px; color:var(--m); line-height:1.4; font-weight:300; }
  .pprice { font-size:14px; font-weight:600; margin-top:auto; padding-top:8px; }
  .stepper { margin-top:10px; }
  .add { display:block; width:100%; background:var(--y); color:var(--d); border:none; border-radius:10px; padding:10px; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
  .svcbtn { display:block; width:100%; margin-top:10px; text-align:center; text-decoration:none; background:transparent; color:var(--d); border:1.5px solid var(--d); border-radius:10px; padding:10px; font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; }
  .bookbtn { background:var(--y); color:var(--d); border-color:var(--y); }
  .qtybox { display:flex; width:100%; align-items:center; justify-content:space-between; background:var(--y); border-radius:10px; }
  .qtybox button { width:36px; height:36px; border:none; background:transparent; color:var(--d); font-size:20px; font-weight:700; cursor:pointer; font-family:inherit; }
  .qtybox .q { flex:1; text-align:center; color:var(--d); font-size:15px; font-weight:700; }
  .catalog.closed-overlay { opacity:0.4; pointer-events:none; }
  .closed-notice { background:var(--g); border:1.5px solid var(--b); border-radius:14px; padding:16px 20px; margin:0 32px 32px; text-align:center; }
  @media(max-width:680px){ .closed-notice{margin:0 20px 24px;} }
  .closed-pause { border-color:rgba(253,207,52,.5); background:rgba(253,207,52,.07); }
  .closed-pause .cn-label { color:#92610a; }
  .cn-label { font-size:15px; font-weight:600; }
  .cn-sub { font-size:13px; color:var(--m); margin-top:3px; }
  .ds-card { display:flex; align-items:center; gap:12px; background:rgba(253,207,52,.08); border:1.5px solid rgba(253,207,52,.35); border-radius:14px; padding:14px 16px; margin:0 0 14px; }
  .ds-img { width:80px; height:80px; border-radius:12px; object-fit:cover; flex-shrink:0; }
  .ds-info { flex:1; }
  .ds-name { font-family:var(--fh); font-size:16px; font-weight:400; }
  .ds-price { font-size:14px; font-weight:600; margin-top:4px; }
  .ds-btn { flex-shrink:0; background:var(--y); color:var(--d); font-size:14px; font-weight:700; border:none; border-radius:999px; padding:10px 18px; cursor:pointer; font-family:inherit; }
  .sectitle { font-family:var(--fh); font-size:26px; font-weight:300; margin:40px 0 20px; }
  .appnote { font-family:var(--fh); font-size:17px; font-weight:300; color:var(--m); margin:40px auto 16px; text-align:center; line-height:1.5; max-width:420px; padding:0 24px; }
  .cta { display:flex; flex-direction:row; gap:10px; width:100%; max-width:420px; margin:0 auto 40px; justify-content:center; padding:0 24px; }
  .store { flex:0 0 auto; display:flex; align-items:center; gap:8px; background:var(--d); color:var(--w); text-decoration:none; padding:11px 18px; border-radius:12px; border:1.5px solid transparent; }
  .store svg { width:20px; height:20px; flex:0 0 auto; fill:var(--w); }
  .store .txt { display:flex; flex-direction:column; text-align:left; line-height:1.05; min-width:0; }
  .store .txt small { font-size:9px; color:rgba(255,255,255,.7); font-weight:400; white-space:nowrap; }
  .store .txt strong { font-size:13px; font-weight:600; white-space:nowrap; }
  .store.primary { background:var(--y); color:var(--d); }
  .store.primary svg { fill:var(--d); }
  .store.primary .txt small { color:rgba(20,21,42,.65); }
  .btn { display:block; width:100%; max-width:420px; margin:32px auto 16px; padding:15px; border-radius:14px; font-weight:700; text-decoration:none; font-size:16px; background:var(--d); color:var(--w); text-align:center; }
  .foot { margin:24px 0 40px; font-size:12px; color:var(--m); line-height:1.5; text-align:center; padding:0 24px; }
  .foot b { color:var(--d); font-weight:600; }
  /* CART BAR */
  .cartbar { position:fixed; left:0; right:0; bottom:0; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.95) 30%); display:flex; justify-content:center; z-index:50; }
  .cartbtn { width:100%; max-width:528px; display:flex; align-items:center; justify-content:space-between; gap:12px; background:var(--d); color:var(--w); font-size:15px; font-weight:600; border:none; padding:16px 22px; border-radius:16px; cursor:pointer; font-family:inherit; box-shadow:0 8px 28px rgba(20,21,42,.22); }
  .cartbtn .cnt { background:var(--y); color:var(--d); border-radius:999px; padding:3px 11px; font-size:13px; font-weight:700; }
  /* MODALE */
  .sheet { position:fixed; inset:0; z-index:100; background:rgba(0,0,0,.45); display:none; align-items:flex-end; justify-content:center; }
  .sheet.open { display:flex; }
  .panel { width:100%; max-width:560px; background:var(--w); border-radius:22px 22px 0 0; padding:24px 22px calc(24px + env(safe-area-inset-bottom)); max-height:90vh; overflow:auto; }
  .panel h2 { font-family:var(--fh); font-size:24px; font-weight:400; margin-bottom:4px; }
  .panel .sub { color:var(--m); font-size:13px; margin-bottom:18px; }
  .lines { border:1px solid var(--b); border-radius:12px; padding:10px 14px; margin-bottom:16px; }
  .line { display:flex; justify-content:space-between; font-size:14px; padding:5px 0; }
  .line.tot { border-top:1px solid var(--b); margin-top:6px; padding-top:10px; font-weight:700; font-size:16px; }
  .fld { margin-bottom:14px; text-align:left; }
  .fld label { display:block; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--m); margin-bottom:6px; }
  .fld input, .fld textarea { width:100%; background:var(--g); border:1.5px solid var(--b); border-radius:11px; padding:13px; color:var(--d); font-size:15px; font-family:inherit; }
  .fld textarea { resize:vertical; min-height:52px; }
  .voicerow { display:flex; align-items:center; gap:10px; }
  .vrec { display:inline-flex; align-items:center; gap:8px; background:var(--g); border:1px solid var(--b); color:var(--d); border-radius:11px; padding:12px 16px; font-size:14px; font-weight:600; font-family:inherit; cursor:pointer; }
  .vrec.rec { border-color:#FF6B6B; color:#dc2626; }
  .vdot { width:11px; height:11px; border-radius:50%; background:#FF6B6B; flex:0 0 auto; }
  .vrec.rec .vdot { animation:blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity:.25; } }
  .vtime { font-size:13px; color:var(--m); font-variant-numeric:tabular-nums; }
  .vdel { background:none; border:none; color:var(--m); font-size:20px; cursor:pointer; line-height:1; padding:4px 8px; }
  #vplay { width:100%; margin-top:10px; }
  .pays { display:flex; gap:10px; margin-bottom:16px; }
  .pay { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:12px; border-radius:12px; border:1.5px solid var(--b); background:var(--g); color:var(--d); font-weight:600; font-size:14px; font-family:inherit; cursor:pointer; }
  .pay svg, .pay img { width:26px; height:26px; flex:0 0 auto; border-radius:7px; object-fit:cover; }
  .pay.sel { border-color:var(--d); background:var(--w); }
  .payer { width:100%; background:var(--d); color:var(--w); border:none; border-radius:14px; padding:16px; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit; }
  .payer[disabled] { opacity:.5; }
  .msg { color:#dc2626; font-size:13px; margin:10px 0 0; min-height:16px; text-align:center; }
  .waiting { text-align:center; padding:10px 0; }
  .waiting img { width:210px; height:210px; border-radius:14px; background:var(--g); padding:8px; margin:12px auto; display:block; }
  .spin { width:34px; height:34px; border:2.5px solid var(--b); border-top-color:var(--d); border-radius:50%; margin:16px auto; animation:sp 1s linear infinite; }
  @keyframes sp { to { transform:rotate(360deg); } }
  .close { position:absolute; top:16px; right:18px; background:var(--g); border:none; color:var(--d); font-size:18px; cursor:pointer; line-height:1; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
  /* BEAUTE */
  .bdates { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none; }
  .bdates::-webkit-scrollbar { display:none; }
  .bdate { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:1px; background:var(--g); border:1.5px solid var(--b); border-radius:12px; padding:8px 11px; color:var(--d); cursor:pointer; font-family:inherit; }
  .bdate b { font-size:11px; font-weight:600; color:var(--m); }
  .bdate i { font-style:normal; font-size:18px; font-weight:700; }
  .bdate small { font-size:10px; color:var(--m); }
  .bdate.on { background:var(--y); border-color:var(--y); }
  .bdate.on b, .bdate.on i, .bdate.on small { color:var(--d); }
  .bslots { display:flex; flex-wrap:wrap; gap:8px; min-height:20px; }
  .bslot { background:var(--g); border:1.5px solid var(--b); border-radius:9px; padding:9px 13px; color:var(--d); font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  .bslot.on { background:var(--y); border-color:var(--y); color:var(--d); }
  .bhint { font-size:13px; color:var(--m); }
  /* HABILLEMENT */
  .pstock { font-size:11px; color:var(--m); margin-top:2px; }
  .hab-sec { margin-bottom:14px; }
  .hab-sec label { display:block; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--m); margin-bottom:8px; }
  .hab-chips { display:flex; flex-wrap:wrap; gap:8px; }
  .hab-chip { flex:0 0 auto; padding:8px 14px; border-radius:9px; border:1.5px solid var(--d); background:transparent; color:var(--d); font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
  .hab-chip.on { background:var(--y); border-color:var(--y); color:var(--d); }
  #habStock { font-size:13px; color:var(--m); margin:0 0 14px; }
  #habStock.low { color:#F97316; }
  /* ABONNEMENT FITNESS */
  .abolist { display:flex; flex-direction:column; gap:10px; margin-bottom:32px; }
  .abocard { display:flex; align-items:center; gap:14px; background:var(--w); border:1.5px solid var(--b); border-radius:16px; padding:16px 18px; }
  .abo-left { flex:1; min-width:0; }
  .abonom { font-family:var(--fh); font-size:16px; font-weight:400; color:var(--d); line-height:1.2; }
  .abometa { font-size:12px; color:var(--m); margin-top:3px; }
  .abo-right { display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex-shrink:0; }
  .aboprix { font-size:15px; font-weight:700; color:var(--d); }
  .abo-btn { background:var(--y); color:var(--d); border:none; border-radius:999px; padding:9px 18px; font-size:14px; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; }
  /* TERRAINS */
  .terrain-list { display:flex; flex-direction:column; gap:14px; margin-bottom:40px; }
  .terrain-card { display:flex; align-items:center; gap:16px; background:var(--w); border:1.5px solid var(--b); border-radius:18px; overflow:hidden; text-decoration:none; color:var(--d); }
  .terrain-img { width:110px; height:100px; object-fit:cover; flex-shrink:0; }
  .terrain-emoji-box { width:80px; height:80px; display:flex; align-items:center; justify-content:center; font-size:40px; flex-shrink:0; background:var(--g); border-radius:14px; margin:10px 0 10px 10px; }
  .terrain-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; padding:14px 0 14px 0; }
  .terrain-addr { font-size:12px; color:var(--m); font-weight:300; }
  .terrain-prix { font-size:15px; font-weight:700; margin-top:4px; }
  .terrain-unit { font-size:12px; font-weight:400; color:var(--m); }
  .terrain-btn { flex-shrink:0; background:var(--y); color:var(--d); border:none; border-radius:0; padding:12px 18px; font-size:13px; font-weight:700; text-decoration:none; white-space:nowrap; display:flex; align-items:center; align-self:stretch; font-family:inherit; cursor:pointer; writing-mode:horizontal-tb; }
  @media(max-width:560px){ .terrain-card{flex-wrap:wrap;} .terrain-img{width:100%;height:160px;} .terrain-emoji-box{width:60px;height:60px;margin:10px;font-size:32px;} .terrain-btn{width:100%;justify-content:center;border-radius:0 0 18px 18px;} .terrain-body{padding:10px 14px 0;} }
  /* LIGHTBOX */
  .lbx { position:fixed; inset:0; z-index:999; background:rgba(0,0,0,.92); display:none; align-items:center; justify-content:center; cursor:zoom-out; }
  .lbx.open { display:flex; }
  .lbx-img { max-width:96vw; max-height:92vh; object-fit:contain; border-radius:12px; pointer-events:none; display:block; }
  .lbx-close { position:absolute; top:16px; right:16px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,.15); border:none; color:#fff; font-size:24px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  /* LAYOUT (Phase 2) — variantes ; valeurs par défaut (3/bordered/split) = aucune règle = rendu inchangé */
  body[data-cols="2"] .grid { grid-template-columns:repeat(2,1fr); }
  body[data-card="shadow"] .prod { border-color:transparent; box-shadow:0 8px 24px rgba(20,21,42,.10); }
  body[data-card="shadow"] .prod.in { border-color:var(--y); }
  body[data-card="flat"] .prod { border:none; border-radius:0; border-bottom:1px solid var(--b); }
  body[data-hero="centered"] .hero { grid-template-columns:1fr; min-height:auto; }
  body[data-hero="centered"] .hero-img { order:-1; min-height:280px; }
  body[data-hero="centered"] .hero-left { align-items:center; text-align:center; padding:40px 24px 28px; }
  body[data-hero="centered"] .hero-desc { margin-left:auto; margin-right:auto; }
  body[data-hero="centered"] .hours-block { width:100%; }
  body[data-hero="minimal"] .hero { grid-template-columns:1fr; min-height:auto; }
  body[data-hero="minimal"] .hero-img { display:none; }
  body[data-hero="minimal"] .hero-left { padding:44px 28px 24px; }
  /* ═══ TEMPLATE COSMETIC — éditorial beauté (réf Cosmetic.html) : hero image dominante, cartes image carrée + texte centré, boutons pilule ═══ */
  body[data-template="cosmetic"] .hero { grid-template-columns:1fr 1.15fr; background:var(--g); min-height:88vh; }
  body[data-template="cosmetic"] .hero-left { padding:72px 56px; }
  body[data-template="cosmetic"] .hero-img { background:#efe2d0; }
  body[data-template="cosmetic"] .shop-logo { border-radius:50%; width:70%; box-shadow:0 30px 60px rgba(23,19,19,.18); }
  body[data-template="cosmetic"] .logo-initial { border-radius:50%; }
  body[data-template="cosmetic"] .shop-cat { color:var(--y); letter-spacing:4px; font-weight:600; font-size:12px; }
  body[data-template="cosmetic"] .hero-title { font-weight:600; letter-spacing:-1px; font-size:clamp(42px,6vw,70px); }
  body[data-template="cosmetic"] .verified-badge { background:var(--y); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .zone-badge { border-color:var(--y); color:var(--d); border-radius:9999px; }
  body[data-template="cosmetic"] .catalog { max-width:1140px; }
  body[data-template="cosmetic"] .catalog-title { text-align:center; font-weight:600; letter-spacing:-0.5px; font-size:clamp(30px,4vw,46px); }
  body[data-template="cosmetic"] .catnav { justify-content:center; }
  body[data-template="cosmetic"] .cathead { justify-content:center; }
  body[data-template="cosmetic"] .cathead-title { font-weight:600; font-size:24px; }
  body[data-template="cosmetic"] .sectitle { text-align:center; font-weight:600; }
  body[data-template="cosmetic"] .grid { gap:26px; }
  body[data-template="cosmetic"] .prod { border:none; border-radius:20px; box-shadow:0 14px 40px rgba(23,19,19,.08); overflow:hidden; text-align:center; }
  body[data-template="cosmetic"] .prod.in { box-shadow:0 14px 40px rgba(217,134,100,.30); }
  body[data-template="cosmetic"] .pimgzone { aspect-ratio:1/1; background:var(--g); }
  body[data-template="cosmetic"] .pbody { align-items:center; }
  body[data-template="cosmetic"] .pname { font-weight:600; font-size:17px; }
  body[data-template="cosmetic"] .pprice { color:var(--y); font-weight:700; font-size:16px; }
  body[data-template="cosmetic"] .abonom { font-weight:600; }
  body[data-template="cosmetic"] .ds-name { font-weight:600; }
  body[data-template="cosmetic"] .abocard { border:none; border-radius:18px; box-shadow:0 10px 28px rgba(23,19,19,.07); }
  body[data-template="cosmetic"] .terrain-card { border:none; border-radius:18px; box-shadow:0 10px 28px rgba(23,19,19,.07); }
  body[data-template="cosmetic"] .ds-card { border-color:var(--y); background:rgba(217,134,100,.08); border-radius:18px; }
  body[data-template="cosmetic"] .chip { border-radius:9999px; }
  body[data-template="cosmetic"] .chip.sel { background:var(--y); border-color:var(--y); color:#fff; }
  body[data-template="cosmetic"] .add { background:var(--y); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .bookbtn { background:var(--y); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .abo-btn { background:var(--y); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .ds-btn { background:var(--y); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .svcbtn { border-color:var(--y); color:var(--y); border-radius:9999px; }
  body[data-template="cosmetic"] .terrain-btn { background:var(--y); color:#fff; }
  body[data-template="cosmetic"] .store { border-radius:9999px; }
  body[data-template="cosmetic"] .btn { border-radius:9999px; }
  body[data-template="cosmetic"] .payer { border-radius:9999px; }
  body[data-template="cosmetic"] .qtybox { background:var(--y); border-radius:9999px; }
  body[data-template="cosmetic"] .qtybox button { color:#fff; }
  body[data-template="cosmetic"] .qtybox .q { color:#fff; }
  body[data-template="cosmetic"] .cartbtn { background:var(--d); color:#fff; border-radius:9999px; }
  body[data-template="cosmetic"] .cartbtn .cnt { background:var(--y); color:#fff; }
  body[data-template="cosmetic"] .pay.sel { border-color:var(--y); }
  body[data-template="cosmetic"] .appnote { font-weight:500; }
  @media(max-width:680px){ body[data-template="cosmetic"] .hero{grid-template-columns:1fr;} body[data-template="cosmetic"] .hero-left{padding:36px 24px 32px;} }
  /* ─── Structure landing COSMETIC (classes cx-*) ─── */
  .cx-head { position:sticky; top:0; z-index:40; background:var(--w); border-bottom:1px solid var(--b); }
  .cx-top { display:flex; align-items:center; justify-content:space-between; gap:24px; max-width:1280px; margin:0 auto; padding:18px 40px; }
  .cx-logo { display:flex; align-items:center; gap:9px; font-family:var(--fh); font-weight:700; font-size:23px; letter-spacing:.5px; text-transform:uppercase; color:var(--d); }
  .cx-logo-ic { color:var(--y); font-size:20px; }
  .cx-logo-img { width:30px; height:30px; border-radius:7px; object-fit:cover; flex:0 0 auto; }
  .cx-cat { flex:0 1 300px; display:flex; align-items:center; border:1px solid var(--b); border-radius:9999px; padding:0 8px 0 18px; background:var(--w); }
  .cx-cat select { border:none; background:transparent; font-family:inherit; font-size:13.5px; color:var(--m); padding:11px 8px; width:100%; cursor:pointer; outline:none; -webkit-appearance:none; appearance:none; }
  .cx-call { display:flex; align-items:center; gap:11px; text-decoration:none; }
  .cx-call-ic { width:40px; height:40px; border-radius:50%; background:rgba(217,134,100,.14); color:var(--y); display:flex; align-items:center; justify-content:center; font-size:18px; flex:0 0 auto; }
  .cx-call-txt { display:flex; flex-direction:column; line-height:1.25; }
  .cx-call-txt small { font-size:11px; color:var(--m); }
  .cx-call-txt b { font-size:15px; color:var(--d); font-weight:700; }
  .cx-navrow { display:flex; align-items:center; justify-content:space-between; gap:24px; max-width:1280px; margin:0 auto; padding:0 40px 0; border-top:1px solid var(--b); }
  .cx-nav { display:flex; gap:32px; }
  .cx-nav a { color:var(--d); text-decoration:none; font-size:13.5px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; padding:16px 0; white-space:nowrap; }
  .cx-nav a:hover { color:var(--y); }
  .cx-icons { display:flex; align-items:center; gap:18px; }
  .cx-ic { color:var(--d); font-size:19px; text-decoration:none; cursor:pointer; line-height:1; position:relative; }
  .cx-ic:hover { color:var(--y); }
  @media(max-width:860px){ .cx-cat{display:none;} }
  @media(max-width:760px){ .cx-top{padding:12px 18px;gap:12px;} .cx-navrow{padding:0 18px;overflow-x:auto;} .cx-nav{gap:20px;} .cx-call-txt{display:none;} }
  .cx-hero { display:grid; grid-template-columns:1fr 1fr; align-items:stretch; min-height:82vh; background:var(--g); }
  .cx-hero-txt { display:flex; flex-direction:column; justify-content:center; padding:72px 56px; }
  .cx-eyebrow { font-size:12px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:var(--y); margin-bottom:18px; }
  .cx-eyebrow.light { color:#fff; opacity:.85; }
  .cx-hero-title { font-family:var(--fh); font-weight:600; font-size:clamp(40px,6vw,72px); line-height:1.02; letter-spacing:-1px; margin-bottom:20px; }
  .cx-hero-sub { font-size:16px; line-height:1.7; color:var(--m); max-width:440px; margin-bottom:30px; }
  .cx-hero-cta { display:flex; align-items:center; gap:18px; flex-wrap:wrap; margin-bottom:30px; }
  .cx-btn { display:inline-block; background:var(--y); color:#fff; text-decoration:none; font-weight:600; font-size:15px; padding:15px 34px; border-radius:9999px; }
  .cx-btn.light { background:#fff; color:var(--d); }
  .cx-hero-hours .hours-status { margin:0; }
  .cx-stats { display:flex; gap:34px; border-top:1px solid var(--b); padding-top:24px; flex-wrap:wrap; }
  .cx-stat { display:flex; flex-direction:column; gap:2px; }
  .cx-stat b { font-family:var(--fh); font-size:28px; font-weight:700; }
  .cx-stat b .cx-count { font-weight:700; font-size:inherit; }
  .cx-stat span { font-size:12px; color:var(--m); }
  .cx-hero-img { position:relative; background:var(--g); display:flex; align-items:flex-end; justify-content:center; overflow:hidden; }
  .cx-hero-model { width:100%; height:100%; object-fit:contain; object-position:bottom center; display:block; }
  .cx-hero-badge { position:absolute; bottom:22px; right:22px; background:var(--y); color:#fff; font-size:11px; font-weight:600; padding:7px 15px; border-radius:9999px; }
  .cx-play { display:inline-flex; align-items:center; gap:11px; color:var(--d); text-decoration:none; font-weight:600; font-size:14px; }
  .cx-play-ic { width:40px; height:40px; border-radius:50%; background:var(--w); border:1px solid var(--b); display:flex; align-items:center; justify-content:center; color:var(--y); font-size:12px; }
  .cx-play:hover .cx-play-ic { background:var(--y); color:#fff; border-color:var(--y); }
  @media(max-width:760px){ .cx-hero{grid-template-columns:1fr;} .cx-hero-txt{padding:44px 24px;} .cx-hero-img{min-height:300px;order:-1;} }
  .cx-banners { display:grid; grid-template-columns:1fr 1fr; gap:22px; max-width:1180px; margin:60px auto; padding:0 40px; }
  .cx-banner { position:relative; min-height:260px; border-radius:16px; overflow:hidden; background-size:cover; background-position:right center; background-color:#d9c7b5; text-decoration:none; display:flex; align-items:center; }
  .cx-banner::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,rgba(243,236,227,.72) 0%,rgba(243,236,227,.30) 42%,rgba(243,236,227,0) 65%); }
  .cx-banner-in { position:relative; z-index:1; padding:34px 36px; max-width:62%; }
  .cx-banner-k { font-size:11px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; color:var(--m); }
  .cx-banner-in h3 { font-family:var(--fh); font-weight:600; font-size:25px; line-height:1.18; margin:10px 0 20px; color:var(--d); }
  .cx-banner-cta { display:inline-block; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; color:var(--d); border:1.5px solid var(--d); padding:11px 24px; border-radius:2px; }
  .cx-banner:hover .cx-banner-cta { background:var(--d); color:#fff; }
  @media(max-width:760px){ .cx-banners{grid-template-columns:1fr;padding:0 20px;margin:36px auto;} .cx-banner-in{max-width:75%;} }
  .cx-shop { max-width:1180px; margin:0 auto; padding:30px 40px 20px; }
  @media(max-width:760px){ .cx-shop{padding:20px;} }
  .cx-sec-head { text-align:center; margin-bottom:34px; }
  .cx-sec-k { font-size:12px; font-weight:600; letter-spacing:3px; text-transform:uppercase; color:var(--y); }
  .cx-sec-title { font-family:var(--fh); font-weight:600; font-size:clamp(30px,4vw,46px); letter-spacing:-0.5px; margin-top:8px; }
  .cx-sec-sub { font-size:14.5px; color:var(--m); margin-top:10px; max-width:460px; margin-left:auto; margin-right:auto; line-height:1.6; }
  /* Section meilleures ventes : tuile éditoriale + grille produits */
  .cx-best { max-width:1180px; margin:70px auto; padding:0 40px; }
  .cx-best-grid { display:grid; grid-template-columns:0.85fr 1.6fr; gap:24px; align-items:stretch; }
  .cx-best-feature { position:relative; border-radius:16px; overflow:hidden; background-size:cover; background-position:center; background-color:#241a16; min-height:420px; display:flex; align-items:flex-end; }
  .cx-best-feature-ov { position:absolute; inset:0; background:linear-gradient(180deg,rgba(23,19,19,0) 40%,rgba(23,19,19,.78)); }
  .cx-best-feature-in { position:relative; z-index:1; padding:30px; }
  .cx-best-feature-in h3 { font-family:var(--fh); font-weight:600; font-size:27px; line-height:1.15; color:#fff; margin:10px 0 18px; }
  .cx-best-products { grid-template-columns:repeat(3,1fr); margin:0; }
  @media(max-width:860px){ .cx-best-grid{grid-template-columns:1fr;} .cx-best-feature{min-height:300px;} }
  @media(max-width:760px){ .cx-best{padding:0 20px;margin:44px auto;} .cx-best-products{grid-template-columns:repeat(2,1fr);} }
  /* Section sombre « peau éclatante » : titre + sceau + rangée produits + 4 features */
  .cx-feature { background:#171313; color:#fff; margin:70px 0 0; padding:50px 40px; }
  .cx-feature-top { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; max-width:1180px; margin:0 auto; }
  .cx-feature-head { max-width:440px; }
  .cx-feature-head h2 { font-family:var(--fh); font-weight:600; font-size:clamp(32px,4.4vw,50px); line-height:1.08; color:#fff; margin-bottom:16px; }
  .cx-feature-head p { font-size:15px; line-height:1.7; color:rgba(255,255,255,.62); margin-bottom:26px; }
  .cx-btn-outline { display:inline-block; border:1px solid rgba(255,255,255,.45); color:#fff; text-decoration:none; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; padding:14px 28px; border-radius:2px; }
  .cx-btn-outline:hover { background:#fff; color:var(--d); }
  .cx-feature-seal { flex:0 0 auto; width:96px; height:96px; border:1.5px solid var(--y); border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; color:var(--y); text-align:center; }
  .cx-seal-star { font-size:15px; line-height:1; }
  .cx-seal-txt { font-size:10px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; line-height:1.35; }
  .cx-feature-hero { max-width:1180px; margin:30px auto 8px; }
  .cx-feature-hero img { width:100%; height:440px; object-fit:cover; object-position:center; display:block; border-radius:14px; }
  .cx-feature-icons { display:grid; grid-template-columns:repeat(3,1fr); gap:30px; max-width:960px; margin:32px auto 0; }
  .cx-fico { text-align:center; }
  .cx-fico-ic { display:inline-flex; width:30px; height:30px; color:var(--y); }
  .cx-fico-ic svg { width:100%; height:100%; }
  .cx-fico b { display:block; color:#fff; font-size:16px; font-weight:600; margin:10px 0 6px; }
  .cx-fico small { display:block; color:rgba(255,255,255,.55); font-size:12.5px; line-height:1.6; max-width:260px; margin:0 auto; }
  @media(max-width:760px){ .cx-feature{padding:48px 20px;} .cx-feature-top{flex-direction:column;align-items:center;text-align:center;} .cx-feature-icons{grid-template-columns:1fr;gap:28px;} }
  .cx-perks { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:var(--y); margin:0; }
  .cx-perk { background:var(--y); color:#fff; padding:26px 24px; text-align:center; }
  .cx-perk b { display:block; font-size:15px; font-weight:700; margin-bottom:5px; }
  .cx-perk span { font-size:12.5px; opacity:.9; }
  @media(max-width:760px){ .cx-perks{grid-template-columns:1fr 1fr;} }
  .cx-foot { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:36px; background:var(--d); color:#fff; padding:60px 40px 36px; }
  .cx-foot .cx-logo { color:#fff; margin-bottom:14px; }
  .cx-foot-brand p { font-size:13.5px; line-height:1.7; color:rgba(255,255,255,.6); max-width:300px; }
  .cx-foot-col h4 { font-size:13px; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:14px; color:rgba(255,255,255,.9); }
  .cx-foot-col p { font-size:13.5px; color:rgba(255,255,255,.6); margin-bottom:8px; }
  .cx-foot-hours .hours-status { margin-top:6px; }
  .cx-foot-cta { display:inline-block; margin-top:10px; color:var(--y); text-decoration:none; font-weight:600; font-size:14px; }
  .cx-foot .cta { justify-content:flex-start; padding:0; margin:14px 0 0; }
  @media(max-width:760px){ .cx-foot{grid-template-columns:1fr;gap:26px;padding:40px 24px 28px;} }
  .cx-copy { background:var(--d); color:rgba(255,255,255,.4); text-align:center; font-size:12px; padding:0 0 26px; }
  .cx-copy span { color:var(--y); }

  /* ═══ TEMPLATE POTTERY — artisanat minimal (réf Pottery.html) : hero typographique Unbounded, cartes carrées bord fin, accent terre ═══ */
  body[data-template="pottery"] .hero { grid-template-columns:1.35fr 1fr; min-height:82vh; }
  body[data-template="pottery"] .hero-left { padding:72px 56px; justify-content:center; }
  body[data-template="pottery"] .hero-img { background:var(--g); }
  body[data-template="pottery"] .shop-logo { border-radius:4px; }
  body[data-template="pottery"] .logo-initial { border-radius:4px; }
  body[data-template="pottery"] .shop-cat { color:var(--y); letter-spacing:3px; font-weight:600; font-size:12px; }
  body[data-template="pottery"] .hero-title { font-weight:700; letter-spacing:-1.5px; line-height:1.02; font-size:clamp(44px,7vw,80px); }
  body[data-template="pottery"] .verified-badge { background:var(--d); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .zone-badge { border-radius:4px; }
  body[data-template="pottery"] .catalog-title { font-weight:700; letter-spacing:-1px; font-size:clamp(32px,5vw,54px); }
  body[data-template="pottery"] .sectitle { font-weight:700; }
  /* Unbounded = gros titres seulement ; petits titres repassent en Plus Jakarta */
  body[data-template="pottery"] .pname { font-family:var(--fb); font-weight:600; font-size:15px; }
  body[data-template="pottery"] .cathead-title { font-family:var(--fb); font-weight:700; }
  body[data-template="pottery"] .abonom { font-family:var(--fb); font-weight:600; }
  body[data-template="pottery"] .ds-name { font-family:var(--fb); font-weight:600; }
  body[data-template="pottery"] .panel h2 { font-family:var(--fb); font-weight:700; }
  body[data-template="pottery"] .grid { gap:16px; }
  body[data-template="pottery"] .prod { border:1px solid var(--b); border-radius:4px; box-shadow:none; }
  body[data-template="pottery"] .prod.in { border-color:var(--y); }
  body[data-template="pottery"] .pimgzone { aspect-ratio:1/1; background:var(--g); }
  body[data-template="pottery"] .pprice { color:var(--d); font-weight:700; }
  body[data-template="pottery"] .abocard { border:1px solid var(--b); border-radius:4px; box-shadow:none; }
  body[data-template="pottery"] .terrain-card { border:1px solid var(--b); border-radius:4px; box-shadow:none; }
  body[data-template="pottery"] .ds-card { border-radius:4px; }
  body[data-template="pottery"] .chip { border-radius:4px; }
  body[data-template="pottery"] .chip.sel { background:var(--d); border-color:var(--d); color:#fff; }
  body[data-template="pottery"] .add { background:var(--y); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .bookbtn { background:var(--y); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .abo-btn { background:var(--y); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .ds-btn { background:var(--y); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .svcbtn { border-color:var(--d); color:var(--d); border-radius:4px; }
  body[data-template="pottery"] .terrain-btn { background:var(--y); color:#fff; }
  body[data-template="pottery"] .store { border-radius:4px; }
  body[data-template="pottery"] .btn { border-radius:4px; }
  body[data-template="pottery"] .payer { border-radius:4px; }
  body[data-template="pottery"] .qtybox { background:var(--y); border-radius:4px; }
  body[data-template="pottery"] .qtybox button { color:#fff; }
  body[data-template="pottery"] .qtybox .q { color:#fff; }
  body[data-template="pottery"] .cartbtn { background:var(--d); color:#fff; border-radius:4px; }
  body[data-template="pottery"] .cartbtn .cnt { background:var(--y); color:#fff; }
  body[data-template="pottery"] .pay.sel { border-color:var(--d); }
  @media(max-width:680px){ body[data-template="pottery"] .hero{grid-template-columns:1fr;} body[data-template="pottery"] .hero-left{padding:36px 24px 32px;} }

  /* ═══ RÉSEAUX SOCIAUX (toutes templates) — icônes cliquables sur pastille blanche ═══ */
  .soc-row{display:flex;gap:14px;margin-top:16px;justify-content:center;flex-wrap:wrap}
  .soc-row .soc{width:56px;height:56px;border-radius:50%;background:#fff;display:grid;place-items:center;transition:.2s;border:1px solid rgba(0,0,0,.06)}
  .soc-row .soc:hover{transform:translateY(-3px);box-shadow:0 8px 18px rgba(0,0,0,.2)}
  .soc-row .soc img{width:30px;height:30px;object-fit:contain}

  /* ═══ TEMPLATE FURNITURE — Maison & Mobilier (réf Furniture.html) : header 2 rangées, hero mint + collage, bandes sombres, cartes carrées ═══ */
  body[data-template="furniture"]{background:#fff}
  .fn-head{max-width:1240px;margin:0 auto;padding:0 28px}
  .fn-h1{display:flex;align-items:center;gap:20px;min-height:92px}
  .fn-logo img{height:76px;width:auto}
  .fn-logo span{font-family:var(--fh);font-size:15px;font-weight:700;color:var(--d);white-space:nowrap}
  .fn-search{flex:0 0 280px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--b);border-radius:22px;padding:9px 16px;color:var(--m);font-size:14px}
  .fn-nav{margin-left:auto;display:flex;gap:26px;font-size:15px;font-weight:500}
  .fn-nav a{color:var(--d)} .fn-nav a:hover{color:var(--y)}
  .fn-cart{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:var(--d)}
  .fn-h2{display:flex;align-items:center;gap:30px;min-height:54px;border-top:1px solid var(--b);border-bottom:1px solid var(--b);font-size:14px}
  .fn-cats{display:flex;gap:24px;flex-wrap:wrap} .fn-cats a{color:var(--d);font-weight:500} .fn-cats a:hover{color:var(--y)}
  .fn-info{margin-left:auto;display:flex;gap:32px;color:var(--m);font-size:13px}
  .fn-info b{display:block;color:var(--d);font-weight:600}
  .fn-hero-sec{max-width:1240px;margin:0 auto;padding:28px 28px 48px}
  .fn-hero{background:var(--g);border-radius:26px;padding:60px 54px;display:grid;grid-template-columns:1fr 1.02fr;gap:46px;align-items:center}
  .fn-hero-l h1{font-family:var(--fh);font-size:clamp(26px,3.3vw,40px);font-weight:700;line-height:1.1;letter-spacing:-.5px;color:var(--d)}
  .fn-hero-l p{color:var(--m);font-size:13.5px;max-width:380px;margin:16px 0 24px;line-height:1.5}
  .fn-hero-cta{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
  .fn-btn{display:inline-flex;align-items:center;gap:8px;background:var(--d);color:#fff;padding:15px 30px;border-radius:30px;font-size:15px;font-weight:500;transition:.2s}
  .fn-btn:hover{opacity:.9}
  .fn-hours{font-size:13px;color:var(--m)}
  .fn-collage{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .fn-pcard{background:#fff;border-radius:16px;padding:14px;position:relative;display:flex;flex-direction:column;min-height:210px}
  .fn-pcard.fn-empty{background-size:cover;background-position:center;border-radius:16px}
  .fn-pt{font-weight:600;font-size:15px;color:var(--d)} .fn-pp{color:var(--m);font-size:13px;margin-top:2px}
  .fn-pim{margin-top:12px;border-radius:12px;flex:1;min-height:120px;background:var(--g);background-size:cover;background-position:center}
  .fn-arrow{position:absolute;right:16px;bottom:16px;width:40px;height:40px;border-radius:50%;background:var(--d);color:#fff;display:grid;place-items:center;font-size:17px}
  .fn-big{border-radius:16px;background:var(--b);background-size:cover;background-position:center;min-height:190px}
  .fn-promo{background:var(--d);color:#fff;border-radius:16px;padding:24px;display:flex;flex-direction:column;justify-content:center}
  .fn-promo h3{font-size:34px;font-weight:700;color:var(--y)} .fn-promo p{color:rgba(255,255,255,.8);font-size:11.5px;margin:8px 0 14px}
  .fn-promo a{color:#fff;font-weight:500;font-size:14px;align-self:flex-start;border-bottom:1px solid rgba(255,255,255,.5);padding-bottom:3px}
  .fn-shop{max-width:1240px;margin:0 auto;padding:10px 28px 60px}
  .fn-sec-head{text-align:center;max-width:620px;margin:0 auto 40px}
  .fn-sec-head .fn-k{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:var(--y);font-weight:600}
  .fn-sec-head h2{font-family:var(--fh);font-size:clamp(24px,3vw,34px);font-weight:700;color:var(--d);margin-top:10px}
  body[data-template="furniture"] .pdesc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12px}
  /* catalogue réel réutilisé — skin mobilier (cartes carrées, boutons verts) */
  body[data-template="furniture"] .grid{gap:0;border-top:1px solid var(--b);border-left:1px solid var(--b)}
  body[data-template="furniture"] .prod{border:none;border-right:1px solid var(--b);border-bottom:1px solid var(--b);border-radius:0;box-shadow:none;padding:22px}
  body[data-template="furniture"] .prod:hover{background:#fafcfc}
  body[data-template="furniture"] .prod.in{border-color:var(--y)}
  body[data-template="furniture"] .pimgzone{aspect-ratio:1/1;border-radius:6px;background:var(--g)}
  body[data-template="furniture"] .pname{font-weight:600;font-size:16px}
  body[data-template="furniture"] .pprice{color:var(--d);font-weight:700}
  body[data-template="furniture"] .add{background:var(--d);color:#fff;border-radius:30px}
  body[data-template="furniture"] .svcbtn{border-color:var(--d);color:var(--d);border-radius:30px}
  body[data-template="furniture"] .bookbtn,body[data-template="furniture"] .abo-btn,body[data-template="furniture"] .ds-btn,body[data-template="furniture"] .terrain-btn{background:var(--d);color:#fff;border-radius:30px}
  body[data-template="furniture"] .chip{border-radius:30px} body[data-template="furniture"] .chip.sel{background:var(--d);border-color:var(--d);color:#fff}
  body[data-template="furniture"] .abocard,body[data-template="furniture"] .terrain-card{border:1px solid var(--b);border-radius:8px;box-shadow:none}
  body[data-template="furniture"] .cartbtn{background:var(--d);color:#fff;border-radius:30px}
  body[data-template="furniture"] .qtybox{background:var(--d);border-radius:30px} body[data-template="furniture"] .qtybox button,body[data-template="furniture"] .qtybox .q{color:#fff}
  body[data-template="furniture"] .add,body[data-template="furniture"] .store,body[data-template="furniture"] .btn,body[data-template="furniture"] .payer{border-radius:30px}
  .fn-rooms{max-width:1240px;margin:0 auto;padding:0 28px 70px}
  .fn-rooms-in{background:var(--d);border-radius:26px;padding:52px;color:#fff}
  .fn-rooms-top{max-width:560px;margin-bottom:30px}
  .fn-rooms-top h2{font-family:var(--fh);font-size:clamp(22px,2.8vw,32px);font-weight:700}
  .fn-rooms-top p{color:rgba(255,255,255,.7);font-size:13.5px;margin-top:10px}
  .fn-rooms-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:180px 180px;gap:16px}
  .fn-room{position:relative;border-radius:14px;overflow:hidden;background-size:cover;background-position:center}
  .fn-room::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.4),transparent 50%)}
  .fn-room.big{grid-column:1;grid-row:1/3}
  .fn-chip{position:absolute;z-index:2;left:16px;bottom:16px;background:#fff;color:var(--d);border-radius:10px;padding:8px 14px}
  .fn-chip b{font-size:14px;font-weight:600}
  .fn-materials{max-width:1240px;margin:0 auto;padding:0 28px 80px}
  .fn-mat{display:grid;grid-template-columns:1fr 1.25fr;gap:52px;align-items:center}
  .fn-mat-l h2{font-family:var(--fh);font-size:clamp(28px,3.6vw,44px);font-weight:700;line-height:1.12;color:var(--d)}
  .fn-mat-l p{color:var(--m);font-size:15px;margin:18px 0 28px;max-width:420px}
  .fn-mat-gal{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;align-items:center}
  .fn-mat-gal .fn-mg{border-radius:14px;background-size:cover;background-position:center;aspect-ratio:3/4.4;background-color:var(--g)}
  .fn-mat-gal .fn-mg:nth-child(2){transform:translateY(-20px)} .fn-mat-gal .fn-mg:nth-child(3){transform:translateY(20px)}
  .fn-foot{background:var(--d);color:rgba(255,255,255,.72)}
  .fn-foot-grid{max-width:1240px;margin:0 auto;padding:60px 28px 40px;display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:36px}
  .fn-foot-brand img{height:74px;margin-bottom:14px} .fn-foot-brand .fn-foot-logo{font-family:var(--fh);font-size:24px;color:#fff;margin-bottom:12px}
  .fn-foot-brand p{font-size:14px;max-width:280px}
  .fn-foot-col h4{color:#fff;font-size:15px;font-weight:600;margin-bottom:14px}
  .fn-foot-col a{display:block;font-size:14px;margin-bottom:9px;color:rgba(255,255,255,.72)} .fn-foot-col a:hover{color:#fff}
  .fn-foot-col p{font-size:14px;margin-bottom:8px}
  .fn-copy{border-top:1px solid rgba(255,255,255,.12);padding:20px;text-align:center;font-size:13px;color:rgba(255,255,255,.6)}
  @media(max-width:860px){
    .fn-h1 .fn-nav,.fn-search,.fn-info{display:none}
    .fn-hero{grid-template-columns:1fr;padding:38px 24px}
    .fn-hero-l h1{font-size:20px;line-height:1.15}
    .fn-rooms-grid{grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,150px)}
    .fn-room.big{grid-column:1/3;grid-row:1}.fn-room.wide{grid-column:1/3;grid-row:2}
    .fn-mat{grid-template-columns:1fr;gap:26px}
    .fn-foot-grid{grid-template-columns:1fr 1fr}
  }
  /* ── GARDEROBE (mode / prêt-à-porter) ───────────────────────────────── */
  body[data-template="garderobe"]{background:#fff}
  .gd-head{position:sticky;top:0;z-index:40;background:var(--d);color:#fff}
  .gd-head-in{max-width:1240px;margin:0 auto;padding:16px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}
  .gd-logo img{height:34px;display:block} .gd-logo span{font-family:var(--fh);font-weight:700;font-size:21px;color:#fff;letter-spacing:.5px}
  .gd-nav{display:flex;gap:30px}
  .gd-nav a{color:rgba(255,255,255,.82);text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
  .gd-nav a:hover{color:var(--y)}
  .gd-head-cta{background:var(--y);color:#fff;font-weight:700;font-size:12px;letter-spacing:.5px;text-transform:uppercase;padding:10px 22px;border-radius:4px;text-decoration:none;white-space:nowrap}
  .gd-head-cta:hover{filter:brightness(.94)}
  .gd-hero{display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:30px;background:var(--g);max-width:100%;padding:0}
  .gd-hero-l{padding:64px 28px 64px 56px;max-width:620px;margin-left:auto}
  .gd-eyebrow{display:inline-block;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--y);margin-bottom:16px}
  .gd-hero-title{font-family:var(--fh);font-weight:700;font-size:clamp(30px,3.8vw,46px);line-height:1.08;letter-spacing:-1px;color:var(--d)}
  .gd-hero-sub{color:var(--m);font-size:15px;line-height:1.7;margin:20px 0 22px;max-width:440px}
  .gd-feats{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:30px}
  .gd-feat{font-size:13px;font-weight:600;color:var(--d);display:inline-flex;align-items:center;gap:8px} .gd-feat::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--y)}
  .gd-hero-cta{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  .gd-btn{display:inline-block;background:var(--y);color:#fff;font-weight:700;font-size:14px;padding:15px 34px;border-radius:4px;text-decoration:none;text-transform:uppercase;letter-spacing:.5px}
  .gd-btn:hover{filter:brightness(.94)}
  .gd-hero-r{position:relative;align-self:stretch;min-height:460px;display:flex;align-items:flex-end;justify-content:center;padding:40px 40px 0}
  .gd-hero-r::before{content:"";position:absolute;top:50%;left:50%;transform:translate(-50%,-46%);width:min(430px,78%);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 40%,#fff 0%,var(--y) 140%);opacity:.16}
  .gd-hero-img{position:relative;max-height:520px;max-width:100%;object-fit:contain;display:block;filter:drop-shadow(0 26px 40px rgba(0,0,0,.14))}
  .gd-hero-badge{position:absolute;left:24px;bottom:24px;background:#fff;color:var(--d);font-size:12px;font-weight:600;padding:8px 14px;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .gd-perks{background:var(--d);overflow:hidden}
  .gd-marq{overflow:hidden}
  .gd-marq-track{display:flex;width:max-content;animation:gdMarq 9s linear infinite}
  .gd-marq:hover .gd-marq-track{animation-play-state:paused}
  @keyframes gdMarq{from{transform:translateX(-33.333%)}to{transform:translateX(0)}}
  @media(prefers-reduced-motion:reduce){.gd-marq-track{animation:none;transform:none}}
  .gd-perks-in{max-width:1240px;margin:0 auto;padding:30px 28px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
  .gd-marq-track .gd-perk{flex:0 0 auto;margin:28px 34px;padding-left:16px}
  .gd-perk{display:flex;align-items:center;gap:14px;color:#fff;padding-left:16px;border-left:2px solid var(--y)}
  .gd-perk b{display:block;font-size:14px;font-weight:600} .gd-perk small{color:rgba(255,255,255,.6);font-size:12px}
  .gd-shop{max-width:1240px;margin:0 auto;padding:60px 28px 20px}
  .gd-sec-head{text-align:center;margin-bottom:30px}
  .gd-k{display:block;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--m);margin-bottom:6px}
  .gd-sec-head h2{font-family:var(--fh);font-weight:700;font-size:clamp(26px,3.4vw,40px);color:var(--d)}
  body[data-template="garderobe"] .catnav,body[data-template="garderobe"] .cathead{justify-content:center}
  body[data-template="garderobe"] .grid{gap:22px}
  body[data-template="garderobe"] .prod{border:1px solid var(--b);border-radius:8px;box-shadow:none;text-align:center;overflow:hidden;transition:box-shadow .2s}
  body[data-template="garderobe"] .prod:hover{box-shadow:0 14px 34px rgba(0,0,0,.09)}
  body[data-template="garderobe"] .prod.in{border-color:var(--y);box-shadow:0 14px 34px rgba(228,50,43,.18)}
  body[data-template="garderobe"] .pimgzone{aspect-ratio:1/1;background:var(--g)}
  body[data-template="garderobe"] .pbody{align-items:center;padding:16px}
  body[data-template="garderobe"] .pname{font-weight:600;font-size:15px}
  body[data-template="garderobe"] .pprice{color:var(--y);font-weight:700;font-size:16px}
  body[data-template="garderobe"] .chip{border-radius:4px} body[data-template="garderobe"] .chip.sel{background:var(--d);border-color:var(--d);color:#fff}
  body[data-template="garderobe"] .add{background:var(--y);color:#fff;border-radius:4px;text-transform:uppercase;font-weight:700;letter-spacing:.5px}
  body[data-template="garderobe"] .svcbtn{border-color:var(--y);color:var(--y);border-radius:4px}
  body[data-template="garderobe"] .bookbtn,body[data-template="garderobe"] .abo-btn,body[data-template="garderobe"] .ds-btn,body[data-template="garderobe"] .terrain-btn{background:var(--y);color:#fff;border-radius:4px}
  body[data-template="garderobe"] .qtybox{background:var(--y);border-radius:4px} body[data-template="garderobe"] .qtybox button,body[data-template="garderobe"] .qtybox .q{color:#fff}
  body[data-template="garderobe"] .cartbtn{background:var(--d);color:#fff;border-radius:4px} body[data-template="garderobe"] .cartbtn .cnt{background:var(--y);color:#fff}
  body[data-template="garderobe"] .abocard,body[data-template="garderobe"] .terrain-card{border:1px solid var(--b);border-radius:8px;box-shadow:none}
  body[data-template="garderobe"] .store,body[data-template="garderobe"] .btn,body[data-template="garderobe"] .payer{border-radius:4px}
  .gd-sec-head.light .gd-k,.gd-sec-head.light h2{color:#fff} .gd-k.light{color:rgba(255,255,255,.55)}
  /* Parcourir par catégorie (sombre) */
  .gd-cats-sec{background:var(--d);margin-top:40px}
  .gd-cats-wrap{max-width:1240px;margin:0 auto;padding:64px 28px}
  .gd-cats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
  .gd-cat-card{position:relative;display:block;height:380px;border-radius:12px;overflow:hidden;background-size:cover;background-position:center;text-decoration:none}
  .gd-cat-ov{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.65),rgba(0,0,0,.05) 60%)}
  .gd-cat-info{position:absolute;left:22px;bottom:22px;z-index:2;color:#fff}
  .gd-cat-info small{display:block;font-size:12px;color:var(--y);font-weight:600;letter-spacing:.5px;margin-bottom:4px}
  .gd-cat-info b{font-family:var(--fh);font-size:24px;font-weight:700}
  /* Bloc éditorial (boîte sombre sur visuel) */
  .gd-edito{position:relative;max-width:1240px;margin:70px auto;padding:0 28px;display:flex;justify-content:flex-end;align-items:center;min-height:480px}
  .gd-edito-img{position:absolute;right:28px;top:0;width:66%;height:100%;border-radius:12px;background-size:cover;background-position:center;background-color:var(--g)}
  .gd-edito-box{position:relative;z-index:2;background:var(--d);color:#fff;max-width:420px;padding:44px;border-radius:12px;margin:40px 0}
  .gd-edito-box h2{font-family:var(--fh);font-weight:700;font-size:clamp(26px,3.2vw,38px);margin:6px 0 16px}
  .gd-edito-box p{color:rgba(255,255,255,.72);font-size:15px;line-height:1.75;margin-bottom:22px}
  .gd-sign{font-family:var(--fh);font-size:26px;font-style:italic;color:var(--y)}
  /* Bande offres (produits + panneau) */
  .gd-deals{background:var(--g)}
  .gd-deals-wrap{max-width:1240px;margin:0 auto;padding:64px 28px;display:grid;grid-template-columns:2fr 1fr;gap:30px;align-items:stretch}
  .gd-deals-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .gd-deals-panel{background:var(--d);color:#fff;border-radius:12px;padding:40px;display:flex;flex-direction:column;justify-content:center}
  .gd-deals-k{font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--y);margin-bottom:8px}
  .gd-deals-panel h3{font-family:var(--fh);font-weight:700;font-size:clamp(24px,2.6vw,32px);margin-bottom:12px}
  .gd-deals-panel p{color:rgba(255,255,255,.7);font-size:14px;line-height:1.7;margin-bottom:22px}
  .gd-foot{background:var(--d);color:rgba(255,255,255,.72)}
  .gd-foot-grid{max-width:1240px;margin:0 auto;padding:60px 28px 40px;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:36px}
  .gd-foot-brand img{height:40px;margin-bottom:14px} .gd-foot-brand .gd-foot-logo{font-family:var(--fh);font-size:22px;color:#fff;margin-bottom:12px}
  .gd-foot-brand p{font-size:14px;max-width:290px;margin-bottom:16px}
  .gd-foot-col h4{color:#fff;font-size:15px;font-weight:600;margin-bottom:14px}
  .gd-foot-col a{display:block;font-size:14px;margin-bottom:9px;color:rgba(255,255,255,.72);text-decoration:none} .gd-foot-col a:hover{color:#fff}
  .gd-foot-col p{font-size:14px;margin-bottom:8px}
  .gd-foot-cta{color:var(--y);font-weight:600}
  .gd-copy{border-top:1px solid rgba(255,255,255,.12);padding:20px;text-align:center;font-size:13px;color:rgba(255,255,255,.6)}
  @media(max-width:860px){
    .gd-nav{display:none}
    .gd-hero{grid-template-columns:1fr} .gd-hero-l{padding:40px 24px 10px;margin:0;max-width:none} .gd-hero-r{min-height:300px;order:-1}
    .gd-hero-img{max-height:340px}
    .gd-perks-in{grid-template-columns:1fr 1fr;gap:18px}
    .gd-cats-grid{grid-template-columns:1fr;gap:16px} .gd-cat-card{height:260px}
    .gd-edito{min-height:auto;display:block;padding:0 24px} .gd-edito-img{position:relative;width:100%;height:240px;right:auto} .gd-edito-box{max-width:none;margin:-40px 0 0;padding:28px}
    .gd-deals-wrap{grid-template-columns:1fr;gap:20px} .gd-deals-grid{grid-template-columns:1fr 1fr;gap:12px} .gd-deals-panel{order:-1}
    .gd-foot-grid{grid-template-columns:1fr 1fr}
  }
  /* ── Template SAC (maroquinerie / bagagerie — « Modern Shop ») ── */
  body[data-template="sac"]{background:#fff}
  .sc-head{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid var(--b)}
  .sc-head-top{max-width:1240px;margin:0 auto;padding:16px 28px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px}
  .sc-head-side{display:flex;align-items:center;gap:14px}
  .sc-head-tools{justify-content:flex-end}
  .sc-head-social a,.sc-head-social span{display:inline-flex}
  .sc-logo{justify-self:center;text-align:center}
  .sc-logo img{height:40px;display:block} .sc-logo span{font-family:var(--fh);font-weight:700;font-size:22px;color:var(--d);letter-spacing:1px;text-transform:uppercase}
  .sc-ic{color:var(--d);font-size:18px;cursor:pointer;text-decoration:none}
  .sc-nav{display:flex;justify-content:center;gap:34px;padding:0 28px 14px}
  .sc-nav a{color:var(--m);text-decoration:none;font-size:12px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;padding-bottom:4px;white-space:nowrap}
  .sc-nav a:hover{color:var(--d)}
  .sc-nav .sc-nav-active{color:var(--d);border-bottom:2px solid var(--y)}
  .sc-hero{position:relative;min-height:clamp(440px,72vh,640px);background-size:cover;background-position:center;background-color:var(--d);display:flex;align-items:center}
  .sc-hero-kb{background-size:112%;animation:scKen 22s ease-in-out infinite alternate}
  @keyframes scKen{from{background-size:112%;background-position:50% 50%}to{background-size:128%;background-position:52% 48%}}
  @media(prefers-reduced-motion:reduce){.sc-hero-kb{animation:none;background-size:cover}}
  .sc-hero-ov{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,18,18,.78),rgba(18,18,18,.35) 60%,rgba(18,18,18,.15))}
  .sc-hero-in{position:relative;z-index:2;width:100%;max-width:1240px;margin:0 auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;gap:30px}
  .sc-hero-l{max-width:560px}
  .sc-eyebrow{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--y);margin-bottom:16px;white-space:nowrap}
  .sc-hero-l h1{font-family:var(--fh);font-weight:800;font-size:clamp(34px,5.2vw,62px);line-height:1.04;letter-spacing:-1px;color:#fff}
  .sc-hero-l p{color:rgba(255,255,255,.82);font-size:15px;line-height:1.7;margin:20px 0 28px;max-width:440px}
  .sc-hero-cta{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  .sc-btn{display:inline-block;background:var(--y);color:var(--d);font-weight:700;font-size:14px;padding:15px 32px;border-radius:6px;text-decoration:none}
  .sc-btn:hover{opacity:.92}
  .sc-btn-y{background:var(--y);color:var(--d)}
  .sc-hours{font-size:13px;color:rgba(255,255,255,.75)}
  .sc-play{flex:0 0 auto;margin-left:auto;width:84px;height:84px;border-radius:50%;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.7);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;transition:.2s;box-shadow:0 10px 40px rgba(0,0,0,.3);cursor:pointer;padding:0}
  .sc-play:hover{background:var(--y);border-color:var(--y);color:var(--d);transform:scale(1.06)}
  .sc-play svg{margin-left:4px}
  .sc-vlb{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:none;align-items:center;justify-content:center;padding:20px}
  .sc-vlb.on{display:flex}
  .sc-vlb-in{position:relative;width:100%;max-width:820px}
  .sc-vlb-in video{width:100%;max-height:82vh;border-radius:12px;background:#000;display:block}
  .sc-vlb-x{position:absolute;top:-44px;right:0;width:36px;height:36px;border-radius:50%;background:#fff;color:#111;border:none;font-size:16px;cursor:pointer;line-height:36px}
  .sc-badge{position:absolute;z-index:2;left:28px;bottom:24px;background:#fff;color:var(--d);font-size:12px;font-weight:600;padding:8px 14px;border-radius:30px;box-shadow:0 10px 30px rgba(0,0,0,.2)}
  .sc-feature{margin:0 auto;padding:64px 0 24px}
  .sc-feature-in{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:stretch;background:var(--d);padding:40px;box-sizing:border-box}
  .sc-feature-in .sc-fcard{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
  .sc-feature-in .sc-fcard h2,.sc-feature-in .sc-fcard-top b{color:#fff}
  .sc-feature-in .sc-fcard p,.sc-feature-in .sc-fcard-top small{color:rgba(255,255,255,.7)}
  .sc-fcard{background:#fff;border:1px solid var(--b);border-radius:16px;padding:34px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 16px 40px rgba(0,0,0,.05)}
  .sc-fcard-top{display:flex;align-items:center;gap:14px;margin-bottom:18px}
  .sc-avatar{width:48px;height:48px;border-radius:50%;object-fit:cover;background:var(--g)}
  .sc-fcard-top b{display:block;font-size:12px;color:var(--d);line-height:1.2;white-space:nowrap} .sc-fcard-top small{color:var(--m);font-size:11.5px}
  .sc-fcard h2{font-family:var(--fh);font-weight:700;font-size:clamp(24px,3vw,34px);line-height:1.1;color:var(--d);margin-bottom:14px}
  .sc-fcard p{color:var(--m);font-size:14px;line-height:1.7}
  .sc-promo{position:relative;border-radius:16px;overflow:hidden;min-height:260px;background-size:cover;background-position:center;background-color:var(--d)}
  .sc-promo-ov{position:absolute;inset:0;background:linear-gradient(90deg,rgba(26,26,26,.82),rgba(26,26,26,.35));display:flex;flex-direction:column;justify-content:center;padding:40px;color:#fff}
  .sc-promo-k{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--y);margin-bottom:12px}
  .sc-promo h3{font-family:var(--fh);font-weight:700;font-size:clamp(17px,2vw,23px);line-height:1.2;margin-bottom:12px;max-width:400px}
  .sc-promo p{color:rgba(255,255,255,.72);font-size:13px;line-height:1.6;margin-bottom:20px;max-width:330px}
  .sc-btn-dark{background:#000;color:#fff}
  .sc-promo .sc-btn{align-self:flex-start}
  .sc-types{max-width:1240px;margin:0 auto;padding:48px 28px}
  .sc-types-head{text-align:center;margin-bottom:34px}
  .sc-types-head h2{font-family:var(--fh);font-weight:700;font-size:clamp(26px,3.4vw,42px);color:var(--d)}
  .sc-types-head p{color:var(--m);font-size:14px;margin-top:8px}
  .sc-types-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
  .sc-type{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:3/4;background-size:cover;background-position:center;background-color:var(--g)}
  .sc-type::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,.1) 62%)}
  .sc-type-ov{position:absolute;z-index:2;left:16px;right:16px;bottom:16px} .sc-type-ov b{display:block;color:#fff;font-size:16px;font-weight:700}
  .sc-type-ov small{display:block;color:rgba(255,255,255,.82);font-size:11.5px;line-height:1.45;margin-top:5px}
  .sc-shop{max-width:1240px;margin:0 auto;padding:40px 28px 20px}
  .sc-sec-head{text-align:center;margin-bottom:30px}
  .sc-k{display:block;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--m);margin-bottom:6px}
  .sc-sec-head h2{font-family:var(--fh);font-weight:700;font-size:clamp(26px,3.4vw,40px);color:var(--d)}
  body[data-template="sac"] .catnav,body[data-template="sac"] .cathead{justify-content:center}
  body[data-template="sac"] .grid{gap:22px}
  body[data-template="sac"] .prod{border:1px solid var(--b);border-radius:12px;box-shadow:none;overflow:hidden;transition:box-shadow .2s}
  body[data-template="sac"] .prod:hover{box-shadow:0 14px 34px rgba(0,0,0,.09)}
  body[data-template="sac"] .prod.in{border-color:var(--y);box-shadow:0 14px 34px rgba(253,207,52,.28)}
  body[data-template="sac"] .pimgzone{aspect-ratio:1/1;background:var(--g)}
  body[data-template="sac"] .pname{font-weight:600;font-size:15px}
  body[data-template="sac"] .pprice{color:var(--d);font-weight:700;font-size:16px}
  body[data-template="sac"] .chip{border-radius:30px} body[data-template="sac"] .chip.sel{background:var(--d);border-color:var(--d);color:#fff}
  body[data-template="sac"] .add{background:var(--d);color:#fff;border-radius:6px}
  body[data-template="sac"] .svcbtn{border-color:var(--d);color:var(--d);border-radius:6px}
  body[data-template="sac"] .bookbtn,body[data-template="sac"] .abo-btn,body[data-template="sac"] .ds-btn,body[data-template="sac"] .terrain-btn{background:var(--d);color:#fff;border-radius:6px}
  body[data-template="sac"] .qtybox{background:var(--d);border-radius:6px} body[data-template="sac"] .qtybox button,body[data-template="sac"] .qtybox .q{color:#fff}
  body[data-template="sac"] .cartbtn{background:var(--d);color:#fff;border-radius:6px} body[data-template="sac"] .cartbtn .cnt{background:var(--y);color:var(--d)}
  body[data-template="sac"] .abocard,body[data-template="sac"] .terrain-card{border:1px solid var(--b);border-radius:12px;box-shadow:none}
  body[data-template="sac"] .store,body[data-template="sac"] .btn,body[data-template="sac"] .payer{border-radius:6px}
  .sc-about{margin:0 auto;padding:40px 0 80px}
  .sc-about-in{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;background:var(--d);padding:48px;box-sizing:border-box}
  .sc-about-in .sc-k,.sc-about-in .sc-about-txt h2{color:#fff}
  .sc-about-in .sc-about-txt p{color:rgba(255,255,255,.7)}
  .sc-about-img{border-radius:14px;background-size:cover;background-position:center;aspect-ratio:4/3;background-color:var(--g)}
  .sc-about-txt h2{font-family:var(--fh);font-weight:700;font-size:clamp(26px,3.4vw,40px);color:var(--d);margin:6px 0 14px}
  .sc-about-txt p{color:var(--m);font-size:15px;line-height:1.7;margin-bottom:26px;max-width:440px}
  .sc-foot{background:var(--d);color:rgba(255,255,255,.72)}
  .sc-foot-grid{max-width:1240px;margin:0 auto;padding:60px 28px 40px;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:36px}
  .sc-foot-brand img{height:40px;margin-bottom:14px} .sc-foot-brand .sc-foot-logo{font-family:var(--fh);font-size:22px;color:#fff;margin-bottom:12px}
  .sc-foot-brand p{font-size:14px;max-width:290px;margin-bottom:16px}
  .sc-foot-col h4{color:#fff;font-size:15px;font-weight:600;margin-bottom:14px}
  .sc-foot-col a{display:block;font-size:14px;margin-bottom:9px;color:rgba(255,255,255,.72);text-decoration:none} .sc-foot-col a:hover{color:#fff}
  .sc-foot-col p{font-size:14px;margin-bottom:8px}
  .sc-foot-cta{color:var(--y);font-weight:600}
  .sc-copy{border-top:1px solid rgba(255,255,255,.12);padding:20px;text-align:center;font-size:13px;color:rgba(255,255,255,.6)}
  @media(max-width:860px){
    .sc-nav{gap:20px;overflow-x:auto;justify-content:flex-start}
    .sc-hero{min-height:clamp(380px,62vh,520px)} .sc-hero-in{flex-direction:column;align-items:flex-start;gap:24px;padding:48px 24px} .sc-hero-l{max-width:none} .sc-play{width:68px;height:68px;align-self:flex-end;margin-left:auto}
    .sc-feature-in{grid-template-columns:1fr;gap:18px} .sc-promo{min-height:220px}
    .sc-types-grid{grid-template-columns:1fr 1fr;gap:14px}
    .sc-about-in{grid-template-columns:1fr;gap:24px}
    .sc-foot-grid{grid-template-columns:1fr 1fr}
  }

  /* ───────────────── TEMPLATE TRESSE (crème + Amatic SC + corail) ───────────────── */
  body[data-template="tresse"]{--tr-bg:#FFFFFF;--tr-band:#F4ECE1;--tr-ink:#1D1E21;--tr-mut:#646464;--tr-coral:#FF7648;--tr-card:#F4ECE1;--tr-fh:'Amatic SC',cursive;--tr-fb:'Raleway',sans-serif;background:var(--tr-bg);color:var(--tr-ink);font-family:var(--tr-fb);}
  .tr-head{position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:18px;padding:16px clamp(18px,4vw,48px);background:var(--tr-band);border-bottom:1px solid rgba(29,30,33,.06)}
  .tr-brand{display:flex;align-items:center;text-decoration:none;color:var(--tr-ink)}
  .tr-brand img{height:34px;display:block} .tr-brand span{font-family:var(--tr-fh);font-size:30px;font-weight:700;letter-spacing:1px;line-height:1}
  .tr-nav{flex:1;display:flex;justify-content:center;gap:clamp(14px,2.4vw,34px);flex-wrap:wrap}
  .tr-nav a{color:var(--tr-ink);text-decoration:none;font-size:12.5px;font-weight:500;letter-spacing:.5px}
  .tr-nav a:hover,.tr-nav .tr-nav-active{color:var(--tr-coral)}
  .tr-phone{background:var(--tr-ink);color:#fff;text-decoration:none;font-size:13px;font-weight:600;letter-spacing:.5px;padding:9px 16px;border-radius:999px;white-space:nowrap}
  .tr-hero{position:relative;background:var(--tr-band);padding:clamp(40px,9vw,96px) 20px clamp(60px,10vw,110px);overflow:hidden;text-align:center}
  .tr-hero-in{position:relative;z-index:2;max-width:900px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
  .tr-hero-logo{height:clamp(72px,11vw,120px);width:auto;display:block;margin:0 auto 6px;object-fit:contain}
  .tr-hero-name{font-family:var(--tr-fh);font-weight:700;font-size:clamp(84px,24vw,230px);line-height:.78;letter-spacing:2px;color:var(--tr-ink);text-transform:uppercase}
  .tr-hero-tag{font-size:clamp(13px,1.6vw,17px);font-weight:500;letter-spacing:5px;text-transform:uppercase;color:var(--tr-ink);margin:18px 0 30px}
  .tr-cta{display:inline-block;background:var(--tr-coral);color:#fff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:.5px;padding:14px 34px;border-radius:999px;box-shadow:0 10px 24px rgba(224,120,92,.32);transition:transform .15s}
  .tr-cta:hover{transform:translateY(-2px)}
  .tr-deco{position:absolute;color:var(--tr-ink);opacity:.5;z-index:1}
  .tr-deco-1{top:14%;left:9%;transform:rotate(-12deg)} .tr-deco-2{top:40%;right:11%;transform:rotate(14deg)} .tr-deco-3{bottom:16%;left:14%;font-size:30px;opacity:.4}
  .tr-path{position:absolute;right:16%;bottom:8%;width:160px;height:90px;border-bottom:2px dashed rgba(43,40,34,.3);border-right:2px dashed rgba(43,40,34,.3);border-bottom-right-radius:80px;z-index:1}
  @media(max-width:680px){.tr-path,.tr-deco-2{display:none}}
  .tr-h2{font-family:var(--tr-fh);font-weight:700;font-size:clamp(44px,8vw,78px);line-height:.95;letter-spacing:2px;color:var(--tr-ink);text-transform:uppercase}
  .tr-about{max-width:1100px;margin:0 auto;padding:clamp(48px,8vw,90px) clamp(20px,4vw,40px);display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,5vw,64px);align-items:center}
  .tr-about-txt p{font-size:15px;line-height:1.75;color:var(--tr-mut);font-weight:400;margin-top:18px;max-width:440px}
  .tr-about-img img{width:100%;border-radius:14px;display:block;aspect-ratio:4/3;object-fit:cover;box-shadow:0 18px 40px rgba(43,40,34,.14)}
  .tr-hours{margin-top:22px}
  @media(max-width:720px){.tr-about{grid-template-columns:1fr}.tr-about-img{order:-1}}
  .tr-services{max-width:1120px;margin:0 auto;padding:clamp(10px,3vw,30px) clamp(16px,4vw,40px) clamp(50px,8vw,90px)}
  .tr-services-head{text-align:center;margin-bottom:30px;position:relative}
  .tr-services-head p{color:var(--tr-mut);font-size:14px;margin-top:10px}
  .tr-deco-sm{display:inline-block;color:var(--tr-coral);opacity:.8;margin-bottom:4px}
  body[data-template="tresse"] .sectitle{display:none}
  body[data-template="tresse"] .cathead{border:none;padding:0 4px 10px}
  body[data-template="tresse"] .cathead-title{font-family:var(--tr-fh);font-size:34px;letter-spacing:1px;color:var(--tr-ink)}
  body[data-template="tresse"] .prod{background:var(--tr-card);border:1px solid rgba(43,40,34,.08);border-radius:16px}
  body[data-template="tresse"] .pname{color:var(--tr-ink)} body[data-template="tresse"] .pprice{color:var(--tr-coral)}
  body[data-template="tresse"] .chip{border-radius:999px} body[data-template="tresse"] .chip.sel{background:var(--tr-coral);color:#fff;border-color:var(--tr-coral)}
  /* Page « Mes services » : 3 colonnes, image paysage, texte centré (réf Wix) */
  body[data-template="tresse"] .tr-services .grid{grid-template-columns:repeat(3,1fr);gap:26px}
  body[data-template="tresse"] .prod.svc:not(.tr-feat){background:transparent;border:none;box-shadow:none;border-radius:0;text-align:center;padding:0;overflow:visible}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pimgzone,body[data-template="tresse"] .prod.svc:not(.tr-feat) .svc-imgzone{aspect-ratio:4/3;border-radius:12px;overflow:hidden;margin-bottom:14px;background:#e9e3d8}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pimg{width:100%;height:100%;object-fit:cover}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pbody{padding:0}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pname{font-family:var(--tr-fh);font-size:30px;letter-spacing:1px;text-transform:uppercase;line-height:1;color:var(--tr-ink)}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pdesc{color:var(--tr-mut);font-size:13.5px;line-height:1.5;margin:8px auto 10px;max-width:260px}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .pprice{font-family:var(--tr-fh);font-size:28px;color:var(--tr-coral);margin:0 0 14px}
  body[data-template="tresse"] .svcbtn,body[data-template="tresse"] .bookbtn{background:var(--tr-coral);color:#fff;border-radius:6px}
  body[data-template="tresse"] .prod.svc:not(.tr-feat) .svcbtn{width:100%;max-width:220px;margin:0 auto;padding:12px 0}
  @media(max-width:860px){body[data-template="tresse"] .tr-services .grid{grid-template-columns:1fr 1fr}}
  @media(max-width:560px){body[data-template="tresse"] .tr-services .grid{grid-template-columns:1fr}}
  .tr-foot{background:var(--tr-band);text-align:center;padding:clamp(40px,7vw,70px) 20px 30px;margin-top:20px}
  .tr-foot-name{font-family:var(--tr-fh);font-size:clamp(40px,7vw,64px);letter-spacing:1px;color:var(--tr-ink)}
  .tr-foot-in p{color:var(--tr-mut);font-size:14px;margin-top:8px} .tr-foot-in a{color:var(--tr-coral);text-decoration:none}
  .tr-foot-in a.tr-cta{color:#fff}
  .tr-foot .soc-row{justify-content:center;margin-top:16px}
  .tr-cta-sm{margin-top:22px;padding:12px 28px}
  .tr-copy{margin-top:30px;font-size:12.5px;color:var(--tr-mut)}
  /* Galerie (conteneurs images) */
  .tr-gallery{max-width:1120px;margin:0 auto;padding:clamp(20px,4vw,50px) clamp(16px,4vw,40px)}
  .tr-gallery-head{text-align:center;margin-bottom:26px} .tr-gallery-head .tr-deco-sm{display:inline-block;color:var(--tr-coral);margin-bottom:2px}
  .tr-gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .tr-gtile{aspect-ratio:1/1;border-radius:14px;background-size:cover;background-position:center;background-color:var(--tr-card)}
  @media(max-width:720px){.tr-gallery-grid{grid-template-columns:1fr 1fr;gap:10px}}
  /* Contact + carte */
  .tr-contact{position:relative;max-width:1120px;margin:0 auto;padding:clamp(30px,6vw,70px) clamp(16px,4vw,40px)}
  .tr-contact-in{display:grid;grid-template-columns:1fr 1.2fr;gap:clamp(24px,5vw,56px);align-items:center}
  .tr-contact-txt p{color:var(--tr-mut);font-size:15px;margin-top:10px} .tr-contact-txt a{color:var(--tr-coral);text-decoration:none}
  .tr-contact-txt .soc-row{margin-top:16px}
  .tr-contact .tr-deco-c{position:absolute;top:8%;right:6%;color:var(--tr-ink);opacity:.4}
  .tr-contact-deco{position:relative;height:clamp(100px,14vw,140px);margin-bottom:6px}
  .tr-contact-path{width:100%;height:100%;color:var(--tr-ink);opacity:.42}
  .tr-bench-ic{position:absolute;right:5%;bottom:-4px;color:var(--tr-ink);opacity:.8}
  .tr-bench{width:clamp(120px,16vw,168px);height:auto}
  @media(max-width:680px){.tr-bench-ic{right:2%}}
  .tr-map-link{position:relative;display:block}
  .tr-map{width:100%;height:clamp(240px,34vw,360px);object-fit:cover;border:0;border-radius:16px;box-shadow:0 14px 34px rgba(29,30,33,.12);display:block}
  .tr-map-open{position:absolute;right:12px;bottom:12px;background:var(--tr-coral);color:#fff;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:999px;box-shadow:0 6px 16px rgba(255,118,72,.35)}
  .tr-map-pin{position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);filter:drop-shadow(0 4px 5px rgba(0,0,0,.3));pointer-events:none;line-height:0}
  .tr-map-empty{display:flex;align-items:center;justify-content:center;background:var(--tr-card);color:var(--tr-mut)}
  .tr-map-empty-in{text-align:center;padding:24px}
  .tr-loc-btn{display:inline-block;margin-top:14px;background:var(--tr-coral);color:#fff;border:0;border-radius:999px;font-size:14px;font-weight:600;padding:13px 26px;cursor:pointer;box-shadow:0 8px 20px rgba(255,118,72,.3)}
  body:not(.lassi-ed) .tr-loc-btn{display:none}
  .lassi-ed .tr-map-hint{display:none}
  @media(max-width:720px){.tr-contact-in{grid-template-columns:1fr}}
  /* Séparateur courbe pointillé + ciseau */
  .tr-sep{display:flex;align-items:center;justify-content:center;gap:10px;max-width:460px;margin:clamp(18px,4vw,40px) auto;color:var(--tr-ink);opacity:.55}
  .tr-sep-curve{width:min(320px,70vw);height:30px}
  .tr-sep-ic{flex:0 0 auto;color:var(--tr-coral);opacity:.9}
  /* Long séparateur traversant (À propos → Réserver) */
  .tr-sep-long{position:relative;display:flex;justify-content:center;height:clamp(170px,26vw,290px);margin:4px auto;color:var(--tr-ink);opacity:.5}
  .tr-sep-long-curve{height:100%;width:min(220px,46vw)}
  .tr-sep-long-ic{position:absolute;bottom:-6px;left:50%;transform:translateX(16px);color:var(--tr-coral);opacity:.95}
  /* Conteneur réservation mis en avant */
  .tr-reserve{max-width:1000px;margin:0 auto;padding:clamp(10px,3vw,20px) clamp(16px,4vw,40px) clamp(20px,4vw,40px)}
  .tr-reserve-head{text-align:center;margin-bottom:18px}
  .tr-feat{display:grid;grid-template-columns:1.1fr 1fr;gap:0;border-radius:18px;overflow:hidden;background:var(--tr-card);box-shadow:0 16px 40px rgba(29,30,33,.12)}
  .tr-feat-img{min-height:260px;background-size:cover;background-position:center;background-color:#ddd}
  .tr-feat-body{padding:clamp(22px,3vw,38px);display:flex;flex-direction:column;justify-content:center}
  .tr-feat-name{font-family:var(--tr-fh);font-size:clamp(30px,4vw,46px);line-height:.95;color:var(--tr-ink);letter-spacing:1px}
  .tr-feat-desc{color:var(--tr-mut);font-size:14px;line-height:1.6;margin:10px 0 14px}
  .tr-feat-meta{font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--tr-mut)}
  .tr-feat-price{font-family:var(--tr-fh);font-size:32px;color:var(--tr-coral);margin:6px 0 16px;line-height:1}
  .tr-feat-btn{align-self:flex-start;padding:12px 30px}
  .tr-reserve-cta{text-align:center;margin-top:26px}
  @media(max-width:680px){.tr-feat{grid-template-columns:1fr}.tr-feat-img{min-height:220px}}
  /* ═══ TEMPLATE FERME — ferme agricole (réf Ferme Arno : crème + serif Cormorant vert + orange) ═══ */
  body[data-template="ferme"]{--fm-bg:#FBF6F0;--fm-ink:#2E4537;--fm-mut:#5E7360;--fm-green:#2F5E3C;--fm-green-d:#244A30;--fm-orange:#EFA838;--fm-card:#FFFFFF;--fm-fh:'Cormorant Garamond',Georgia,serif;--fm-fb:'Cormorant Garamond',Georgia,serif;--fm-fs:'Helvetica Neue',system-ui,Arial,sans-serif;background:var(--fm-bg);color:var(--fm-ink);font-family:var(--fm-fb);font-size:17px}
  .fm-page[hidden]{display:none}
  .fm-hen{height:72px;width:auto;display:inline-block}
  .fm-head{position:sticky;top:0;z-index:40;display:flex;flex-direction:column;align-items:center;gap:10px;padding:10px clamp(18px,4vw,48px);background:rgba(251,246,240,.95);backdrop-filter:blur(8px);border-bottom:1px solid rgba(44,58,44,.08)}
  .fm-head-row{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%}
  .fm-logo{display:flex;align-items:center;gap:9px;text-decoration:none;color:var(--fm-ink)}
  .fm-logo img{height:26px;width:auto;display:block} .fm-logo span{font-family:var(--fm-fs);font-size:13px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;line-height:1}
  .fm-nav{display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:clamp(6px,2vw,20px);flex-wrap:nowrap;width:100%;order:-1;padding-bottom:6px;border-bottom:1px solid rgba(44,58,44,.07)}
  .fm-nav a{font-family:var(--fm-fs);color:var(--fm-ink);text-decoration:none;font-size:9px;font-weight:500;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap}
  .fm-nav a:hover,.fm-nav .fm-nav-active{color:var(--fm-green)}
  .fm-icons{display:flex;align-items:center;gap:14px} .fm-ic{color:var(--fm-ink);display:flex}
  /* HERO plein écran image + overlay, texte centré blanc */
  .fm-hero{position:relative;min-height:min(78vh,620px);display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center;background-color:#4a5a3e;text-align:center}
  .fm-hero-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,38,26,.28),rgba(30,38,26,.52))}
  .fm-hero-in{position:relative;z-index:2;padding:40px 20px;color:#fff;max-width:1000px}
  .fm-hero-year{display:block;font-family:var(--fm-fs);font-size:clamp(12px,1.5vw,15px);font-weight:500;letter-spacing:4px;text-transform:uppercase;margin-bottom:12px;opacity:.95}
  .fm-hero-title{font-family:var(--fm-fh);font-weight:600;font-size:clamp(46px,9vw,118px);line-height:.98;letter-spacing:2px;text-transform:uppercase;margin:0;text-shadow:0 2px 22px rgba(0,0,0,.28)}
  .fm-hero-tags{font-family:var(--fm-fs);font-weight:500;font-size:clamp(12px,1.7vw,17px);letter-spacing:3px;text-transform:uppercase;margin-top:20px}
  /* BANDE 3 colonnes : histoire | produits frais (orange) | visite */
  .fm-band{display:grid;grid-template-columns:1fr 1fr 1fr;min-height:clamp(320px,38vw,460px)}
  .fm-band-img{position:relative;background-size:cover;background-position:center;background-color:#e7e0d4;text-decoration:none;display:flex;align-items:center;justify-content:center}
  .fm-band-card{background:#fff;padding:22px 30px;text-align:center;box-shadow:0 12px 30px rgba(44,58,44,.14)}
  .fm-band-card b{display:block;font-family:var(--fm-fh);font-size:clamp(24px,2.6vw,34px);font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--fm-ink)}
  .fm-band-card small{display:block;font-size:17px;color:var(--fm-green);margin-top:2px;font-style:italic}
  .fm-band-mid{background:var(--fm-orange);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:clamp(30px,4vw,50px)}
  .fm-seal{display:inline-block;font-family:var(--fm-fs);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--fm-ink);border:1.5px solid var(--fm-ink);border-radius:999px;padding:7px 16px;opacity:.75}
  .fm-band-mid h3{font-family:var(--fm-fh);font-weight:600;font-size:clamp(38px,5vw,62px);line-height:.98;text-transform:uppercase;letter-spacing:1px;color:var(--fm-ink);margin:14px 0 0}
  .fm-band-mid p{font-size:clamp(16px,1.7vw,19px);line-height:1.5;color:#3a3326;margin:10px 0 18px;max-width:320px}
  @media(max-width:820px){.fm-band{grid-template-columns:1fr}.fm-band-img{min-height:300px}}
  .fm-btn{display:inline-block;background:var(--fm-green);color:#fff;text-decoration:none;font-family:var(--fm-fs);font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:13px 32px;transition:background .15s}
  .fm-btn:hover{background:var(--fm-green-d)}
  /* BOUTIQUE */
  .fm-sec-head{text-align:center;max-width:640px;margin:0 auto clamp(26px,4vw,40px)}
  .fm-k{display:inline-block;font-family:var(--fm-fs);font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--fm-green)}
  .fm-sec-head h2{font-family:var(--fm-fh);font-weight:600;font-size:clamp(32px,5vw,56px);line-height:1.02;text-transform:uppercase;letter-spacing:1.5px;margin:6px 0 0;color:var(--fm-ink)}
  .fm-sec-head p{color:var(--fm-mut);font-size:18px;margin-top:8px}
  .fm-shop{max-width:1200px;margin:0 auto;padding:clamp(44px,6vw,86px) clamp(16px,4vw,40px)}
  body[data-template="ferme"] .sectitle{text-align:center;font-family:var(--fm-fh);font-weight:600;text-transform:uppercase;letter-spacing:1.5px}
  body[data-template="ferme"] .catnav{justify-content:center}
  body[data-template="ferme"] .cathead{justify-content:center}
  body[data-template="ferme"] .cathead-title{font-family:var(--fm-fh);font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--fm-ink)}
  body[data-template="ferme"] .chip{font-family:var(--fm-fs);text-transform:uppercase;letter-spacing:.5px;font-size:12px;font-weight:600}
  body[data-template="ferme"] .grid{gap:22px}
  body[data-template="ferme"] .prod{background:var(--fm-card);border:1px solid rgba(44,58,44,.1);border-radius:4px;overflow:hidden;box-shadow:0 10px 28px rgba(44,58,44,.07)}
  body[data-template="ferme"] .prod.in{border-color:var(--fm-green);box-shadow:0 14px 32px rgba(53,102,62,.2)}
  body[data-template="ferme"] .pname{color:var(--fm-ink);font-family:var(--fm-fh);font-weight:600;text-transform:uppercase;letter-spacing:.5px;font-size:21px}
  body[data-template="ferme"] .pdesc{font-size:16px;line-height:1.5}
  body[data-template="ferme"] .pprice{color:var(--fm-green);font-family:var(--fm-fh);font-weight:700;font-size:23px}
  body[data-template="ferme"] .add{background:var(--fm-green);color:#fff;border-color:transparent;border-radius:3px;font-family:var(--fm-fs);text-transform:uppercase;letter-spacing:1px;font-weight:600}
  body[data-template="ferme"] .chip.sel{background:var(--fm-green);color:#fff;border-color:var(--fm-green)}
  /* TÉMOIGNAGES */
  .fm-testi{text-align:center;max-width:760px;margin:0 auto;padding:clamp(30px,5vw,60px) clamp(20px,4vw,40px) clamp(40px,6vw,80px)}
  .fm-testi-ic{display:inline-block} .fm-testi-ic .fm-hen{height:84px}
  .fm-testi h2{font-family:var(--fm-fh);font-weight:600;font-size:clamp(30px,4.6vw,52px);text-transform:uppercase;letter-spacing:1.5px;color:var(--fm-ink);margin:8px 0 22px}
  .fm-quote{font-size:clamp(18px,2.1vw,24px);line-height:1.6;font-style:italic;color:var(--fm-green);max-width:620px;margin:0 auto}
  .fm-testi-who{font-family:var(--fm-fs);font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--fm-ink);margin-top:20px}
  /* INSTAGRAM */
  .fm-insta{max-width:1180px;margin:0 auto;padding:clamp(20px,3vw,40px) clamp(16px,4vw,40px) clamp(40px,6vw,72px);text-align:center}
  .fm-insta h2{font-family:var(--fm-fh);font-weight:600;font-size:clamp(26px,3.6vw,44px);text-transform:uppercase;letter-spacing:1.5px;color:var(--fm-ink)}
  .fm-insta-tag{color:var(--fm-green);font-family:var(--fm-fs);font-size:14px;letter-spacing:1px;margin:6px 0 24px}
  .fm-insta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .fm-insta-tile{aspect-ratio:1/1;background-size:cover;background-position:center;background-color:#e7e0d4;border-radius:3px}
  @media(max-width:720px){.fm-insta-grid{grid-template-columns:1fr 1fr}}
  /* FOOTER */
  .fm-foot{background:var(--fm-bg);border-top:1px solid rgba(44,58,44,.1);padding:clamp(40px,5vw,64px) clamp(20px,4vw,48px) 30px}
  .fm-foot-in{max-width:1140px;margin:0 auto;display:grid;grid-template-columns:auto 1fr 1fr auto;gap:clamp(24px,4vw,56px);align-items:start}
  .fm-foot-logo img{height:80px;width:auto} .fm-foot-logo .fm-hen{height:96px}
  .fm-foot-col h4{font-family:var(--fm-fs);font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--fm-ink);margin:0 0 12px}
  .fm-foot-col p{font-size:16px;color:var(--fm-mut);margin:0 0 6px} .fm-foot-col a{color:var(--fm-mut);text-decoration:none} .fm-foot-col a:hover{color:var(--fm-green)}
  .fm-foot-soc{text-align:right} .fm-foot-soc .soc-row{justify-content:flex-end;margin-bottom:12px} .fm-foot-soc p{font-family:var(--fm-fs);font-size:12px;color:var(--fm-mut);margin:0 0 4px}
  @media(max-width:820px){.fm-foot-in{grid-template-columns:1fr 1fr}.fm-foot-logo{grid-column:1/-1}.fm-foot-soc{text-align:left}.fm-foot-soc .soc-row{justify-content:flex-start}}
  /* PAGE À PROPOS */
  .fm-ab-hero{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;min-height:clamp(340px,42vw,520px)}
  .fm-ab-hero-txt{background:var(--fm-orange);display:flex;flex-direction:column;justify-content:center;padding:clamp(32px,5vw,70px)}
  .fm-ab-hero-txt h2{font-family:var(--fm-fh);font-weight:600;font-size:clamp(30px,4vw,50px);line-height:1.05;text-transform:uppercase;letter-spacing:1px;color:var(--fm-ink);margin:10px 0 0}
  .fm-ab-hero-txt p{font-size:clamp(16px,1.7vw,19px);line-height:1.6;color:#3a3326;margin-top:16px;max-width:460px}
  .fm-ab-hero-img{background-size:cover;background-position:center;background-color:#d8cdbb}
  @media(max-width:780px){.fm-ab-hero{grid-template-columns:1fr}.fm-ab-hero-img{min-height:280px}}
  .fm-ab-intro{text-align:center;max-width:860px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(20px,4vw,40px)}
  .fm-ab-intro h2{font-family:var(--fm-fh);font-weight:600;font-size:clamp(28px,4vw,46px);text-transform:uppercase;letter-spacing:1.5px;color:var(--fm-ink);margin:8px 0 24px}
  .fm-ab-cols{display:grid;grid-template-columns:1fr 1fr;gap:clamp(22px,4vw,48px);text-align:left}
  .fm-ab-cols p{font-size:17px;line-height:1.7;color:var(--fm-mut)}
  @media(max-width:680px){.fm-ab-cols{grid-template-columns:1fr;gap:16px}}
  .fm-btn-outline{display:inline-block;margin-top:30px;font-family:var(--fm-fs);font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--fm-ink);text-decoration:none;border:1.5px solid var(--fm-ink);padding:12px 30px;transition:all .15s}
  .fm-btn-outline:hover{background:var(--fm-green);border-color:var(--fm-green);color:#fff}
  .fm-ab-split{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;min-height:clamp(300px,36vw,440px)}
  .fm-ab-split-img{background-size:cover;background-position:center;background-color:#d8cdbb}
  .fm-ab-split-txt{background:var(--fm-orange);display:flex;flex-direction:column;justify-content:center;padding:clamp(30px,5vw,64px)}
  .fm-ab-split-txt h3{font-family:var(--fm-fh);font-weight:600;font-size:clamp(26px,3.4vw,42px);line-height:1.08;text-transform:uppercase;letter-spacing:1px;color:var(--fm-ink);margin:0}
  .fm-ab-split-txt p{font-size:clamp(16px,1.6vw,18px);line-height:1.6;color:#3a3326;margin-top:14px;max-width:440px}
  @media(max-width:780px){.fm-ab-split{grid-template-columns:1fr}.fm-ab-split-img{min-height:260px;order:-1}.fm-ab-split.reverse .fm-ab-split-img{order:-1}}
  /* ═══ TEMPLATE GRILL — steakhouse (réf Au Grill : charbon + or + Anton/Cinzel) ═══ */
  body[data-template="grill"]{--gr-bg:#212023;--gr-bg2:#2A292C;--gr-gold:#AE9A64;--gr-gold-d:#746743;--gr-ink:#191819;--gr-txt:#E4DBC4;--gr-mut:#B0B0B0;--gr-fh:'Anton',Impact,sans-serif;--gr-fe:'Montserrat',Arial,sans-serif;--gr-fb:georgia,palatino,'book antiqua','palatino linotype',serif;--gr-fs:'Montserrat',system-ui,Arial,sans-serif;background:var(--gr-bg);color:var(--gr-txt);font-family:var(--gr-fb);font-size:16px}
  .gr-page[hidden]{display:none}
  .gr-head{position:sticky;top:0;z-index:40}
  .gr-topbar{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;background:var(--gr-gold);color:var(--gr-ink);font-family:var(--gr-fs);font-size:11.5px;letter-spacing:1px;text-transform:uppercase;padding:7px 20px;font-weight:600}
  .gr-navbar{display:flex;align-items:center;gap:20px;background:var(--gr-gold);color:var(--gr-ink);padding:6px clamp(16px,4vw,48px) 12px;border-top:1px solid rgba(30,29,27,.14)}
  .gr-brand{text-decoration:none;color:var(--gr-ink)} .gr-brand img{height:40px} .gr-brand span{font-family:var(--gr-fh);font-size:24px;letter-spacing:1px;text-transform:uppercase}
  .gr-nav{flex:1;display:flex;justify-content:center;gap:clamp(14px,2.6vw,36px);flex-wrap:wrap}
  .gr-nav a{font-family:var(--gr-fs);color:var(--gr-ink);text-decoration:none;font-size:10.5px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase}
  .gr-nav a:hover,.gr-nav .gr-nav-active{color:#fff}
  .gr-ic{color:var(--gr-ink);display:flex}
  /* DÉFILEMENT OVERLAP — empilement de slides : chaque section se fige (sticky top:0)
     et la suivante glisse par-dessus en la recouvrant jusqu'en haut (réf Au Grill). */
  .gr-stack{position:relative}
  .gr-slide{position:sticky;top:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 -30px 70px rgba(0,0,0,.5)}
  .gr-slide:first-child{box-shadow:none}
  /* HERO (slide 1) */
  .gr-hero{background-size:cover;background-position:center;background-color:#1b1a18;text-align:center}
  .gr-hero-ov{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(20,19,17,.35),rgba(20,19,17,.72))}
  .gr-hero-in{position:relative;z-index:2;padding:40px 20px}
  @media(max-width:760px){.gr-slide{min-height:92vh}}
  /* Titres sections = Lulo Clean (→ Montserrat 700, capitales larges) */
  body[data-template="grill"] .gr-light,body[data-template="grill"] .gr-col h3,body[data-template="grill"] .gr-brand span,body[data-template="grill"] .pname{font-weight:700}
  /* Hero « AU GRILL » = Anton 200px (font_3 Wix) */
  .gr-hero-title{font-family:var(--gr-fh);font-size:clamp(66px,16vw,200px);line-height:1;letter-spacing:1px;text-transform:uppercase;color:#fff;margin:0;text-shadow:0 6px 30px rgba(0,0,0,.5)}
  .gr-hero-sub{font-family:var(--gr-fs);font-size:clamp(15px,2.6vw,30px);font-weight:500;letter-spacing:4px;text-transform:uppercase;color:#fff;margin:16px 0 30px}
  .gr-btn{display:inline-block;background:var(--gr-gold);color:var(--gr-ink);text-decoration:none;font-family:var(--gr-fs);font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:14px 40px;border:1px solid var(--gr-gold);transition:all .18s}
  .gr-btn:hover{background:transparent;color:var(--gr-gold)}
  /* Titres */
  .gr-h2{text-align:center;line-height:1.04;margin:0}
  .gr-gold{font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);font-size:clamp(26px,4vw,40px);letter-spacing:2px;text-transform:uppercase}
  .gr-light{font-family:var(--gr-fe);font-weight:700;color:#fff;font-size:clamp(26px,4vw,40px);letter-spacing:2px;text-transform:uppercase}
  .gr-sm{font-size:clamp(22px,3vw,34px);letter-spacing:2px}
  /* LE RESTAURANT — 3 colonnes sur photo cuisine assombrie (réf Au Grill) */
  .gr-about{background:var(--gr-bg);background-size:cover;background-position:center;padding:clamp(60px,8vw,110px) clamp(20px,4vw,48px)}
  .gr-about-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(22,21,19,.86),rgba(22,21,19,.93))}
  .gr-about-in{position:relative;z-index:2;width:100%}
  .gr-cols{max-width:1080px;margin:clamp(34px,5vw,64px) auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(24px,4vw,56px);text-align:center}
  .gr-num{display:block;font-family:var(--gr-fe);font-size:28px;font-weight:600;color:var(--gr-gold);margin-bottom:16px;letter-spacing:1px}
  .gr-col h3{font-family:var(--gr-fe);font-weight:700;font-size:clamp(17px,2vw,25px);line-height:1.2;letter-spacing:1px;text-transform:uppercase;color:var(--gr-gold);margin:0 0 14px}
  .gr-col p{font-size:15px;line-height:1.65;color:var(--gr-mut)}
  @media(max-width:760px){.gr-cols{grid-template-columns:1fr;gap:38px}}
  /* Couverts gravés + RÉSERVER UNE TABLE (slide plein écran sur or) */
  .gr-cutlery{background:var(--gr-gold);text-align:center;padding:clamp(24px,4vw,48px) clamp(20px,4vw,40px);overflow:visible}
  .gr-cutlery-in{line-height:0;width:100%;text-align:center}
  .gr-cutlery-in img{max-height:34vh;width:auto;max-width:72%;object-fit:contain;display:inline-block}
  .gr-resa-title{margin-top:10px!important;color:var(--gr-ink)!important}
  .gr-resa-sub{max-width:560px;margin:14px auto 22px;color:#3a3420;font-size:clamp(15px,1.7vw,18px);line-height:1.55}
  .gr-btn-dark{background:var(--gr-ink);color:var(--gr-gold);border-color:var(--gr-ink)}
  .gr-btn-dark:hover{background:transparent;color:var(--gr-ink)}
  /* Modale réservation */
  .gr-resa-ov{position:fixed;inset:0;z-index:120;background:rgba(10,9,8,.72);display:flex;align-items:center;justify-content:center;padding:18px}
  .gr-resa-ov[hidden]{display:none}
  .gr-resa-modal{position:relative;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;background:var(--gr-bg2);border:1px solid rgba(174,154,100,.35);border-radius:4px;padding:26px clamp(18px,4vw,30px);color:var(--gr-txt)}
  .gr-resa-x{position:absolute;top:10px;right:14px;background:none;border:0;color:var(--gr-mut);font-size:26px;line-height:1;cursor:pointer}
  .gr-resa-h{font-family:var(--gr-fe);font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--gr-gold);font-size:20px;text-align:center;margin:0 0 6px}
  .gr-resa-note{text-align:center;color:var(--gr-mut);font-size:13px;line-height:1.5;margin:0 0 16px}
  .gr-resa-lb{display:block;font-family:var(--gr-fs);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gr-gold);margin:14px 0 6px}
  .gr-resa-in{width:100%;background:#1b1a18;border:1px solid rgba(174,154,100,.3);color:#fff;font-family:var(--gr-fb);font-size:16px;padding:11px 13px;border-radius:3px}
  .gr-resa-slots{display:flex;flex-wrap:wrap;gap:8px;min-height:22px}
  .gr-resa-hint{color:var(--gr-mut);font-size:13px}
  .gr-resa-slot{background:transparent;border:1px solid rgba(174,154,100,.4);color:var(--gr-txt);font-family:var(--gr-fs);font-size:13px;font-weight:600;padding:8px 13px;border-radius:3px;cursor:pointer}
  .gr-resa-slot.on{background:var(--gr-gold);color:var(--gr-ink);border-color:var(--gr-gold)}
  .gr-resa-pays{display:flex;gap:10px}
  .gr-resa-pay{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;background:#1b1a18;border:1px solid rgba(174,154,100,.3);color:var(--gr-txt);font-family:var(--gr-fs);font-size:13px;font-weight:600;padding:10px;border-radius:3px;cursor:pointer}
  .gr-resa-pay img{height:18px;width:auto}
  .gr-resa-pay.on{border-color:var(--gr-gold);background:#242220}
  .gr-resa-msg{color:#e6a07a;font-size:13px;text-align:center;min-height:16px;margin:10px 0 0}
  .gr-resa-submit{width:100%;margin-top:16px;animation:none!important}
  .gr-resa-spin{width:34px;height:34px;margin:18px auto;border:3px solid rgba(174,154,100,.25);border-top-color:var(--gr-gold);border-radius:50%;animation:grspin 1s linear infinite}
  @keyframes grspin{to{transform:rotate(360deg)}}
  /* Barre réservation inline (réf Au Grill : personnes / date / heure / bouton) */
  .gr-resa-bar{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:12px;max-width:900px;margin:8px auto 0}
  .gr-resa-field{position:relative;display:flex;flex-direction:column;text-align:left;min-width:150px}
  .gr-resa-field>label{font-family:var(--gr-fs);font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--gr-ink);margin:0 0 6px 2px;opacity:.85}
  .gr-resa-pick{appearance:none;-webkit-appearance:none;background:#fff;border:1px solid rgba(25,24,25,.25);color:var(--gr-ink);font-family:var(--gr-fb);font-size:15px;padding:11px 14px;border-radius:2px;min-width:150px;cursor:pointer;text-align:left}
  .gr-resa-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .gr-resa-trigger:disabled{opacity:.5;cursor:not-allowed}
  .gr-resa-ic{color:var(--gr-gold-d);font-size:12px}
  .gr-resa-find{align-self:flex-end;height:44px;animation:none!important}
  .gr-resa-barmsg{text-align:center;color:#5a2b1b;font-weight:600}
  /* Popovers (calendrier / heures) */
  .gr-resa-pop{position:absolute;top:calc(100% + 6px);left:0;z-index:30;background:#fff;border:1px solid rgba(25,24,25,.2);border-radius:4px;box-shadow:0 18px 40px rgba(0,0,0,.28);padding:12px;min-width:260px}
  .gr-resa-pop[hidden]{display:none}
  .gr-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-family:var(--gr-fe);font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:13px;color:var(--gr-ink)}
  .gr-cal-nav{background:none;border:0;font-size:20px;line-height:1;color:var(--gr-ink);cursor:pointer;padding:0 6px}
  .gr-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
  .gr-cal-dow{font-family:var(--gr-fs);font-size:10px;font-weight:700;text-transform:uppercase;color:#999;text-align:center;padding:4px 0}
  .gr-cal-d{border:0;border-radius:3px;padding:8px 0;font-size:13px;font-family:var(--gr-fb);cursor:pointer}
  .gr-cal-d.on-ok{background:#e4f3e6;color:#1f6b2a;font-weight:700}
  .gr-cal-d.on-ok:hover{background:#2e7d32;color:#fff}
  .gr-cal-d.on-no{background:#f6e4e4;color:#c06a6a;cursor:not-allowed}
  /* Liste des heures */
  .gr-resa-hours{display:flex;flex-wrap:wrap;gap:7px;max-width:300px}
  .gr-hour{background:transparent;border:1px solid rgba(255,255,255,.55);border-radius:1px;padding:14px 8px;font-size:14px;font-family:var(--gr-fb);color:#fff;cursor:pointer;text-align:center}
  .gr-hour.on-ok:hover{background:rgba(255,255,255,.08)}
  .gr-hour.on-no{cursor:not-allowed;color:rgba(255,255,255,.55);background-image:linear-gradient(to top right,transparent calc(50% - 0.5px),rgba(255,255,255,.55) 50%,transparent calc(50% + 0.5px))}
  .gr-hour.sel{background:rgba(255,255,255,.12);border-color:#fff;color:#fff}
  .gr-resa-recap{text-align:center;background:#1b1a18;border:1px solid rgba(174,154,100,.3);border-radius:3px;padding:10px;color:var(--gr-txt);font-size:15px;margin-bottom:12px}
  .gr-resa-recap b{color:var(--gr-gold)}
  /* Page réservation dédiée (réf « EFFECTUER UNE RÉSERVATION ») */
  .gr-resa-sec{max-width:900px;margin:0 auto;padding:clamp(60px,8vw,110px) clamp(20px,4vw,40px);text-align:center}
  .gr-resa-sub2{color:var(--gr-mut);font-size:clamp(15px,1.7vw,18px);max-width:560px;margin:14px auto 26px;line-height:1.55}
  .gr-page-resa .gr-resa-bar{justify-content:center}
  .gr-page-resa .gr-resa-field>label{color:var(--gr-gold)}
  .gr-page-resa .gr-resa-pick{background:#1b1a18;border-color:rgba(174,154,100,.3);color:#fff}
  .gr-resa-gridwrap{max-width:760px;margin:26px auto 0;text-align:left}
  .gr-resa-gridlabel{font-family:var(--gr-fs);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gr-gold);margin:0 0 12px}
  .gr-hours-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px}
  .gr-resa-heuredisp{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#fff;font-family:var(--gr-fb);min-height:50px}
  .gr-page-resa .gr-resa-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,2.5vw,28px);max-width:1000px;margin:30px auto 0;align-items:end}
  .gr-page-resa .gr-resa-field{min-width:0}
  .gr-page-resa .gr-resa-field>label{font-family:var(--gr-fb);font-size:15px;font-weight:400;letter-spacing:0;text-transform:none;color:#fff;opacity:1;margin:0 0 8px 2px}
  .gr-page-resa .gr-resa-pick{width:100%;min-width:0;background:transparent;border:1px solid rgba(255,255,255,.55);color:#fff;font-family:var(--gr-fb);font-size:16px;padding:14px 16px}
  .gr-page-resa .gr-resa-ic{color:rgba(255,255,255,.7)}
  .gr-resa-hr{max-width:1000px;margin:28px auto 0;border-top:1px solid rgba(174,154,100,.4)}
  .gr-resa-gridwrap{max-width:1000px;margin:26px auto 0;text-align:left}
  .gr-resa-gridlabel{font-family:var(--gr-fb);font-size:16px;letter-spacing:0;text-transform:none;color:#fff;margin:0 0 14px}
  .gr-hours-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
  @media(max-width:720px){.gr-hours-grid{grid-template-columns:repeat(3,1fr)}}
  .gr-page-resa .gr-resa-find{background:var(--gr-gold);color:var(--gr-ink);border-color:var(--gr-gold);margin-top:28px}
  .gr-page-resa .gr-resa-find:hover{background:transparent;color:var(--gr-gold)}
  /* Barre légale globale (toutes pages, réf footer Au Grill) */
  .gr-legal{background:var(--gr-ink);text-align:center;padding:22px 20px;border-top:1px solid rgba(174,154,100,.12)}
  .gr-legal-links{display:flex;justify-content:center;gap:clamp(14px,3vw,30px);flex-wrap:wrap;margin-bottom:10px}
  .gr-legal-links a{font-family:var(--gr-fs);font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--gr-gold);text-decoration:none}
  .gr-legal-links a:hover{color:#fff}
  .gr-legal-copy{font-family:var(--gr-fs);font-size:11px;letter-spacing:.5px;color:var(--gr-mut)}
  @media(max-width:720px){.gr-resa-bar{flex-direction:column;align-items:stretch}.gr-resa-field,.gr-resa-pick{min-width:0;width:100%}.gr-resa-pop{min-width:240px}}
  /* Bœuf gravé (slide sombre bifsteck) */
  .gr-beef{line-height:0;width:min(900px,100%)} .gr-beef img{width:100%;max-height:300px;object-fit:cover;object-position:center;display:block}
  .gr-ill-wrap{display:flex;justify-content:center;color:var(--gr-ink);padding:clamp(20px,4vw,40px) 20px}
  .gr-ill{height:clamp(110px,14vw,170px);width:auto;opacity:.9}
  .gr-ill-img{width:min(420px,78%);height:auto;display:block;margin:0 auto}
  /* BIFSTECK — gravure boeuf plein cadre en fond + titre or par-dessus */
  .gr-feature{position:relative;background-color:#2b2b2b;background-size:cover;background-position:center;text-align:center;padding:clamp(40px,6vw,80px) clamp(20px,4vw,48px)}
  .gr-feature-ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(28,27,25,.32),rgba(28,27,25,.72))}
  .gr-feature-in{position:relative;z-index:2;max-width:760px}
  .gr-lead{max-width:640px;margin:22px auto 0;font-size:clamp(17px,1.9vw,21px);line-height:1.7;color:var(--gr-mut)}
  /* PRENEZ UN VERRE (fond or) */
  .gr-drink{background:var(--gr-gold);padding:clamp(50px,7vw,90px) clamp(20px,4vw,48px);text-align:center}
  .gr-drink .gr-ill-wrap{color:var(--gr-ink)}
  .gr-lead.gr-dark{color:#3a3324}
  /* MENU (catalogue réel) */
  .gr-shop{background:var(--gr-bg);padding:clamp(50px,7vw,90px) clamp(16px,4vw,40px)}
  .gr-sub-ctr{text-align:center;color:var(--gr-mut);font-size:17px;margin:12px 0 clamp(24px,4vw,40px)}
  /* MENU resto en liste (réf « MENU DÎNER ») — garde les .prod pour le panier */
  body[data-template="grill"] .gr-shop{max-width:860px;margin:0 auto}
  body[data-template="grill"] .gr-crumb{font-family:var(--gr-fs);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gr-mut);text-align:center;margin-bottom:10px}
  body[data-template="grill"] .sectitle{text-align:left;font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);text-transform:uppercase;letter-spacing:2px}
  body[data-template="grill"] .catnav{display:none}
  body[data-template="grill"] .cathead{justify-content:flex-start;border-bottom:1px solid rgba(174,154,100,.3);padding-bottom:10px;margin:clamp(28px,4vw,48px) 0 4px}
  body[data-template="grill"] .cathead-title{font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);text-transform:uppercase;letter-spacing:2px;font-size:clamp(18px,2.4vw,26px)}
  body[data-template="grill"] .cathead-count{display:none}
  body[data-template="grill"] .grid,body[data-template="grill"] .catsec .grid{display:block;gap:0}
  body[data-template="grill"] .prod{background:transparent;border:0;border-bottom:1px solid rgba(174,154,100,.14);border-radius:0;overflow:visible;padding:16px 2px}
  body[data-template="grill"] .prod.in{border-bottom-color:var(--gr-gold)}
  body[data-template="grill"] .pimgzone{display:none}
  body[data-template="grill"] .pbody{display:grid;grid-template-columns:1fr auto;grid-template-areas:"name price" "desc add";column-gap:18px;row-gap:4px;align-items:baseline}
  body[data-template="grill"] .pname{grid-area:name;font-family:var(--gr-fe);color:var(--gr-txt);text-transform:uppercase;letter-spacing:.5px;font-size:16px;font-weight:700}
  body[data-template="grill"] .pdesc{grid-area:desc;color:var(--gr-mut);font-size:14px;line-height:1.5;font-family:var(--gr-fb)}
  body[data-template="grill"] .pprice{grid-area:price;font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);font-size:17px;text-align:right;white-space:nowrap}
  body[data-template="grill"] .pstock{grid-area:desc;color:var(--gr-mut);font-size:12px}
  body[data-template="grill"] .stepper{grid-area:add;justify-self:end;margin-top:2px}
  body[data-template="grill"] .add{background:transparent;color:var(--gr-gold);border:1px solid var(--gr-gold);border-radius:2px;font-family:var(--gr-fs);text-transform:uppercase;letter-spacing:1px;font-weight:700;font-size:11px;padding:7px 15px}
  body[data-template="grill"] .add:hover{background:var(--gr-gold);color:var(--gr-ink)}
  /* GALERIE plein cadre */
  .gr-gallery{background:var(--gr-bg);padding:clamp(40px,6vw,72px) 0 0}
  .gr-gallery .gr-h2{margin-bottom:clamp(24px,4vw,40px)}
  .gr-gal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
  .gr-gtile{aspect-ratio:1/1;background-size:cover;background-position:center;background-color:#1b1a18}
  @media(max-width:760px){.gr-gal-grid{grid-template-columns:1fr 1fr}}
  /* Bande viande plein écran */
  .gr-band{height:clamp(240px,34vw,420px);background-size:cover;background-position:center;background-color:#1b1a18}
  /* LISTE DE DIFFUSION */
  .gr-news{background:var(--gr-bg);text-align:center;padding:clamp(46px,6vw,80px) clamp(20px,4vw,40px)}
  .gr-news-p{color:var(--gr-mut);font-size:17px;margin:12px 0 26px}
  .gr-news-form{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;max-width:560px;margin:0 auto}
  .gr-input{flex:1;min-width:220px;background:transparent;border:1px solid rgba(201,162,75,.4);color:var(--gr-txt);font-family:var(--gr-fb);font-size:17px;padding:12px 16px;border-radius:2px}
  .gr-input::placeholder{color:var(--gr-mut)}
  /* CONTACT */
  .gr-foot{background:var(--gr-ink);text-align:center;padding:clamp(50px,7vw,90px) clamp(20px,4vw,40px) 36px}
  .gr-foot-sub{color:var(--gr-mut);font-size:17px;margin:12px 0 clamp(26px,4vw,40px)}
  .gr-foot-info{display:flex;justify-content:center;gap:clamp(28px,5vw,64px);flex-wrap:wrap;margin-bottom:30px}
  .gr-foot-info b{display:block;font-family:var(--gr-fs);font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gr-gold);margin-bottom:6px}
  .gr-foot-info span{color:var(--gr-txt);font-size:17px}
  .gr-foot-hours{color:var(--gr-txt)}
  .gr-foot .soc-row{justify-content:center;margin:26px 0 0}
  .gr-copy{margin-top:26px;padding-top:22px;border-top:1px solid rgba(201,162,75,.15);font-family:var(--gr-fs);font-size:12px;letter-spacing:.5px;color:var(--gr-mut)}

  /* ===== TEMPLATE BAR / RESTAURANT-LOUNGE (BRAISE) ===== */
  /* Redéfinit les variables --gr-* → tous les composants réutilisés (réservation, */
  /* catalogue, boutons, modale) héritent du look BRAISE automatiquement.           */
  body[data-template="bar"]{--gr-bg:#0D0C11;--gr-bg2:#141218;--gr-gold:#D68B1A;--gr-gold-d:#9c6413;--gr-ink:#0D0C11;--gr-txt:#E8E2DA;--gr-mut:#8A8580;--gr-fh:'Syne',system-ui,sans-serif;--gr-fe:'Syne',system-ui,sans-serif;--gr-fb:'Jost',system-ui,sans-serif;--gr-fs:'Syne',system-ui,sans-serif;background:var(--gr-bg);color:var(--gr-txt);font-family:var(--gr-fb);font-size:16px}
  /* Catalogue (miroir des règles grill préfixées) */
  body[data-template="bar"] .gr-shop{max-width:860px;margin:0 auto}
  body[data-template="bar"] .gr-crumb{font-family:var(--gr-fs);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gr-mut);text-align:center;margin-bottom:10px}
  body[data-template="bar"] .catnav{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:30px}
  body[data-template="bar"] .chip{font-family:var(--gr-fs);text-transform:uppercase;letter-spacing:.5px;font-size:12px;font-weight:600;background:transparent;color:var(--gr-txt);border:1px solid rgba(214,139,26,.4);border-radius:40px;padding:9px 18px}
  body[data-template="bar"] .chip.sel{background:var(--gr-gold);color:var(--gr-ink);border-color:var(--gr-gold)}
  body[data-template="bar"] .cathead{justify-content:flex-start;border-bottom:1px solid rgba(214,139,26,.3);padding-bottom:10px;margin:36px 0 4px}
  body[data-template="bar"] .cathead-title{font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);text-transform:uppercase;letter-spacing:1px;font-size:22px}
  body[data-template="bar"] .cathead-count{display:none}
  body[data-template="bar"] .grid,body[data-template="bar"] .catsec .grid{display:block;gap:0}
  body[data-template="bar"] .prod{background:transparent;border:0;border-bottom:1px solid rgba(214,139,26,.14);border-radius:0;overflow:visible;padding:16px 2px}
  body[data-template="bar"] .prod.in{border-bottom-color:var(--gr-gold)}
  body[data-template="bar"] .pimgzone{display:none}
  body[data-template="bar"] .pbody{display:grid;grid-template-columns:1fr auto;grid-template-areas:"name price" "desc add";column-gap:18px;row-gap:4px;align-items:baseline}
  body[data-template="bar"] .pname{grid-area:name;font-family:var(--gr-fe);color:var(--gr-txt);font-weight:600;font-size:17px}
  body[data-template="bar"] .pdesc{grid-area:desc;color:var(--gr-mut);font-size:14px;line-height:1.5;font-family:var(--gr-fb)}
  body[data-template="bar"] .pprice{grid-area:price;font-family:var(--gr-fe);font-weight:700;color:var(--gr-gold);font-size:18px;text-align:right;white-space:nowrap}
  body[data-template="bar"] .pstock{grid-area:desc;color:var(--gr-mut);font-size:12px}
  body[data-template="bar"] .stepper{grid-area:add;justify-self:end;margin-top:2px}
  body[data-template="bar"] .add{background:var(--gr-gold);color:var(--gr-ink);border:1px solid var(--gr-gold);border-radius:2px;font-family:var(--gr-fs);text-transform:uppercase;letter-spacing:1px;font-weight:700;font-size:11px;padding:7px 15px}
  /* Header */
  body[data-template="bar"] .ba-nav{position:sticky;top:0;z-index:40;background:rgba(13,12,17,.9);backdrop-filter:blur(6px);border-bottom:1px solid rgba(255,255,255,.07)}
  .ba-nav-in{max-width:1140px;margin:0 auto;padding:0 28px;display:flex;align-items:center;height:80px;gap:30px}
  .ba-brand{display:flex;align-items:center;gap:9px;font-family:'Syne',sans-serif;font-weight:800;font-size:18px;letter-spacing:2px;color:#fff;text-decoration:none;text-transform:uppercase;white-space:nowrap}
  .ba-brand .ba-mark{width:20px;height:20px;color:#fff;flex:none}
  .ba-menu{display:flex;gap:26px;margin-left:auto;flex-wrap:wrap}
  .ba-menu a{font-family:'Syne',sans-serif;font-size:14px;color:#fff;opacity:.85;text-decoration:none}
  .ba-menu a:hover{color:var(--gr-gold);opacity:1}
  .ba-burger{display:none;margin-left:auto;background:none;border:none;cursor:pointer;flex-direction:column;gap:5px;padding:8px}
  .ba-burger span{display:block;width:24px;height:2px;background:#fff;border-radius:2px}
  @media(max-width:760px){
    .ba-burger{display:flex}
    .ba-menu{display:none;position:absolute;top:80px;left:0;right:0;flex-direction:column;gap:0;background:rgba(13,12,17,.98);border-bottom:1px solid rgba(255,255,255,.1);padding:8px 0;z-index:41}
    .ba-menu.ba-menu-open{display:flex}
    .ba-menu a{padding:14px 28px;font-size:15px;opacity:1;border-top:1px solid rgba(255,255,255,.06)}
  }
  /* Hero arche */
  .ba-hero{position:relative;min-height:92vh;background-size:cover;background-position:center;background-color:#1b1a18;display:flex;flex-direction:column;align-items:center;overflow:hidden}
  .ba-hero-bg{position:absolute;inset:0;background:rgba(13,12,17,.2)}
  .ba-arch{position:relative;z-index:2;width:min(470px,90%);min-height:84vh;display:flex;flex-direction:column;align-items:center;background:var(--gr-bg);border-radius:235px 235px 0 0;padding:70px 46px 40px;text-align:center}
  .ba-arch .ba-mark{width:42px;height:42px;color:#fff;margin-bottom:34px}
  .ba-hero-num{font-family:'Syne';font-weight:500;font-size:16px;letter-spacing:1px;color:var(--gr-mut);margin-bottom:12px}
  .ba-hero-word{font-family:'Syne';font-weight:800;font-size:clamp(30px,6vw,52px);line-height:1.05;color:#fff;letter-spacing:1px;text-transform:uppercase;max-width:100%;word-break:break-word}
  .ba-hero-sub{font-family:'Jost';font-weight:300;font-size:17px;color:var(--gr-mut);margin:24px 0 28px}
  .ba-hero-adr{margin-top:auto;padding-top:50px;color:#fff;font-size:15px}
  .ba-btn{display:inline-block;font-family:'Syne';font-weight:600;font-size:14px;padding:15px 36px;background:var(--gr-gold);color:var(--gr-ink);border:1px solid var(--gr-gold);cursor:pointer;text-decoration:none}
  .ba-btn:hover{background:transparent;color:var(--gr-gold)}
  .ba-btn-o{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}
  .ba-btn-o:hover{border-color:var(--gr-gold);color:var(--gr-gold)}
  /* Titres */
  .ba-h2{font-family:'Syne';font-weight:700;font-size:clamp(30px,5vw,54px);line-height:1.2;color:#fff;margin:0}
  .ba-h24{font-family:'Syne';font-weight:400;font-size:24px;color:var(--gr-mut);margin:0}
  .ba-eyebrow{font-family:'Syne';font-weight:600;color:var(--gr-gold);font-size:18px}
  .ba-body{font-family:'Jost';font-weight:300;font-size:16px;line-height:1.8;color:var(--gr-mut)}
  .ba-ctr{text-align:center}
  /* À propos */
  .ba-about{max-width:1140px;margin:0 auto;padding:clamp(70px,10vw,130px) 28px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}
  @media(max-width:760px){.ba-about{grid-template-columns:1fr;gap:28px}}
  .ba-sep{height:1px;background:rgba(255,255,255,.1);max-width:1140px;margin:0 auto}
  .ba-sechead{max-width:1140px;margin:0 auto;padding:80px 28px 30px}
  /* Splits signatures */
  .ba-split{display:grid;grid-template-columns:1fr 1fr;align-items:stretch;min-height:clamp(380px,50vw,560px)}
  .ba-media{background-size:cover;background-position:center;background-color:#1b1a18;min-height:300px}
  .ba-txt{display:flex;flex-direction:column;justify-content:center;gap:12px;padding:clamp(40px,6vw,70px)}
  .ba-meta{color:var(--gr-mut);font-family:'Jost'}
  @media(max-width:760px){.ba-split{grid-template-columns:1fr}.ba-split-rev .ba-media{order:-1}}
  /* Galerie bento */
  .ba-bento{max-width:1140px;margin:0 auto;padding:clamp(60px,8vw,110px) 28px}
  .ba-bento .ba-h2{margin-bottom:40px}
  .ba-bento-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:200px;gap:12px}
  .ba-tile{background-size:cover;background-position:center;background-color:#1b1a18;border-radius:4px}
  .ba-tile:nth-child(1){grid-column:span 2;grid-row:span 2}
  .ba-tile:nth-child(2){grid-column:span 2}
  .ba-tile:nth-child(5){grid-column:span 2}
  @media(max-width:760px){.ba-bento-grid{grid-template-columns:1fr 1fr;grid-auto-rows:150px}.ba-tile:nth-child(1){grid-column:span 2;grid-row:auto}}
  /* Newsletter */
  .ba-news{text-align:center;padding:clamp(60px,8vw,110px) 28px}
  .ba-news .ba-body{margin:14px auto 26px;max-width:44ch}
  .ba-news-form{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;max-width:500px;margin:0 auto}
  .ba-input{flex:1;min-width:220px;background:transparent;border:1px solid rgba(214,139,26,.4);color:#fff;font-family:'Jost';font-size:15px;padding:14px 18px}
  .ba-input::placeholder{color:var(--gr-mut)}
  /* Carte */
  .ba-map{position:relative;margin-top:30px}
  .ba-map iframe{display:block;width:100%;height:420px;border:0;filter:grayscale(.3) contrast(1.05)}
  .ba-map-card{position:absolute;z-index:3;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--gr-bg);border:1px solid rgba(255,255,255,.14);padding:20px 26px;text-align:center;min-width:230px}
  .ba-mc-pin{width:28px;height:28px;color:var(--gr-gold);margin-bottom:8px}
  .ba-map-card b{display:block;font-family:'Syne';font-weight:700;color:#fff;font-size:16px;margin-bottom:4px}
  .ba-map-card span{color:var(--gr-mut);font-size:14px}
  .ba-map-card a{display:inline-block;margin-top:10px;font-family:'Syne';font-size:13px;color:var(--gr-gold);border-bottom:1px solid var(--gr-gold);text-decoration:none}
  /* Footer */
  .ba-foot{background:var(--gr-bg2);border-top:1px solid rgba(255,255,255,.08);text-align:center;padding:clamp(50px,7vw,80px) 28px 36px}
  .ba-foot-info{display:flex;justify-content:center;gap:clamp(28px,5vw,60px);flex-wrap:wrap;margin-bottom:24px}
  .ba-foot-info b{display:block;font-family:'Syne';font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--gr-gold);margin-bottom:6px}
  .ba-foot-info span{color:var(--gr-txt);font-size:15px}
  .ba-copy{margin-top:22px;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);font-family:'Syne';font-size:12px;color:var(--gr-mut)}

  /* ═══ TEMPLATE EXCLUSIF CAFEFA — Les Délices de Fa (réf Wix « Asphalt Bloom Cafe ») ═══ */
  body[data-template="cafefa"]{ --fa-bg:#141210; --fa-ink:#ece7e0; --fa-lime:#FE7F24; --fa-brown:#1d1a17; --fa-mut:#9b938a; --fa-line:rgba(236,231,224,.13);
    background:#0f0d0b url('/assets/fa/herobg.jpg') center/cover fixed; color:var(--fa-ink); font-family:'IBM Plex Sans',system-ui,sans-serif; }
  body[data-template="cafefa"] ::selection{ background:var(--fa-lime); color:#141210; }
  .fa-kick{ display:inline-block; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:var(--fa-mut); margin-bottom:16px; }
  .fa-h2{ font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(34px,5.5vw,70px); line-height:.98; letter-spacing:.5px; text-transform:uppercase; }
  .fa-btn{ display:inline-block; background:var(--fa-lime); color:#141210; font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:14px; letter-spacing:1px; text-transform:uppercase; padding:15px 28px; border-radius:2px; text-decoration:none; border:none; cursor:pointer; transition:transform .18s ease, filter .18s ease; }
  .fa-btn:hover{ transform:translateY(-2px); filter:brightness(1.08); }
  .fa-btn-out{ display:inline-block; border:1.5px solid rgba(236,231,224,.4); color:var(--fa-ink); font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:13px; letter-spacing:2px; text-transform:uppercase; padding:14px 30px; border-radius:2px; text-decoration:none; transition:background .2s ease,color .2s ease,border-color .2s ease; }
  .fa-btn-out:hover{ background:var(--fa-lime); border-color:var(--fa-lime); color:#141210; }
  /* MASTHEAD — titre géant plein cadre + marque florale */
  .fa-masthead{ padding:30px clamp(16px,3vw,40px) 10px; }
  .fa-mast-title{ display:flex; align-items:center; justify-content:center; flex-wrap:nowrap; gap:.18em; font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(40px,12.5vw,170px); line-height:.86; letter-spacing:.5px; text-transform:uppercase; white-space:nowrap; color:var(--fa-ink); }
  .fa-mark{ width:.72em; height:.72em; color:var(--fa-lime); flex:0 0 auto; animation:fa-spin 14s linear infinite; }
  @keyframes fa-spin{ to{ transform:rotate(360deg); } }
  /* TOP NAV — rangée pleine largeur espacée */
  .fa-topnav{ position:sticky; top:0; z-index:40; display:flex; justify-content:space-between; gap:12px; max-width:1180px; margin:0 auto; padding:16px clamp(16px,3vw,40px); border-top:1px solid var(--fa-line); border-bottom:1px solid var(--fa-line); background:rgba(20,18,16,.92); backdrop-filter:blur(8px); }
  .fa-topnav a{ font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:2.5px; text-transform:uppercase; color:var(--fa-ink); text-decoration:none; transition:color .2s ease; }
  .fa-topnav a:hover{ color:var(--fa-lime); }
  .fa-topnav a.fa-on{ color:var(--fa-lime); position:relative; }
  .fa-topnav a.fa-on::after{ content:''; position:absolute; left:0; right:0; bottom:-17px; height:2px; background:var(--fa-lime); }
  @media(max-width:620px){ .fa-topnav{ gap:8px; overflow-x:auto; justify-content:flex-start; } .fa-topnav a{ font-size:11px; letter-spacing:1.5px; flex:0 0 auto; } }
  /* HERO — 3 colonnes sur fond photo : image gauche · texte centré · image droite */
  .fa-hero{ position:relative; display:grid; grid-template-columns:0.82fr 1.36fr 0.82fr; min-height:clamp(360px,52vh,500px); }
  .fa-hero::before{ content:''; position:absolute; inset:0; background:rgba(15,13,11,.3); }
  .fa-hero > *{ position:relative; z-index:1; }
  .fa-hero-img{ position:relative; display:flex; align-items:center; justify-content:center; padding:24px; background:transparent; }
  .fa-hero-img img{ width:100%; max-width:584px; height:auto; aspect-ratio:3/4; object-fit:cover; border-radius:3px; display:block; transition:transform .9s cubic-bezier(.2,.7,.2,1); }
  .fa-hero-img:hover img{ transform:scale(1.04); }
  .fa-hero-stamp{ position:absolute; left:14px; bottom:14px; color:var(--fa-lime); font-family:'Anton',Impact,sans-serif; font-size:13px; letter-spacing:1px; text-transform:lowercase; transform:rotate(-90deg); transform-origin:left bottom; }
  .fa-hero-mid{ display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:clamp(28px,4vw,54px) clamp(22px,3vw,42px); background:transparent; }
  .fa-hero-mid .fa-kick{ font-size:17px; letter-spacing:4px; color:var(--fa-lime); }
  .fa-hero-h{ font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(46px,5.8vw,78px); line-height:1; letter-spacing:.5px; text-transform:uppercase; margin-bottom:22px; }
  .fa-hero-p{ font-size:clamp(19px,1.9vw,24px); line-height:1.7; color:var(--fa-ink); max-width:500px; margin-bottom:34px; }
  .fa-hero-mid .fa-btn-out{ font-size:19px; letter-spacing:2px; padding:20px 46px; }
  .fa-hero-hours{ margin-top:22px; }
  @media(max-width:820px){ .fa-hero{ grid-template-columns:1fr; } .fa-hero-img{ min-height:260px; } .fa-hero-mid{ order:-1; padding:28px 22px 30px; } .fa-hero-mid .fa-kick{ font-size:13px; letter-spacing:2.5px; } .fa-hero-h{ font-size:36px; margin-bottom:14px; } .fa-hero-p{ font-size:15.5px; line-height:1.55; margin-bottom:22px; } .fa-hero-mid .fa-btn-out{ font-size:15px; letter-spacing:1.5px; padding:14px 30px; } }
  /* MARQUEE */
  .fa-marquee{ overflow:hidden; background:var(--fa-lime); color:#13260a; padding:12px 0; white-space:nowrap; }
  .fa-marquee-row{ display:inline-flex; align-items:center; gap:22px; animation:fa-scroll 26s linear infinite; }
  .fa-marquee-row span{ font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:13px; letter-spacing:3px; text-transform:uppercase; }
  .fa-marquee-row .fa-dot{ font-size:10px; }
  @keyframes fa-scroll{ from{ transform:translateX(0);} to{ transform:translateX(-50%);} }
  /* ABOUT */
  /* STATEMENT — bandeau manifeste centré (réf « More than a cafe ») */
  .fa-statement{ position:relative; background-size:cover; background-position:center; border-top:1px solid var(--fa-line); border-bottom:1px solid var(--fa-line); }
  .fa-about-ov{ position:absolute; inset:0; background:rgba(15,13,11,.45); }
  .fa-statement-in{ position:relative; max-width:900px; margin:0 auto; padding:clamp(60px,9vw,130px) 28px; text-align:center; }
  .fa-sm{ position:absolute; width:clamp(26px,3vw,44px); color:var(--fa-lime); opacity:.9; }
  .fa-sm svg{ width:100%; height:100%; transform:rotate(-12deg); }
  .fa-sm-r svg{ transform:rotate(14deg); }
  .fa-sm-l{ left:clamp(10px,9vw,150px); top:clamp(96px,13vw,205px); }
  .fa-sm-r{ right:clamp(10px,9vw,150px); top:clamp(50px,7vw,110px); }
  .fa-statement-h{ font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(34px,6.5vw,86px); line-height:.98; letter-spacing:.5px; text-transform:uppercase; color:var(--fa-ink); }
  .fa-statement-p{ font-size:clamp(17px,2vw,23px); line-height:1.8; color:var(--fa-mut); max-width:660px; margin:52px auto 0; }
  .fa-stats{ display:flex; gap:38px; flex-wrap:wrap; justify-content:center; margin-top:40px; }
  .fa-stat b{ display:block; font-family:'Anton',Impact,sans-serif; font-size:34px; color:var(--fa-lime); line-height:1; }
  .fa-stat span{ font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--fa-mut); }
  /* REVEAL — image plein écran qui grandit au scroll (section épinglée) */
  .fa-reveal{ position:relative; height:200vh; }
  .fa-reveal-sticky{ position:sticky; top:0; height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .fa-reveal-frame{ position:relative; width:60%; height:58%; overflow:hidden; border-radius:22px; box-shadow:0 40px 110px rgba(0,0,0,.6); will-change:width,height; }
  .fa-reveal-frame img{ width:100%; height:100%; object-fit:cover; display:block; }
  .fa-reveal-cap{ position:absolute; left:0; right:0; bottom:clamp(24px,5vh,56px); text-align:center; color:#fff; text-shadow:0 2px 24px rgba(0,0,0,.7); }
  .fa-reveal-cap .fa-kick{ color:var(--fa-lime); margin-bottom:8px; }
  .fa-reveal-cap .fa-h2{ color:#fff; }
  .fa-reveal-cta{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) scale(.55); transform-origin:center; display:inline-flex; align-items:center; gap:.4em; white-space:nowrap; background:var(--fa-lime); color:#13260a; font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:clamp(15px,2vw,22px); letter-spacing:.5px; text-transform:uppercase; padding:18px 34px; border-radius:3px; text-decoration:none; box-shadow:0 20px 60px rgba(0,0,0,.5); will-change:transform; }
  @media(max-width:620px){ .fa-reveal{ height:160vh; } }
  .fa-hero-2col{ grid-template-columns:0.9fr 1.4fr !important; }
  @media(max-width:820px){ .fa-hero-2col{ grid-template-columns:1fr !important; } }
  /* SIGNATURES — grille décalée */
  .fa-sig{ max-width:1180px; margin:0 auto; padding:clamp(56px,8vw,110px) clamp(16px,3vw,40px) 10px; }
  .fa-sig-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(14px,2vw,26px); align-items:start; }
  .fa-sig-grid .fa-card:nth-child(2){ margin-top:clamp(40px,7vw,96px); }
  .fa-card{ position:relative; border-radius:4px; overflow:hidden; background:var(--fa-brown); border:1px solid var(--fa-line); }
  .fa-card-img{ width:100%; aspect-ratio:4/5; object-fit:cover; display:block; transition:transform .9s cubic-bezier(.2,.7,.2,1); }
  .fa-card:hover .fa-card-img{ transform:scale(1.05); }
  .fa-card-body{ padding:16px 16px 20px; }
  .fa-card-top{ display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
  .fa-card-name{ font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(18px,2.4vw,28px); text-transform:uppercase; line-height:1; color:var(--fa-ink); }
  .fa-card-price{ font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:14px; color:var(--fa-lime); white-space:nowrap; }
  .fa-card-desc{ margin-top:10px; color:var(--fa-mut); font-size:13px; line-height:1.55; }
  @media(max-width:760px){ .fa-sig{ padding:clamp(40px,10vw,70px) 10px 10px; } .fa-sig-grid{ grid-template-columns:repeat(3,1fr); gap:6px; } .fa-sig-grid .fa-card:nth-child(2){ margin-top:22px; } .fa-card-body{ padding:7px 7px 10px; } .fa-card-top{ flex-direction:column; align-items:flex-start; gap:2px; } .fa-card-name{ font-size:11px; line-height:1.05; } .fa-card-price{ font-size:10.5px; } .fa-card-desc{ display:none; } }
  /* NOTRE MAISON */
  .fa-house{ border-top:1px solid var(--fa-line); text-align:center; padding:clamp(56px,8vw,110px) 28px; }
  .fa-house-h{ font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(34px,6vw,76px); text-transform:uppercase; line-height:1; margin-bottom:clamp(30px,4vw,52px); color:var(--fa-ink); }
  .fa-house-img{ width:100%; max-width:560px; aspect-ratio:3/2; object-fit:cover; border-radius:4px; margin:0 auto; display:block; }
  .fa-house-p{ max-width:620px; margin:clamp(26px,4vw,40px) auto 0; color:var(--fa-mut); font-size:clamp(14px,1.6vw,17px); line-height:1.8; }
  /* NOTRE HISTOIRE (page) */
  .fa-story-wrap{ max-width:1100px; margin:0 auto; padding:clamp(40px,6vw,80px) clamp(16px,4vw,40px); }
  .fa-story-photo{ width:100%; max-width:720px; aspect-ratio:16/10; object-fit:cover; border-radius:4px; display:block; margin:0 auto clamp(30px,4vw,48px); }
  .fa-story-sub{ text-align:center; font-style:italic; font-size:clamp(17px,2.2vw,24px); color:var(--fa-ink); line-height:1.5; max-width:620px; margin:0 auto clamp(24px,4vw,40px); }
  .fa-story-title{ text-align:center; font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(40px,9vw,120px); line-height:.92; text-transform:uppercase; color:var(--fa-ink); margin-bottom:clamp(36px,5vw,64px); }
  .fa-story-title em{ font-style:normal; color:var(--fa-lime); }
  .fa-story-body{ max-width:620px; margin:0 auto; }
  .fa-story-body p{ font-family:'IBM Plex Mono',monospace; font-size:clamp(13px,1.5vw,15px); line-height:2; color:var(--fa-ink); margin-bottom:22px; }
  .fa-story-body p:last-child{ color:var(--fa-lime); }
  .fa-story-cta{ text-align:center; margin-top:clamp(36px,5vw,56px); }
  /* FOOTER v2 */
  .fa-foot2{ background:var(--fa-brown); border-top:1px solid var(--fa-line); padding:clamp(40px,6vw,72px) clamp(16px,4vw,52px) 26px; }
  .fa-foot2-top{ max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; align-items:flex-start; gap:30px; flex-wrap:wrap; }
  .fa-foot2-info{ display:flex; flex-direction:column; gap:6px; }
  .fa-foot2-info a,.fa-foot2-info span{ color:var(--fa-ink); text-decoration:none; font-family:'IBM Plex Mono',monospace; font-size:13px; line-height:1.7; letter-spacing:.5px; }
  .fa-foot2-info a:hover{ color:var(--fa-lime); }
  .fa-foot2-hours{ margin-top:4px; }
  .fa-foot2-social a{ color:var(--fa-ink); text-decoration:none; font-family:'IBM Plex Mono',monospace; font-size:13px; letter-spacing:2px; text-transform:uppercase; }
  .fa-foot2-social a:hover{ color:var(--fa-lime); }
  .fa-foot2-maplink{ display:block; max-width:1200px; margin:clamp(26px,4vw,40px) auto 0; }
  .fa-foot2-map{ width:100%; height:clamp(180px,26vw,300px); object-fit:cover; border:1px solid var(--fa-line); border-radius:4px; filter:grayscale(.35) contrast(1.05); display:block; }
  .fa-foot2-big{ max-width:1300px; margin:clamp(26px,4vw,40px) auto 0; display:flex; align-items:center; justify-content:center; gap:.18em; font-family:'Anton',Impact,sans-serif; font-weight:400; font-size:clamp(30px,8.4vw,120px); line-height:.9; letter-spacing:.5px; text-transform:uppercase; color:var(--fa-ink); white-space:nowrap; overflow:hidden; }
  .fa-foot2-big .fa-mark{ width:.62em; height:.62em; color:var(--fa-lime); flex:0 0 auto; }
  .fa-foot2-logo{ width:clamp(52px,9vw,104px); height:clamp(52px,9vw,104px); border-radius:50%; object-fit:cover; flex:0 0 auto; margin-right:.3em; border:2px solid var(--fa-lime); background:#fff; }
  .fa-foot2-legal{ max-width:1200px; margin:clamp(22px,3vw,32px) auto 0; padding-top:20px; border-top:1px solid var(--fa-line); display:flex; align-items:center; gap:26px; flex-wrap:wrap; }
  .fa-foot2-legal a{ color:var(--fa-mut); text-decoration:none; font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:1px; }
  .fa-foot2-legal a:hover{ color:var(--fa-lime); }
  .fa-foot2-credit{ margin-left:auto; color:var(--fa-mut); font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.5px; }
  @media(max-width:620px){ .fa-foot2-legal{ gap:16px; } .fa-foot2-credit{ margin-left:0; width:100%; } }
  /* MENU (catalogue réutilisé, restylé sombre+lime) */
  .fa-menu{ max-width:1240px; margin:0 auto; padding:clamp(56px,8vw,100px) 28px 40px; }
  .fa-menu-head{ text-align:center; margin-bottom:46px; }
  .fa-h2-c{ margin:0 auto; }
  .fa-menu-sub{ font-family:'IBM Plex Mono',monospace; font-size:13px; letter-spacing:1px; color:var(--fa-mut); margin-top:18px; max-width:560px; margin-left:auto; margin-right:auto; }
  .fa-menu-body.closed-overlay{ opacity:.55; pointer-events:none; filter:grayscale(.4); }
  body[data-template="cafefa"] .catnav{ justify-content:center; margin-bottom:40px; }
  body[data-template="cafefa"] .chip{ border:1.5px solid var(--fa-line); color:var(--fa-ink); background:transparent; font-family:'IBM Plex Mono',monospace; letter-spacing:1px; text-transform:uppercase; font-size:12px; border-radius:2px; }
  body[data-template="cafefa"] .chip.sel{ background:var(--fa-lime); border-color:var(--fa-lime); color:#13260a; }
  body[data-template="cafefa"] .cathead-title{ font-family:'Anton',Impact,sans-serif; text-transform:uppercase; letter-spacing:.5px; color:var(--fa-ink); }
  body[data-template="cafefa"] .cathead-count{ background:rgba(195,255,91,.14); color:var(--fa-lime); }
  body[data-template="cafefa"] .sectitle{ font-family:'Anton',Impact,sans-serif; text-transform:uppercase; color:var(--fa-ink); }
  body[data-template="cafefa"] .prod{ background:var(--fa-brown); border:1.5px solid var(--fa-line); border-radius:6px; }
  body[data-template="cafefa"] .prod.in{ border-color:var(--fa-lime); }
  body[data-template="cafefa"] .pimgzone,body[data-template="cafefa"] .svc-imgzone{ background:#24140a; }
  body[data-template="cafefa"] .pname{ font-family:'Anton',Impact,sans-serif; font-weight:400; letter-spacing:.3px; color:var(--fa-ink); text-transform:uppercase; }
  body[data-template="cafefa"] .pdesc{ color:var(--fa-mut); }
  body[data-template="cafefa"] .pprice{ color:var(--fa-lime); font-family:'IBM Plex Mono',monospace; font-weight:600; }
  body[data-template="cafefa"] .pstock{ color:var(--fa-mut); font-size:11px; }
  body[data-template="cafefa"] .add,body[data-template="cafefa"] .bookbtn,body[data-template="cafefa"] .ds-btn,body[data-template="cafefa"] .abo-btn{ background:var(--fa-lime); color:#13260a; border-color:var(--fa-lime); border-radius:3px; font-family:'IBM Plex Mono',monospace; letter-spacing:.5px; }
  body[data-template="cafefa"] .svcbtn{ border-color:var(--fa-line); color:var(--fa-ink); border-radius:3px; }
  body[data-template="cafefa"] .qtybox{ background:var(--fa-lime); border-radius:3px; }
  body[data-template="cafefa"] .qtybox button,body[data-template="cafefa"] .qtybox .q{ color:#13260a; }
  body[data-template="cafefa"] .ds-card,body[data-template="cafefa"] .abocard{ background:var(--fa-brown); border:1.5px solid var(--fa-line); border-radius:6px; }
  body[data-template="cafefa"] .ds-name,body[data-template="cafefa"] .abonom{ font-family:'Anton',Impact,sans-serif; text-transform:uppercase; color:var(--fa-ink); }
  body[data-template="cafefa"] .ds-price,body[data-template="cafefa"] .aboprix{ color:var(--fa-lime); }
  body[data-template="cafefa"] .closed-notice{ background:var(--fa-brown); border:1px solid var(--fa-line); color:var(--fa-ink); }
  body[data-template="cafefa"] .hours-status{ background:rgba(195,255,91,.12); color:var(--fa-lime); }
  body[data-template="cafefa"] .hours-status::before{ background:var(--fa-lime); }
  body[data-template="cafefa"] .h-closed{ background:rgba(255,255,255,.06); color:var(--fa-mut); }
  body[data-template="cafefa"] .h-closed::before{ background:var(--fa-mut); }
  body[data-template="cafefa"] .hours-time{ color:var(--fa-mut); }
  /* CART BAR — accent lime */
  body[data-template="cafefa"] .cartbtn{ background:var(--fa-lime); color:#13260a; }
  body[data-template="cafefa"] #cartTotal{ color:#13260a!important; }
  /* FOOT */
  .fa-foot{ background:var(--fa-brown); border-top:1px solid var(--fa-line); padding:clamp(48px,7vw,84px) 28px 34px; text-align:center; }
  .fa-foot-in{ max-width:1100px; margin:0 auto; display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:40px; text-align:left; }
  .fa-foot-name{ font-family:'Anton',Impact,sans-serif; font-size:32px; text-transform:uppercase; margin-bottom:8px; }
  .fa-foot-brand p{ color:var(--fa-mut); font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase; margin-bottom:16px; }
  .fa-foot-col b{ display:block; font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:var(--fa-lime); margin:10px 0 4px; }
  .fa-foot-col span,.fa-foot-col a{ color:var(--fa-ink); text-decoration:none; font-size:15px; }
  .fa-foot-cta{ margin:40px 0 24px; }
  .fa-copy{ color:var(--fa-mut); font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:1px; padding-top:22px; border-top:1px solid var(--fa-line); }
  @media(max-width:760px){ .fa-foot-in{ grid-template-columns:1fr; gap:24px; } }
  /* ═══ TEMPLATE EXCLUSIF UDEBI — Ûdebi Atelier (mode épuré, sacs en perles) ═══ */
  body[data-template="udebi"]{ --ud-bg:#f4f1ea; --ud-ink:#2a2420; --ud-wine:#5a1420; --ud-mut:#8c8276; --ud-line:rgba(42,36,32,.14); --ud-card:#ece7dc; background:var(--ud-bg); color:var(--ud-ink); font-family:'Jost',system-ui,sans-serif; font-weight:300; line-height:1.6; -webkit-font-smoothing:antialiased; overflow-x:clip; max-width:100vw; }
  html:has(body[data-template="udebi"]){ overflow-x:clip; }
  body[data-template="udebi"] img{ max-width:100%; display:block; }
  body[data-template="udebi"] ::selection{ background:var(--ud-wine); color:var(--ud-bg); }
  .ud-serif{ font-family:'Playfair Display',Georgia,serif; }
  .ud-nav{ position:sticky; top:0; z-index:40; display:flex; align-items:center; justify-content:space-between; padding:20px clamp(18px,4vw,56px); background:rgba(246,243,236,.97); border-bottom:1px solid var(--ud-line); }
  .ud-brand{ display:flex; align-items:center; text-decoration:none; }
  .ud-brand img{ height:clamp(40px,4.6vw,56px); width:auto; display:block; }
  .ud-links{ display:flex; gap:clamp(16px,2.6vw,40px); }
  .ud-links a{ text-decoration:none; font-size:13px; letter-spacing:1.5px; text-transform:uppercase; color:var(--ud-ink); transition:color .2s; }
  .ud-links a:hover,.ud-links a.on{ color:var(--ud-wine); }
  @media(max-width:640px){ .ud-links{ gap:14px; } .ud-links a{ font-size:11px; letter-spacing:1px; } }
  .ud-hero{ position:relative; z-index:2; min-height:clamp(540px,88vh,860px); display:flex; align-items:center; overflow:hidden; background:var(--ud-bg); }
  .ud-hero-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .ud-hero::after{ content:''; position:absolute; inset:0; background:linear-gradient(90deg,rgba(26,18,14,.6),rgba(26,18,14,.18) 42%,rgba(26,18,14,0) 62%); }
  .ud-hero-in{ position:relative; z-index:2; padding:clamp(28px,5vw,80px); max-width:680px; align-self:center; margin-bottom:clamp(20px,6vh,70px); }
  .ud-hero-h{ font-style:italic; font-weight:600; font-size:clamp(34px,4.6vw,60px); line-height:1.06; color:#fff; white-space:nowrap; text-shadow:0 2px 24px rgba(0,0,0,.35); }
  .ud-hero-p{ margin-top:18px; font-size:clamp(15px,1.5vw,18px); color:#f1ece4; max-width:400px; text-shadow:0 1px 14px rgba(0,0,0,.35); }
  .ud-btn{ display:inline-block; margin-top:28px; background:var(--ud-ink); color:var(--ud-bg); font-size:13px; letter-spacing:2px; text-transform:uppercase; padding:15px 34px; text-decoration:none; transition:background .25s; cursor:pointer; }
  .ud-btn:hover{ background:var(--ud-wine); }
  .ud-hero-card{ position:absolute; right:clamp(16px,3vw,54px); bottom:clamp(16px,3vw,54px); z-index:3; display:flex; align-items:center; gap:18px; background:rgba(246,243,236,.97); padding:16px; max-width:430px; border:1px solid var(--ud-line); }
  .ud-hero-card img{ width:150px; height:180px; object-fit:cover; flex:0 0 auto; }
  .ud-hero-card .t{ font-family:'Playfair Display',serif; font-style:italic; font-size:17px; color:var(--ud-wine); }
  .ud-hero-card .s{ font-size:12px; letter-spacing:1px; text-transform:uppercase; color:var(--ud-mut); margin-top:4px; }
  .ud-hero-card a{ font-family:'Playfair Display',serif; font-style:italic; font-size:14px; color:var(--ud-wine); text-decoration:underline; text-underline-offset:3px; margin-top:6px; display:inline-block; }
  @media(max-width:720px){ .ud-hero-h{ font-size:clamp(26px,6.6vw,36px); } .ud-hero-img{ object-position:36% center; } .ud-hero::after{ background:linear-gradient(0deg,rgba(20,13,10,.55),rgba(20,13,10,.25) 45%,rgba(20,13,10,.6) 100%); } .ud-hero-in{ align-self:flex-start; margin-bottom:0; margin-top:clamp(8px,3vh,36px); max-width:62%; } .ud-hero-p{ color:#fff; text-shadow:0 2px 16px rgba(0,0,0,.75); font-size:13px; max-width:100%; } .ud-btn{ margin-top:16px; font-size:10px; letter-spacing:1.2px; padding:10px 18px; }
  .ud-hero-card{ display:flex; right:14px; bottom:16px; max-width:230px; padding:10px; gap:10px; }
  .ud-hero-card img{ width:66px; height:84px; }
  .ud-hero-card .t{ font-size:13px; }
  .ud-hero-card .s{ font-size:10px; }
  .ud-hero-card a{ font-size:12px; } }
  .ud-head{ text-align:center; max-width:560px; margin:0 auto; padding:clamp(60px,9vw,120px) 24px clamp(30px,4vw,48px); }
  .ud-head h2{ font-style:italic; font-weight:500; font-size:clamp(30px,4vw,48px); color:var(--ud-wine); }
  .ud-head p{ margin-top:14px; color:var(--ud-ink); font-size:clamp(15px,1.6vw,18px); }
  .ud-coll{ max-width:1320px; margin:0 auto; padding:0 clamp(14px,2vw,28px) clamp(40px,6vw,80px); display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(10px,1.4vw,20px); }
  .ud-cell{ position:relative; overflow:hidden; background:var(--ud-card); }
  .ud-cell-img{ width:100%; aspect-ratio:3/4; object-fit:cover; transition:transform 1s cubic-bezier(.2,.7,.2,1); }
  .ud-cell:hover .ud-cell-img{ transform:scale(1.05); }
  .ud-cell-cap{ position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:center; padding:26px 20px; background:linear-gradient(0deg,rgba(28,23,18,.6),rgba(28,23,18,0)); }
  .ud-cell-btn{ background:rgba(244,241,234,.95); color:var(--ud-ink); font-size:12px; letter-spacing:2px; text-transform:uppercase; padding:13px 30px; text-decoration:none; transition:background .25s,color .25s; }
  .ud-cell-btn:hover{ background:var(--ud-wine); color:var(--ud-bg); }
  @media(max-width:860px){ .ud-coll{ grid-template-columns:repeat(2,1fr); } }
  @media(max-width:520px){ .ud-coll{ grid-template-columns:1fr; } }
  .ud-overlap{ position:relative; }
  .ud-front{ position:relative; z-index:2; background:var(--ud-bg); }
  .ud-grow{ position:fixed; inset:0; z-index:1; display:flex; align-items:center; overflow:hidden; background:var(--ud-bg); }
  .ud-grow-spacer{ height:100vh; }
  .ud-grow-bg{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .ud-grow::after{ content:''; position:absolute; inset:0; background:linear-gradient(0deg,rgba(28,23,18,.28),rgba(28,23,18,0) 50%); }
  .ud-banner-card{ position:relative; z-index:2; margin:clamp(18px,4vw,56px); background:rgba(246,243,236,.97); padding:clamp(24px,3vw,44px); max-width:400px; border:1px solid var(--ud-line); opacity:0; transform:translateY(48px); transition:opacity 1s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1); }
  .ud-banner-card.in{ opacity:1; transform:none; }
  .ud-banner-card.in h3{ animation:udCardLine .9s cubic-bezier(.16,1,.3,1) .15s both; }
  .ud-banner-card.in p{ animation:udCardLine .9s cubic-bezier(.16,1,.3,1) .3s both; }
  .ud-banner-card.in a{ animation:udCardLine .9s cubic-bezier(.16,1,.3,1) .45s both; }
  @keyframes udCardLine{ from{ opacity:0; transform:translateY(18px); } to{ opacity:1; transform:none; } }
  .ud-banner-card h3{ font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(24px,3vw,38px); color:var(--ud-wine); }
  .ud-banner-card p{ margin-top:12px; color:var(--ud-ink); font-size:15px; }
  .ud-banner-card a{ display:inline-block; margin-top:18px; font-family:'Playfair Display',serif; font-style:italic; font-size:16px; color:var(--ud-wine); text-decoration:underline; text-underline-offset:4px; }
  @media(max-width:720px){
  .ud-overlap{ isolation:isolate; }
  .ud-grow{ position:sticky; inset:auto; top:0; height:100svh; margin-top:-100svh; align-items:flex-end; }
  .ud-grow-spacer{ height:100svh; }
  .ud-banner-card{ margin:0 14px clamp(28px,6vh,70px); padding:14px 16px; max-width:none; }
  .ud-banner-card h3{ font-size:19px; }
  .ud-banner-card p{ font-size:12px; margin-top:6px; }
  .ud-banner-card a{ font-size:13px; margin-top:10px; } }
  .ud-coveted{ position:relative; z-index:2; background:var(--ud-bg); padding:clamp(56px,8vw,110px) clamp(14px,2vw,28px) clamp(40px,6vw,80px); }
  .ud-coveted-head{ text-align:center; margin-bottom:clamp(32px,4vw,56px); }
  .ud-coveted-head h2{ font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:clamp(28px,4vw,46px); color:var(--ud-wine); }
  .ud-cov-grid{ max-width:1320px; margin:0 auto; display:grid; grid-template-columns:1fr 1fr; gap:clamp(12px,1.6vw,22px); }
  .ud-cov-card{ position:relative; overflow:hidden; aspect-ratio:4/5; background:var(--ud-card); }
  .ud-cov-card video{ width:100%; height:100%; object-fit:cover; display:block; }
  .ud-cov-cap{ position:absolute; left:0; right:0; bottom:0; padding:clamp(18px,2.4vw,30px); background:linear-gradient(0deg,rgba(28,23,18,.6),rgba(28,23,18,0)); color:#f4f1ea; }
  .ud-cov-name{ font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(18px,2.2vw,28px); }
  .ud-cov-link{ display:inline-block; margin-top:8px; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:underline; text-underline-offset:3px; color:#f4f1ea; }
  @media(max-width:620px){ .ud-cov-grid{ gap:8px; } .ud-cov-cap{ padding:12px; } .ud-cov-name{ font-size:15px; } .ud-cov-link{ font-size:10px; margin-top:5px; } }
  .ud-look{ position:relative; z-index:2; background:var(--ud-bg); padding:clamp(20px,3vw,40px) clamp(14px,2vw,28px) clamp(50px,7vw,90px); }
  .ud-look-grid{ max-width:1340px; margin:0 auto; display:grid; grid-template-columns:1.3fr 1fr; gap:clamp(12px,1.6vw,22px); align-items:stretch; }
  .ud-look-main{ position:relative; overflow:hidden; background:var(--ud-card); min-height:clamp(420px,60vh,760px); }
  .ud-look-main img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
  .ud-look-title{ position:absolute; top:clamp(18px,2vw,30px); left:clamp(18px,2vw,30px); z-index:2; font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:clamp(24px,2.6vw,38px); color:#fff; text-shadow:0 2px 20px rgba(0,0,0,.4); }
  .ud-look-right{ display:flex; flex-direction:column; gap:clamp(12px,1.6vw,22px); }
  .ud-look-card{ display:flex; flex-direction:column; }
  .ud-look-imgz{ position:relative; overflow:hidden; aspect-ratio:1/1; background:var(--ud-card); }
  .ud-look-imgz img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
  .ud-look-imgz .ud-look-hover{ opacity:0; transition:opacity .55s cubic-bezier(.2,.7,.2,1); }
  .ud-look-imgz:hover .ud-look-hover{ opacity:1; }
  .ud-look-imgz.show2 .ud-look-hover{ opacity:1; }
  .ud-look-meta{ display:flex; justify-content:space-between; align-items:baseline; gap:10px; margin-top:12px; }
  .ud-look-name{ font-family:'Playfair Display',serif; font-style:italic; font-size:clamp(16px,1.8vw,21px); color:var(--ud-ink); }
  .ud-look-link{ font-size:12px; letter-spacing:1.5px; text-transform:uppercase; text-decoration:underline; text-underline-offset:3px; color:var(--ud-wine); }
  @media(max-width:760px){ .ud-look-grid{ gap:8px; } .ud-look-main{ min-height:0; } .ud-look-right{ gap:8px; } .ud-look-title{ font-size:17px; top:12px; left:12px; } .ud-look-meta{ margin-top:8px; } .ud-look-name{ font-size:13px; } .ud-look-link{ font-size:10px; } }
  .ud-story{ position:relative; z-index:2; background:var(--ud-bg); display:grid; grid-template-columns:0.92fr 1.08fr; align-items:center; }
  .ud-story-text{ padding:clamp(40px,6vw,96px) clamp(24px,4vw,64px); max-width:560px; margin-left:auto; }
  .ud-story-text .k{ font-family:'Jost',monospace; font-size:12px; letter-spacing:3px; text-transform:uppercase; color:var(--ud-mut); }
  .ud-story-text h2{ font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:clamp(30px,4vw,52px); color:var(--ud-wine); margin:14px 0 18px; line-height:1.05; }
  .ud-story-text p{ color:var(--ud-ink); font-size:clamp(15px,1.5vw,17px); line-height:1.8; }
  .ud-story-img{ height:100%; min-height:clamp(440px,74vh,820px); overflow:hidden; background:var(--ud-card); }
  .ud-story-img img{ width:100%; height:100%; object-fit:cover; display:block; }
  @media(max-width:760px){ .ud-story{ grid-template-columns:0.88fr 1.12fr; } .ud-story-text{ margin:0; max-width:none; padding:14px 12px; } .ud-story-img{ min-height:0; aspect-ratio:3/4; } .ud-story-text .k{ font-size:9px; letter-spacing:2px; } .ud-story-text h2{ font-size:19px; margin:8px 0 10px; } .ud-story-text p{ font-size:12px; line-height:1.55; } .ud-story-text .ud-btn{ margin-top:14px; font-size:10px; padding:10px 16px; } }
  .ud-foot{ position:relative; z-index:2; background:var(--ud-bg); border-top:1px solid var(--ud-line); padding:clamp(48px,7vw,90px) clamp(18px,4vw,56px) 0; }
  .ud-foot-grid{ max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1.6fr 1fr 1fr 1fr; gap:clamp(24px,3vw,48px); }
  .ud-foot h4{ font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:22px; color:var(--ud-wine); margin-bottom:18px; }
  .ud-foot p{ color:var(--ud-mut); font-size:14px; max-width:320px; }
  .ud-foot-col a{ display:block; text-decoration:none; color:var(--ud-ink); font-size:14px; margin-bottom:12px; transition:color .2s; }
  .ud-foot-col a:hover{ color:var(--ud-wine); }
  .ud-foot-word{ text-align:center; margin-top:clamp(28px,4vw,48px); }
  .ud-foot-word img{ height:clamp(90px,14vw,180px); width:auto; display:inline-block; }
  .ud-foot-legal{ max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; flex-wrap:wrap; gap:12px; padding:22px 0 30px; border-top:1px solid var(--ud-line); font-size:12px; letter-spacing:.5px; color:var(--ud-mut); }
  @media(max-width:760px){ .ud-foot-grid{ grid-template-columns:1fr 1fr; } }
  @media(max-width:460px){ .ud-foot-grid{ grid-template-columns:1fr; } }
  body[data-template="udebi"] .rv{ opacity:0; transform:translateY(38px); transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1); }
  body[data-template="udebi"] .rv.in{ opacity:1; transform:none; }
  body[data-template="udebi"] .rv-stag.in>*{ transition-delay:calc(var(--i,0)*90ms); }
  @media(prefers-reduced-motion:reduce){ body[data-template="udebi"] .rv,body[data-template="udebi"] .rv-stag>*{ opacity:1!important; transform:none!important; } .ud-banner-card{ opacity:1; transform:none; } }
  /* BOUTIQUE (page produits — panier réel restylé) */
  .sh-head{ padding:clamp(34px,5vw,64px) clamp(18px,4vw,56px) clamp(22px,3vw,34px); border-bottom:1px solid var(--ud-line); }
  .sh-head h1{ font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:clamp(34px,5vw,60px); color:var(--ud-wine); }
  .sh-head p{ margin-top:12px; color:var(--ud-ink); max-width:620px; font-size:15px; }
  .sh-wrap{ max-width:1320px; margin:0 auto; padding:clamp(26px,4vw,48px) clamp(18px,4vw,56px) clamp(60px,8vw,110px); }
  .sh-main-top{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:22px; }
  .sh-count{ color:var(--ud-mut); font-size:13px; letter-spacing:1px; text-transform:uppercase; }
  .sh-sort{ color:var(--ud-ink); font-size:13px; letter-spacing:.5px; }
  body[data-template="udebi"] .grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:clamp(14px,2vw,30px); }
  @media(max-width:760px){ body[data-template="udebi"] .grid{ grid-template-columns:repeat(2,1fr); gap:12px; } }
  body[data-template="udebi"] .cathead{ display:none; }
  body[data-template="udebi"] .prod{ background:transparent; border:none; border-radius:0; box-shadow:none; }
  body[data-template="udebi"] .pimgzone{ background:var(--ud-card); border-radius:0; aspect-ratio:3/4; overflow:hidden; }
  body[data-template="udebi"] .pname{ font-family:'Playfair Display',serif; font-style:italic; font-weight:500; font-size:clamp(16px,1.8vw,20px); color:var(--ud-ink); margin-top:14px; }
  body[data-template="udebi"] .pdesc{ color:var(--ud-mut); font-size:13px; }
  body[data-template="udebi"] .pprice{ color:var(--ud-wine); letter-spacing:1px; }
  body[data-template="udebi"] .add,body[data-template="udebi"] .qtybox{ background:var(--ud-ink); color:var(--ud-bg); border:none; border-radius:0; letter-spacing:1.5px; text-transform:uppercase; }
  body[data-template="udebi"] .add:hover{ background:var(--ud-wine); }
  body[data-template="udebi"] .cartbar{ background:linear-gradient(180deg,rgba(244,241,234,0),rgba(244,241,234,.96) 30%); }
  body[data-template="udebi"] .cartbtn{ background:var(--ud-ink); color:var(--ud-bg); border-radius:0; }
  body[data-template="udebi"] #cartTotal{ color:var(--ud-bg)!important; }
</style>
</head>
<body data-template="${theme.template}" data-cols="${theme.layout.cols}" data-card="${theme.layout.card}" data-hero="${theme.layout.hero}">
  ${body}
  ${hasProducts ? `
  <div class="cartbar" id="cartbar" hidden>
    <button class="cartbtn" id="cartbtn" type="button">
      <span><span class="cnt" id="cnt">0</span> &nbsp;Commander</span>
      <span id="cartTotal" style="color:${BRAND_GOLD};font-weight:700">0 F</span>
    </button>
  </div>
  <div class="sheet" id="sheet">
    <div class="panel" style="position:relative">
      <button class="close" id="closeSheet" type="button">×</button>
      <div id="step-form">
        <h2>Finaliser la commande</h2>
        <p class="sub">${esc(o.name)} · paiement sécurisé Wave / Orange Money</p>
        <div class="lines" id="lines"></div>
        <div class="fld"><label>Ton nom *</label><input id="f-name" type="text" placeholder="Ex : Awa Diop" maxlength="80" autocomplete="name"></div>
        <div class="fld"><label>Téléphone *</label><input id="f-phone" type="text" inputmode="numeric" placeholder="77 123 45 67" maxlength="14" autocomplete="off" autocorrect="off" autocapitalize="off"></div>
        <div class="fld"><label>Adresse / précisions *</label><textarea id="f-note" placeholder="Ex : Livraison Sacré-Cœur 3, villa 12 — ou retrait sur place"></textarea></div>
        <div class="fld"><label>Message vocal (optionnel)</label>
          <div class="voicerow">
            <button class="vrec" id="vrec" type="button"><span class="vdot"></span><span id="vlabel">Enregistrer</span></button>
            <span class="vtime" id="vtime"></span>
            <button class="vdel" id="vdel" type="button" hidden aria-label="Supprimer">✕</button>
          </div>
          <audio id="vplay" controls hidden></audio>
        </div>
        <div class="fld"><label>Moyen de paiement *</label>
          <div class="pays">
            <button class="pay" type="button" data-m="wave"><img src="/assets/wave.jpg" alt="Wave"><span>Wave</span></button>
            <button class="pay" type="button" data-m="orange_money"><img src="/assets/om.png" alt="Orange Money"><span>Orange Money</span></button>
          </div>
        </div>
        <p class="msg" id="msg"></p>
      </div>
      <div id="step-wait" style="display:none" class="waiting">
        <h2 id="waitTitle">Paiement</h2>
        <p class="sub" id="waitSub">Valide le paiement dans l'app, puis reviens sur cette page.</p>
        <a class="payer" id="payOpen" style="display:none;text-decoration:none;width:auto;padding:15px 30px" href="#">Payer</a>
        <img id="omQr" alt="QR paiement" hidden>
        <div class="spin"></div>
        <p class="sub" id="waitMsg">En attente de confirmation du paiement…</p>
        <button class="pay" id="checkNow" type="button" style="margin-top:8px;width:auto;padding:10px 20px">J'ai payé — vérifier</button>
      </div>
    </div>
  </div>
  ` : ''}
  ${hasBeauty ? `
  <div class="sheet" id="bsheet">
    <div class="panel" style="position:relative">
      <button class="close" id="bClose" type="button">×</button>
      <div id="bstep-form">
        <h2 id="bTitle">Réserver</h2>
        <p class="sub" id="bSub">${esc(o.name)} · paiement sécurisé Wave / Orange Money</p>
        <div class="fld"><label>Choisis une date</label><div class="bdates" id="bDates"></div></div>
        <div class="fld"><label>Créneau</label><div class="bslots" id="bSlots"><span class="bhint">Choisis d'abord une date</span></div></div>
        <div class="fld"><label>Ton nom *</label><input id="bName" type="text" placeholder="Ex : Awa Diop" maxlength="80" autocomplete="name"></div>
        <div class="fld"><label>Téléphone *</label><input id="bPhone" type="text" inputmode="numeric" placeholder="77 123 45 67" maxlength="14" autocomplete="off" autocorrect="off" autocapitalize="off"></div>
        <div class="fld"><label>Moyen de paiement *</label>
          <div class="pays">
            <button class="pay" type="button" data-bm="wave"><img src="/assets/wave.jpg" alt="Wave"><span>Wave</span></button>
            <button class="pay" type="button" data-bm="orange_money"><img src="/assets/om.png" alt="Orange Money"><span>Orange Money</span></button>
          </div>
        </div>
        <p class="msg" id="bMsg"></p>
      </div>
      <div id="bstep-wait" style="display:none" class="waiting">
        <h2 id="bWaitTitle">Paiement</h2>
        <p class="sub" id="bWaitSub">Valide le paiement, puis reviens sur cette page.</p>
        <a class="payer" id="bPayOpen" style="display:none;text-decoration:none;width:auto;padding:15px 30px" href="#">Payer</a>
        <img id="bOmQr" alt="QR paiement" hidden>
        <div class="spin"></div>
        <p class="sub" id="bWaitMsg">En attente de confirmation du paiement…</p>
        <button class="pay" id="bCheckNow" type="button" style="margin-top:8px;width:auto;padding:10px 20px">J'ai payé — vérifier</button>
      </div>
    </div>
  </div>
  ` : ''}
  ${hasProducts ? `
  <div class="sheet" id="habsheet">
    <div class="panel" style="position:relative">
      <button class="close" id="habClose" type="button">×</button>
      <h2 id="habName" style="margin-bottom:4px"></h2>
      <p id="habStock"></p>
      <div id="habSizeSec" class="hab-sec" style="display:none">
        <label>Taille</label>
        <div class="hab-chips" id="habSizeBtns"></div>
      </div>
      <div id="habColorSec" class="hab-sec" style="display:none">
        <label>Couleur</label>
        <div class="hab-chips" id="habColorBtns"></div>
      </div>
      <button class="payer" id="habConfirm" type="button" disabled style="margin-top:8px">Ajouter au panier</button>
    </div>
  </div>
  <!-- Fiche produit agrandie (tap carte) : carrousel + description scrollable -->
  <div class="pd-ov" id="pdOv" hidden>
    <div class="pd-card" role="dialog" aria-modal="true">
      <button class="pd-x" id="pdX" type="button" aria-label="Fermer">×</button>
      <div class="pd-gallery" id="pdGallery"></div>
      <div class="pd-dots" id="pdDots"></div>
      <div class="pd-body">
        <div class="pd-name" id="pdName"></div>
        <div class="pd-price" id="pdPrice"></div>
        <div class="pd-stock" id="pdStock"></div>
        <div class="pd-desc" id="pdDesc"></div>
      </div>
      <div class="pd-action" id="pdAction"></div>
    </div>
  </div>
  <!-- Image produit plein écran -->
  <div class="pf-ov" id="pfOv" hidden>
    <button class="pf-x" id="pfX" type="button" aria-label="Fermer">×</button>
    <img class="pf-img" id="pfImg" alt="">
  </div>
  ` : ''}
  ${hasFitness ? `
  <div class="sheet" id="abosheet">
    <div class="panel" style="position:relative">
      <button class="close" id="aboClose" type="button">\xD7</button>
      <div id="abostep-form">
        <h2 id="aboTitle">S'abonner</h2>
        <p class="sub" id="aboSub">${esc(o.name)} \xB7 paiement s\xe9curis\xe9 Wave / Orange Money</p>
        <div class="lines" id="aboLines"></div>
        <div class="fld"><label>Ton nom *</label><input id="abo-name" type="text" placeholder="Ex : Awa Diop" maxlength="80" autocomplete="name"></div>
        <div class="fld"><label>T\xe9l\xe9phone *</label><input id="abo-phone" type="text" inputmode="numeric" placeholder="77 123 45 67" maxlength="14" autocomplete="off" autocorrect="off" autocapitalize="off"></div>
        <div class="fld"><label>Moyen de paiement *</label>
          <div class="pays">
            <button class="pay" type="button" data-am="wave"><img src="/assets/wave.jpg" alt="Wave"><span>Wave</span></button>
            <button class="pay" type="button" data-am="orange_money"><img src="/assets/om.png" alt="Orange Money"><span>Orange Money</span></button>
          </div>
        </div>
        <p class="msg" id="aboMsg"></p>
      </div>
      <div id="abostep-wait" style="display:none" class="waiting">
        <h2 id="aboWaitTitle">Paiement</h2>
        <p class="sub" id="aboWaitSub">Valide le paiement, puis reviens sur cette page.</p>
        <a class="payer" id="aboPayOpen" style="display:none;text-decoration:none;width:auto;padding:15px 30px" href="#">Payer</a>
        <img id="aboOmQr" alt="QR paiement" hidden>
        <div class="spin"></div>
        <p class="sub" id="aboWaitMsg">En attente de confirmation du paiement…</p>
        <button class="pay" id="aboCheckNow" type="button" style="margin-top:8px;width:auto;padding:10px 20px">J'ai pay\xe9 — v\xe9rifier</button>
      </div>
    </div>
  </div>
  ` : ''}
  ${(hasProducts || hasBeauty || hasFitness) ? `<script id="cfg" type="application/json">${cfg}</script>` : ''}
  ${hasProducts ? `<script>${safeScript(CART_JS)}</script>` : ''}
  ${hasBeauty ? `<script>${safeScript(BOOKING_JS)}</script>` : ''}
  ${hasFitness ? `<script>${safeScript(SUBSCRIPTION_JS)}</script>` : ''}
  <div class="lbx" id="lbx"><button class="lbx-close" id="lbxClose">\xD7</button><img class="lbx-img" id="lbxImg" src="" alt=""></div>
  <script>${safeScript(LIGHTBOX_JS)}</script>
  ${REVEAL}
  ${SCROLLFX}
</body>
</html>`;
}

// Page de confirmation (s.lassi.tech/commande?id=..&s=ok|ko) — poll du statut.
function renderConfirmation(url: URL): string {
  const id = (url.searchParams.get('id') ?? '').trim();
  const s = url.searchParams.get('s') ?? '';
  const shop = (url.searchParams.get('shop') ?? '').trim();
  const type = url.searchParams.get('type') ?? '';
  const retour = shop ? `https://s.lassi.tech/${encodeURIComponent(shop)}` : 'https://lassi.tech';
  const cfg = JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY, id, s, type });
  const isOk = s === 'ok';
  const isKo = s === 'ko';
  const isTerrain = type === 'terrain';
  const isBeauty = type === 'beauty';
  const isAbo = type === 'abonnement';
  const OK_SVG_SSR = `<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="34" fill="${BRAND_GOLD}"/><path d="M22 37l10 10 18-20" fill="none" stroke="${BRAND_BG}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const KO_SVG_SSR = `<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="33" fill="none" stroke="#FF6B6B" stroke-width="4"/><path d="M26 26l20 20M46 26l-20 20" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/></svg>`;
  const initMark  = isOk ? OK_SVG_SSR : isKo ? KO_SVG_SSR : `<div class="spin"></div>`;
  const initTitle = isOk ? (isTerrain || isBeauty ? 'Réservation confirmée' : isAbo ? 'Abonnement activé !' : 'Paiement confirmé') : isKo ? 'Paiement non abouti' : 'Vérification du paiement…';
  const initDesc  = isOk ? (isTerrain ? 'Ton créneau est réservé.' : isBeauty ? 'Le prestataire a reçu ta réservation.' : isAbo ? 'Ton abonnement est actif.' : 'Merci ! Le marchand a reçu ta commande.') : isKo ? 'Le paiement n\'a pas abouti.' : 'Un instant, on confirme ta commande.';
  const homeDisplay = (isOk || isKo) ? 'inline-block' : 'none';
  const homeHref    = shop ? `https://s.lassi.tech/${encodeURIComponent(shop)}` : 'javascript:history.go(-2)';
  // Pour les commandes normales (type vide), le bouton est caché côté SSR
  // et affiché par JS uniquement après confirmation de paiement en DB (anti race-condition Wave).
  const recuDisplay = (isOk && id && type) ? 'inline-flex' : 'none';
  const recuHref    = (isOk && id) ? `/receipt?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}` : '#';
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Commande — LASSİ</title>
<style>
  *{box-sizing:border-box} body{margin:0;min-height:100vh;background:${BRAND_BG};color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:28px;text-align:center}
  .box{max-width:420px}
  #mark{margin:0 auto 18px;min-height:72px;display:flex;align-items:center;justify-content:center}
  #mark svg{width:72px;height:72px}
  h1{font-size:23px;margin:0 0 10px}
  p{color:rgba(255,255,255,.7);font-size:15px;line-height:1.55;margin:0 0 8px}
  .gold{color:${BRAND_GOLD};font-weight:700}
  .spin{width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:${BRAND_GOLD};border-radius:50%;animation:sp 1s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .btn{display:inline-block;margin-top:20px;background:${BRAND_GOLD};color:${BRAND_BG};padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none}
  .actions{display:flex;flex-direction:column;gap:10px;align-items:center;margin-top:20px}
  .actions .btn{margin-top:0}
  .ghost{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.28);padding:13px 26px;border-radius:14px;font-weight:700;text-decoration:none;font-size:15px}
  .ghost svg{width:18px;height:18px;fill:${BRAND_GOLD}}
  .dl{margin-top:34px}
  .dltxt{color:${BRAND_GOLD};font-weight:800;font-size:14.5px;margin:0 0 14px;line-height:1.45}
  .rcpt{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:16px 18px;margin:18px 0 4px;text-align:left}
  .rcpt-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.07)}
  .rcpt-row:last-child{border-bottom:none;padding-top:10px}
  .rcpt-lbl{color:rgba(255,255,255,.5);font-size:12.5px;white-space:nowrap}
  .rcpt-val{font-size:13.5px;font-weight:600;text-align:right;word-break:break-word}
  .rcpt-prix{color:${BRAND_GOLD};font-size:16px;font-weight:800}
  .cta{display:flex;flex-direction:row;gap:10px;max-width:430px;margin:0 auto}
  .store{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;background:#000;color:#fff;text-decoration:none;padding:11px;border-radius:13px;border:1px solid rgba(255,255,255,.14);animation:pulseDark 2.2s ease-in-out infinite}
  .store svg{width:22px;height:22px;flex:0 0 auto;fill:#fff}
  .store .txt{display:flex;flex-direction:column;text-align:left;line-height:1.05;min-width:0}
  .store .txt small{font-size:9px;color:rgba(255,255,255,.75);font-weight:500;white-space:nowrap}
  .store .txt strong{font-size:13px;font-weight:700;white-space:nowrap}
  .store.primary{background:${BRAND_GOLD};color:${BRAND_BG};border-color:transparent;animation:pulseGold 2.2s ease-in-out infinite .35s}
  .store.primary svg{fill:${BRAND_BG}}
  .store.primary .txt small{color:rgba(20,21,42,.7)}
  @keyframes pulseGold{0%,100%{box-shadow:0 6px 18px rgba(253,207,52,.35),0 0 0 0 rgba(253,207,52,.55)}50%{box-shadow:0 6px 18px rgba(253,207,52,.35),0 0 0 13px rgba(253,207,52,0)}}
  @keyframes pulseDark{0%,100%{box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 0 rgba(255,255,255,.35)}50%{box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 13px rgba(255,255,255,0)}}
  @media (prefers-reduced-motion:reduce){.store,.store.primary{animation:none}}
</style></head>
<body>
  <div class="box">
    <div id="mark">${initMark}</div>
    <h1 id="t">${initTitle}</h1>
    <p id="d">${initDesc}</p>
    <div id="receipt-card" class="rcpt" style="display:none">
      <div class="rcpt-row"><span class="rcpt-lbl">Formule</span><span class="rcpt-val" id="rc-nom"></span></div>
      <div class="rcpt-row"><span class="rcpt-lbl">Durée</span><span class="rcpt-val" id="rc-duree"></span></div>
      <div class="rcpt-row"><span class="rcpt-lbl">Client</span><span class="rcpt-val" id="rc-client"></span></div>
      <div class="rcpt-row"><span class="rcpt-lbl">Établissement</span><span class="rcpt-val" id="rc-prest"></span></div>
      <div class="rcpt-row"><span class="rcpt-lbl">Montant payé</span><span class="rcpt-val rcpt-prix" id="rc-prix"></span></div>
    </div>
    <div class="actions">
      <a class="btn" id="home" href="${escAttr(homeHref)}" style="display:${homeDisplay}">Retour à la boutique</a>
      <a class="ghost" id="recu" href="${escAttr(recuHref)}" download style="display:${recuDisplay}"><svg viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1zM5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"/></svg>Télécharger le reçu (PDF)</a>
    </div>
    <div class="dl">
      <p class="dltxt">Télécharge l'application pour découvrir tous les commerçants autour de toi</p>
      <div class="cta">
        <a class="store primary" href="${APPSTORE_URL}">
          <svg viewBox="0 0 24 24"><path d="M16.365 1.43c0 1.14-.417 2.2-1.25 3.06-.95.99-2.08 1.56-3.2 1.47-.14-1.09.43-2.26 1.22-3.05.89-.9 2.33-1.57 3.23-1.48zM20.9 17.1c-.55 1.27-.81 1.83-1.52 2.96-.99 1.57-2.38 3.53-4.1 3.54-1.53.02-1.92-.99-4-.98-2.08.01-2.51 1-4.04.97-1.72-.01-3.04-1.77-4.03-3.34C-.5 16.73-.78 11.08 1.38 8.17c1.07-1.46 2.76-2.38 4.36-2.38 1.63 0 2.66 1 4.01 1 1.31 0 2.11-1 4-1 1.43 0 2.94.78 4.02 2.12-3.53 1.94-2.95 6.98 1.13 9.19z"/></svg>
          <span class="txt"><small>Télécharger dans l'</small><strong>App Store</strong></span>
        </a>
        <a class="store" href="${PLAY_URL}">
          <svg viewBox="0 0 24 24"><path d="M3.6 1.8c-.32.34-.51.86-.51 1.53v17.34c0 .67.19 1.19.53 1.52l.06.05L13.5 12.4v-.23L3.68 1.75l-.08.05z" fill="#00D0FF"/><path d="M17.2 15.7l-3.7-3.3v-.24l3.7-3.3.08.05 4.37 2.48c1.25.71 1.25 1.87 0 2.58l-4.37 2.48-.08.02z" fill="#FFCE00"/><path d="M17.28 15.65l-3.78-3.38L3.6 22.2c.41.44 1.09.49 1.86.06l11.82-6.61" fill="#FF3A44"/><path d="M17.28 8.9L5.46 2.3C4.69 1.86 4.01 1.92 3.6 2.36l9.9 9.91 3.78-3.37z" fill="#00F076"/></svg>
          <span class="txt"><small>Disponible sur</small><strong>Google Play</strong></span>
        </a>
      </div>
    </div>
  </div>
  <script id="cfg" type="application/json">${cfg}</script>
  <script>${safeScript(CONFIRM_JS)}</script>
</body></html>`;
}

function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s: string): string { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function clip(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }
function fmtPrice(n: number): string { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F'; }
function fmtHr(hhmm: string): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

type DayKey2 = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
const JS_DAY_TO_KEY2: DayKey2[] = ['sun','mon','tue','wed','thu','fri','sat'];

interface ShopStatusResult { isOpen: boolean; isPause: boolean; label: string; pauseNextChange: string; todayOpen: string; todayClose: string; todayClosed: boolean; }

function computeShopStatus(hours: unknown, manuallyClosed: boolean | null | undefined): ShopStatusResult {
  const base = { isPause: false, pauseNextChange: '' };
  if (manuallyClosed) return { ...base, isOpen: false, label: 'Exceptionnellement fermé', todayOpen: '', todayClose: '', todayClosed: true };
  const now = new Date();
  const todayKey = JS_DAY_TO_KEY2[now.getDay()];
  let weekHours: Record<string, { open: string; close: string; closed: boolean; pauseStart?: string; pauseEnd?: string }> = {};
  if (hours && typeof hours === 'object' && !Array.isArray(hours)) {
    weekHours = hours as Record<string, { open: string; close: string; closed: boolean; pauseStart?: string; pauseEnd?: string }>;
  }
  if (!Object.keys(weekHours).length) return { ...base, isOpen: true, label: 'Ouvert', todayOpen: '', todayClose: '', todayClosed: false };
  const today = weekHours[todayKey] ?? { open: '07:00', close: '22:00', closed: false };
  if (today.closed) return { ...base, isOpen: false, label: "Fermé aujourd'hui", todayOpen: '', todayClose: '', todayClosed: true };
  const toMin = (hhmm: string) => { const [h2, m2] = hhmm.split(':').map(Number); return h2*60+m2; };
  const fmtH = (hhmm: string) => { const [h2, m2] = hhmm.split(':').map(Number); return m2 === 0 ? h2 + 'h' : h2 + 'h' + String(m2).padStart(2, '0'); };
  const nowMin = now.getHours()*60 + now.getMinutes();
  const openMin = toMin(today.open);
  const rawClose = toMin(today.close);
  const closeMin = rawClose || 1440;
  // Horaire traversant minuit (ex: 07:00–02:58)
  const overnight = rawClose > 0 && rawClose < openMin;
  const inRange = overnight
    ? (nowMin >= openMin || nowMin < closeMin)
    : (nowMin >= openMin && nowMin < closeMin);
  if (inRange) {
    // Vérifier pause
    if (today.pauseStart && today.pauseEnd) {
      const ps = toMin(today.pauseStart); const pe = toMin(today.pauseEnd);
      if (ps < pe && nowMin >= ps && nowMin < pe) {
        return { isOpen: false, isPause: true, label: 'En pause', pauseNextChange: 'Reprend à ' + fmtH(today.pauseEnd), todayOpen: today.open, todayClose: today.close, todayClosed: false };
      }
    }
    return { ...base, isOpen: true, label: 'Ouvert', todayOpen: today.open, todayClose: today.close, todayClosed: false };
  }
  if (!overnight && nowMin < openMin) return { ...base, isOpen: false, label: 'Pas encore ouvert', todayOpen: today.open, todayClose: today.close, todayClosed: false };
  if (overnight && nowMin >= closeMin && nowMin < openMin) return { ...base, isOpen: false, label: 'Pas encore ouvert', todayOpen: today.open, todayClose: today.close, todayClosed: false };
  return { ...base, isOpen: false, label: 'Fermé', todayOpen: today.open, todayClose: today.close, todayClosed: false };
}

// ── Lightbox — aperçu image plein écran (clic desktop, appui long mobile) ────
const LIGHTBOX_JS = `
(function(){
  var lbx=document.getElementById('lbx');
  var lbxImg=document.getElementById('lbxImg');
  if(!lbx||!lbxImg) return;
  var justOpened=false;
  function openLbx(src,alt){
    justOpened=true; setTimeout(function(){ justOpened=false; },350);
    lbxImg.src=src; lbxImg.alt=alt||'';
    lbx.classList.add('open'); document.body.style.overflow='hidden';
  }
  function closeLbx(){ lbx.classList.remove('open'); document.body.style.overflow=''; setTimeout(function(){ lbxImg.src=''; },300); }
  lbx.addEventListener('click',function(e){ if(justOpened) return; if(e.target===lbx||e.target.id==='lbxClose') closeLbx(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeLbx(); });
  var lpTimer=null, lpActive=false;
  function bindZone(el,src,alt){
    el.style.cursor='zoom-in';
    el.addEventListener('click',function(){ if(lpActive){lpActive=false;return;} openLbx(src,alt); });
    el.addEventListener('touchstart',function(){
      lpActive=false; clearTimeout(lpTimer);
      lpTimer=setTimeout(function(){ lpActive=true; openLbx(src,alt); },450);
    },{passive:true});
    el.addEventListener('touchend',function(){ clearTimeout(lpTimer); lpTimer=null; },{passive:true});
    el.addEventListener('touchmove',function(){ clearTimeout(lpTimer); lpTimer=null; },{passive:true});
    el.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  }
  // Produits + services : bind sur .pimgzone (le container, pas l'img absolute qui rate les clicks)
  document.querySelectorAll('.pimgzone').forEach(function(zone){
    var img=zone.querySelector('img');
    if(img) bindZone(zone, img.src, img.alt);
  });
  // Plats du jour : img inline (pas absolute), bind direct
  document.querySelectorAll('.ds-img').forEach(function(img){
    bindZone(img, img.src, img.alt);
  });
})();
`;

// ── JS client : panier + checkout (concaténation, aucun backtick) ────────────
const CART_JS = `
(function(){
  var CFG = JSON.parse(document.getElementById('cfg').textContent);
  var RATE = CFG.rate || 0.01;
  var cart = {}; // id -> { name, base, qty }
  function fmt(n){ return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ') + ' F'; }
  function sumBase(){ var s=0; for(var k in cart){ s += cart[k].base*cart[k].qty; } return s; }
  function count(){ var c=0; for(var k in cart){ c += cart[k].qty; } return c; }
  function total(){ var b=sumBase(); return b>0 ? b + Math.ceil(b*RATE) : 0; }

  function syncStepper(id){
    var box = document.querySelector('.stepper[data-id="'+CSS.escape(id)+'"]');
    if(!box) return;
    var q = cart[id] ? cart[id].qty : 0;
    var add = box.querySelector('.add'), qb = box.querySelector('.qtybox');
    var card = box.closest('.prod');
    if(q>0){ add.hidden=true; qb.hidden=false; qb.querySelector('.q').textContent=q; card.classList.add('in'); }
    else { add.hidden=false; qb.hidden=true; card.classList.remove('in'); }
  }
  function refreshBar(){
    var c=count(), bar=document.getElementById('cartbar');
    document.getElementById('cnt').textContent=c;
    document.getElementById('cartTotal').textContent=fmt(total());
    bar.hidden = c===0;
  }
  function change(id,name,base,delta,dsId){
    var cur = cart[id] ? cart[id].qty : 0;
    var next = Math.max(0, cur+delta);
    if(next===0) delete cart[id]; else cart[id]={name:name,base:base,qty:next,dsId:dsId||null};
    syncStepper(id); refreshBar();
  }

  // Plats du jour (plusieurs possibles)
  document.querySelectorAll('.ds-card').forEach(function(dsCard){
    var dsId=dsCard.getAttribute('data-ds-id'), dsName=dsCard.getAttribute('data-ds-name'), dsBase=parseInt(dsCard.getAttribute('data-ds-price')||'0',10)||0;
    var dsKey='ds_'+dsId;
    dsCard.querySelector('.ds-btn').addEventListener('click', function(){ change(dsKey,'🍽 Plat du jour \xB7 '+dsName,dsBase,1,dsId); });
  });

  // cartVariants : cartId -> {productId, selectedSize, selectedColor}
  var cartVariants={};

  // ── Picker habillement (taille + couleur) ─────────────────────────────────
  var habId=null, habName=null, habBase=null, habHasSz=false, habHasCl=false, habSelSz=null, habSelCl=null;
  function updateHabConfirm(){ var ok=(!habHasSz||habSelSz)&&(!habHasCl||habSelCl); document.getElementById('habConfirm').disabled=!ok; }
  function openHabPicker(id,name,base,szJson,clJson,stock){
    habId=id; habName=name; habBase=base; habSelSz=null; habSelCl=null;
    var sizes=[],colors=[];
    try{sizes=JSON.parse(szJson||'[]');}catch(e){}
    try{colors=JSON.parse(clJson||'[]');}catch(e){}
    habHasSz=sizes.length>0; habHasCl=colors.length>0;
    document.getElementById('habName').textContent=name;
    var stEl=document.getElementById('habStock');
    if(stock!==''&&stock!==null){var n=parseInt(stock,10); stEl.textContent=n+' restant'+(n>1?'s':''); stEl.className=n<=5?'low':''; stEl.style.display='';}
    else{stEl.style.display='none';}
    var szSec=document.getElementById('habSizeSec'), szBtns=document.getElementById('habSizeBtns');
    if(habHasSz){
      szBtns.innerHTML='';
      sizes.forEach(function(s){
        var b=document.createElement('button'); b.type='button'; b.className='hab-chip'; b.textContent=s;
        b.addEventListener('click',function(){ document.querySelectorAll('#habSizeBtns .hab-chip').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); habSelSz=s; updateHabConfirm(); });
        szBtns.appendChild(b);
      });
      szSec.style.display='';
    } else { szSec.style.display='none'; }
    var clSec=document.getElementById('habColorSec'), clBtns=document.getElementById('habColorBtns');
    if(habHasCl){
      clBtns.innerHTML='';
      colors.forEach(function(c){
        var b=document.createElement('button'); b.type='button'; b.className='hab-chip'; b.textContent=c;
        b.addEventListener('click',function(){ document.querySelectorAll('#habColorBtns .hab-chip').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); habSelCl=c; updateHabConfirm(); });
        clBtns.appendChild(b);
      });
      clSec.style.display='';
    } else { clSec.style.display='none'; }
    updateHabConfirm();
    document.getElementById('habsheet').classList.add('open');
  }
  var habCloseEl=document.getElementById('habClose');
  if(habCloseEl) habCloseEl.addEventListener('click',function(){ document.getElementById('habsheet').classList.remove('open'); });
  var habConfirmEl=document.getElementById('habConfirm');
  if(habConfirmEl) habConfirmEl.addEventListener('click',function(){
    if(!habId) return;
    var parts=[habSelSz,habSelCl].filter(Boolean);
    var suffix=parts.length>0?' ('+parts.join(', ')+')':'';
    var cartId=habId+'|'+(habSelSz||'')+'|'+(habSelCl||'');
    cartVariants[cartId]={productId:habId,selectedSize:habSelSz||null,selectedColor:habSelCl||null};
    change(cartId,habName+suffix,habBase,1);
    document.getElementById('habsheet').classList.remove('open');
  });

  document.querySelectorAll('.prod').forEach(function(card){
    if(card.classList.contains('svc') || !card.querySelector('.add')) return;
    var id=card.getAttribute('data-id'), name=card.getAttribute('data-name'), base=parseInt(card.getAttribute('data-base'),10)||0;
    var szJson=card.getAttribute('data-sizes')||'', clJson=card.getAttribute('data-colors')||'', stockStr=card.getAttribute('data-stock')||'';
    var hasVars=szJson!==''||clJson!=='';
    card.querySelector('.add').addEventListener('click', function(e){
      e.stopPropagation();
      if(hasVars){ openHabPicker(id,name,base,szJson,clJson,stockStr); }
      else{ change(id,name,base,1); }
    });
    if(!hasVars){
      card.querySelector('.plus').addEventListener('click', function(e){ e.stopPropagation(); change(id,name,base,1); });
      card.querySelector('.minus').addEventListener('click', function(e){ e.stopPropagation(); change(id,name,base,-1); });
    }
    // Tap sur la carte (hors boutons) → fiche produit agrandie
    card.addEventListener('click', function(){ openProductDetail(card); });
  });

  // ── Fiche produit agrandie + image plein écran ────────────────────────────
  var pdOv=document.getElementById('pdOv'), pfOv=document.getElementById('pfOv');
  var pdCur=null; // {id,name,base,hasVars,szJson,clJson,stockStr,imgs}
  var pdOpenedAt=0; // anti ghost-click : le tap qui ouvre la fiche ne doit pas ouvrir le plein écran
  function pdImages(card){
    var imgs=[]; try{ imgs=JSON.parse(card.getAttribute('data-images')||'[]'); }catch(e){}
    return (imgs||[]).filter(function(u){ return typeof u==='string' && u.indexOf('http')===0; });
  }
  function renderPdAction(){
    if(!pdCur) return;
    var el=document.getElementById('pdAction');
    var q=cart[pdCur.id]?cart[pdCur.id].qty:0;
    if(pdCur.hasVars || q===0){
      el.innerHTML='<button class="pd-add" type="button">Ajouter au panier</button>';
      el.querySelector('.pd-add').addEventListener('click',function(){
        if(pdCur.hasVars){ closeProductDetail(); openHabPicker(pdCur.id,pdCur.name,pdCur.base,pdCur.szJson,pdCur.clJson,pdCur.stockStr); }
        else{ change(pdCur.id,pdCur.name,pdCur.base,1); renderPdAction(); }
      });
    } else {
      el.innerHTML='<div class="pd-qty"><button type="button" class="m">−</button><b>'+q+'</b><button type="button" class="p">+</button></div>';
      el.querySelector('.m').addEventListener('click',function(){ change(pdCur.id,pdCur.name,pdCur.base,-1); renderPdAction(); });
      el.querySelector('.p').addEventListener('click',function(){ change(pdCur.id,pdCur.name,pdCur.base,1); renderPdAction(); });
    }
  }
  function openProductDetail(card){
    if(!pdOv) return;
    var imgs=pdImages(card);
    pdCur={ id:card.getAttribute('data-id'), name:card.getAttribute('data-name'), base:parseInt(card.getAttribute('data-base'),10)||0,
      hasVars:(card.getAttribute('data-sizes')||'')!==''||(card.getAttribute('data-colors')||'')!=='',
      szJson:card.getAttribute('data-sizes')||'', clJson:card.getAttribute('data-colors')||'', stockStr:card.getAttribute('data-stock')||'', imgs:imgs };
    document.getElementById('pdName').textContent=pdCur.name;
    var priceEl=card.querySelector('.pprice'); document.getElementById('pdPrice').innerHTML=priceEl?priceEl.innerHTML:'';
    var stEl=document.getElementById('pdStock');
    if(pdCur.stockStr!==''){var n=parseInt(pdCur.stockStr,10); stEl.textContent=n+' restant'+(n>1?'s':''); stEl.style.display='';} else {stEl.style.display='none';}
    var desc=card.getAttribute('data-desc')||''; var dEl=document.getElementById('pdDesc'); dEl.textContent=desc; dEl.style.display=desc?'':'none';
    var gal=document.getElementById('pdGallery'), dots=document.getElementById('pdDots');
    gal.innerHTML=''; dots.innerHTML='';
    if(imgs.length){
      imgs.forEach(function(u,i){
        var im=document.createElement('img'); im.src=u; im.alt=pdCur.name; im.loading='lazy';
        im.addEventListener('click',function(e){ e.stopPropagation(); if(Date.now()-pdOpenedAt<500) return; openFull(u); });
        gal.appendChild(im);
        var d=document.createElement('i'); if(i===0)d.className='on'; dots.appendChild(d);
      });
      dots.style.display=imgs.length>1?'':'none';
      gal.onscroll=function(){ var i=Math.round(gal.scrollLeft/gal.clientWidth); [].forEach.call(dots.children,function(x,j){ x.className=j===i?'on':''; }); };
    } else {
      var em=card.querySelector('.pemoji'); gal.innerHTML='<div class="pd-emoji">'+(em?em.textContent:'🛍')+'</div>'; dots.style.display='none';
    }
    renderPdAction();
    pdOpenedAt=Date.now();
    pdOv.hidden=false; document.body.style.overflow='hidden';
  }
  function closeProductDetail(){ if(pdOv){pdOv.hidden=true;} document.body.style.overflow=''; }
  function openFull(u){ if(!pfOv)return; document.getElementById('pfImg').src=u; pfOv.hidden=false; }
  function closeFull(){ if(pfOv)pfOv.hidden=true; }
  if(pdOv){
    document.getElementById('pdX').addEventListener('click',closeProductDetail);
    pdOv.addEventListener('click',function(e){ if(e.target===pdOv){ if(Date.now()-pdOpenedAt<500) return; closeProductDetail(); } });
  }
  if(pfOv){
    document.getElementById('pfX').addEventListener('click',closeFull);
    pfOv.addEventListener('click',function(e){ if(e.target===pfOv)closeFull(); });
  }

  // ── Onglets catégories (chips) : filtre les sections ──
  var chips=document.querySelectorAll('.chip');
  if(chips.length){
    var secs=document.querySelectorAll('.catsec'), nav=document.querySelector('.catnav');
    chips.forEach(function(ch){
      ch.addEventListener('click', function(){
        chips.forEach(function(x){ x.classList.remove('sel'); });
        ch.classList.add('sel');
        var cat=ch.getAttribute('data-cat');
        secs.forEach(function(sec){ sec.hidden = (cat!=='__all' && sec.getAttribute('data-cat')!==cat); });
        if(nav){ var y=nav.getBoundingClientRect().top; if(y<0) window.scrollBy(0, y-4); }
      });
    });
  }

  var sheet=document.getElementById('sheet');
  function openSheet(){
    var lines=document.getElementById('lines'), h='';
    for(var k in cart){ var it=cart[k]; h += '<div class="line"><span>'+it.qty+'× '+escapeHtml(it.name)+'</span><span>'+fmt((it.base+Math.ceil(it.base*RATE))*it.qty)+'</span></div>'; }
    h += '<div class="line tot"><span>Total</span><span>'+fmt(total())+'</span></div>';
    lines.innerHTML=h;
    document.getElementById('step-form').style.display='';
    document.getElementById('step-wait').style.display='none';
    sheet.classList.add('open');
  }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  document.getElementById('cartbtn').addEventListener('click', openSheet);
  document.getElementById('closeSheet').addEventListener('click', function(){ sheet.classList.remove('open'); });

  var moyen='wave';
  var paying=false;
  var SESSION_KEY='lassi_order_'+CFG.slug;

  // Au démarrage : si commande déjà créée pour ce shop → vérifier statut
  (function checkExistingOrder(){
    try {
      var saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
      if(!saved||!saved.orderId) return;
      // Paiement déjà initié → aller directement à la page confirmation.
      // Empêche tout double-paiement si l'utilisateur revient sur la vitrine avant la confirmation Wave/OM.
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href=saved.confUrl;
    } catch(e){}
  })();

  // ── Message vocal — WAV PCM 16 kHz encodé côté navigateur : lecture native
  // garantie sur expo-av (iOS AVPlayer + Android ExoPlayer), aucun codec requis.
  // Fallback MediaRecorder seulement si Web Audio indisponible.
  var voiceBlob=null, voiceMime='', recording=false, recTimer=null;
  var vrec=document.getElementById('vrec'), vlabel=document.getElementById('vlabel');
  var vtime=document.getElementById('vtime'), vdel=document.getElementById('vdel'), vplay=document.getElementById('vplay');
  var audioCtx=null, srcNode=null, procNode=null, micStream=null, pcmChunks=[], pcmRate=44100; // chemin PCM/WAV
  var mediaRec=null, recChunks=[]; // chemin fallback
  function uiRecording(on){
    recording=on;
    if(on){ vrec.classList.add('rec'); vlabel.textContent='Arreter'; }
    else { vrec.classList.remove('rec'); vlabel.textContent='Reenregistrer'; if(recTimer){ clearInterval(recTimer); recTimer=null; } }
  }
  function showPlayer(){ if(vplay&&voiceBlob){ vplay.src=URL.createObjectURL(voiceBlob); vplay.hidden=false; } if(vdel) vdel.hidden=false; }
  function startTimer(){
    var t0=Date.now();
    recTimer=setInterval(function(){ var s=Math.floor((Date.now()-t0)/1000); vtime.textContent='0:'+(s<10?'0':'')+s; if(s>=60) stopRec(); },250);
  }
  function resetVoice(){
    voiceBlob=null; voiceMime='';
    if(vplay){ vplay.hidden=true; vplay.removeAttribute('src'); } if(vdel) vdel.hidden=true;
    if(vlabel) vlabel.textContent='Enregistrer'; if(vtime) vtime.textContent='';
  }
  function downsampleInt16(buf, inRate, outRate){
    if(!buf.length || outRate>=inRate) return buf;
    var ratio=inRate/outRate, newLen=Math.round(buf.length/ratio), out=new Int16Array(newLen), pos=0, i=0;
    while(i<newLen){
      var next=Math.round((i+1)*ratio), sum=0, cnt=0;
      for(var j=pos;j<next&&j<buf.length;j++){ sum+=buf[j]; cnt++; }
      out[i]=cnt?(sum/cnt)|0:0; pos=next; i++;
    }
    return out;
  }
  function encodeWav(){
    var total=0,i; for(i=0;i<pcmChunks.length;i++) total+=pcmChunks[i].length;
    var pcm=new Int16Array(total), off=0;
    for(i=0;i<pcmChunks.length;i++){ pcm.set(pcmChunks[i],off); off+=pcmChunks[i].length; }
    var outRate=16000;
    var ds=downsampleInt16(pcm, pcmRate||44100, outRate);
    var bytes=ds.length*2, buf=new ArrayBuffer(44+bytes), dv=new DataView(buf);
    function wstr(o,s){ for(var k=0;k<s.length;k++) dv.setUint8(o+k, s.charCodeAt(k)); }
    wstr(0,'RIFF'); dv.setUint32(4,36+bytes,true); wstr(8,'WAVE');
    wstr(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
    dv.setUint32(24,outRate,true); dv.setUint32(28,outRate*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true);
    wstr(36,'data'); dv.setUint32(40,bytes,true);
    var p=44; for(i=0;i<ds.length;i++){ dv.setInt16(p, ds[i], true); p+=2; }
    voiceBlob=new Blob([buf],{type:'audio/wav'}); voiceMime='audio/wav';
  }
  function stopRec(){
    if(!recording) return;
    uiRecording(false);
    if(audioCtx){
      try{ procNode.disconnect(); srcNode.disconnect(); }catch(e){}
      try{ micStream.getTracks().forEach(function(t){t.stop();}); }catch(e){}
      try{ audioCtx.close(); }catch(e){}
      audioCtx=null;
      try{ encodeWav(); showPlayer(); }catch(e){ resetVoice(); vtime.textContent='Erreur'; }
    } else if(mediaRec){ try{ mediaRec.stop(); }catch(e){} }
  }
  function startRec(){
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ vtime.textContent='Non supporte'; return; }
    navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
      micStream=stream;
      if(window.AudioContext||window.webkitAudioContext){
        var AC=window.AudioContext||window.webkitAudioContext;
        audioCtx=new AC(); if(audioCtx.resume) audioCtx.resume();
        pcmRate=audioCtx.sampleRate; pcmChunks=[];
        srcNode=audioCtx.createMediaStreamSource(stream);
        procNode=audioCtx.createScriptProcessor(4096,1,1);
        procNode.onaudioprocess=function(e){
          var inp=e.inputBuffer.getChannelData(0), buf=new Int16Array(inp.length), i;
          for(i=0;i<inp.length;i++){ var s=inp[i]; s=s<-1?-1:(s>1?1:s); buf[i]=s<0?s*0x8000:s*0x7FFF; }
          pcmChunks.push(buf);
        };
        srcNode.connect(procNode); procNode.connect(audioCtx.destination);
      } else {
        audioCtx=null; recChunks=[];
        var mime='', c=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg'];
        if(window.MediaRecorder&&MediaRecorder.isTypeSupported){ for(var j=0;j<c.length;j++){ if(MediaRecorder.isTypeSupported(c[j])){ mime=c[j]; break; } } }
        if(!window.MediaRecorder){ vtime.textContent='Non supporte'; try{ stream.getTracks().forEach(function(t){t.stop();}); }catch(e){} return; }
        try{ mediaRec=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream); }catch(e){ mediaRec=new MediaRecorder(stream); }
        voiceMime=String(mediaRec.mimeType||mime||'audio/webm').split(';')[0];
        mediaRec.ondataavailable=function(e){ if(e.data&&e.data.size) recChunks.push(e.data); };
        mediaRec.onstop=function(){ try{ stream.getTracks().forEach(function(t){t.stop();}); }catch(e){} voiceBlob=new Blob(recChunks,{type:voiceMime}); showPlayer(); };
        mediaRec.start();
      }
      uiRecording(true); startTimer();
    }).catch(function(){ vtime.textContent='Micro refuse'; });
  }
  if(vrec) vrec.addEventListener('click', function(){ if(recording) stopRec(); else startRec(); });
  if(vdel) vdel.addEventListener('click', resetVoice);
  function blobToB64(blob, cb){
    var r=new FileReader();
    r.onloadend=function(){ var s=String(r.result||''); var i=s.indexOf(','); cb(i>=0?s.slice(i+1):s); };
    r.onerror=function(){ cb(''); };
    r.readAsDataURL(blob);
  }

  var phoneInput=document.getElementById('f-phone');
  if(phoneInput){
    phoneInput.addEventListener('input', function(){
      var v=this.value.replace(/\D/g,'');
      if(v.startsWith('221')) v=v.slice(3);
      this.value=v.slice(0,9);
    });
    phoneInput.addEventListener('blur', function(){
      var v=this.value.replace(/\D/g,'');
      if(v.startsWith('221')) v=v.slice(3);
      v=v.slice(0,9);
      var fmt='';
      if(v.length>0) fmt=v.slice(0,2);
      if(v.length>2) fmt+=' '+v.slice(2,5);
      if(v.length>5) fmt+=' '+v.slice(5,7);
      if(v.length>7) fmt+=' '+v.slice(7,9);
      this.value=fmt;
    });
  }

  document.querySelectorAll('#sheet .pay').forEach(function(b){
    b.addEventListener('click', function(){
      if(paying) return;
      document.querySelectorAll('#sheet .pay').forEach(function(x){x.classList.remove('sel');});
      b.classList.add('sel'); moyen=b.getAttribute('data-m');
      var name=document.getElementById('f-name').value.trim();
      var phone=document.getElementById('f-phone').value.trim();
      var note=document.getElementById('f-note').value.trim();
      var msg=document.getElementById('msg'); msg.textContent='';
      if(name.length<2){ msg.textContent='Entre ton nom.'; return; }
      var digits=phone.replace(/[^0-9]/g,'').replace(/^221/,'');
      if(!/^7[05678][0-9]{7}$/.test(digits)){ msg.textContent='Num\xe9ro invalide (ex\xa0: 77 123 45 67).'; return; }
      if(!note){ msg.textContent='Indique ton adresse ou \xe9cris "retrait sur place".'; return; }
      var items=[]; for(var k in cart){ var it=cart[k]; if(it.dsId) items.push({dailySpecialId:it.dsId, qty:it.qty}); else if(cartVariants[k]){ var v=cartVariants[k]; var vi={productId:v.productId, qty:it.qty}; if(v.selectedSize) vi.selectedSize=v.selectedSize; if(v.selectedColor) vi.selectedColor=v.selectedColor; items.push(vi); } else items.push({productId:k, qty:it.qty}); }
      if(items.length===0){ msg.textContent='Ton panier est vide.'; return; }
      paying=true;
      var isW=(moyen==='wave');
      document.getElementById('step-form').style.display='none';
      document.getElementById('step-wait').style.display='';
      document.getElementById('waitTitle').textContent=isW?'Paiement Wave':'Paiement Orange Money';
      document.getElementById('waitSub').textContent='Connexion en cours…';
      document.getElementById('payOpen').style.display='none';
      var idem='web_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
      function send(vb64){
        // Si commande déjà créée pour ce shop, vérifier si payée avant d'en créer une nouvelle
        try {
          var saved=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');
          if(saved&&saved.orderId){
            fetch(CFG.url+'/functions/v1/create-guest-order?order='+encodeURIComponent(saved.orderId),{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}})
              .then(function(r){return r.json();}).then(function(d){
                if(d&&d.paid){ sessionStorage.removeItem(SESSION_KEY); window.location.href=saved.confUrl+'&s=ok'; return; }
                doSend(vb64);
              }).catch(function(){ doSend(vb64); });
            return;
          }
        } catch(e){}
        doSend(vb64);
      }
      function doSend(vb64){
        var payload={slug:CFG.slug, items:items, name:name, phone:digits, note:note, moyenPaiement:moyen, idempotencyKey:idem};
        if(vb64){ payload.voiceB64=vb64; payload.voiceMime=voiceMime; }
        fetch(CFG.url+'/functions/v1/create-guest-order',{
          method:'POST',
          headers:{'Content-Type':'application/json','apikey':CFG.key,'Authorization':'Bearer '+CFG.key},
          body:JSON.stringify(payload)
        }).then(function(r){return r.json();}).then(function(d){
          if(!d||!d.success){ throw new Error((d&&d.error)||'Erreur'); }
          var confUrl='https://s.lassi.tech/commande?id='+encodeURIComponent(d.orderId)+'&shop='+encodeURIComponent(CFG.slug);
          try{ sessionStorage.setItem(SESSION_KEY, JSON.stringify({orderId:d.orderId, confUrl:confUrl})); }catch(e){}
          if(d.mode==='simulation'){ sessionStorage.removeItem(SESSION_KEY); window.location.href=confUrl+'&s=ok'; return; }
          var a=document.getElementById('payOpen');
          if(d.qrCode){
            // OM : QR code + bouton deeplink (pas de redirect auto — évite la page Maxit inutile)
            document.getElementById('waitSub').textContent='Scanne ce QR code avec Orange Money ou clique sur le bouton.';
            var img=document.getElementById('omQr');
            img.src=(String(d.qrCode).indexOf('data:')===0?d.qrCode:'data:image/png;base64,'+d.qrCode);
            img.hidden=false;
            if(d.redirectUrl){ a.textContent='Ouvrir Orange Money'; a.href=d.redirectUrl; a.style.display='inline-block'; }
            else { a.style.display='none'; }
          } else if(d.redirectUrl){
            a.textContent=isW?'Payer avec Wave':'Ouvrir Orange Money';
            a.href=d.redirectUrl; a.style.display='inline-block';
            document.getElementById('waitSub').textContent=isW?'Clique sur le bouton, paie dans Wave, puis reviens ici — la page se met \xe0 jour automatiquement.':'Valide le paiement dans Orange Money, puis reviens sur cette page.';
          } else {
            a.style.display='none';
          }
          pollStatus(d.orderId, confUrl);
        }).catch(function(e){
          paying=false;
          document.getElementById('step-wait').style.display='none';
          document.getElementById('step-form').style.display='';
          document.querySelectorAll('#sheet .pay').forEach(function(x){x.disabled=false;});
          document.getElementById('msg').textContent=e.message||'Une erreur est survenue. R\xe9essaie.';
        });
      }
      if(voiceBlob){ blobToB64(voiceBlob, function(b64){ send(b64||null); }); }
      else{ send(null); }
    });
  });

  function checkOnce(orderId, confUrl, iv, dbFails){
    var useVerify = (dbFails||0) >= 5;
    var url = useVerify
      ? CFG.url+'/functions/v1/create-guest-order?verify_order='+encodeURIComponent(orderId)
      : CFG.url+'/functions/v1/create-guest-order?order='+encodeURIComponent(orderId);
    return fetch(url,{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}})
      .then(function(r){return r.json();}).then(function(d){
        if(d && d.paid){ if(iv) clearInterval(iv); try{sessionStorage.removeItem(SESSION_KEY);}catch(e){} window.location.href=confUrl+'&s=ok'; return true; }
        return false;
      }).catch(function(){ return false; });
  }
  function pollStatus(orderId, confUrl){
    var tries=0, dbFails=0;
    var iv=setInterval(function(){
      tries++;
      checkOnce(orderId, confUrl, iv, dbFails).then(function(paid){ if(!paid) dbFails++; });
      if(tries>80){ clearInterval(iv); document.getElementById('waitMsg').textContent='Si tu as payé, ta commande est déjà confirmée. Tu peux fermer cette page.'; }
    }, 3000);
    // Retour sur la page (après l'app de paiement) → vérifier tout de suite.
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkOnce(orderId, confUrl, iv, dbFails); });
    var cn=document.getElementById('checkNow');
    if(cn) cn.addEventListener('click', function(){ checkOnce(orderId, confUrl, iv, Math.max(dbFails, 5)); });
  }
})();
`;

// ── JS client : réservation beauté (dates + créneaux + paiement) ─────────────
const BOOKING_JS = `
(function(){
  var cfgEl=document.getElementById('cfg'); if(!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var sheet=document.getElementById('bsheet'); if(!sheet) return;
  var DAYS=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  var MONTHS=['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  var cur={id:null,name:'',price:0,date:null,slot:null,moyen:'wave'};
  var idem='wr_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
  function pad(n){ return (n<10?'0':'')+n; }
  function dstr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function fmt(n){ return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ')+' F'; }

  function openSheet(el){
    cur.id=el.getAttribute('data-svc');
    cur.name=el.getAttribute('data-name')||'Prestation';
    cur.price=parseInt(el.getAttribute('data-price'),10)||0;
    cur.date=null; cur.slot=null; cur.moyen='wave';
    idem='wr_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
    document.getElementById('bTitle').textContent=cur.name;
    document.getElementById('bSub').textContent='Réserve ton créneau · '+fmt(cur.price);
    document.getElementById('bstep-form').style.display='';
    document.getElementById('bstep-wait').style.display='none';
    document.getElementById('bMsg').textContent='';
    document.querySelectorAll('#bsheet .pay').forEach(function(p){ p.classList.remove('sel'); });
    buildDates();
    document.getElementById('bSlots').innerHTML='<span class="bhint">Choisis d\\'abord une date</span>';
    sheet.classList.add('open');
  }
  function buildDates(){
    var wrap=document.getElementById('bDates'); wrap.innerHTML='';
    var now=new Date();
    for(var i=0;i<14;i++){
      var d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
      var b=document.createElement('button'); b.type='button'; b.className='bdate';
      b.setAttribute('data-d', dstr(d));
      b.innerHTML='<b>'+DAYS[d.getDay()]+'</b><i>'+d.getDate()+'</i><small>'+MONTHS[d.getMonth()]+'</small>';
      b.addEventListener('click', function(){ selectDate(this); });
      wrap.appendChild(b);
    }
  }
  function selectDate(btn){
    cur.date=btn.getAttribute('data-d'); cur.slot=null;
    document.querySelectorAll('#bDates .bdate').forEach(function(x){ x.classList.remove('on'); });
    btn.classList.add('on');
    loadSlots();
  }
  function loadSlots(){
    var box=document.getElementById('bSlots');
    box.innerHTML='<span class="bhint">Chargement…</span>';
    fetch(CFG.url+'/functions/v1/create-guest-reservation?slug='+encodeURIComponent(CFG.slug)+'&service='+encodeURIComponent(cur.id)+'&date='+encodeURIComponent(cur.date),{headers:{apikey:CFG.key,Authorization:'Bearer '+CFG.key}})
      .then(function(r){return r.json();}).then(function(d){
        if(!d||!d.success){ box.innerHTML='<span class="bhint">Indisponible</span>'; return; }
        if(d.closed){ box.innerHTML='<span class="bhint">Fermé ce jour-là</span>'; return; }
        if(!d.slots||!d.slots.length){ box.innerHTML='<span class="bhint">Aucun créneau libre ce jour</span>'; return; }
        box.innerHTML='';
        d.slots.forEach(function(s){
          var b=document.createElement('button'); b.type='button'; b.className='bslot';
          b.textContent=s.debut; b.setAttribute('data-deb',s.debut);
          b.addEventListener('click', function(){
            cur.slot=this.getAttribute('data-deb');
            document.querySelectorAll('#bSlots .bslot').forEach(function(x){x.classList.remove('on');});
            this.classList.add('on');
          });
          box.appendChild(b);
        });
      }).catch(function(){ box.innerHTML='<span class="bhint">Erreur réseau</span>'; });
  }

  document.querySelectorAll('.prod.svc.book .bookbtn').forEach(function(btn){
    btn.addEventListener('click', function(){ openSheet(this.closest('.prod.svc.book')); });
  });
  document.getElementById('bClose').addEventListener('click', function(){ sheet.classList.remove('open'); });
  var bPaying=false;
  var bPhoneInput=document.getElementById('bPhone');
  if(bPhoneInput){
    bPhoneInput.addEventListener('input', function(){
      var v=this.value.replace(/\D/g,'');
      if(v.startsWith('221')) v=v.slice(3);
      this.value=v.slice(0,9);
    });
    bPhoneInput.addEventListener('blur', function(){
      var v=this.value.replace(/\D/g,'');
      if(v.startsWith('221')) v=v.slice(3);
      v=v.slice(0,9);
      var fmt='';
      if(v.length>0) fmt=v.slice(0,2);
      if(v.length>2) fmt+=' '+v.slice(2,5);
      if(v.length>5) fmt+=' '+v.slice(5,7);
      if(v.length>7) fmt+=' '+v.slice(7,9);
      this.value=fmt;
    });
  }
  document.querySelectorAll('#bsheet .pay').forEach(function(b){
    b.addEventListener('click', function(){
      if(bPaying) return;
      document.querySelectorAll('#bsheet .pay').forEach(function(x){x.classList.remove('sel');});
      b.classList.add('sel'); cur.moyen=b.getAttribute('data-bm');
      var msg=document.getElementById('bMsg'); msg.textContent='';
      if(!cur.date){ msg.textContent='Choisis une date.'; return; }
      if(!cur.slot){ msg.textContent='Choisis un cr\xe9neau.'; return; }
      var name=document.getElementById('bName').value.trim();
      var phone=document.getElementById('bPhone').value.trim();
      if(name.length<2){ msg.textContent='Entre ton nom.'; return; }
      var digits=phone.replace(/[^0-9]/g,'').replace(/^221/,'');
      if(!/^7[05678][0-9]{7}$/.test(digits)){ msg.textContent='Num\xe9ro invalide (ex\xa0: 77 123 45 67).'; return; }
      bPaying=true;
      var isW=(cur.moyen==='wave');
      document.getElementById('bstep-form').style.display='none';
      document.getElementById('bstep-wait').style.display='';
      document.getElementById('bWaitTitle').textContent=isW?'Paiement Wave':'Paiement Orange Money';
      document.getElementById('bWaitSub').textContent='Connexion en cours…';
      document.getElementById('bPayOpen').style.display='none';
      fetch(CFG.url+'/functions/v1/create-guest-reservation',{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':CFG.key,'Authorization':'Bearer '+CFG.key},
        body:JSON.stringify({slug:CFG.slug, serviceId:cur.id, date:cur.date, slotDebut:cur.slot, name:name, phone:digits, moyenPaiement:cur.moyen, idempotencyKey:idem})
      }).then(function(r){return r.json();}).then(function(d){
        if(!d||!d.success){ throw new Error((d&&d.error)||'Erreur'); }
        var confUrl='https://s.lassi.tech/commande?id='+encodeURIComponent(d.reservationId)+'&shop='+encodeURIComponent(CFG.slug)+'&type=beauty';
        if(d.mode==='simulation'){ window.location.href=confUrl+'&s=ok'; return; }
        var a=document.getElementById('bPayOpen');
        if(d.redirectUrl){
          document.getElementById('bWaitSub').textContent=isW
            ? 'Valide le paiement dans Wave, puis reviens sur cette page.'
            : 'Valide le paiement dans Orange Money, puis reviens sur cette page.';
          a.textContent=isW?'Rouvrir Wave':'Rouvrir Orange Money';
          a.href=d.redirectUrl; a.style.display='inline-block';
        } else { a.style.display='none'; }
        if(d.qrCode){
          document.getElementById('bWaitSub').textContent='Scanne ce QR code avec Orange Money.';
          var img=document.getElementById('bOmQr');
          img.src=(String(d.qrCode).indexOf('data:')===0?d.qrCode:'data:image/png;base64,'+d.qrCode);
          img.hidden=false;
        }
        pollBeauty(d.reservationId, confUrl);
      }).catch(function(e){
        bPaying=false;
        document.getElementById('bstep-wait').style.display='none';
        document.getElementById('bstep-form').style.display='';
        document.querySelectorAll('#bsheet .pay').forEach(function(x){x.disabled=false;});
        msg.textContent=e.message||'Une erreur est survenue. R\xe9essaie.';
      });
    });
  });

  function checkOnce(id, confUrl, iv){
    return fetch(CFG.url+'/functions/v1/create-guest-reservation?status='+encodeURIComponent(id),{headers:{apikey:CFG.key,Authorization:'Bearer '+CFG.key}})
      .then(function(r){return r.json();}).then(function(d){
        if(d&&d.paid){ if(iv) clearInterval(iv); window.location.href=confUrl+'&s=ok'; return true; }
        return false;
      }).catch(function(){ return false; });
  }
  function pollBeauty(id, confUrl){
    var tries=0;
    var iv=setInterval(function(){ tries++; checkOnce(id,confUrl,iv); if(tries>80){ clearInterval(iv); document.getElementById('bWaitMsg').textContent='Si tu as payé, ta réservation est confirmée. Tu peux fermer cette page.'; } },3000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkOnce(id,confUrl,iv); });
    var cn=document.getElementById('bCheckNow'); if(cn) cn.addEventListener('click', function(){ checkOnce(id,confUrl,iv); });
  }
})();
`;

// ── JS client : abonnement fitness invité ────────────────────────────────────
const SUBSCRIPTION_JS = `
(function(){
  var cfgEl=document.getElementById('cfg'); if(!cfgEl) return;
  var CFG=JSON.parse(cfgEl.textContent);
  var sheet=document.getElementById('abosheet'); if(!sheet) return;
  var cur={id:null,nom:'',prix:0,meta:'',moyen:'wave'};
  function fmt(n){ return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ')+' F'; }

  function openSheet(card){
    cur.id=card.getAttribute('data-offreid');
    cur.nom=card.getAttribute('data-nom')||'Offre';
    cur.prix=parseInt(card.getAttribute('data-prix'),10)||0;
    cur.meta=card.getAttribute('data-meta')||'';
    cur.moyen='';
    document.getElementById('aboTitle').textContent=cur.nom;
    document.getElementById('aboSub').textContent=CFG.shop+' \xB7 '+fmt(cur.prix);
    var linesHtml='<div class="line"><span>'+cur.nom+'</span><span></span></div>'+
      '<div class="line"><span>⏱ '+cur.meta+'</span><span></span></div>'+
      '<div class="line tot"><span>Total</span><span>'+fmt(cur.prix)+'</span></div>';
    document.getElementById('aboLines').innerHTML=linesHtml;
    document.getElementById('abostep-form').style.display='';
    document.getElementById('abostep-wait').style.display='none';
    document.getElementById('aboMsg').textContent='';
    document.querySelectorAll('#abosheet .pay').forEach(function(p){ p.classList.remove('sel'); });
    document.getElementById('abo-name').value='';
    document.getElementById('abo-phone').value='';
    sheet.classList.add('open');
  }

  document.querySelectorAll('.abocard .abo-btn').forEach(function(btn){
    btn.addEventListener('click', function(){ openSheet(this.closest('.abocard')); });
  });
  document.getElementById('aboClose').addEventListener('click', function(){ sheet.classList.remove('open'); });

  var aboPhoneInput=document.getElementById('abo-phone');
  aboPhoneInput.addEventListener('input', function(){
    var v=this.value.replace(/\\D/g,'');
    if(v.startsWith('221')) v=v.slice(3);
    this.value=v.slice(0,9);
  });
  aboPhoneInput.addEventListener('blur', function(){
    var v=this.value.replace(/\\D/g,'');
    if(v.startsWith('221')) v=v.slice(3);
    v=v.slice(0,9);
    var f='';
    if(v.length>0) f=v.slice(0,2);
    if(v.length>2) f+=' '+v.slice(2,5);
    if(v.length>5) f+=' '+v.slice(5,7);
    if(v.length>7) f+=' '+v.slice(7,9);
    this.value=f;
  });
  var aboPaying=false;

  function doPayment(){
    if(aboPaying) return;
    var name=document.getElementById('abo-name').value.trim();
    var phone=document.getElementById('abo-phone').value.replace(/\\D/g,'').replace(/^221/,'');
    var msg=document.getElementById('aboMsg');
    if(name.length<2){ msg.textContent='Entre ton nom.'; return; }
    if(!/^7[05678][0-9]{7}$/.test(phone)){ msg.textContent='Num\xe9ro invalide.'; return; }
    aboPaying=true;
    var isW=(cur.moyen==='wave');
    document.getElementById('abostep-form').style.display='none';
    document.getElementById('abostep-wait').style.display='';
    document.getElementById('aboWaitTitle').textContent=isW?'Paiement Wave':'Paiement Orange Money';
    document.getElementById('aboWaitSub').textContent='Connexion en cours…';
    document.getElementById('aboPayOpen').style.display='none';
    fetch(CFG.url+'/functions/v1/create-guest-subscription',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':CFG.key,'Authorization':'Bearer '+CFG.key},
      body:JSON.stringify({offreId:cur.id,name:name,phone:phone,moyenPaiement:cur.moyen,shopSlug:CFG.slug})
    }).then(function(r){return r.json();}).then(function(d){
      if(!d||!d.success){ throw new Error((d&&d.error)||'Erreur'); }
      var confUrl='https://s.lassi.tech/commande?id='+encodeURIComponent(d.piId)+'&shop='+encodeURIComponent(CFG.slug)+'&type=abonnement';
      if(d.mode==='simulation'){ window.location.href=confUrl+'&s=ok'; return; }
      var a=document.getElementById('aboPayOpen');
      if(d.redirectUrl){
        document.getElementById('aboWaitSub').textContent=isW
          ? 'Valide le paiement dans Wave, puis reviens sur cette page.'
          : 'Valide le paiement dans Orange Money, puis reviens sur cette page.';
        a.textContent=isW?'Rouvrir Wave':'Rouvrir Orange Money';
        a.href=d.redirectUrl; a.style.display='inline-block';
      } else { a.style.display='none'; }
      if(d.qrCode){
        document.getElementById('aboWaitSub').textContent='Scanne ce QR code avec Orange Money.';
        var img=document.getElementById('aboOmQr');
        img.src=(String(d.qrCode).indexOf('data:')===0?d.qrCode:'data:image/png;base64,'+d.qrCode);
        img.hidden=false;
      }
      pollAbo(d.piId, confUrl);
    }).catch(function(e){
      aboPaying=false;
      document.getElementById('abostep-wait').style.display='none';
      document.getElementById('abostep-form').style.display='';
      document.querySelectorAll('#abosheet .pay').forEach(function(x){x.classList.remove('sel');});
      cur.moyen='';
      document.getElementById('aboMsg').textContent=e.message||'Une erreur est survenue. R\xe9essaie.';
    });
  }

  document.querySelectorAll('#abosheet .pay').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('#abosheet .pay').forEach(function(x){x.classList.remove('sel');});
      b.classList.add('sel');
      cur.moyen=b.getAttribute('data-am');
      doPayment();
    });
  });

  function checkAboOnce(piId, confUrl, iv){
    return fetch(CFG.url+'/functions/v1/create-guest-subscription?pi='+encodeURIComponent(piId),{
      headers:{apikey:CFG.key,Authorization:'Bearer '+CFG.key}
    }).then(function(r){return r.json();}).then(function(d){
      if(d&&d.paid){ if(iv) clearInterval(iv); window.location.href=confUrl+'&s=ok'; return true; }
      return false;
    }).catch(function(){ return false; });
  }
  function pollAbo(piId, confUrl){
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      checkAboOnce(piId,confUrl,iv);
      if(tries>80){ clearInterval(iv); document.getElementById('aboWaitMsg').textContent='Si tu as pay\xe9, ton abonnement est actif. Tu peux fermer cette page.'; }
    }, 3000);
    document.addEventListener('visibilitychange', function(){ if(!document.hidden) checkAboOnce(piId,confUrl,iv); });
    var cn=document.getElementById('aboCheckNow');
    if(cn) cn.addEventListener('click', function(){ checkAboOnce(piId,confUrl,iv); });
  }
})();
`;

// ── JS client : page de confirmation (poll statut) ───────────────────────────
const CONFIRM_JS = `
(function(){
  var CFG = JSON.parse(document.getElementById('cfg').textContent);
  var mark=document.getElementById('mark'), t=document.getElementById('t'), d=document.getElementById('d'), home=document.getElementById('home');
  var OK_SVG='<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="34" fill="#FDCF34"/><path d="M22 37l10 10 18-20" fill="none" stroke="#14152A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var KO_SVG='<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="33" fill="none" stroke="#FF6B6B" stroke-width="4"/><path d="M26 26l20 20M46 26l-20 20" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/></svg>';
  var PENDING_SVG='<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="33" fill="none" stroke="#FDCF34" stroke-width="4"/><path d="M36 20v16l10 6" fill="none" stroke="#FDCF34" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var isBeauty = CFG.type==='beauty';
  var isAbo = CFG.type==='abonnement';
  var isTerrain = CFG.type==='terrain';
  var statusUrl = isBeauty
    ? CFG.url+'/functions/v1/create-guest-reservation?status='+encodeURIComponent(CFG.id)
    : isAbo
      ? CFG.url+'/functions/v1/create-guest-subscription?pi='+encodeURIComponent(CFG.id)
      : isTerrain
        ? CFG.url+'/functions/v1/create-guest-terrain-reservation?resa='+encodeURIComponent(CFG.id)
        : CFG.url+'/functions/v1/create-guest-order?order='+encodeURIComponent(CFG.id);
  function ok(){
    mark.innerHTML=OK_SVG;
    if(isTerrain){
      t.textContent='R\xe9servation confirm\xe9e';
      d.innerHTML='Pay\xe9 ! <span class="gold">Ton cr\xe9neau est r\xe9serv\xe9.</span> Pr\xe9sente-toi sur le terrain \xe0 l\\'heure choisie et montre le code \xe0 l\\'accueil.';
      if(CFG.id){fetch(CFG.url+'/functions/v1/create-guest-terrain-reservation?receipt='+encodeURIComponent(CFG.id),{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}}).then(function(r){return r.json();}).then(function(x){if(!x||!x.success)return;var fn=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v||'—';};fn('rc-nom',x.sport_emoji+' '+x.terrain_nom);fn('rc-duree',x.heure_debut+' → '+x.heure_fin);fn('rc-client',x.client_name);fn('rc-prest',x.prestataire_name);fn('rc-prix',x.montant_label);var lbls=document.querySelectorAll('.rcpt-row .rcpt-lbl');if(lbls[0])lbls[0].textContent='Terrain';if(lbls[1])lbls[1].textContent='Cr\xe9neau';var c=document.getElementById('receipt-card');if(c){var rDate=document.createElement('div');rDate.className='rcpt-row';rDate.innerHTML='<span class="rcpt-lbl">Date</span><span class="rcpt-val">'+String(x.date_label||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>';c.insertBefore(rDate,c.children[1]);var rCode=document.createElement('div');rCode.className='rcpt-row';rCode.innerHTML='<span class="rcpt-lbl">Code</span><span class="rcpt-val" style="font-family:monospace;letter-spacing:2.5px;color:#FDCF34;font-size:15px">'+String(x.receipt_code||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>';c.insertBefore(rCode,c.lastElementChild);c.style.display='block';}var recu=document.getElementById('recu');if(recu){recu.removeAttribute('download');recu.style.display='inline-flex';recu.addEventListener('click',function(ev){ev.preventDefault();var GOLD='#FDCF34',DARK='#14152A';function e2(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}var html='<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Re\xe7u terrain — LASSİ</title><style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#fff;color:'+DARK+';padding:40px 32px}.logo{font-size:22px;font-weight:800;letter-spacing:-1px;margin-bottom:4px}.logo span{color:'+GOLD+'}.logo-sub{font-size:11px;color:#999;margin-bottom:28px}h1{font-size:18px;font-weight:700;margin:0 0 4px}p.sub{color:#777;font-size:13px;margin:0 0 24px;line-height:1.5}.card{border:1.5px solid #e8e5de;border-radius:14px;padding:16px 18px;margin-bottom:20px}.row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0ede7;font-size:13px}.row:last-child{border-bottom:none;font-weight:700;font-size:14.5px;padding-top:10px}.lbl{color:#888;flex-shrink:0}.val{text-align:right;word-break:break-word}.code-box{text-align:center;margin:20px 0 6px}.code{font-family:monospace;font-size:22px;letter-spacing:4px;background:'+DARK+';color:'+GOLD+';padding:10px 20px;border-radius:10px;display:inline-block;font-weight:700}.hint{font-size:11px;color:#999;text-align:center;margin-bottom:16px}.pbtn{display:block;width:100%;margin:10px 0;background:'+GOLD+';color:'+DARK+';border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:700;cursor:pointer}.footer{font-size:11px;color:#bbb;text-align:center;border-top:1px solid #eee;padding-top:14px;margin-top:10px}@media print{.pbtn{display:none!important}body{padding:20px}}</style></head><body><div class="logo">LASS<span>İ</span></div><div class="logo-sub">lassi.tech — R\xe9servation terrain en ligne</div><h1>Re\xe7u de r\xe9servation</h1><p class="sub">Montre ce document \xe0 l\'accueil du terrain pour valider ton entr\xe9e.</p><div class="card"><div class="row"><span class="lbl">Terrain</span><span class="val">'+e2(x.sport_emoji+' '+x.terrain_nom)+'</span></div><div class="row"><span class="lbl">Date</span><span class="val">'+e2(x.date_label)+'</span></div><div class="row"><span class="lbl">Cr\xe9neau</span><span class="val">'+e2(x.heure_debut)+' → '+e2(x.heure_fin)+'</span></div><div class="row"><span class="lbl">Client</span><span class="val">'+e2(x.client_name)+'</span></div><div class="row"><span class="lbl">\xc9tablissement</span><span class="val">'+e2(x.prestataire_name)+'</span></div><div class="row"><span class="lbl">Montant pay\xe9</span><span class="val">'+e2(x.montant_label)+'</span></div></div><div class="code-box"><div class="code">'+e2(x.receipt_code)+'</div></div><div class="hint">Code unique — valide jusqu\'\xe0 la fin du cr\xe9neau</div><button class="pbtn" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="footer">LASSİ • lassi.tech • Transaction s\xe9curis\xe9e Wave / Orange Money</div></body></html>';try{var blob=new Blob([html],{type:'text/html;charset=utf-8'});var burl=URL.createObjectURL(blob);var w=window.open(burl,'_blank');if(w){setTimeout(function(){URL.revokeObjectURL(burl);},10000);}else{var a=document.createElement('a');a.href=burl;a.download='recu-terrain-lassi.html';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(burl);},5000);}}catch(e){alert('Code r\xe9servation : '+String(x.receipt_code||''));} });}}}).catch(function(){});}
    } else if(isBeauty){
      t.textContent='R\xe9servation confirm\xe9e';
      d.innerHTML='Pay\xe9 ! <span class="gold">Le prestataire a re\xe7u ta r\xe9servation</span> et te confirmera le rendez-vous. Pr\xe9sente-toi \xe0 l\\'heure choisie.';
    } else if(isAbo){
      t.textContent='Abonnement activ\xe9 !';
      d.innerHTML='<span class="gold">Ton abonnement est actif.</span> Pr\xe9sente-toi chez le prestataire avec ton num\xe9ro de t\xe9l\xe9phone pour valider l\\'acc\xe8s.';
      if(CFG.id){fetch(CFG.url+'/functions/v1/create-guest-subscription?receipt='+encodeURIComponent(CFG.id),{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}}).then(function(r){return r.json();}).then(function(x){if(!x||!x.success)return;var c=document.getElementById('receipt-card');var fn=function(id,v){var el=document.getElementById(id);if(el)el.textContent=v||'—';};fn('rc-nom',x.offre_nom);fn('rc-duree',x.duree_label);fn('rc-client',x.client_name);fn('rc-prest',x.prestataire_name);fn('rc-prix',x.prix_label);if(c)c.style.display='block';}).catch(function(){});var recu=document.getElementById('recu');if(recu){recu.style.display='inline-flex';recu.addEventListener('click',function(e){e.preventDefault();recu.style.opacity='0.5';fetch(CFG.url+'/functions/v1/create-guest-subscription?pdf='+encodeURIComponent(CFG.id),{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}}).then(function(r){return r.ok?r.blob():Promise.reject(r.status);}).then(function(b){var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='recu-abonnement-lassi.pdf';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},5000);}).catch(function(){alert('Erreur lors du t\xe9l\xe9chargement. R\xe9essaie.');}).finally(function(){recu.style.opacity='';});});}}
    } else {
      t.textContent='Commande confirm\xe9e';
      d.innerHTML='Merci ! <span class="gold">Le marchand a re\xe7u ta commande</span> et va te rappeler pour le retrait ou la livraison.';
      var recu=document.getElementById('recu'); if(recu){recu.style.display='none';} if(CFG.id){var _rt=0;function _waitOrd(){fetch(CFG.url+'/functions/v1/create-guest-order?order='+encodeURIComponent(CFG.id),{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}}).then(function(r){return r.json();}).then(function(x){if(x&&x.paid){if(recu){recu.href=CFG.url+'/functions/v1/create-guest-order?receipt='+encodeURIComponent(CFG.id)+'&apikey='+encodeURIComponent(CFG.key);recu.removeAttribute('download');recu.style.display='inline-flex';}}else if(_rt<12){_rt++;setTimeout(_waitOrd,2500);}}).catch(function(){if(_rt<12){_rt++;setTimeout(_waitOrd,2500);}});}  _waitOrd();}
    }
    home.style.display='inline-block';
  }
  function fail(){ mark.innerHTML=KO_SVG; t.textContent='Paiement non abouti'; d.textContent=isTerrain?'Ta r\xe9servation n\\'a pas \xe9t\xe9 pay\xe9e. Tu peux r\xe9essayer.':isAbo?'Ton abonnement n\\'a pas \xe9t\xe9 pay\xe9. Tu peux r\xe9essayer depuis la boutique.':isBeauty?'Ta r\xe9servation n\\'a pas \xe9t\xe9 pay\xe9e. Tu peux r\xe9essayer depuis la boutique.':'Ta commande n\\'a pas \xe9t\xe9 pay\xe9e. Tu peux r\xe9essayer depuis la boutique.'; home.style.display='inline-block'; }
  if(CFG.s==='ko'){ fail(); return; }
  ok();
})();
`;

// ── Page réservation terrain invité web ───────────────────────────────────────
function renderTerrainPage(url: URL): string {
  const terrainId = (url.searchParams.get('id') ?? '').trim();
  const cfg = JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_ANON_KEY, terrainId });
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Réserver un terrain — LASSİ</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  [hidden]{display:none !important}
  :root{--y:${BRAND_GOLD};--d:#14152A;--w:#fff;--g:#f5f4f0;--m:#8a8880;--b:#e8e5de;--fh:'Cormorant Garamond',Georgia,serif;--fb:'DM Sans',system-ui,sans-serif}
  body{background:var(--w);color:var(--d);font-family:var(--fb);font-size:15px;padding-bottom:40px}
  .hdr{background:var(--d);color:#fff;padding:28px 24px 24px;min-height:140px;display:flex;flex-direction:column;justify-content:flex-end}
  .hdr-sport{font-size:32px;margin-bottom:8px}
  .hdr-nom{font-family:var(--fh);font-size:clamp(26px,5vw,40px);font-weight:300;line-height:1.1;color:#fff}
  .hdr-addr{font-size:13px;color:rgba(255,255,255,.6);margin-top:6px}
  .hdr-prix{margin-top:12px;font-size:14px;color:var(--y);font-weight:600}
  .wrap{max-width:600px;margin:0 auto;padding:28px 20px}
  .sec-label{font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--m);margin-bottom:12px}
  .dates{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;margin-bottom:28px}
  .dates::-webkit-scrollbar{display:none}
  .dchip{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:1px;background:var(--g);border:1.5px solid var(--b);border-radius:12px;padding:8px 11px;cursor:pointer;font-family:inherit}
  .dchip b{font-size:11px;font-weight:600;color:var(--m)}
  .dchip i{font-style:normal;font-size:18px;font-weight:700;color:var(--d)}
  .dchip small{font-size:10px;color:var(--m)}
  .dchip.on{background:var(--y);border-color:var(--y)}
  .dchip.on b,.dchip.on i,.dchip.on small{color:var(--d)}
  .durs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px}
  .dur{flex:0 0 auto;padding:9px 20px;border-radius:999px;border:1.5px solid var(--b);background:transparent;color:var(--d);font-size:13px;font-weight:500;cursor:pointer;font-family:inherit}
  .dur.on{background:var(--d);border-color:var(--d);color:#fff}
  .slots{display:flex;flex-wrap:wrap;gap:8px;min-height:24px;margin-bottom:28px}
  .slot{background:var(--g);border:1.5px solid var(--b);border-radius:9px;padding:10px 16px;color:var(--d);font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
  .slot.on{background:var(--y);border-color:var(--y)}
  .hint{font-size:13px;color:var(--m);padding:8px 0}
  .divider{height:1px;background:var(--b);margin:4px 0 28px}
  .fld{margin-bottom:14px}
  .fld label{display:block;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--m);margin-bottom:6px}
  .fld input{width:100%;background:var(--g);border:1.5px solid var(--b);border-radius:11px;padding:13px;color:var(--d);font-size:15px;font-family:inherit}
  .pays{display:flex;gap:10px;margin-bottom:16px}
  .pay{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;border:1.5px solid var(--b);background:var(--g);color:var(--d);font-weight:600;font-size:14px;font-family:inherit;cursor:pointer}
  .pay img{width:26px;height:26px;flex:0 0 auto;border-radius:7px;object-fit:cover}
  .pay.sel{border-color:var(--d);background:var(--w)}
  .recap{background:var(--g);border:1.5px solid var(--b);border-radius:14px;padding:14px 16px;margin-bottom:16px}
  .recap-row{display:flex;justify-content:space-between;font-size:14px;padding:4px 0}
  .recap-tot{font-weight:700;border-top:1px solid var(--b);margin-top:6px;padding-top:8px}
  .payer{width:100%;background:var(--d);color:#fff;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit}
  .payer[disabled]{opacity:.5}
  .msg{color:#dc2626;font-size:13px;margin:10px 0 0;min-height:16px;text-align:center}
  .sheet{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}
  .sheet.open{display:flex}
  .panel{width:100%;max-width:560px;background:var(--w);border-radius:22px 22px 0 0;padding:24px 22px calc(24px + env(safe-area-inset-bottom));max-height:90vh;overflow:auto;position:relative}
  .panel h2{font-family:var(--fh);font-size:24px;font-weight:400;margin-bottom:4px}
  .panel .sub{color:var(--m);font-size:13px;margin-bottom:18px}
  .close{position:absolute;top:16px;right:18px;background:var(--g);border:none;color:var(--d);font-size:18px;cursor:pointer;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .waiting{text-align:center;padding:10px 0}
  .spin{width:34px;height:34px;border:2.5px solid var(--b);border-top-color:var(--d);border-radius:50%;margin:16px auto;animation:sp 1s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .payopen{display:inline-block;margin:12px auto 8px;background:var(--y);color:var(--d);padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;font-size:15px}
  #t-loader{display:flex;align-items:center;justify-content:center;min-height:200px}
  #t-content{display:none}
  #t-notfound{display:none;padding:40px 20px;text-align:center;color:var(--m)}
</style>
</head>
<body>
  <div id="t-loader"><div class="spin" style="width:44px;height:44px;border-width:3px"></div></div>
  <div id="t-notfound"><h2>Terrain introuvable</h2><p style="margin-top:10px">Ce terrain n'est plus disponible.</p></div>
  <div id="t-content">
    <div class="hdr">
      <div class="hdr-sport" id="t-sport"></div>
      <div class="hdr-nom" id="t-nom">Chargement…</div>
      <div class="hdr-addr" id="t-addr"></div>
      <div class="hdr-prix" id="t-prix"></div>
    </div>
    <div class="wrap">
      <div class="sec-label">Choisis une date</div>
      <div class="dates" id="t-dates"></div>
      <div class="sec-label">Durée</div>
      <div class="durs" id="t-durs"></div>
      <div class="sec-label">Créneaux disponibles</div>
      <div class="slots" id="t-slots"><span class="hint">Choisis une date et une durée</span></div>
      <div class="divider"></div>
    </div>
  </div>
  <div class="sheet" id="t-sheet">
    <div class="panel">
      <button class="close" id="t-close" type="button">×</button>
      <div id="ts-form">
        <h2 id="t-stitle">Réserver</h2>
        <p class="sub" id="t-ssub">Paiement sécurisé Wave / Orange Money</p>
        <div class="recap" id="t-recap"></div>
        <div class="fld"><label>Ton nom complet *</label><input id="t-name" type="text" placeholder="Ex : Awa Diop" maxlength="80" autocomplete="name"></div>
        <div class="fld"><label>Téléphone *</label><input id="t-phone" type="text" inputmode="numeric" placeholder="77 123 45 67" maxlength="14" autocomplete="off"></div>
        <div class="fld"><label>Moyen de paiement *</label>
          <div class="pays">
            <button class="pay sel" type="button" data-tm="wave"><img src="/assets/wave.jpg" alt="Wave"><span>Wave</span></button>
            <button class="pay" type="button" data-tm="orange_money"><img src="/assets/om.png" alt="Orange Money"><span>Orange Money</span></button>
          </div>
        </div>
        <p class="msg" id="t-msg"></p>
        <button class="payer" id="t-pay" type="button" disabled>Payer</button>
      </div>
      <div id="ts-wait" style="display:none" class="waiting">
        <h2 id="t-wtitle">Paiement en cours</h2>
        <p class="sub" id="t-wsub">Valide le paiement, puis reviens ici.</p>
        <a class="payopen" id="t-wopen" style="display:none" href="#">Payer</a>
        <img id="t-wqr" alt="QR paiement" hidden style="width:210px;height:210px;border-radius:14px;background:var(--g);padding:8px;margin:12px auto;display:block">
        <div class="spin"></div>
        <button class="pay" id="t-wcheck" type="button" style="margin-top:8px;width:auto;padding:10px 20px">J'ai payé — vérifier</button>
      </div>
    </div>
  </div>
  <script id="cfg" type="application/json">${cfg}</script>
  <script>${safeScript(TERRAIN_JS)}</script>
</body></html>`;
}

// ── JS client terrain ─────────────────────────────────────────────────────────
const TERRAIN_JS = `
(function(){
  var CFG = JSON.parse(document.getElementById('cfg').textContent);
  var EF  = CFG.url + '/functions/v1/create-guest-terrain-reservation';
  var KEY = CFG.key;
  var tid = CFG.terrainId;
  var H   = { 'apikey': KEY, 'Authorization': 'Bearer '+KEY };
  var SPORT_EMOJI = { football:'\\u26BD', basketball:'\\uD83C\\uDFC0', tennis:'\\uD83C\\uDFBE', volleyball:'\\uD83C\\uDFD0', autre:'\\uD83C\\uDFDF' };
  var DAYS  = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  var MONTHS= ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  var DURS  = [{l:'1h',v:60},{l:'1h30',v:90},{l:'2h',v:120},{l:'2h30',v:150},{l:'3h',v:180}];

  var state = { date:null, dur:60, slot:null, moyen:'wave', prixBase:0, prixTotal:0, paying:false };
  var resaId = null;

  function pad(n){ return (n<10?'0':'')+n; }
  function dstr(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  function fmt(n){ return String(Math.round(n)).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ')+' F'; }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function showLoader(on){ document.getElementById('t-loader').style.display=on?'flex':'none'; }
  function showContent(on){ document.getElementById('t-content').style.display=on?'block':'none'; }
  function showNotFound(){ document.getElementById('t-loader').style.display='none'; document.getElementById('t-notfound').style.display='block'; }

  // Charger terrain
  if(!tid){ showNotFound(); return; }

  fetch(EF+'?terrain_id='+encodeURIComponent(tid),{headers:H})
    .then(function(r){return r.json();})
    .then(function(d){
      if(!d.success||!d.terrain){ showNotFound(); return; }
      var t=d.terrain;
      state.prixBase=Math.round(Number(t.prix_horaire)||0);
      document.getElementById('t-sport').textContent=SPORT_EMOJI[t.sport_type]||'\\uD83C\\uDFDF';
      document.getElementById('t-nom').textContent=t.nom||'Terrain';
      if(t.adresse) document.getElementById('t-addr').textContent='\\uD83D\\uDCCD '+t.adresse;
      document.getElementById('t-prix').textContent=fmt(state.prixBase)+' / heure';
      buildDates();
      buildDurs();
      showLoader(false);
      showContent(true);
    })
    .catch(function(){ showNotFound(); });

  function buildDates(){
    var wrap=document.getElementById('t-dates'); wrap.innerHTML='';
    var now=new Date();
    for(var i=0;i<14;i++){
      var day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
      var b=document.createElement('button'); b.type='button'; b.className='dchip';
      b.setAttribute('data-d',dstr(day));
      b.innerHTML='<b>'+DAYS[day.getDay()]+'</b><i>'+day.getDate()+'</i><small>'+MONTHS[day.getMonth()]+'</small>';
      b.addEventListener('click',function(){ selectDate(this); });
      wrap.appendChild(b);
    }
  }

  function buildDurs(){
    var wrap=document.getElementById('t-durs'); wrap.innerHTML='';
    DURS.forEach(function(item){
      var b=document.createElement('button'); b.type='button'; b.className='dur'+(item.v===state.dur?' on':'');
      b.textContent=item.l; b.setAttribute('data-v',item.v);
      b.addEventListener('click',function(){
        state.dur=parseInt(this.getAttribute('data-v'),10);
        document.querySelectorAll('.dur').forEach(function(x){x.classList.remove('on');});
        this.classList.add('on');
        updatePrix();
        if(state.date) loadSlots();
      });
      wrap.appendChild(b);
    });
  }

  function updatePrix(){
    state.prixTotal = state.prixBase * (state.dur/60);
    state.prixTotal = Math.round(state.prixTotal) + Math.ceil(Math.round(state.prixTotal)*0.01);
  }

  function selectDate(btn){
    state.date=btn.getAttribute('data-d'); state.slot=null;
    document.querySelectorAll('.dchip').forEach(function(x){x.classList.remove('on');});
    btn.classList.add('on');
    loadSlots();
  }

  function loadSlots(){
    if(!state.date) return;
    var box=document.getElementById('t-slots');
    box.innerHTML='<span class="hint">Chargement\\u2026</span>';
    updatePrix();
    fetch(EF+'?terrain_id='+encodeURIComponent(tid)+'&date='+encodeURIComponent(state.date)+'&dur='+state.dur,{headers:H})
      .then(function(r){return r.json();})
      .then(function(d){
        if(!d.success){ box.innerHTML='<span class="hint">Erreur chargement</span>'; return; }
        if(d.closed){ box.innerHTML='<span class="hint">Fermé ce jour-là</span>'; return; }
        var slots=d.slots||[];
        if(!slots.length){ box.innerHTML='<span class="hint">Aucun créneau disponible</span>'; return; }
        box.innerHTML='';
        slots.forEach(function(s){
          var b=document.createElement('button'); b.type='button'; b.className='slot';
          b.textContent=s.debut+' - '+s.fin;
          b.setAttribute('data-deb',s.debut); b.setAttribute('data-fin',s.fin);
          b.addEventListener('click',function(){
            state.slot={debut:this.getAttribute('data-deb'),fin:this.getAttribute('data-fin')};
            document.querySelectorAll('.slot').forEach(function(x){x.classList.remove('on');});
            this.classList.add('on');
            openSheet();
          });
          box.appendChild(b);
        });
      })
      .catch(function(){ box.innerHTML='<span class="hint">Erreur chargement</span>'; });
  }

  function openSheet(){
    updatePrix();
    var nom=document.getElementById('t-nom').textContent||'Terrain';
    var d=new Date(state.date+'T12:00:00');
    var dateLabel=DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()];
    document.getElementById('t-stitle').textContent='Réserver';
    document.getElementById('t-ssub').textContent=nom+' · '+dateLabel;
    var durLabel='';
    DURS.forEach(function(item){if(item.v===state.dur) durLabel=item.l;});
    document.getElementById('t-recap').innerHTML=
      '<div class="recap-row"><span>Créneau</span><span>'+esc(state.slot.debut)+' - '+esc(state.slot.fin)+'</span></div>'+
      '<div class="recap-row"><span>Durée</span><span>'+esc(durLabel)+'</span></div>'+
      '<div class="recap-row recap-tot"><span>Total</span><span>'+fmt(state.prixTotal)+'</span></div>';
    document.getElementById('ts-form').style.display='';
    document.getElementById('ts-wait').style.display='none';
    document.getElementById('t-msg').textContent='';
    document.getElementById('t-pay').disabled=false;
    document.getElementById('t-sheet').classList.add('open');
  }

  document.getElementById('t-close').addEventListener('click',function(){
    document.getElementById('t-sheet').classList.remove('open');
  });

  // Moyen paiement
  state.moyen='wave';
  document.querySelectorAll('[data-tm]').forEach(function(b){
    b.addEventListener('click',function(){
      state.moyen=this.getAttribute('data-tm');
      document.querySelectorAll('[data-tm]').forEach(function(x){x.classList.remove('sel');});
      this.classList.add('sel');
    });
  });

  // Payer
  document.getElementById('t-pay').addEventListener('click',function(){
    if(state.paying) return;
    var name=document.getElementById('t-name').value.trim();
    var phone=document.getElementById('t-phone').value.replace(/[^0-9]/g,'').replace(/^221/,'');
    var msg=document.getElementById('t-msg');
    if(!name){ msg.textContent='Entre ton nom complet.'; return; }
    if(!/^7[05678][0-9]{7}$/.test(phone)){ msg.textContent='Numéro invalide (ex: 77 123 45 67).'; return; }
    if(!state.slot||!state.date){ msg.textContent='Créneau non sélectionné.'; return; }
    msg.textContent='';
    state.paying=true;
    document.getElementById('t-pay').disabled=true;
    fetch(EF,{
      method:'POST',
      headers:Object.assign({'Content-Type':'application/json'},H),
      body:JSON.stringify({
        terrainId:tid, date:state.date,
        heureDebut:state.slot.debut, dureeMinutes:state.dur,
        name:name, phone:phone,
        moyenPaiement:state.moyen,
        idem:'tw_'+Date.now()+'_'+Math.random().toString(36).slice(2,8)
      })
    })
    .then(function(r){return r.json();})
    .then(function(d){
      state.paying=false;
      if(!d.success){ msg.textContent=d.error||'Erreur. Réessaie.'; document.getElementById('t-pay').disabled=false; return; }
      resaId=d.resaId;
      document.getElementById('ts-form').style.display='none';
      document.getElementById('ts-wait').style.display='block';
      if(d.redirectUrl){
        var wBtn=document.getElementById('t-wopen');
        wBtn.href=d.redirectUrl;
        wBtn.textContent=state.moyen==='wave'?'Payer avec Wave':'Ouvrir Orange Money';
        wBtn.style.display='inline-block';
        document.getElementById('t-wsub').textContent=state.moyen==='wave'?'Clique sur le bouton, paie dans Wave, puis reviens ici.':'Valide le paiement dans Orange Money, puis reviens sur cette page.';
      }
      if(d.qrCode){
        var qrEl=document.getElementById('t-wqr');
        qrEl.src='data:image/png;base64,'+d.qrCode;
        qrEl.hidden=false;
      }
      startPoll();
    })
    .catch(function(){
      state.paying=false;
      document.getElementById('t-pay').disabled=false;
      document.getElementById('t-msg').textContent='Erreur réseau. Réessaie.';
    });
  });

  var SESSION_KEY_RESA='lassi_terrain_resa_'+tid;

  function goConfirm(rid){
    sessionStorage.removeItem(SESSION_KEY_RESA);
    window.location.href=window.location.origin+'/commande?id='+encodeURIComponent(rid)+'&type=terrain&s=ok';
  }

  function checkResaOnce(rid, iv){
    fetch(EF+'?resa='+encodeURIComponent(rid),{headers:H})
      .then(function(r){return r.json();})
      .then(function(x){
        if(x&&x.paid){ if(iv) clearInterval(iv); goConfirm(rid); }
      }).catch(function(){});
  }

  function startPoll(){
    if(!resaId) return;
    sessionStorage.setItem(SESSION_KEY_RESA, resaId);
    var tries=0;
    var iv=setInterval(function(){
      tries++;
      checkResaOnce(resaId, iv);
      if(tries>80){ clearInterval(iv); document.getElementById('t-wsub').textContent='Si tu as pay\xe9, ta r\xe9servation est confirm\xe9e. Tu peux fermer cette page.'; }
    },3000);
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) checkResaOnce(resaId, iv); });
  }

  document.getElementById('t-wcheck').addEventListener('click',function(){
    if(!resaId) return;
    checkResaOnce(resaId, null);
    document.getElementById('t-wsub').textContent='Vérification en cours…';
  });

  // Si page rechargée après paiement Wave/OM, relancer le suivi depuis sessionStorage
  (function recoverPendingResa(){
    var saved=sessionStorage.getItem(SESSION_KEY_RESA);
    if(!saved) return;
    resaId=saved;
    document.getElementById('ts-form').style.display='none';
    document.getElementById('ts-wait').style.display='block';
    document.getElementById('t-sheet').classList.add('open');
    document.getElementById('t-wsub').textContent='Vérification de ton paiement en cours…';
    startPoll();
    checkResaOnce(resaId, null);
  })();
})();
`;
