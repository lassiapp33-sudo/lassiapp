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
];

// ── Palettes (ids = clés SITE_PALETTES côté edge) ────────────────────────────
// Chaque palette fournit les couleurs d'aperçu pour la pastille dans l'éditeur.
export interface PaletteOption {
  id: string;
  label: string;
  bg: string; // fond page (--w)
  text: string; // texte foncé (--d)
  soft: string; // fond doux (--g)
}
export const SITE_PALETTES: PaletteOption[] = [
  { id: 'classic', label: 'Classique', bg: '#FFFFFF', text: '#14152A', soft: '#f5f4f0' },
  { id: 'noir', label: 'Noir', bg: '#FFFFFF', text: '#1a1a1a', soft: '#f4f4f4' },
  { id: 'sable', label: 'Sable', bg: '#FBF8F3', text: '#2b2118', soft: '#f1ece3' },
  { id: 'foret', label: 'Forêt', bg: '#FFFFFF', text: '#14241c', soft: '#eef3f0' },
  { id: 'ardoise', label: 'Ardoise', bg: '#FFFFFF', text: '#1b2430', soft: '#eef1f5' },
  { id: 'cosmetic', label: 'Cosmetic', bg: '#FFFFFF', text: '#171313', soft: '#F4E7D6' },
  { id: 'pottery', label: 'Pottery', bg: '#FFFFFF', text: '#201d1d', soft: '#f4f4f5' },
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
];

// ── Templates (Phase 3) ──────────────────────────────────────────────────────
export const SITE_TEMPLATES: { id: string; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'cosmetic', label: 'Cosmetic' },
  { id: 'pottery', label: 'Pottery' },
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
  return out;
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
    !c.displayName
  );
}

// URL d'aperçu live : s.lassi.tech/<slug>?draft=<JSON encodé>. Le edge décode,
// force le thème (présentation) et garde les vraies données par slug.
export function buildDraftPreviewUrl(slug: string, cfg: SiteConfig): string {
  const q = encodeURIComponent(JSON.stringify(cfg));
  return `https://s.lassi.tech/${encodeURIComponent(slug)}?draft=${q}`;
}
