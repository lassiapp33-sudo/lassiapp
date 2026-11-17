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
const SITE_TEMPLATES = ['classic', 'cosmetic', 'pottery', 'furniture', 'garderobe', 'sac']; // Phase 3 — #1 cosmetic (beauté), #2 pottery (artisanat), #3 furniture (maison & mobilier), #4 garderobe (mode / prêt-à-porter), #5 sac (maroquinerie / bagagerie)
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
  cafe_wass: 'Café ak Thé', beignet_fataya: 'Beignet ak Fataya', boulangerie: 'Boulangerie',
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
}
interface Product {
  id: string; name: string | null; description: string | null;
  emoji: string | null; photo_url: string | null; price: number | null;
  category: string | null;
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
      renderHtml(demo.shop, demo.products, [], [], demo.shop.slug, base, [], []),
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
    if (editMode) inject += EDIT_OVERLAY;
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
.led-a-fade{animation:ledFade .6s ease both}
.led-a-fade-up{animation:ledUp .6s ease both}
.led-a-fade-left{animation:ledLeft .6s ease both}
.led-a-zoom{animation:ledZoom .6s ease both}
.led-a-fade-right{animation:ledRight .6s ease both}
.led-a-pop{animation:ledPop .6s cubic-bezier(.34,1.56,.64,1) both}
.led-a-rotate{animation:ledRotate .6s ease both}
.led-a-blur{animation:ledBlur .7s ease both}
.led-a-flip{animation:ledFlip .7s ease both}
</style>
<script>(function(){
  var FONTS={cormorant:"'Cormorant Garamond',serif",playfair:"'Playfair Display',serif",lora:"Lora,serif",dmsans:"'DM Sans',sans-serif",inter:"Inter,sans-serif",poppins:"Poppins,sans-serif",montserrat:"Montserrat,sans-serif",spacegrotesk:"'Space Grotesk',sans-serif",rubik:"Rubik,sans-serif",unbounded:"Unbounded,cursive",plusjakarta:"'Plus Jakarta Sans',sans-serif",jost:"Jost,sans-serif",manrope:"Manrope,sans-serif",fraunces:"Fraunces,serif",bebas:"'Bebas Neue',sans-serif",outfit:"Outfit,sans-serif"};
  var ANIM={fade:'led-a-fade','fade-up':'led-a-fade-up','fade-left':'led-a-fade-left',zoom:'led-a-zoom','fade-right':'led-a-fade-right',pop:'led-a-pop',rotate:'led-a-rotate',blur:'led-a-blur',flip:'led-a-flip'};
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
    }catch(e){}
  };
})();</script>`;

// ─── Overlay mode édition ────────────────────────────────────────────────────
// Injecté après LED_CORE en contexte éditeur (draft + edit=1). Surligne les blocs,
// rend le texte éditable inline, et poste la sélection/les éditions à l'app RN.
const EDIT_OVERLAY = `<style id="lassi-edit-style">
.lassi-ed section,.lassi-ed nav{outline:1.5px dashed rgba(61,139,253,.4);outline-offset:-2px}
.lassi-ed [data-k]{cursor:text}
.lassi-ed [data-k].led-sel{outline:2px solid #3D8BFD;outline-offset:2px;border-radius:3px}
.lassi-ed nav.led-sel{outline:2.5px solid #3D8BFD;outline-offset:-2px}
.lassi-ed.lassi-preview section,.lassi-ed.lassi-preview nav{outline:none!important}
.lassi-ed.lassi-preview [data-k].led-sel{outline:none!important}
</style>
<script>(function(){
  var doc=document, body=doc.body; body.classList.add('lassi-ed');
  function post(m){try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(e){}}
  // S'assure que les clés existent même sans overrides (applique un objet vide).
  if(window.__ledApply) window.__ledApply({});
  var leaves=(window.__ledLeaves?window.__ledLeaves():[]);
  var sel=null;
  function selectLeaf(el){
    if(sel) sel.classList.remove('led-sel');
    sel=el; el.classList.add('led-sel');
    var cs=getComputedStyle(el), r=el.getBoundingClientRect();
    post({type:'led:text', key:el.getAttribute('data-k'),
      text:(el.textContent||'').trim().slice(0,200),
      size:Math.round(parseFloat(cs.fontSize)||16),
      color:rgbHex(cs.color), y:Math.round(r.top+window.scrollY)});
  }
  function rgbHex(c){var m=/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(c||'');if(!m)return '';function h(n){n=(+n).toString(16);return n.length<2?'0'+n:n;}return '#'+h(m[1])+h(m[2])+h(m[3]);}
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
  post({type:'led:ready'});
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
      `&select=id,name,logo_url,description,zone,category,subcategories,slug,shop_type,merchant_id,opening_hours,is_manually_closed,site_config,gallery_urls,cover_url,phone&limit=1`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Shop[];
    return rows[0] ?? null;
  } catch { return null; }
}

async function fetchProducts(shopId: string): Promise<Product[]> {
  try {
    const q =
      `${SUPABASE_URL}/rest/v1/products?shop_id=eq.${encodeURIComponent(shopId)}` +
      `&stock=eq.in&order=created_at.asc&limit=48&select=id,name,description,emoji,photo_url,price,category,sizes,colors,stock_quantity`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
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
function buildDemo(templateId: string, base: string): { shop: Shop; products: Product[] } {
  const t = SITE_TEMPLATES.indexOf(templateId) >= 0 ? templateId : 'cosmetic';
  const img = (f: string) => `${base}/assets/demo/${t}/${f}`;

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
  });
}

function productVisual(p: Product): string {
  const url = typeof p.photo_url === 'string' && p.photo_url.startsWith('http') ? p.photo_url : '';
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
  return `<div class="prod" data-id="${escAttr(p.id)}" data-name="${escAttr(p.name ?? '')}" data-base="${base}" data-sizes="${escAttr(sizesJson)}" data-colors="${escAttr(colorsJson)}" data-stock="${escAttr(stockAttr)}">
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
}): string {
  const deep = `https://lassi.tech/p/${encodeURIComponent(o.slug)}`;
  const theme = resolveTheme(o.siteConfig);
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
        <h1 class="hero-title">${esc(o.name)}</h1>
        ${o.desc ? `<p class="hero-desc">${esc(clip(o.desc, 200))}</p>` : ''}
        ${hoursHtml ? `<div class="hours-block"><div class="hours-label">Horaires aujourd'hui</div>${hoursHtml}</div>` : ''}
        ${promosHtml}
      </div>
      <div class="hero-img">
        ${o.zone ? `<div class="zone-badge">📍 ${esc(o.zone)}</div>` : ''}
        ${avatar}
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
      <h2 class="catalog-title">Faites-vous plaisir</h2>
      ${orderedSections}
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
      <div class="cx-stat"><b>${cxStatCount}+</b><span>${hasProducts ? 'Produits' : hasServices ? 'Prestations' : 'Terrains'}</span></div>
      <div class="cx-stat"><b>100%</b><span>Naturel &amp; bio</span></div>
      <div class="cx-stat"><b>24/7</b><span>Commande en ligne</span></div>
    </div>`;
  const cxBanners = `
    <section class="cx-banners">
      <a class="cx-banner" href="#cx-shop" ${bg(pick(1))}>
        <div class="cx-banner-in">
          <span class="cx-banner-k">Peau éclatante</span>
          <h3>Chacune mérite de se sentir belle et confiante</h3>
          <span class="cx-banner-cta">Acheter</span>
        </div>
      </a>
      <a class="cx-banner" href="#cx-shop" ${bg(pick(2))}>
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
      <div class="cx-best-grid">
        <div class="cx-best-feature" ${bg(pick(3))}>
          <div class="cx-best-feature-ov"></div>
          <div class="cx-best-feature-in">
            <span class="cx-eyebrow light">Soins naturels</span>
            <h3>Découvre le pouvoir de la beauté naturelle</h3>
            <a class="cx-btn light" href="#cx-shop">Voir la boutique</a>
          </div>
        </div>
        <div class="cx-best-products grid">
          ${o.products.slice(0, 6).map(productCard).join('')}
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
          <h2>Une peau éclatante<br>au quotidien</h2>
          <p>Des soins naturels, pensés pour révéler l'éclat de ta peau jour après jour.</p>
          <a class="cx-btn-outline" href="#cx-shop">En savoir plus</a>
        </div>
        <div class="cx-feature-seal"><span class="cx-seal-star">&#10038;</span><span class="cx-seal-txt">Produit<br>naturel</span></div>
      </div>
      <div class="cx-feature-hero"><img src="/assets/demo/cosmetic/feature.jpg" alt="Nos produits" loading="lazy"></div>
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
          <span class="cx-ic" title="Rechercher">&#9906;</span>
          <span class="cx-ic" title="Favoris">&#9825;</span>
          <a class="cx-ic cx-cart" href="#cx-shop" title="Panier">&#128717;</a>
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
      <div class="fn-rooms-grid">
        ${fnRoomItems.map((r, i) => `<a class="fn-room ${i === 0 ? 'big' : ''}" href="#cx-shop" ${bg(pick(i))}><span class="fn-chip"><b>${esc(r.title)}</b></span></a>`).join('')}
      </div>
    </div></section>` : '';
  const fnMaterials = gal.length >= 1 ? `
    <section class="fn-materials" id="fn-about"><div class="fn-mat">
      <div class="fn-mat-l">
        <h2>Un savoir-faire d'exception commence par les meilleures matières</h2>
        <p>${esc(clip(o.desc || `Matières nobles et finitions soignées. Chaque pièce de ${o.name} est pensée pour durer et traverser les années avec élégance.`, 170))}</p>
        <a class="fn-btn" href="#cx-shop">${cxHeadCta}</a>
      </div>
      <div class="fn-mat-gal"><div class="fn-mg" ${bg(pick(0))}></div><div class="fn-mg" ${bg(pick(1))}></div><div class="fn-mg" ${bg(pick(2))}></div></div>
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
        <div class="fn-search">&#9906; <span>Rechercher</span></div>
        <nav class="fn-nav">
          <a href="#fn-top">Accueil</a>
          <a href="#cx-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
          <a href="#fn-about">À propos</a>
          <a href="#fn-contact">Contact</a>
        </nav>
        <a class="fn-cart" href="#cx-shop">&#128722; <span>Panier</span></a>
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
  const gdPerks = `
    <section class="gd-perks"><div class="gd-perks-in">
      <div class="gd-perk"><div><b>Paiement sécurisé</b><small>Wave &amp; Orange Money</small></div></div>
      <div class="gd-perk"><div><b>Retrait / livraison</b><small>${esc(o.zone || 'À Dakar')}</small></div></div>
      <div class="gd-perk"><div><b>Qualité garantie</b><small>pièces sélectionnées</small></div></div>
      <div class="gd-perk"><div><b>Support client</b><small>rappel après commande</small></div></div>
    </div></section>`;
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
      <div class="gd-cats-grid">
        ${groups.slice(0, 3).map((g, i) => `<a class="gd-cat-card" href="#gd-shop" ${bg(pick(i))}><span class="gd-cat-ov"></span><span class="gd-cat-info"><small>${g.items.length} article${g.items.length > 1 ? 's' : ''}</small><b>${esc(g.title)}</b></span></a>`).join('')}
      </div>
    </div></section>` : '';
  // Bloc éditorial « la maison » — boîte sombre sur grand visuel + signature = nom boutique.
  const gdEditorial = gal.length >= 1 ? `
    <section class="gd-edito" id="gd-about">
      <div class="gd-edito-img" ${bg(pick(1))}></div>
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
      <div class="gd-deals-panel">
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
        <div class="gd-hero-cta"><a class="gd-btn" href="#gd-shop">${cxHeadCta === 'Commander' ? 'Explorer la boutique' : cxHeadCta}</a>${hoursHtml ? `<div class="gd-hours">${hoursHtml}</div>` : ''}</div>
      </div>
      <div class="gd-hero-r">
        ${heroImg ? `<img class="gd-hero-img" src="${escAttr(heroImg)}" alt="${escAttr(o.name)}">` : ''}
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
      <div class="sc-types-grid">
        ${scTypeItems.map((r, i) => {
          const d = (r.items[0]?.description || '').trim();
          const sub = d ? clip(d, 78) : `${r.items.length} modèle${r.items.length > 1 ? 's' : ''} disponible${r.items.length > 1 ? 's' : ''}`;
          return `<a class="sc-type" href="#sc-shop" ${bg(pick(i))}><span class="sc-type-ov"><b>${esc(r.title)}</b><small>${esc(sub)}</small></span></a>`;
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
        <div class="sc-head-side sc-head-social">${socialHtml || '<span class="sc-ic">&#9906;</span>'}</div>
        <a class="sc-logo" href="#sc-top">${o.logo ? `<img src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">` : `<span>${esc(o.name)}</span>`}</a>
        <div class="sc-head-side sc-head-tools"><span class="sc-ic" title="Rechercher">&#9906;</span><a class="sc-ic sc-cart" href="#sc-shop" title="Panier">&#128722;</a></div>
      </div>
      <nav class="sc-nav">
        <a class="sc-nav-active" href="#sc-top">Accueil</a>
        <a href="#sc-shop">${hasProducts ? 'Boutique' : hasTerrains ? 'Terrains' : 'Prestations'}</a>
        <a href="#sc-types">Catégories</a>
        <a href="#sc-about">À propos</a>
        <a href="#sc-contact">Contact</a>
      </nav>
    </header>
    <section class="sc-hero" ${bg(pick(0))}>
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
        var v=pb.getAttribute('data-video');
        if(v){ var lb=document.getElementById('sc-vlb'), vd=document.getElementById('sc-vlb-video'); if(lb){ lb.classList.add('on'); try{vd.currentTime=0;vd.play();}catch(e){} } }
        else { var t=document.querySelector(pb.getAttribute('data-scroll')); if(t) t.scrollIntoView({behavior:'smooth'}); }
      });
      var lb=document.getElementById('sc-vlb');
      if(lb){ function close(){ lb.classList.remove('on'); var vd=document.getElementById('sc-vlb-video'); try{vd.pause();}catch(e){} }
        lb.addEventListener('click',function(e){ if(e.target===lb||e.target.className==='sc-vlb-x') close(); });
      }
    })();</script>
    <section class="sc-feature"><div class="sc-feature-in">
      <div class="sc-fcard">
        <div class="sc-fcard-top"><img class="sc-avatar" src="${escAttr(o.logo || (o.slug === '__demo' ? `${o.base}/assets/demo/sac/avatar.jpg` : initialAvatar(o.name)))}" alt="${escAttr(o.name)}"><div><b>${esc(o.name)}</b><small>${esc(o.cat || o.zone || 'Maroquinerie')}</small></div></div>
        <h2>Le sac qui vous suit partout</h2>
        <p>${esc(clip(o.desc || `${o.name} sélectionne des pièces durables et bien finies. Commande en ligne, paiement sécurisé Wave & Orange Money, retrait ou livraison à Dakar.`, 170))}</p>
      </div>
      <div class="sc-promo" ${bg(pick(1))}><div class="sc-promo-ov">
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
    <section class="sc-about" id="sc-about"><div class="sc-about-in">
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

  const body = theme.template === 'furniture' && hasCatalog ? furnitureBody
    : theme.template === 'cosmetic' && hasCatalog ? cosmeticBody
    : theme.template === 'garderobe' && hasCatalog ? garderobeBody
    : theme.template === 'sac' && hasCatalog ? sacBody
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
  .pemoji { font-size:46px; }
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
  .cx-stat b { font-family:var(--fh); font-size:24px; font-weight:600; }
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
  .gd-perks{background:var(--d)}
  .gd-perks-in{max-width:1240px;margin:0 auto;padding:30px 28px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
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
  .sc-feature{max-width:1240px;margin:0 auto;padding:64px 28px 24px}
  .sc-feature-in{display:grid;grid-template-columns:1fr 1.1fr;gap:28px;align-items:stretch}
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
  .sc-about{max-width:1240px;margin:0 auto;padding:40px 28px 80px}
  .sc-about-in{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
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
    card.querySelector('.add').addEventListener('click', function(){
      if(hasVars){ openHabPicker(id,name,base,szJson,clJson,stockStr); }
      else{ change(id,name,base,1); }
    });
    if(!hasVars){
      card.querySelector('.plus').addEventListener('click', function(){ change(id,name,base,1); });
      card.querySelector('.minus').addEventListener('click', function(){ change(id,name,base,-1); });
    }
  });

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
