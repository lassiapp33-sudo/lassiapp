import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AnnonceAudience } from '../utils/annonceTemplates';

export interface Annonce {
  id: string;
  titre: string;
  corps: string;
  icone: string;
  tag: string | null;
  audience: AnnonceAudience;
  est_actif: boolean;
  expire_at: string | null;
  created_at: string;
}

/**
 * File FIFO des annonces système non lues (cf. AnnonceModal). Au montage
 * (et à chaque changement d'utilisateur connecté), récupère via
 * get_annonces_non_lues() les annonces actives ciblant ce compte et pas
 * encore marquées comme lues. marquerLue() enregistre la lecture dans
 * annonces_lues et passe à l'annonce suivante — une annonce fermée ne
 * revient jamais.
 */
export function useAnnonces(userId: string | null) {
  const [queue, setQueue] = useState<Annonce[]>([]);

  useEffect(() => {
    if (!userId) {
      setQueue([]);
      return;
    }
    let cancelled = false;
    supabase
      .rpc('get_annonces_non_lues')
      .then(({ data, error }: { data: Annonce[] | null; error: unknown }) => {
        if (!cancelled && !error && data) setQueue(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const marquerLue = useCallback(async () => {
    const courante = queue[0];
    if (!courante || !userId) return;
    setQueue(q => q.slice(1));
    try {
      await supabase.from('annonces_lues').insert({ annonce_id: courante.id, user_id: userId });
    } catch {
      // silencieux — réessaiera au prochain démarrage si l'insertion a échoué
    }
  }, [queue, userId]);

  return {
    annonceCourante: queue[0] ?? null,
    nbRestantes: Math.max(queue.length - 1, 0),
    marquerLue,
  };
}
