import { supabase } from '../lib/supabase';
import {
  calculerCommission,
  calculerPrixClient,
  validerMontant,
  PAYMENT_CONFIG,
  MoyenPaiement,
} from '../config/payment';
import { retryWithBackoff } from '../utils/retry';
import { isNetworkError } from '../utils/network';
import useConnectionStore from '../store/connectionStore';

export { calculerPrixClient, calculerCommission, PAYMENT_CONFIG, MoyenPaiement };

// Section 10 — message clair en mode dégradé (pas de message technique brut)
const ERREUR_CONNEXION = 'Connexion impossible. Vérifie ton réseau et réessaie.';

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  montantTotal?: number;
  commission?: number;
  prixBase?: number;
  redirectUrl?: string;
  qrCode?: string | null;   // OM seulement : base64 affiché si deepLink non dispo
  mode?: 'simulation' | 'production';
  error?: string;
}

export const initierPaiement = async (params: {
  orderId: string;
  prestataireId: string;
  prixBase: number;
  moyenPaiement: MoyenPaiement;
}): Promise<PaymentResult> => {
  if (!validerMontant(params.prixBase)) {
    return { success: false, error: 'Montant invalide' };
  }

  const idempotencyKey = `${params.orderId}-${params.moyenPaiement}-${new Date().toISOString().slice(0, 10)}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Non connecté' };

  let data, error;
  try {
    // Section 10 — retry avec backoff exponentiel : seules les coupures
    // réseau sont réessayées (idempotencyKey garantit qu'aucun doublon
    // n'est créé côté Wave/OM).
    ({ data, error } = await retryWithBackoff(async () => {
      const res = await supabase.functions.invoke('create-payment', {
        body: {
          orderId: params.orderId,
          prestataireId: params.prestataireId,
          prixBase: params.prixBase,
          moyenPaiement: params.moyenPaiement,
          idempotencyKey,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error && isNetworkError(res.error)) throw res.error;
      return res;
    }));
  } catch {
    useConnectionStore.getState().setOffline(true);
    return { success: false, error: ERREUR_CONNEXION };
  }
  useConnectionStore.getState().setOffline(false);

  if (error || (!data?.success && !data?.paymentIntentId)) {
    return { success: false, error: error?.message ?? data?.error ?? 'Erreur paiement' };
  }

  return {
    success:         true,
    paymentIntentId: data.paymentIntentId ?? data.reference,
    montantTotal:    data.montantTotal,
    commission:      data.commission,
    prixBase:        data.prixBase,
    redirectUrl:     data.redirectUrl ?? data.paymentUrl,
    qrCode:          (data.qrCode ?? null) as string | null,
    mode:            (data.mode ?? (data.simulation ? 'simulation' : 'production')) as 'simulation' | 'production',
  };
};

export const verifierPaiement = async (paymentIntentId: string): Promise<{
  confirmed: boolean;
  statut: string;
  mode: string;
}> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { confirmed: false, statut: 'error', mode: 'unknown' };

  let data, error;
  try {
    ({ data, error } = await retryWithBackoff(async () => {
      const res = await supabase.functions.invoke('verify-payment', {
        body: { paymentIntentId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error && isNetworkError(res.error)) throw res.error;
      return res;
    }));
  } catch {
    useConnectionStore.getState().setOffline(true);
    return { confirmed: false, statut: 'error', mode: 'unknown' };
  }
  useConnectionStore.getState().setOffline(false);

  if (error || (!data?.confirmed && !data?.paid)) {
    return { confirmed: false, statut: 'failed', mode: 'unknown' };
  }
  return {
    confirmed: data.confirmed ?? data.paid ?? false,
    statut:    data.statut ?? 'unknown',
    mode:      data.mode   ?? 'unknown',
  };
};
