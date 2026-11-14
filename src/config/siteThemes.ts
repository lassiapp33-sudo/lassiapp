// ─────────────────────────────────────────────────────────────────────────────
// SITE BUILDER — catalogues thème vitrine (MIROIR de vercel-apercu/api/preview.ts).
// Les ids DOIVENT rester identiques des deux côtés (sinon le rendu retombe au défaut).
// Présentation uniquement : rien ici ne change les données affichées sur la vitrine.
// ─────────────────────────────────────────────────────────────────────────────

export interface SiteConfig {
  template: string;
  tokens: {
    palette: string;
    accent: string; // hex #RRGGBB
    fontHeading: string;
    fontBody: string;
  };
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

// ── Templates (Phase 3 en ajoutera 10) ───────────────────────────────────────
export const SITE_TEMPLATES: { id: string; label: string }[] = [
  { id: 'classic', label: 'Classique' },
];

export const HEX6 = /^#[0-9a-fA-F]{6}$/;

// Config par défaut = rendu historique (charte LASSİ + Cormorant/DM Sans).
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  template: 'classic',
  tokens: { palette: 'classic', accent: '#FDCF34', fontHeading: 'cormorant', fontBody: 'dmsans' },
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
  const out: SiteConfig = { template, tokens: { palette, accent, fontHeading, fontBody } };
  if (name) out.displayName = name;
  return out;
}

// True si la config == défaut (⇒ on peut stocker NULL en base, rendu historique).
export function isDefaultSiteConfig(c: SiteConfig): boolean {
  const d = DEFAULT_SITE_CONFIG;
  return (
    c.template === d.template &&
    c.tokens.palette === d.tokens.palette &&
    c.tokens.accent.toUpperCase() === d.tokens.accent.toUpperCase() &&
    c.tokens.fontHeading === d.tokens.fontHeading &&
    c.tokens.fontBody === d.tokens.fontBody &&
    !c.displayName
  );
}

// URL d'aperçu live : s.lassi.tech/<slug>?draft=<JSON encodé>. Le edge décode,
// force le thème (présentation) et garde les vraies données par slug.
export function buildDraftPreviewUrl(slug: string, cfg: SiteConfig): string {
  const q = encodeURIComponent(JSON.stringify(cfg));
  return `https://s.lassi.tech/${encodeURIComponent(slug)}?draft=${q}`;
}
