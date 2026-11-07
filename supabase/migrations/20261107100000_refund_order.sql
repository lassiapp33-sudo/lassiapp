-- Migration : système de remboursement commande prestataire
-- Ajoute le statut 'refunded' + colonne refunded_at + RPC get_refund_info

-- 1. Mise à jour contrainte status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('new','preparing','ready','done','refused','refunded'));

-- 2. Colonne timestamp remboursement
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- 3. RPC get_refund_info — retourne infos nécessaires au modal remboursement
CREATE OR REPLACE FUNCTION get_refund_info(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order      RECORD;
  v_pi         RECORD;
  v_pq         RECORD;
  v_phone      TEXT;
BEGIN
  SELECT id, client_id, client_phone, status, pay_method, total
    INTO v_order
    FROM orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF v_order.status IN ('refused', 'refunded') THEN
    RAISE EXCEPTION 'order_not_refundable';
  END IF;

  -- payment_intent lié à cet order
  SELECT id, commission_lassi, montant_total, moyen_paiement
    INTO v_pi
    FROM payment_intents
   WHERE order_id = p_order_id
   LIMIT 1;

  -- montant versé au prestataire (payout_queue)
  SELECT montant
    INTO v_pq
    FROM payout_queue
   WHERE payment_intent_id = v_pi.id
   LIMIT 1;

  -- numéro client : orders.client_phone en priorité, sinon profiles.phone
  v_phone := v_order.client_phone;
  IF v_phone IS NULL AND v_order.client_id IS NOT NULL THEN
    SELECT phone INTO v_phone FROM profiles WHERE id = v_order.client_id;
  END IF;

  RETURN json_build_object(
    'montant_prestataire', COALESCE(v_pq.montant, v_order.total - COALESCE(v_pi.commission_lassi, 0)),
    'commission_lassi',    COALESCE(v_pi.commission_lassi, 0),
    'client_phone',        COALESCE(v_phone, ''),
    'client_id',           v_order.client_id,
    'pay_method',          v_order.pay_method,
    'already_refunded',    (v_order.status = 'refunded')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_refund_info(UUID) TO authenticated;
