import { useEffect } from 'react';
import { Linking } from 'react-native';
import { verifierPaiement } from '../services/paymentService';
import usePendingNavStore from '../store/pendingNavStore';

export function usePaymentDeepLink() {
  const setPendingNav = usePendingNavStore(s => s.setPendingNav);

  useEffect(() => {
    const handleUrl = async ({ url }: { url: string }) => {
      // ── Paiement ──────────────────────────────────────────────────────────
      if (url.includes('lassiapp://paiement/succes')) {
        const piId = parseParam(url, 'pi');
        if (!piId) return;
        try {
          const result = await verifierPaiement(piId);
          setPendingNav(
            result.confirmed
              ? { type: 'payment_success', paymentIntentId: piId }
              : { type: 'payment_failed' },
          );
        } catch {
          setPendingNav({ type: 'payment_failed' });
        }
        return;
      }

      if (url.includes('lassiapp://paiement/echec')) {
        setPendingNav({ type: 'payment_failed' });
        return;
      }

      // ── À la une — catégorie ───────────────────────────────────────────────
      // lassiapp://a-la-une/categorie/{catId}
      // https://lassi.sn/a-la-une/categorie/{catId}
      if (url.includes('/a-la-une/categorie/')) {
        const categorieId = url.split('/a-la-une/categorie/')[1]?.split('?')[0]?.split('/')[0];
        if (categorieId) setPendingNav({ type: 'a_la_une_categorie', categorieId });
        return;
      }

      // ── À la une — bloc précis ─────────────────────────────────────────────
      // lassiapp://a-la-une/{blocId}?produit={elementId}
      // https://lassi.sn/a-la-une/{blocId}?produit={elementId}
      if (url.includes('/a-la-une/')) {
        const afterSlash = url.split('/a-la-une/')[1];
        const blocId = afterSlash?.split('?')[0]?.split('/')[0];
        const produitId = parseParam(url, 'produit') ?? undefined;
        if (blocId) setPendingNav({ type: 'a_la_une_bloc', blocId, produitId });
        return;
      }
    };

    // Liens reçus quand l'app est déjà ouverte
    const sub = Linking.addEventListener('url', handleUrl);

    // Cold start : app ouverte directement depuis le deep link
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    return () => sub.remove();
  }, [setPendingNav]);
}

// Extrait un paramètre de query sans dépendance externe (URL() absent sur RN)
function parseParam(url: string, key: string): string | null {
  const marker = `${key}=`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.slice(idx + marker.length);
  const end = rest.indexOf('&');
  return end === -1 ? rest : rest.slice(0, end);
}
