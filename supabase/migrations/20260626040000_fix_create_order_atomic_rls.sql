-- ===========================================================================
-- FIX : create_order_atomic — bypass RLS explicite + status initial 'new'
-- ---------------------------------------------------------------------------
-- Problème 1 : la policy order_items_insert exige o.status = 'new' mais
--   create_order_atomic insérait la commande avec status = 'pending'.
--   Si Supabase applique RLS même dans le contexte SECURITY DEFINER (via
--   SET row_security = ON sur le rôle postgres), l'INSERT dans order_items
--   échouait silencieusement → erreur 500 generique côté client.
--
-- Problème 2 : la policy order_items_insert vérifie
--   o.client_id = auth.uid() — dans le contexte SECURITY DEFINER, auth.uid()
--   peut être NULL, rendant la vérification toujours fausse.
--
-- Fix :
--   1. SET row_security = off sur la fonction → bypass RLS garanti.
--   2. status initial = 'new' (cohérent avec orders_insert + order_items_insert).
--      confirm_order_from_payment fait status → 'preparing' pour
--      status IN ('pending', 'new') → aucun impact.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.create_order_atomic(
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
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_order_id UUID;
BEGIN
  -- ① Insérer la commande (total calculé par l'Edge Function depuis les prix DB)
  INSERT INTO public.orders (
    shop_id, client_id, client_name,
    total, discount_amount, promo_label,
    status, pay_method, order_type,
    note, idempotency_key
  )
  VALUES (
    p_shop_id, p_client_id, p_client_name,
    p_total, p_discount_amount, p_promo_label,
    'new', 'wave', p_order_type,
    p_note, p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ② Insérer les articles (même transaction — rollback auto si erreur)
  INSERT INTO public.order_items (order_id, product_name, qty, unit_price)
  SELECT
    v_order_id,
    (item ->> 'product_name')::TEXT,
    (item ->> 'qty')::INTEGER,
    (item ->> 'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  -- ③ Section 6 : montant suspect (> 100 000 F) → flag pour vérification manuelle
  IF p_total > 100000 THEN
    PERFORM public.raise_fraud_flag(
      'high_amount', 'order', v_order_id::text, 'medium',
      jsonb_build_object('total', p_total, 'shop_id', p_shop_id, 'client_id', p_client_id)
    );
  END IF;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;

-- Re-appliquer les grants après CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;
