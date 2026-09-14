import { supabase } from '../lib/supabase';

export interface StatsClics {
  total: number;
  parSource: Record<string, number>;
}

/**
 * Clics sur le lien de partage du prestataire connecté.
 * RLS : la policy "prestataire voit ses clics" filtre déjà sur auth.uid(),
 * le filtre .eq('prestataire_id', user.id) reste explicite par sécurité.
 */
export async function getStatsClics(): Promise<StatsClics> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { total: 0, parSource: {} };

  const { data } = await supabase
    .from('clics_lien_partage')
    .select('source')
    .eq('prestataire_id', user.id);

  const total = data?.length ?? 0;
  const parSource: Record<string, number> = {};
  data?.forEach((c: { source: string | null }) => {
    const s = c.source ?? 'direct';
    parSource[s] = (parSource[s] ?? 0) + 1;
  });

  return { total, parSource };
}
