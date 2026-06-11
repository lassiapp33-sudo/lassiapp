import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON } from '../lib/supabase';
import useConnectionStore from '../store/connectionStore';

const CHECK_INTERVAL_MS = 20000;
const TIMEOUT_MS = 5000;

async function isSupabaseReachable(): Promise<boolean> {
  if (!SUPABASE_URL) return true; // pas configuré (dev) : ne pas afficher le bandeau

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Endpoint GoTrue léger : toute réponse HTTP confirme que Supabase est joignable.
    await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Section 10 — Mode dégradé : surveille la joignabilité de Supabase en
 * arrière-plan et alimente connectionStore (bandeau "hors-ligne") sans
 * bloquer ni faire planter l'app si le backend est indisponible.
 */
export function useConnectionWatcher(): void {
  const setOffline = useConnectionStore(s => s.setOffline);

  useEffect(() => {
    let cancelled = false;

    const runCheck = async () => {
      const reachable = await isSupabaseReachable();
      if (!cancelled) setOffline(!reachable);
    };

    runCheck();
    const interval = setInterval(runCheck, CHECK_INTERVAL_MS);

    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') runCheck();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [setOffline]);
}
