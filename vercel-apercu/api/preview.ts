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
  merchant_id: string | null; opening_hours: unknown; is_manually_closed: boolean | null;
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

  // Page de confirmation post-paiement (invité).
  if (slug === 'commande' || slug === 'merci') {
    return new Response(renderConfirmation(url), {
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
  const [products, services, terrains] = shop
    ? await Promise.all([fetchProducts(shop.id), fetchServices(shop.merchant_id), fetchTerrains(shop.merchant_id)])
    : [[], [], []];
  const dailySpecial = shop ? await fetchDailySpecials(shop.id) : [];

  if (!bot && shop) {
    const p = logClic(slug, detectSource(req));
    if (ctx?.waitUntil) ctx.waitUntil(p);
  }

  const base = `${url.protocol}//${url.host}`;
  return new Response(renderHtml(shop, products, services, terrains as Terrain[], slug, base, dailySpecial as { id: string; name: string; price: number; photo_url?: string | null }[]), {
    status: shop ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    },
  });
}

async function fetchShop(slug: string): Promise<Shop | null> {
  try {
    const q =
      `${SUPABASE_URL}/rest/v1/shops?slug=eq.${encodeURIComponent(slug)}` +
      `&select=id,name,logo_url,description,zone,category,subcategories,slug,merchant_id,opening_hours,is_manually_closed&limit=1`;
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
async function fetchServices(merchantId: string | null): Promise<ServiceItem[]> {
  if (!merchantId) return [];
  const H = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const mid = encodeURIComponent(merchantId);
  const out: ServiceItem[] = [];
  const [beauty, fitness] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/beauty_services?prestataire_id=eq.${mid}&actif=eq.true&order=created_at.asc&limit=48&select=id,nom,description,prix,duree_minutes,categorie,image_url`, { headers: H })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/fitness_abonnement_offres?prestataire_id=eq.${mid}&actif=eq.true&order=prix.asc&limit=48&select=id,nom,description,prix,duree_jours,categorie_tab`, { headers: H })
      .then(r => r.ok ? r.json() : []).catch(() => []),
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

async function fetchTerrains(merchantId: string | null): Promise<Terrain[]> {
  if (!merchantId) return [];
  try {
    const q = `${SUPABASE_URL}/rest/v1/terrains?prestataire_id=eq.${encodeURIComponent(merchantId)}&actif=eq.true&order=created_at.asc&limit=20&select=id,nom,description,prix_horaire,sport_type,adresse,images`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return [];
    return (await res.json()) as Terrain[];
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

function renderHtml(shop: Shop | null, products: Product[], services: ServiceItem[], terrains: Terrain[], slug: string, base: string, dailySpecial: { id: string; name: string; price: number; photo_url?: string | null }[] = []): string {
  const canonical = `${base}/${encodeURIComponent(slug)}`;
  if (!shop) {
    return page({
      title: 'Boutique introuvable — LASSİ', desc: "Cette boutique n'est plus disponible sur LASSİ.",
      ogImage: initialAvatar('LASSI'), canonical, base, name: 'Boutique introuvable', zone: '', cat: '', logo: '', slug, products: [], services: [], terrains: [], shopStatus: null, dailySpecial: [],
    });
  }
  const name = shop.name?.trim() || 'Boutique';
  const zone = shop.zone?.trim() || '';
  const cat = categoryLabel(shop.category, shop.subcategories);
  const logo = shop.logo_url?.trim() || '';
  const nb = products.length + services.length + terrains.length;
  const descRaw = shop.description?.trim() ||
    `Boutique vérifiée sur LASSİ${zone ? ' · ' + zone : ''}${cat ? ' · ' + cat : ''}.` +
      (nb ? ` ${nb} offre${nb > 1 ? 's' : ''} — commandez ou réservez.` : '');
  const shopStatus = computeShopStatus(shop.opening_hours, shop.is_manually_closed);
  return page({
    title: `${name} — sur LASSİ`, desc: clip(descRaw.replace(/\s+/g, ' '), 180),
    ogImage: logo || initialAvatar(name), canonical, base, name, zone, cat, logo, slug, products, services, terrains, shopStatus, dailySpecial,
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
      <div class="pprice">${fmtPrice(prixClient(base))}</div>
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
      <div class="pprice">${fmtPrice(prixClient(s.price))}</div>`;
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
      <div class="terrain-prix">${fmtPrice(prixClient)} <span class="terrain-unit">/ heure</span></div>
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
      <div class="aboprix">${fmtPrice(total)}</div>
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
}): string {
  const deep = `https://lassi.tech/p/${encodeURIComponent(o.slug)}`;
  const initial = (o.name.charAt(0) || '?').toUpperCase();
  const avatar = o.logo
    ? `<img class="shop-logo" src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">`
    : `<div class="logo-initial">${esc(initial)}</div>`;
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
        `<div class="ds-info"><div class="ds-name">${esc(ds.name)}</div><div class="ds-price">${fmtPrice(Math.ceil(ds.price * 1.01))}</div></div>` +
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

  const shopHeader = `
    <section class="hero">
      <div class="hero-left">
        ${o.cat ? `<div class="shop-cat">${esc(o.cat)}</div>` : ''}
        <h1 class="hero-title">${esc(o.name)}</h1>
        ${o.desc ? `<p class="hero-desc">${esc(clip(o.desc, 200))}</p>` : ''}
        ${hoursHtml ? `<div class="hours-block"><div class="hours-label">Horaires aujourd’hui</div>${hoursHtml}</div>` : ''}
      </div>
      <div class="hero-img">
        ${o.zone ? `<div class="zone-badge">📍 ${esc(o.zone)}</div>` : ''}
        ${avatar}
        <div class="verified-badge">✓ Boutique vérifiée sur LASSİ</div>
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
  const body = hasCatalog ? `
    ${shopHeader}
    ${closedNotice}
    <div class="catalog${catalogCls}">
      <h2 class="catalog-title">Faites-vous plaisir</h2>
      ${catnav}${dsSection}${grid}
      ${svcSection}
      ${terrainSection}
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
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  [hidden] { display:none !important; }
  :root { --y:${BRAND_GOLD}; --d:#14152A; --w:#FFFFFF; --g:#f5f4f0; --m:#8a8880; --b:#e8e5de; }
  body { background:var(--w); color:var(--d); font-family:'DM Sans',system-ui,sans-serif; font-size:15px; line-height:1.55; padding-bottom:${hasProducts ? '80px' : '0'}; }
  /* HERO */
  .hero { display:grid; grid-template-columns:1fr 1fr; min-height:80vh; align-items:stretch; }
  @media(max-width:680px){ .hero{grid-template-columns:1fr;min-height:auto;} .hero-img{order:-1;height:280px;} }
  .hero-left { display:flex; flex-direction:column; justify-content:center; padding:64px 52px 64px 48px; }
  @media(max-width:680px){ .hero-left{padding:36px 24px 32px;} }
  .shop-cat { font-size:11px; font-weight:500; letter-spacing:2.5px; text-transform:uppercase; color:var(--m); margin-bottom:18px; }
  .hero-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(36px,5vw,60px); font-weight:300; line-height:1.1; margin-bottom:22px; letter-spacing:-0.5px; }
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
  .hours-time { font-size:13px; color:var(--m); font-weight:300; margin-top:6px; }
  .hero-img { position:relative; background:#e8e7e3; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .shop-logo { width:80%; max-width:420px; aspect-ratio:1/1; object-fit:cover; border-radius:22%; }
  .logo-initial { width:min(60%,220px); aspect-ratio:1/1; border-radius:22%; display:flex; align-items:center; justify-content:center; background:var(--y); color:var(--d); font-family:'Cormorant Garamond',Georgia,serif; font-size:min(90px,16vw); font-weight:300; }
  .verified-badge { position:absolute; bottom:24px; right:24px; background:var(--y); color:var(--d); font-size:11px; font-weight:600; padding:6px 14px; border-radius:999px; }
  .zone-badge { position:absolute; top:24px; left:24px; background:rgba(255,255,255,.9); color:var(--d); font-size:12px; font-weight:500; padding:6px 14px; border-radius:999px; border:1px solid var(--b); }
  .divider { width:100%; height:1px; background:var(--b); }
  /* CATALOG */
  .catalog { max-width:1100px; margin:0 auto; padding:56px 32px 32px; }
  @media(max-width:680px){ .catalog{padding:36px 20px 20px;} }
  .catalog-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:clamp(28px,4vw,44px); font-weight:300; line-height:1.1; letter-spacing:-0.3px; margin-bottom:32px; }
  .catnav { display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none; margin-bottom:40px; }
  .catnav::-webkit-scrollbar { display:none; }
  .chip { flex:0 0 auto; padding:9px 20px; border-radius:999px; font-size:13px; font-weight:500; border:1.5px solid var(--b); background:transparent; color:var(--d); cursor:pointer; white-space:nowrap; font-family:inherit; }
  .chip.sel { background:var(--y); border-color:var(--y); }
  .catsec { margin-bottom:52px; }
  .cathead { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
  .cathead-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:22px; font-weight:400; }
  .cathead-count { font-size:12px; font-weight:500; color:var(--m); background:var(--g); padding:3px 10px; border-radius:999px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  @media(max-width:760px){ .grid{grid-template-columns:repeat(2,1fr);gap:14px;} }
  .prod { display:flex; flex-direction:column; border:1.5px solid var(--b); border-radius:18px; overflow:hidden; background:var(--w); }
  .prod.in { border-color:var(--y); }
  .pimgzone { width:100%; aspect-ratio:1/1; background:var(--g); display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
  .svc-imgzone { aspect-ratio:4/3; }
  .pimg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .pemoji { font-size:46px; }
  .pbody { padding:14px 16px 16px; display:flex; flex-direction:column; gap:4px; flex:1; }
  .pname { font-family:'Cormorant Garamond',Georgia,serif; font-size:16px; font-weight:400; line-height:1.2; }
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
  .ds-name { font-family:'Cormorant Garamond',Georgia,serif; font-size:16px; font-weight:400; }
  .ds-price { font-size:14px; font-weight:600; margin-top:4px; }
  .ds-btn { flex-shrink:0; background:var(--y); color:var(--d); font-size:14px; font-weight:700; border:none; border-radius:999px; padding:10px 18px; cursor:pointer; font-family:inherit; }
  .sectitle { font-family:'Cormorant Garamond',Georgia,serif; font-size:26px; font-weight:300; margin:40px 0 20px; }
  .appnote { font-family:'Cormorant Garamond',Georgia,serif; font-size:17px; font-weight:300; color:var(--m); margin:40px auto 16px; text-align:center; line-height:1.5; max-width:420px; padding:0 24px; }
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
  .panel h2 { font-family:'Cormorant Garamond',Georgia,serif; font-size:24px; font-weight:400; margin-bottom:4px; }
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
  .abonom { font-family:'Cormorant Garamond',Georgia,serif; font-size:16px; font-weight:400; color:var(--d); line-height:1.2; }
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
</style>
</head>
<body>
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
        <h2 id="aboTitle">S’abonner</h2>
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
        <button class="pay" id="aboCheckNow" type="button" style="margin-top:8px;width:auto;padding:10px 20px">J’ai pay\xe9 — v\xe9rifier</button>
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
  const recuDisplay = (isOk && id && !isTerrain && !isAbo) ? 'inline-flex' : 'none';
  const recuHref    = (isOk && id && !isTerrain && !isAbo) ? `${SUPABASE_URL}/functions/v1/create-guest-order?receipt=${encodeURIComponent(id)}&apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}` : '#';
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
      <a class="btn" id="home" href="${escAttr(retour)}" style="display:${homeDisplay}">Retour à la boutique</a>
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
            window.location.href=d.redirectUrl;
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
    if(cn) cn.addEventListener('click', function(){ checkOnce(orderId, confUrl, iv, dbFails); });
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
          window.location.replace(d.redirectUrl);
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
        window.location.replace(d.redirectUrl);
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
      var recu=document.getElementById('recu'); if(recu&&CFG.id){ recu.href=CFG.url+'/functions/v1/create-guest-order?receipt='+encodeURIComponent(CFG.id)+'&apikey='+encodeURIComponent(CFG.key); recu.style.display='inline-flex'; }
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
  :root{--y:${BRAND_GOLD};--d:#14152A;--w:#fff;--g:#f5f4f0;--m:#8a8880;--b:#e8e5de}
  body{background:var(--w);color:var(--d);font-family:'DM Sans',system-ui,sans-serif;font-size:15px;padding-bottom:40px}
  .hdr{background:var(--d);color:#fff;padding:28px 24px 24px;min-height:140px;display:flex;flex-direction:column;justify-content:flex-end}
  .hdr-sport{font-size:32px;margin-bottom:8px}
  .hdr-nom{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(26px,5vw,40px);font-weight:300;line-height:1.1;color:#fff}
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
  .panel h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:400;margin-bottom:4px}
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
        window.location.href=d.redirectUrl;
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
