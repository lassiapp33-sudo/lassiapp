-- ===========================================================================
-- SECURITE : create_order_atomic — REVOKE PUBLIC + SET search_path = ''
-- Problème : PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création.
-- N'importe quel utilisateur anon pouvait appeler cette RPC directement
-- via PostgREST en contournant l'Edge Function create-order.
-- Fix : accès réservé à service_role uniquement (seul appelant légitime).
-- ===========================================================================

-- Révoquer l'accès PUBLIC existant (issu de la création initiale)
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;

-- Accorder uniquement à service_role (appelant : Edge Function create-order)
GRANT EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;

-- Redéfinir avec SET search_path = '' (immunité contre injection pg_temp)
-- et noms de tables entièrement qualifiés (public.orders, public.order_items)
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
    'pending', 'wave', p_order_type,
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

-- Re-appliquer les grants après CREATE OR REPLACE (remet les droits à PUBLIC par défaut)
REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB
) TO service_role;
