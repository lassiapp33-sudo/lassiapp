import { supabase } from '../lib/supabase';
import {
  calculerCommission,
  calculerPrixClient,
  validerMontant,
  PAYMENT_CONFIG,
  MoyenPaiement,
} from '../config/payment';

export { calculerPrixClient, calculerCommission, PAYMENT_CONFIG };

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  montantTotal?: number;
  commission?: number;
  prixBase?: number;
  redirectUrl?: string;
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

  const idempotencyKey = `${params.orderId}-${params.moyenPaiement}-${new Date().toDateString()}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { success: false, error: 'Non connecté' };

  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: {
      orderId: params.orderId,
      prestataireId: params.prestataireId,
      prixBase: params.prixBase,
      moyenPaiement: params.moyenPaiement,
      idempotencyKey,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.success) {
    return { success: false, error: error?.message ?? data?.error ?? 'Erreur paiement' };
  }

  return {
    success: true,
    paymentIntentId: data.paymentIntentId,
    montantTotal: data.montantTotal,
    commission: data.commission,
    prixBase: data.prixBase,
    redirectUrl: data.redirectUrl,
    mode: data.mode,
  };
};

export const verifierPaiement = async (paymentIntentId: string): Promise<{
  confirmed: boolean;
  statut: string;
  mode: string;
}> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { confirmed: false, statut: 'error', mode: 'unknown' };

  const { data, error } = await supabase.functions.invoke('verify-payment', {
    body: { paymentIntentId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.success) return { confirmed: false, statut: 'failed', mode: 'unknown' };
  return { confirmed: data.confirmed, statut: data.statut, mode: data.mode };
};
