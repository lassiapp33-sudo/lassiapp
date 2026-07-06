import { supabase } from '../lib/supabase';

export type RatingDirection = 'client_to_merchant' | 'merchant_to_client';

export async function soumettreNote(
  orderId: string,
  direction: RatingDirection,
  note: number,
  commentaire?: string,
): Promise<void> {
  const { error } = await supabase.rpc('soumettre_note_commande', {
    p_order_id: orderId,
    p_direction: direction,
    p_note: note,
    p_commentaire: commentaire ?? null,
  });
  if (error) throw new Error(error.message);
}
