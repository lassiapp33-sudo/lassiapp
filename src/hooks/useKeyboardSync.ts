// Synchronise automatiquement les données marchand vers le clavier vendeur
// dès que la boutique est chargée ou que son nom / slug change.
// À monter une fois dans le navigateur marchand.

import { useEffect } from 'react';
import useShopStore from '../store/shopStore';
import { syncKeyboard, refreshSwitchNotification } from '../services/keyboardSync';

export function useKeyboardSync(): void {
  const shopId = useShopStore(s => s.shopId);
  const shopName = useShopStore(s => s.profile?.name ?? null);
  const slug = useShopStore(s => s.profile?.slug ?? null);

  useEffect(() => {
    if (!shopId || !slug || !shopName) return;
    syncKeyboard({ shopId, shopName, slug });
    // Re-poste la notification de bascule si le marchand l'avait activée.
    refreshSwitchNotification();
  }, [shopId, shopName, slug]);
}
