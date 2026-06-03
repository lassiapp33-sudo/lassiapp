-- ===========================================================================
-- Fonction atomique create_order_atomic
-- Insère la commande ET ses articles dans une seule transaction PostgreSQL.
-- Si l'une des deux insertions échoue → rollback automatique complet.
-- SAFE à re-exécuter (CREATE OR REPLACE).
-- ===========================================================================

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_shop_id         UUID,
  p_client_id       UUID,
  p_client_name     TEXT,
  p_total           NUMERIC,
  p_discount_amount NUMERIC,
  p_promo_label     TEXT,
  p_order_type      TEXT,
  p_note            TEXT,
  p_idempotency_key TEXT,
  p_items           JSONB   -- [{ product_name, qty, unit_price }]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- ① Insérer la commande
  INSERT INTO orders (
    shop_id, client_id, client_name,
    total, discount_amount, promo_label,
    status, pay_method, order_type,
    note, idempotency_key
  )
  VALUES (
    p_shop_id, p_client_id, p_client_name,
    p_total, p_discount_amount, p_promo_label,
    'pending', 'wave', p_order_type,
    p_note, p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ② Insérer les articles (même transaction — rollback auto si erreur)
  INSERT INTO order_items (order_id, product_name, qty, unit_price)
  SELECT
    v_order_id,
    (item ->> 'product_name')::TEXT,
    (item ->> 'qty')::INTEGER,
    (item ->> 'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;

-- ===========================================================================
-- ROLLBACK
-- DROP FUNCTION IF EXISTS create_order_atomic(UUID,UUID,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,JSONB);
-- ===========================================================================
