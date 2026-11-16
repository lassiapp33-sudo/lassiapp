// Service Site Builder — charge/sauvegarde la personnalisation vitrine (présentation).
import { supabase } from '../lib/supabase';
import { normalizeSiteConfig, isDefaultSiteConfig, type SiteConfig } from '../config/siteThemes';

// Config actuelle de la boutique (NULL en base ⇒ défaut normalisé).
export async function getSiteConfig(shopId: string): Promise<SiteConfig> {
  const { data, error } = await supabase
    .from('shops')
    .select('site_config')
    .eq('id', shopId)
    .single();
  if (error || !data) return normalizeSiteConfig(null);
  return normalizeSiteConfig((data.site_config as Partial<SiteConfig> | null) ?? null);
}

// Sauvegarde directe (RLS owner : le marchand ne peut écrire que SA boutique —
// même voie que updatePaymentMethods/updateReservationEnabled). site_config est
// présentation seule ; normalisé/assaini côté client et rendu défensif côté web
// (textContent + propriétés style, jamais d'innerHTML). Config == défaut ⇒ NULL.
export async function saveSiteConfig(
  shopId: string,
  cfg: SiteConfig,
): Promise<{ success: true } | { success: false; error: string }> {
  const clean = normalizeSiteConfig(cfg);
  const value = isDefaultSiteConfig(clean) ? null : clean;
  const { error } = await supabase
    .from('shops')
    .update({ site_config: value })
    .eq('id', shopId);
  if (error) return { success: false, error: error.message || 'Échec de la sauvegarde.' };
  return { success: true };
}
