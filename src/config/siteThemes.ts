// ─────────────────────────────────────────────────────────────────────────────
// SITE BUILDER — catalogues thème vitrine (MIROIR de vercel-apercu/api/preview.ts).
// Les ids DOIVENT rester identiques des deux côtés (sinon le rendu retombe au défaut).
// Présentation uniquement : rien ici ne change les données affichées sur la vitrine.
// ─────────────────────────────────────────────────────────────────────────────

export interface SiteLayout {
  order: string[]; // permutation de SECTION_IDS
  cols: number; // 2 | 3
  card: string; // 'bordered' | 'shadow' | 'flat'
  hero: string; // 'split' | 'centered' | 'minimal'
}

export interface SiteSocial {
  facebook: string;
  tiktok: string;
  instagram: string;
}

// Réglage de style d'un élément de texte (éditeur avancé).
export interface TextStyle { size?: number; color?: string; font?: string }

// Overrides de l'éditeur avancé (appliqués côté web par un script runtime,
// template-agnostique). Tout est optionnel et borné/assaini avant rendu.
export interface SiteOverrides {
  text?: Record<string, string>;        // clé élément -> texte de remplacement
  style?: Record<string, TextStyle>;    // clé élément -> taille/couleur/police
  anim?: Record<string, string>;        // clé élément -> id d'animation d'entrée
  menuHidden?: number[];                // index des entrées de menu masquées
  menuStyle?: TextStyle;                // style global du menu
  cont?: Record<string, ContStyle>;     // tuile catégorie (clé cN) -> forme/animation
  contOrder?: string[];                 // ordre des tuiles catégories (clés cN)
}

// Forme + animation d'une tuile catégorie (conteneur image/texte sélectionnable).
export interface ContStyle { shape?: 'sq' | 'rd'; anim?: string }

export interface SiteConfig {
  template: string;
  tokens: {
    palette: string;
    accent: string; // hex #RRGGBB
    fontHeading: string;
    fontBody: string;
  };
  layout: SiteLayout;
  displayName?: string;
  social?: SiteSocial;
  overrides?: SiteOverrides;
  heroVideo?: string; // URL vidéo de présentation (https), template Maroquinerie
}

// Animations d'entrée disponibles (miroir côté preview.ts).
export const SITE_ANIMATIONS: { id: string; label: string }[] = [
  { id: '',         label: 'Aucune' },
  { id: 'fade',     label: 'Fondu' },
  { id: 'fade-up',  label: 'Fondu ↑' },
  { id: 'fade-left',label: 'Glissé →' },
  { id: 'zoom',     label: 'Zoom' },
  { id: 'fade-right', label: 'Glissé ←' },
  { id: 'pop',      label: 'Pop' },
  { id: 'rotate',   label: 'Rotation' },
  { id: 'blur',     label: 'Flou' },
  { id: 'flip',     label: 'Flip' },
  { id: 'fade-down', label: 'Fondu ↓' },
  { id: 'bounce',   label: 'Rebond' },
  { id: 'pulse',    label: 'Pulsation' },
  { id: 'swing',    label: 'Balancement' },
  { id: 'reveal',   label: 'Dévoilé' },
];

// Tailles de texte proposées (px) dans l'éditeur.
export const TEXT_SIZES = [12, 14, 16, 18, 22, 28, 34, 44];

export const EMPTY_SOCIAL: SiteSocial = { facebook: '', tiktok: '', instagram: '' };

// Valide un lien réseau : http(s) uniquement, sans espace, borné. Sinon ''.
export function cleanSocialUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s || s.length > 300) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  if (/[\s"'<>]/.test(s)) return '';
  return s;
}
export function normalizeSocial(raw: Partial<SiteSocial> | null | undefined): SiteSocial {
  return {
    facebook: cleanSocialUrl(raw?.facebook),
    tiktok: cleanSocialUrl(raw?.tiktok),
    instagram: cleanSocialUrl(raw?.instagram),
  };
}
export function hasAnySocial(s: SiteSocial | undefined): boolean {
  return !!s && !!(s.facebook || s.tiktok || s.instagram);
}

// ── Polices (ids = clés css2 côté edge) ──────────────────────────────────────
export interface FontOption {
  id: string;
  label: string;
  category: 'Serif' | 'Sans' | 'Display';
  // Famille CSS pour un aperçu local approximatif (les vraies Google Fonts sont
  // chargées côté web ; en RN on affiche juste le label dans la police système).
}
export const SITE_FONTS: FontOption[] = [
  { id: 'cormorant', label: 'Cormorant Garamond', category: 'Serif' },
  { id: 'playfair', label: 'Playfair Display', category: 'Serif' },
  { id: 'lora', label: 'Lora', category: 'Serif' },
  { id: 'dmsans', label: 'DM Sans', category: 'Sans' },
  { id: 'inter', label: 'Inter', category: 'Sans' },
  { id: 'poppins', label: 'Poppins', category: 'Sans' },
  { id: 'montserrat', label: 'Montserrat', category: 'Sans' },
  { id: 'spacegrotesk', label: 'Space Grotesk', category: 'Display' },
  { id: 'rubik', label: 'Rubik', category: 'Sans' },
  { id: 'unbounded', label: 'Unbounded', category: 'Display' },
  { id: 'plusjakarta', label: 'Plus Jakarta Sans', category: 'Sans' },
  { id: 'jost', label: 'Jost', category: 'Sans' },
  { id: 'manrope', label: 'Manrope', category: 'Sans' },
  { id: 'fraunces', label: 'Fraunces', category: 'Serif' },
  { id: 'bebas', label: 'Bebas Neue', category: 'Display' },
  { id: 'outfit', label: 'Outfit', category: 'Sans' },
];

// ── Palettes (ids = clés SITE_PALETTES côté edge) ────────────────────────────
// Chaque palette fournit les couleurs d'aperçu pour la pastille dans l'éditeur.
export interface PaletteOption {
  id: string;
  label: string;
  bg: string; // fond page (--w)
  text: string; // texte foncé (--d)
  soft: string; // fond doux (--g)
  hidden?: boolean; // défini mais masqué du sélecteur (rendu/template conservés)
}
export const SITE_PALETTES: PaletteOption[] = [
  // Palettes à fond coloré / sombre : changent le site dans son ensemble. (mises en avant)
  { id: 'encre', label: 'Encre (sombre)', bg: '#14152A', text: '#FFFFFF', soft: '#1e2036' },
  { id: 'onyx', label: 'Onyx (noir)', bg: '#121212', text: '#FFFFFF', soft: '#1d1d1d' },
  { id: 'emerauded', label: 'Émeraude', bg: '#0F2A22', text: '#FFFFFF', soft: '#163A2F' },
  { id: 'bordeaux', label: 'Bordeaux', bg: '#2A1216', text: '#FFFFFF', soft: '#3A1A1F' },
  { id: 'nuitbleue', label: 'Nuit bleue', bg: '#0E1B33', text: '#FFFFFF', soft: '#172644' },
  { id: 'creme', label: 'Crème', bg: '#FDF6EC', text: '#3A2E22', soft: '#F6ECE0' },
  { id: 'lavande', label: 'Lavande', bg: '#F4F1FB', text: '#241F33', soft: '#EBE6F6' },
  { id: 'ocean', label: 'Océan', bg: '#EAF4F7', text: '#0F2F3A', soft: '#DCECF1' },
  { id: 'rosepoudre', label: 'Rose poudré', bg: '#FDF0F3', text: '#3A1E27', soft: '#F8E1E8' },
  // Palettes de template (fond clair) — conservées pour les templates.
  { id: 'cosmetic', label: 'Cosmetic', bg: '#FFFFFF', text: '#171313', soft: '#f6f6f7' },
  { id: 'pottery', label: 'Pottery', bg: '#FFFFFF', text: '#201d1d', soft: '#f4f4f5' },
  { id: 'furniture', label: 'Maison & Mobilier', bg: '#FFFFFF', text: '#152420', soft: '#EEF4F5' },
  { id: 'garderobe', label: 'Garde-robe', bg: '#FFFFFF', text: '#1b1b1f', soft: '#f5f5f6' },
  { id: 'sac', label: 'Maroquinerie', bg: '#FFFFFF', text: '#1a1a1a', soft: '#f4f3f1' },
  // Palettes génériques « blanches » — MASQUÉES du sélecteur (défaut/edge conservés).
  { id: 'classic', label: 'Classique', bg: '#FFFFFF', text: '#14152A', soft: '#f5f4f0', hidden: true },
  { id: 'noir', label: 'Noir', bg: '#FFFFFF', text: '#1a1a1a', soft: '#f4f4f4', hidden: true },
  { id: 'sable', label: 'Sable', bg: '#FBF8F3', text: '#2b2118', soft: '#f1ece3', hidden: true },
  { id: 'foret', label: 'Forêt', bg: '#FFFFFF', text: '#14241c', soft: '#eef3f0', hidden: true },
  { id: 'ardoise', label: 'Ardoise', bg: '#FFFFFF', text: '#1b2430', soft: '#eef1f5', hidden: true },
];

// ── Accents (preset + custom validé) ─────────────────────────────────────────
export const SITE_ACCENTS: { id: string; hex: string }[] = [
  { id: 'gold', hex: '#FDCF34' },
  { id: 'coral', hex: '#F2665E' },
  { id: 'emeraude', hex: '#2BB673' },
  { id: 'azur', hex: '#3D8BFD' },
  { id: 'violet', hex: '#8B5CF6' },
  { id: 'rose', hex: '#EC6FA6' },
  { id: 'nuit', hex: '#14152A' },
  { id: 'turquoise', hex: '#06B6D4' },
  { id: 'orange', hex: '#F59E0B' },
  { id: 'rouge', hex: '#EF4444' },
  { id: 'indigo', hex: '#4F46E5' },
  { id: 'lime', hex: '#65A30D' },
  { id: 'magenta', hex: '#D946EF' },
  { id: 'cacao', hex: '#7C4A21' },
  { id: 'acier', hex: '#64748B' },
];

// ── Templates (Phase 3) ──────────────────────────────────────────────────────
export const SITE_TEMPLATES: { id: string; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'cosmetic', label: 'Cosmetic' },
  { id: 'pottery', label: 'Pottery' },
  { id: 'furniture', label: 'Maison & Mobilier' },
  { id: 'garderobe', label: 'Garde-robe' },
  { id: 'sac', label: 'Maroquinerie & Bagagerie' },
];

// Preset appliqué quand on choisit un template : fixe palette/accent/polices/layout
// pour matcher le design de référence. L'utilisateur peut ensuite ajuster.
export const TEMPLATE_PRESETS: Record<string, { tokens: SiteConfig['tokens']; layout: SiteLayout }> = {
  classic: {
    tokens: { palette: 'classic', accent: '#FDCF34', fontHeading: 'cormorant', fontBody: 'dmsans' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' },
  },
  cosmetic: {
    tokens: { palette: 'cosmetic', accent: '#D98664', fontHeading: 'rubik', fontBody: 'rubik' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
  },
  pottery: {
    tokens: { palette: 'pottery', accent: '#B55D38', fontHeading: 'unbounded', fontBody: 'plusjakarta' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'flat', hero: 'split' },
  },
  furniture: {
    tokens: { palette: 'furniture', accent: '#274C4F', fontHeading: 'jost', fontBody: 'jost' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' },
  },
  garderobe: {
    tokens: { palette: 'garderobe', accent: '#E4322B', fontHeading: 'poppins', fontBody: 'poppins' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
  },
  sac: {
    tokens: { palette: 'sac', accent: '#FDCF34', fontHeading: 'poppins', fontBody: 'inter' },
    layout: { order: ['products', 'services', 'terrains'], cols: 3, card: 'shadow', hero: 'split' },
  },
};

// Applique un template : renvoie une config = preset (en conservant displayName).
export function applyTemplate(cfg: SiteConfig, templateId: string): SiteConfig {
  const preset = TEMPLATE_PRESETS[templateId];
  if (!preset) return cfg;
  return {
    template: templateId,
    tokens: { ...preset.tokens },
    layout: { ...preset.layout, order: [...preset.layout.order] },
    ...(cfg.displayName ? { displayName: cfg.displayName } : {}),
    ...(hasAnySocial(cfg.social) ? { social: { ...cfg.social! } } : {}),
  };
}

// ── Layout (Phase 2) — agencement des conteneurs ─────────────────────────────
export const SITE_SECTIONS: { id: string; label: string }[] = [
  { id: 'products', label: 'Produits' },
  { id: 'services', label: 'Prestations' },
  { id: 'terrains', label: 'Terrains' },
];
export const SECTION_IDS = SITE_SECTIONS.map(s => s.id);
export const CARD_STYLES: { id: string; label: string }[] = [
  { id: 'bordered', label: 'Bordure' },
  { id: 'shadow', label: 'Ombre' },
  { id: 'flat', label: 'Épuré' },
];
export const HERO_STYLES: { id: string; label: string }[] = [
  { id: 'split', label: 'Côte à côte' },
  { id: 'centered', label: 'Centré' },
  { id: 'minimal', label: 'Minimal' },
];
export const COLS_OPTIONS = [2, 3];

export const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Valide une URL de vidéo de présentation : https uniquement, bornée, sans espaces.
export function cleanVideoUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const s = raw.trim();
  if (!s || s.length > 500) return '';
  if (!/^https:\/\//i.test(s)) return '';
  if (/[\s"'<>]/.test(s)) return '';
  return s;
}

export const DEFAULT_LAYOUT: SiteLayout = { order: ['products', 'services', 'terrains'], cols: 3, card: 'bordered', hero: 'split' };

// Config par défaut = rendu historique (charte LASSİ + Cormorant/DM Sans).
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  template: 'classic',
  tokens: { palette: 'classic', accent: '#FDCF34', fontHeading: 'cormorant', fontBody: 'dmsans' },
  layout: { ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] },
};

// Normalise/valide une config (miroir léger de resolveTheme côté edge).
// Garantit que la config sauvegardée ne contient QUE des ids connus + accent hex.
export function normalizeSiteConfig(raw: Partial<SiteConfig> | null | undefined): SiteConfig {
  const d = DEFAULT_SITE_CONFIG;
  const t = raw?.tokens ?? {};
  const palette = SITE_PALETTES.some(p => p.id === t.palette) ? t.palette! : d.tokens.palette;
  const accent = typeof t.accent === 'string' && HEX6.test(t.accent) ? t.accent : d.tokens.accent;
  const fontHeading = SITE_FONTS.some(f => f.id === t.fontHeading) ? t.fontHeading! : d.tokens.fontHeading;
  const fontBody = SITE_FONTS.some(f => f.id === t.fontBody) ? t.fontBody! : d.tokens.fontBody;
  const template = SITE_TEMPLATES.some(x => x.id === raw?.template) ? raw!.template : d.template;
  const name = typeof raw?.displayName === 'string' ? raw.displayName.trim().slice(0, 60) : '';
  const out: SiteConfig = { template, tokens: { palette, accent, fontHeading, fontBody }, layout: normalizeLayout(raw?.layout) };
  if (name) out.displayName = name;
  const social = normalizeSocial(raw?.social);
  if (hasAnySocial(social)) out.social = social;
  const ov = normalizeOverrides((raw as any)?.overrides);
  if (ov) out.overrides = ov;
  const video = cleanVideoUrl((raw as any)?.heroVideo);
  if (video) out.heroVideo = video;
  return out;
}

// Assainit les overrides : bornes strictes (texte 200c, couleur hex, police connue,
// taille 10-60, anim connue, index menu entiers). Renvoie undefined si vide.
const ANIM_IDS = SITE_ANIMATIONS.map(a => a.id).filter(Boolean);
function cleanTextStyle(raw: any): TextStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: TextStyle = {};
  if (typeof raw.size === 'number' && raw.size >= 10 && raw.size <= 60) out.size = Math.round(raw.size);
  if (typeof raw.color === 'string' && HEX6.test(raw.color)) out.color = raw.color;
  if (typeof raw.font === 'string' && SITE_FONTS.some(f => f.id === raw.font)) out.font = raw.font;
  return Object.keys(out).length ? out : undefined;
}
export function normalizeOverrides(raw: any): SiteOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: SiteOverrides = {};
  if (raw.text && typeof raw.text === 'object') {
    const t: Record<string, string> = {};
    for (const k of Object.keys(raw.text).slice(0, 60)) {
      const v = raw.text[k];
      if (typeof k === 'string' && /^[a-z0-9]{1,16}$/.test(k) && typeof v === 'string' && v.length <= 200) t[k] = v;
    }
    if (Object.keys(t).length) out.text = t;
  }
  if (raw.style && typeof raw.style === 'object') {
    const s: Record<string, TextStyle> = {};
    for (const k of Object.keys(raw.style).slice(0, 60)) {
      const cs = cleanTextStyle(raw.style[k]);
      if (/^[a-z0-9]{1,16}$/.test(k) && cs) s[k] = cs;
    }
    if (Object.keys(s).length) out.style = s;
  }
  if (raw.anim && typeof raw.anim === 'object') {
    const a: Record<string, string> = {};
    for (const k of Object.keys(raw.anim).slice(0, 60)) {
      const v = raw.anim[k];
      if (/^[a-z0-9]{1,16}$/.test(k) && typeof v === 'string' && ANIM_IDS.includes(v)) a[k] = v;
    }
    if (Object.keys(a).length) out.anim = a;
  }
  if (Array.isArray(raw.menuHidden)) {
    const h = Array.from(new Set(raw.menuHidden.filter((n: any) => Number.isInteger(n) && n >= 0 && n < 30))) as number[];
    if (h.length) out.menuHidden = h;
  }
  const ms = cleanTextStyle(raw.menuStyle);
  if (ms) out.menuStyle = ms;
  if (raw.cont && typeof raw.cont === 'object') {
    const c: Record<string, ContStyle> = {};
    for (const k of Object.keys(raw.cont).slice(0, 40)) {
      if (!/^c[0-9]{1,3}$/.test(k)) continue;
      const v = raw.cont[k]; if (!v || typeof v !== 'object') continue;
      const cs: ContStyle = {};
      if (v.shape === 'sq' || v.shape === 'rd') cs.shape = v.shape;
      if (typeof v.anim === 'string' && ANIM_IDS.includes(v.anim)) cs.anim = v.anim;
      if (cs.shape || cs.anim) c[k] = cs;
    }
    if (Object.keys(c).length) out.cont = c;
  }
  if (Array.isArray(raw.contOrder)) {
    const seen = new Set<string>();
    const o = raw.contOrder.filter((k: any) =>
      typeof k === 'string' && /^c[0-9]{1,3}$/.test(k) && !seen.has(k) && (seen.add(k), true)).slice(0, 40);
    if (o.length) out.contOrder = o;
  }
  return Object.keys(out).length ? out : undefined;
}
export function hasOverrides(o: SiteOverrides | undefined): boolean {
  return !!o && Object.keys(o).length > 0;
}

// Valide le layout : order = permutation stricte des 3 blocs, sinon défaut.
export function normalizeLayout(raw: Partial<SiteLayout> | null | undefined): SiteLayout {
  const d = DEFAULT_LAYOUT;
  let order = [...d.order];
  if (Array.isArray(raw?.order)) {
    const arr = raw!.order.filter((x): x is string => typeof x === 'string');
    const uniq = Array.from(new Set(arr));
    if (uniq.length === SECTION_IDS.length && uniq.every(x => SECTION_IDS.includes(x))) order = uniq;
  }
  const cols = raw?.cols === 2 ? 2 : 3;
  const card = CARD_STYLES.some(c => c.id === raw?.card) ? raw!.card! : d.card;
  const hero = HERO_STYLES.some(h => h.id === raw?.hero) ? raw!.hero! : d.hero;
  return { order, cols, card, hero };
}

// True si la config == défaut (⇒ on peut stocker NULL en base, rendu historique).
export function isDefaultSiteConfig(c: SiteConfig): boolean {
  const d = DEFAULT_SITE_CONFIG;
  const l = c.layout, dl = d.layout;
  const layoutDefault =
    l.cols === dl.cols && l.card === dl.card && l.hero === dl.hero &&
    l.order.length === dl.order.length && l.order.every((x, i) => x === dl.order[i]);
  return (
    c.template === d.template &&
    c.tokens.palette === d.tokens.palette &&
    c.tokens.accent.toUpperCase() === d.tokens.accent.toUpperCase() &&
    c.tokens.fontHeading === d.tokens.fontHeading &&
    c.tokens.fontBody === d.tokens.fontBody &&
    layoutDefault &&
    !c.displayName &&
    !hasAnySocial(c.social) &&
    !hasOverrides(c.overrides)
  );
}

// URL d'aperçu live : s.lassi.tech/<slug>?draft=<JSON encodé>. Le edge décode,
// force le thème (présentation) et garde les vraies données par slug.
export function buildDraftPreviewUrl(slug: string, cfg: SiteConfig): string {
  const q = encodeURIComponent(JSON.stringify(cfg));
  return `https://s.lassi.tech/${encodeURIComponent(slug)}?draft=${q}`;
}

// URL d'aperçu en MODE ÉDITION : ajoute &edit=1 pour injecter l'overlay éditable
// (surbrillance conteneurs + bridge postMessage). Éditeur avancé in-app uniquement.
export function buildEditPreviewUrl(slug: string, cfg: SiteConfig): string {
  return `${buildDraftPreviewUrl(slug, cfg)}&edit=1`;
}

// Aperçu DÉMO d'un template : boutique fictive cohérente (données d'exemple),
// pour montrer au prestataire à quoi ressemble un vrai site avec ce design.
export function buildDemoPreviewUrl(templateId: string): string {
  return `https://s.lassi.tech/__demo?t=${encodeURIComponent(templateId)}`;
}
