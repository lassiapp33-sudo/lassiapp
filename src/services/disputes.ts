/**
 * services/disputes.ts — Signalement et suivi des litiges depuis l'app mobile.
 */
import { supabase }          from '../lib/supabase';
import * as storageService   from './storage';
import useAuthStore          from '../store/authStore';

export type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
export type DisputeReason =
  | 'paid_not_received'
  | 'wrong_product'
  | 'payment_issue'
  | 'debt_disagreement'
  | 'no_response'
  | 'other';

export interface Dispute {
  id:           string;
  reporterRole: 'client' | 'merchant';
  againstName:  string;
  shopName:     string | null;
  type:         'order' | 'debt';
  reason:       DisputeReason;
  description:  string;
  evidenceUrls: string[];
  status:       DisputeStatus;
  resolution:   string | null;
  createdAt:    string;
}

export interface DisputeMessage {
  id:            string;
  senderName:    string;
  senderRole:    'client' | 'merchant' | 'admin';
  message:       string;
  attachmentUrl: string | null;
  createdAt:     string;
}

export const REASON_LABELS: Record<DisputeReason, string> = {
  paid_not_received: 'Payé mais rien reçu',
  wrong_product:     'Produit non conforme',
  payment_issue:     'Problème de paiement',
  debt_disagreement: 'Désaccord sur dette',
  no_response:       'Commerçant ne répond pas',
  other:             'Autre',
};

export const ORDER_REASONS: DisputeReason[] = [
  'paid_not_received', 'wrong_product', 'payment_issue', 'no_response', 'other',
];

export const DEBT_REASONS: DisputeReason[] = [
  'debt_disagreement', 'payment_issue', 'no_response', 'other',
];

// ─── Création d'un litige ────────────────────────────────────────────────────

export interface CreateDisputeParams {
  againstId:    string;
  shopId?:      string;
  type:         'order' | 'debt';
  orderId?:     string;
  debtId?:      string;
  reason:       DisputeReason;
  description:  string;
  evidenceUris: string[];   // URIs locales des photos — uploadées ici
}

export async function createDispute(params: CreateDisputeParams): Promise<string> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Non connecté');

  // Uploader les preuves vers Storage
  const evidenceUrls: string[] = [];
  for (const uri of params.evidenceUris) {
    try {
      const path = `${user.id}/${Date.now()}_${evidenceUrls.length}.jpg`;
      const url  = await storageService.uploadImage('disputes' as any, uri, path);
      evidenceUrls.push(url);
    } catch {
      // Photo non uploadée — non bloquant
    }
  }

  const { data, error } = await supabase
    .from('disputes')
    .insert({
      reporter_id:   user.id,
      reporter_role: user.role,
      against_id:    params.againstId,
      shop_id:       params.shopId  ?? null,
      type:          params.type,
      order_id:      params.orderId ?? null,
      debt_id:       params.debtId  ?? null,
      reason:        params.reason,
      description:   params.description,
      evidence_urls: evidenceUrls,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

// ─── Mes litiges ─────────────────────────────────────────────────────────────

export async function getMyDisputes(): Promise<Dispute[]> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('disputes')
    .select(`
      id, reporter_role, type, reason, description,
      evidence_urls, status, resolution, created_at,
      against:profiles!against_id(name),
      shops(name)
    `)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:           row.id,
    reporterRole: row.reporter_role,
    againstName:  (row.against as any)?.name ?? 'Inconnu',
    shopName:     (row.shops as any)?.name ?? null,
    type:         row.type,
    reason:       row.reason,
    description:  row.description,
    evidenceUrls: (row.evidence_urls ?? []) as string[],
    status:       row.status,
    resolution:   row.resolution,
    createdAt:    row.created_at,
  }));
}

// ─── Messages d'un litige ────────────────────────────────────────────────────

export async function getDisputeMessages(disputeId: string): Promise<DisputeMessage[]> {
  const { data, error } = await supabase
    .from('dispute_messages')
    .select('id, sender_role, message, attachment_url, created_at, profiles!sender_id(name)')
    .eq('dispute_id', disputeId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map(row => ({
    id:            row.id,
    senderName:    (row.profiles as any)?.name ?? 'Inconnu',
    senderRole:    row.sender_role,
    message:       row.message,
    attachmentUrl: row.attachment_url,
    createdAt:     row.created_at,
  }));
}

// ─── Envoyer un message dans le fil ─────────────────────────────────────────

export async function sendDisputeMessage(
  disputeId: string,
  message:   string,
): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Non connecté');

  const { error } = await supabase.from('dispute_messages').insert({
    dispute_id:  disputeId,
    sender_id:   user.id,
    sender_role: user.role,
    message,
  });

  if (error) throw new Error(error.message);
}
