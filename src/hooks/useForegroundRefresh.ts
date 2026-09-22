import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getValidToken } from '../lib/supabase';

/**
 * Rejoue `onForeground` chaque fois que l'app revient au premier plan, APRÈS
 * avoir garanti un JWT frais (refresh forcé si le token est expiré).
 *
 * Corrige l'écran vide au retour de background : sans ce rechargement, les
 * stores restent figés sur l'état d'avant la mise en veille (recette 0 F,
 * « aucune commande ») jusqu'à ce que l'utilisateur se déconnecte/reconnecte
 * manuellement. Anti-rebond `minIntervalMs` pour éviter les rafales.
 */
export function useForegroundRefresh(onForeground: () => void, minIntervalMs = 3000): void {
  const cbRef = useRef(onForeground);
  cbRef.current = onForeground;
  const lastRef = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastRef.current < minIntervalMs) return;
      lastRef.current = now;
      // JWT frais AVANT rechargement : sinon la 1re requête part avec un token
      // expiré → 401 / RLS → store vide malgré le retour au premier plan.
      try { await getValidToken(); } catch { /* refresh best-effort */ }
      cbRef.current();
    });
    return () => sub.remove();
  }, [minIntervalMs]);
}
