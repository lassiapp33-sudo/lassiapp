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

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.lassiapp.lassiapp';
const APPSTORE_URL = process.env.APPSTORE_URL || 'https://apps.apple.com/app/id6802453488';
const BRAND_BG = '#14152A';
const BRAND_GOLD = '#FDCF34';

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
}
// Prestation/service (non commandable via panier web — réservation/abonnement dans l'app).
interface ServiceItem {
  id: string; name: string; description: string | null;
  price: number; category: string; meta: string; kind: 'beauty' | 'fitness';
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

  if (!slug) return Response.redirect('https://lassi.tech', 302);

  const shop = await fetchShop(slug);
  const bot = isCrawler(req.headers.get('user-agent') ?? '');
  const [products, services] = shop
    ? await Promise.all([fetchProducts(shop.id), fetchServices(shop.merchant_id)])
    : [[], []];
  const dailySpecial = shop ? await fetchDailySpecials(shop.id) : [];

  if (!bot && shop) {
    const p = logClic(slug, detectSource(req));
    if (ctx?.waitUntil) ctx.waitUntil(p);
  }

  const base = `${url.protocol}//${url.host}`;
  return new Response(renderHtml(shop, products, services, slug, base, dailySpecial as { id: string; name: string; price: number }[]), {
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
      `&stock=eq.in&order=created_at.asc&limit=48&select=id,name,description,emoji,photo_url,price,category`;
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
    fetch(`${SUPABASE_URL}/rest/v1/beauty_services?prestataire_id=eq.${mid}&actif=eq.true&order=created_at.asc&limit=48&select=id,nom,description,prix,duree_minutes,categorie`, { headers: H })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/fitness_abonnement_offres?prestataire_id=eq.${mid}&actif=eq.true&order=prix.asc&limit=48&select=id,nom,description,prix,duree_jours`, { headers: H })
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
    });
  }
  for (const r of fitness ?? []) {
    const price = Math.round(Number(r.prix));
    const nom = String(r.nom ?? '').trim();
    if (!nom || !(price > 0)) continue;
    const dj = Number(r.duree_jours);
    out.push({
      id: String(r.id), name: nom, description: (r.description as string) ?? null, price,
      category: 'Abonnements', meta: dj > 0 ? `${Math.round(dj)} jours` : 'Abonnement', kind: 'fitness',
    });
  }
  return out;
}

async function fetchDailySpecials(shopId: string): Promise<{ id: string; name: string; price: number }[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = `${SUPABASE_URL}/rest/v1/daily_specials?shop_id=eq.${encodeURIComponent(shopId)}&date=eq.${today}&select=id,name,price&limit=20`;
    const res = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!res.ok) return [];
    return await res.json() as { id: string; name: string; price: number }[];
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
  return order.map(k => ({ title: prodCatTitle(normCatId(k)), items: map[k] }));
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

function renderHtml(shop: Shop | null, products: Product[], services: ServiceItem[], slug: string, base: string, dailySpecial: { id: string; name: string; price: number }[] = []): string {
  const canonical = `${base}/${encodeURIComponent(slug)}`;
  if (!shop) {
    return page({
      title: 'Boutique introuvable — LASSİ', desc: "Cette boutique n'est plus disponible sur LASSİ.",
      ogImage: initialAvatar('LASSI'), canonical, name: 'Boutique introuvable', zone: '', cat: '', logo: '', slug, products: [], services: [], shopStatus: null, dailySpecial: [],
    });
  }
  const name = shop.name?.trim() || 'Boutique';
  const zone = shop.zone?.trim() || '';
  const cat = categoryLabel(shop.category, shop.subcategories);
  const logo = shop.logo_url?.trim() || '';
  const nb = products.length + services.length;
  const descRaw = shop.description?.trim() ||
    `Boutique vérifiée sur LASSİ${zone ? ' · ' + zone : ''}${cat ? ' · ' + cat : ''}.` +
      (nb ? ` ${nb} offre${nb > 1 ? 's' : ''} — commandez ou réservez.` : '');
  const shopStatus = computeShopStatus(shop.opening_hours, shop.is_manually_closed);
  return page({
    title: `${name} — sur LASSİ`, desc: clip(descRaw.replace(/\s+/g, ' '), 180),
    ogImage: logo || initialAvatar(name), canonical, name, zone, cat, logo, slug, products, services, shopStatus, dailySpecial,
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
function productCard(p: Product): string {
  const base = Math.round(Number(p.price));
  const desc = (p.description ?? '').trim();
  return `<div class="prod" data-id="${escAttr(p.id)}" data-name="${escAttr(p.name ?? '')}" data-base="${base}">
    <div class="pimgzone">${productVisual(p)}</div>
    <div class="pbody">
      <div class="pname">${esc(clip(p.name ?? '', 48))}</div>
      ${desc ? `<div class="pdesc">${esc(clip(desc, 60))}</div>` : ''}
      <div class="pprice">${fmtPrice(prixClient(base))}</div>
      <div class="stepper" data-id="${escAttr(p.id)}">
        <button class="add" type="button" aria-label="Ajouter">Ajouter</button>
        <span class="qtybox" hidden><button class="minus" type="button">−</button><b class="q">0</b><button class="plus" type="button">+</button></span>
      </div>
    </div>
  </div>`;
}

// Carte prestation/service. Beauté = réservable sur le web (créneaux + Wave/OM).
// Fitness (abonnement) = CTA app (achat abonnement encore côté app).
function serviceCard(s: ServiceItem, deep: string): string {
  const sub = s.description ? `${s.meta} · ${s.description}` : s.meta;
  const visual = `<div class="pimgzone"><div class="pemoji">${s.kind === 'fitness' ? '🏋️' : '💇'}</div></div>`;
  const head = `<div class="pname">${esc(clip(s.name, 48))}</div>
      <div class="pdesc">${esc(clip(sub, 64))}</div>
      <div class="pprice">${fmtPrice(prixClient(s.price))}</div>`;
  if (s.kind === 'fitness') {
    return `<div class="prod svc">${visual}<div class="pbody">${head}
      <a class="svcbtn" href="${escAttr(deep)}">S'abonner dans l'app</a></div></div>`;
  }
  return `<div class="prod svc book" data-svc="${escAttr(s.id)}" data-name="${escAttr(s.name)}" data-price="${prixClient(s.price)}" data-meta="${escAttr(s.meta)}" data-min="${Math.max(0, Math.round(s.price))}">
    ${visual}<div class="pbody">${head}
      <button class="svcbtn bookbtn" type="button">Réserver</button></div></div>`;
}

function page(o: {
  title: string; desc: string; ogImage: string; canonical: string;
  name: string; zone: string; cat: string; logo: string; slug: string; products: Product[]; services: ServiceItem[];
  shopStatus: ShopStatusResult | null;
  dailySpecial: { id: string; name: string; price: number }[];
}): string {
  const deep = `https://lassi.tech/p/${encodeURIComponent(o.slug)}`;
  const initial = (o.name.charAt(0) || '?').toUpperCase();
  const avatar = o.logo
    ? `<img class="shop-logo" src="${escAttr(o.logo)}" alt="${escAttr(o.name)}">`
    : `<div class="logo-initial">${esc(initial)}</div>`;
  const hasProducts = o.products.length > 0;
  const hasServices = o.services.length > 0;
  const hasBeauty   = o.services.some(s => s.kind === 'beauty');
  const hasCatalog = hasProducts || hasServices;
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

  // Section prestations/services (beauté, fitness) — affichée en plus des produits.
  const svcGroups = groupServices(o.services);
  const svcSection = !hasServices ? '' :
    `<div class="sectitle">${hasProducts ? 'Prestations &amp; services' : 'Choisis ta prestation'} · ${o.services.length}</div>` +
    svcGroups.map(g =>
      `<div class="cathead"><span class="cathead-title">${esc(g.title)}</span><span class="cathead-count">${g.items.length}</span></div>` +
      `<div class="grid">${g.items.map(s => serviceCard(s, deep)).join('')}</div>`).join('');

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
        <div class="fld"><label>Adresse / précisions (optionnel)</label><textarea id="f-note" placeholder="Ex : Livraison Sacré-Cœur 3, villa 12 — ou retrait sur place"></textarea></div>
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
  ${(hasProducts || hasBeauty) ? `<script id="cfg" type="application/json">${cfg}</script>` : ''}
  ${hasProducts ? `<script>${CART_JS}</script>` : ''}
  ${hasBeauty ? `<script>${BOOKING_JS}</script>` : ''}
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
    <div id="mark"><div class="spin"></div></div>
    <h1 id="t">Vérification du paiement…</h1>
    <p id="d">Un instant, on confirme ta commande.</p>
    <div class="actions">
      <a class="btn" id="home" href="${escAttr(retour)}" style="display:none">Retour à la boutique</a>
      <a class="ghost" id="recu" download style="display:none"><svg viewBox="0 0 24 24"><path d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1zM5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"/></svg>Télécharger le reçu (PDF)</a>
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
  <script>${CONFIRM_JS}</script>
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
  const closeMin = toMin(today.close) || 1440;
  if (nowMin >= openMin && nowMin < closeMin) {
    // Vérifier pause
    if (today.pauseStart && today.pauseEnd) {
      const ps = toMin(today.pauseStart); const pe = toMin(today.pauseEnd);
      if (ps < pe && nowMin >= ps && nowMin < pe) {
        return { isOpen: false, isPause: true, label: 'En pause', pauseNextChange: 'Reprend à ' + fmtH(today.pauseEnd), todayOpen: today.open, todayClose: today.close, todayClosed: false };
      }
    }
    return { ...base, isOpen: true, label: 'Ouvert', todayOpen: today.open, todayClose: today.close, todayClosed: false };
  }
  if (nowMin < openMin) return { ...base, isOpen: false, label: 'Pas encore ouvert', todayOpen: today.open, todayClose: today.close, todayClosed: false };
  return { ...base, isOpen: false, label: 'Fermé', todayOpen: today.open, todayClose: today.close, todayClosed: false };
}

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

  document.querySelectorAll('.prod').forEach(function(card){
    if(card.classList.contains('svc') || !card.querySelector('.add')) return; // carte service = pas de panier
    var id=card.getAttribute('data-id'), name=card.getAttribute('data-name'), base=parseInt(card.getAttribute('data-base'),10)||0;
    card.querySelector('.add').addEventListener('click', function(){ change(id,name,base,1); });
    card.querySelector('.plus').addEventListener('click', function(){ change(id,name,base,1); });
    card.querySelector('.minus').addEventListener('click', function(){ change(id,name,base,-1); });
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
      var items=[]; for(var k in cart){ var it=cart[k]; if(it.dsId) items.push({dailySpecialId:it.dsId, qty:it.qty}); else items.push({productId:k, qty:it.qty}); }
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
          if(d.redirectUrl){
            document.getElementById('waitSub').textContent=isW
              ? 'Valide le paiement dans Wave, puis reviens sur cette page.'
              : 'Valide le paiement dans Orange Money, puis reviens sur cette page.';
            a.textContent=isW?'Rouvrir Wave':'Rouvrir Orange Money';
            a.href=d.redirectUrl; a.style.display='inline-block';
            window.location.replace(d.redirectUrl);
          } else {
            a.style.display='none';
          }
          if(d.qrCode){
            document.getElementById('waitSub').textContent='Scanne ce QR code avec Orange Money.';
            var img=document.getElementById('omQr');
            img.src=(String(d.qrCode).indexOf('data:')===0?d.qrCode:'data:image/png;base64,'+d.qrCode);
            img.hidden=false;
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

// ── JS client : page de confirmation (poll statut) ───────────────────────────
const CONFIRM_JS = `
(function(){
  var CFG = JSON.parse(document.getElementById('cfg').textContent);
  var mark=document.getElementById('mark'), t=document.getElementById('t'), d=document.getElementById('d'), home=document.getElementById('home');
  var OK_SVG='<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="34" fill="#FDCF34"/><path d="M22 37l10 10 18-20" fill="none" stroke="#14152A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var KO_SVG='<svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="33" fill="none" stroke="#FF6B6B" stroke-width="4"/><path d="M26 26l20 20M46 26l-20 20" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/></svg>';
  var isBeauty = CFG.type==='beauty';
  var statusUrl = isBeauty
    ? CFG.url+'/functions/v1/create-guest-reservation?status='+encodeURIComponent(CFG.id)
    : CFG.url+'/functions/v1/create-guest-order?order='+encodeURIComponent(CFG.id);
  function ok(){
    mark.innerHTML=OK_SVG;
    if(isBeauty){
      t.textContent='Réservation confirmée';
      d.innerHTML='Payé ! <span class="gold">Le prestataire a reçu ta réservation</span> et te confirmera le rendez-vous. Présente-toi à l\\'heure choisie.';
    } else {
      t.textContent='Commande confirmée';
      d.innerHTML='Merci ! <span class="gold">Le marchand a reçu ta commande</span> et va te rappeler pour le retrait ou la livraison.';
      var recu=document.getElementById('recu'); if(recu&&CFG.id){ recu.href=CFG.url+'/functions/v1/create-guest-order?receipt='+encodeURIComponent(CFG.id); recu.style.display='inline-flex'; }
    }
    home.style.display='inline-block';
  }
  function fail(){ mark.innerHTML=KO_SVG; t.textContent='Paiement non abouti'; d.textContent=isBeauty?'Ta réservation n\\'a pas été payée. Tu peux réessayer depuis la boutique.':'Ta commande n\\'a pas été payée. Tu peux réessayer depuis la boutique.'; home.style.display='inline-block'; }
  if(CFG.s==='ko'){ fail(); return; }
  if(CFG.s==='ok' || !CFG.id){ ok(); return; }
  var tries=0, dbFails=0;
  var iv=setInterval(function(){
    tries++;
    var url = (!isBeauty && dbFails>=5)
      ? CFG.url+'/functions/v1/create-guest-order?verify_order='+encodeURIComponent(CFG.id)
      : statusUrl;
    fetch(url,{headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}})
      .then(function(r){return r.json();}).then(function(x){
        if(x && x.paid){ clearInterval(iv); ok(); return; }
        dbFails++;
      }).catch(function(){ dbFails++; });
    if(tries>20){ clearInterval(iv); ok(); } // Wave a redirigé sur s=ok → considéré payé
  }, 2000);
})();
`;
