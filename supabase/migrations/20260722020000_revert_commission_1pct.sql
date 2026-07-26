-- ===========================================================================
-- Commission LASSI : revert 10% → 1%
-- La commission LASSI est 1% (pas 10% — 10% est réservé aux livreurs en interne).
-- Annule la migration 20260721000000_commission_10pct.sql
-- ===========================================================================

-- ─── 1. Contrainte de cohérence montants ──────────────────────────────────────
ALTER TABLE public.payment_intents
  DROP CONSTRAINT IF EXISTS check_montants;

ALTER TABLE public.payment_intents
  ADD CONSTRAINT check_montants CHECK (
    commission_lassi = CEIL(prix_base * 0.01) AND
    montant_total    = prix_base + commission_lassi
  ) NOT VALID;

-- ─── 2. create_payment_intent ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id        UUID,
  p_client_id       UUID,
  p_prestataire_id  UUID,
  p_prix_base       INTEGER,
  p_moyen_paiement  TEXT,
  p_idempotency_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_commission INTEGER;
  v_total      INTEGER;
  v_pi_id      UUID;
BEGIN
  SELECT id INTO v_pi_id
    FROM public.payment_intents
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_pi_id; END IF;

  -- 1% LASSI
  v_commission := CEIL(p_prix_base * 0.01);
  v_total      := p_prix_base + v_commission;

  IF p_prix_base < 10 OR p_prix_base > 5000000 THEN
    RAISE EXCEPTION 'montant_invalide: % FCFA', p_prix_base;
  END IF;

  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RAISE EXCEPTION 'moyen_paiement_invalide: %', p_moyen_paiement;
  END IF;

  INSERT INTO public.payment_intents (
    order_id, client_id, prestataire_id,
    prix_base, commission_lassi, montant_total,
    moyen_paiement, idempotency_key, statut
  ) VALUES (
    p_order_id, p_client_id, p_prestataire_id,
    p_prix_base, v_commission, v_total,
    p_moyen_paiement, p_idempotency_key, 'pending'
  ) RETURNING id INTO v_pi_id;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (v_pi_id, 'created', jsonb_build_object(
    'prix_base',  p_prix_base,
    'commission', v_commission,
    'total',      v_total,
    'moyen',      p_moyen_paiement
  ));

  RETURN v_pi_id;
END;
$$;

-- ─── 3. initiate_order_payment ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.initiate_order_payment(
  p_order_id       UUID,
  p_client_id      UUID,
  p_moyen_paiement TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order           RECORD;
  v_prestataire_id  UUID;
  v_items_total     INTEGER;
  v_prix_base       INTEGER;
  v_idempotency_key TEXT;
  v_pi_id           UUID;
  v_blocking_id     UUID;
BEGIN
  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_method');
  END IF;

  SELECT id, client_id, shop_id, status, total, discount_amount
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.client_id <> p_client_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_order.status <> 'new' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  END IF;

  SELECT COALESCE(SUM(qty * unit_price), 0) INTO v_items_total
    FROM public.order_items WHERE order_id = p_order_id;

  v_prix_base := GREATEST(v_items_total - COALESCE(v_order.discount_amount, 0), 1);

  IF v_prix_base <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  END IF;

  IF v_prix_base < 10 OR v_prix_base > 5000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount', 'amount', v_prix_base);
  END IF;

  SELECT id INTO v_blocking_id
    FROM public.payment_intents
    WHERE order_id = p_order_id
      AND statut IN ('confirmed', 'split_done', 'simulated', 'disputed')
    LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid', 'payment_intent_id', v_blocking_id);
  END IF;

  SELECT merchant_id INTO v_prestataire_id
    FROM public.shops WHERE id = v_order.shop_id;
  IF v_prestataire_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shop_not_found');
  END IF;

  v_idempotency_key := 'pay_' || p_order_id::text || '_' || v_prix_base::text || '_' || p_moyen_paiement;

  v_pi_id := public.create_payment_intent(
    p_order_id, p_client_id, v_prestataire_id,
    v_prix_base, p_moyen_paiement, v_idempotency_key
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'payment_intent_id', v_pi_id,
    'prix_base',         v_prix_base,
    'commission',        CEIL(v_prix_base * 0.01)::int,
    'montant_total',     v_prix_base + CEIL(v_prix_base * 0.01)::int,
    'prestataire_id',    v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) TO service_role;

-- ─── 4. creer_commande_alaune ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.creer_commande_alaune(
  p_bloc_id    uuid,
  p_element_id text,
  p_qty        integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id    uuid := auth.uid();
  v_actif        boolean;
  v_expire_at    timestamptz;
  v_presta_id    uuid;
  v_elements     jsonb;
  v_element      jsonb;
  v_nom          text;
  v_prix         numeric;
  v_shop_id      uuid;
  v_shop_name    text;
  v_commission   numeric;
  v_total        numeric;
  v_total_client numeric;
  v_profile_name text;
  v_order_result jsonb;
  v_order_id     uuid;
BEGIN
  IF p_qty < 1 OR p_qty > 99 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  SELECT actif, expire_at, prestataire_id, elements
    INTO v_actif, v_expire_at, v_presta_id, v_elements
    FROM a_la_une
   WHERE id = p_bloc_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offre introuvable';
  END IF;

  IF NOT v_actif OR v_expire_at <= now() THEN
    RAISE EXCEPTION 'Offre expirée ou inactive';
  END IF;

  SELECT el INTO v_element
    FROM jsonb_array_elements(v_elements) el
   WHERE el ->> 'id' = p_element_id
   LIMIT 1;

  IF v_element IS NULL THEN
    RAISE EXCEPTION 'Article introuvable dans l''offre';
  END IF;

  v_nom  := v_element ->> 'nom';
  v_prix := (v_element ->> 'prix')::numeric;

  IF v_prix IS NULL OR v_prix <= 0 THEN
    RAISE EXCEPTION 'Prix non défini pour cet article';
  END IF;

  SELECT id, name INTO v_shop_id, v_shop_name
    FROM shops
   WHERE merchant_id = v_presta_id
   LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Boutique introuvable';
  END IF;

  -- 1% LASSI
  v_total        := v_prix * p_qty;
  v_commission   := CEIL(v_total * 0.01);
  v_total_client := v_total + v_commission;

  SELECT name INTO v_profile_name FROM profiles WHERE id = v_client_id;

  SELECT create_order_atomic(
    v_shop_id,
    v_client_id,
    COALESCE(v_profile_name, 'Client'),
    v_total,
    0,
    NULL,
    'emporter',
    NULL,
    NULL,
    jsonb_build_array(
      jsonb_build_object(
        'product_name', v_nom,
        'qty',          p_qty,
        'unit_price',   v_prix
      )
    )
  ) INTO v_order_result;

  v_order_id := (v_order_result ->> 'id')::uuid;

  RETURN jsonb_build_object(
    'orderId',     v_order_id,
    'total',       v_total,
    'commission',  v_commission,
    'totalClient', v_total_client,
    'elementNom',  v_nom,
    'shopName',    v_shop_name,
    'shopId',      v_shop_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.creer_commande_alaune(uuid, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.creer_commande_alaune(uuid, text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
