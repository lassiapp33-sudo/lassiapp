-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║        LASSİ — Phase 3 / Étape 4 : Intégration SenePay             ║
-- ║  Coller dans : Supabase Dashboard → SQL Editor → New Query → Run   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- ─── 1. Stocker la référence SenePay dans le ticket_data ──────────────────────
-- Fonction appelée par create-payment Edge Function

CREATE OR REPLACE FUNCTION merge_ticket_reference(
  p_message_id TEXT,
  p_reference  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET ticket_data = ticket_data || jsonb_build_object('senepay_reference', p_reference)
  WHERE id = p_message_id::uuid;
END;
$$;

-- ─── 2. Marquer un ticket comme payé ─────────────────────────────────────────
-- Appelée par verify-payment et senepay-webhook Edge Functions
-- → Realtime UPDATE se déclenche → ChatScreen des deux côtés se met à jour

CREATE OR REPLACE FUNCTION mark_ticket_paid(
  p_message_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conv_id uuid;
  v_shop_id uuid;
  v_client_id uuid;
BEGIN
  -- Marquer le ticket comme payé
  UPDATE messages
  SET ticket_data = ticket_data || '{"status": "paid"}'::jsonb
  WHERE id = p_message_id::uuid;

  -- Récupérer la conversation pour insérer une notification
  SELECT conversation_id INTO v_conv_id
  FROM messages WHERE id = p_message_id::uuid;

  SELECT shop_id, client_id INTO v_shop_id, v_client_id
  FROM conversations WHERE id = v_conv_id;

  -- Notif pour le commerçant
  IF v_shop_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body)
    SELECT merchant_id, 'payment', 'Paiement reçu 💰', 'Un client vient de payer sa commande.'
    FROM shops WHERE id = v_shop_id AND merchant_id IS NOT NULL;
  END IF;

  -- Notif pour le client (confirmation)
  IF v_client_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (v_client_id, 'payment', 'Paiement confirmé ✅', 'Ton paiement a bien été reçu.');
  END IF;
END;
$$;

-- ─── 3. Vérifier les permissions des fonctions ───────────────────────────────
GRANT EXECUTE ON FUNCTION merge_ticket_reference(TEXT, TEXT)   TO service_role;
GRANT EXECUTE ON FUNCTION mark_ticket_paid(TEXT)                TO service_role;
