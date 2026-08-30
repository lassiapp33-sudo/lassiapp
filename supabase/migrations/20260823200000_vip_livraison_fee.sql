-- ===========================================================================
-- VIP 5 Étoiles — frais de livraison inclus dans le paiement
-- ---------------------------------------------------------------------------
-- Bug : pour les boutiques 5 Étoiles avec mode livraison, les frais de
-- livraison (ex: 800 FCFA) étaient affichés dans le panier mais jamais
-- persistés en base — OM ne facturait que les articles (ex: 12 FCFA au lieu
-- de 812 FCFA).
--
-- Cause racine :
--   - create_order_atomic stockait total = prix_articles uniquement
--   - initiate_order_payment calculait montant_total = prix_base + commission
--   - Frais de livraison jamais persistés → jamais facturés
--
-- Fix :
--   1. Colonne livraison_fee INTEGER DEFAULT 0 sur orders et payment_intents
--   2. create_order_atomic(12-args) accepte p_livraison_fee → stocké dans orders
--   3. initiate_order_payment lit orders.livraison_fee, le transmet à create_payment_intent
--   4. create_payment_intent(8-args) : montant_total = prix_base + commission + livraison_fee
--   5. confirm_order_from_payment : payout = formule sur (montant_total - livraison_fee)
--      → commission LASSI sur articles uniquement, livraison_fee va au livreur
--   6. reconcile_missing_payouts : même formule
--
-- Invariants gardien-paiements respectés :
--   R6  payout_net <= prix_base (prix articles uniquement)
--       Exemple : articles=11F, commission=1F, livraison=800F
--       montant_total = 812F, montant_hors_livraison = 12F
--       payout_om = FLOOR((12×0.99 - 1) / 1.008) = 10F ≤ prix_base(11) ✓
--   R3  Signature change → DROP avant CREATE (create_payment_intent 7→8, create_order_atomic 11→12)
--   R2  Contrainte check_montants mise à jour : montant_total = prix_base + commission + livraison_fee
-- ===========================================================================

-- ─── 1. Colonnes ─────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS livraison_fee INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS livraison_fee INTEGER NOT NULL DEFAULT 0;

-- ─── 2. Contrainte check_montants ────────────────────────────────────────────
-- Ancienne : montant_total = prix_base + commission_lassi
-- Nouvelle  : montant_total = prix_base + commission_lassi + livraison_fee
-- NOT VALID → n'invalide pas les lignes existantes (livraison_fee=0 → équivalent)

ALTER TABLE public.payment_intents
  DROP CONSTRAINT IF EXISTS check_montants;

ALTER TABLE public.payment_intents
  ADD CONSTRAINT check_montants CHECK (
    (
      commission_lassi = CEIL(prix_base * 0.01)
      OR
      commission_lassi = CEIL(prix_base * 0.02)
    )
    AND montant_total = prix_base + commission_lassi + livraison_fee
  ) NOT VALID;


-- ─── 3. create_payment_intent (DROP 7-args + CREATE 8-args) ──────────────────
-- Règle R3 anti-PGRST203 : DROP l'ancienne signature avant de créer la nouvelle.

DROP FUNCTION IF EXISTS public.create_payment_intent(
  UUID, UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC
);

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id        UUID,
  p_client_id       UUID,
  p_prestataire_id  UUID,
  p_prix_base       INTEGER,
  p_moyen_paiement  TEXT,
  p_idempotency_key TEXT,
  p_commission_rate NUMERIC DEFAULT 0.01,
  p_livraison_fee   INTEGER DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_commission INTEGER;
  v_total      INTEGER;
  v_pi_id      UUID;
BEGIN
  SELECT id INTO v_pi_id
    FROM public.payment_intents
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_pi_id; END IF;

  IF p_commission_rate NOT IN (0.01, 0.02) THEN
    RAISE EXCEPTION 'commission_rate_invalide: %', p_commission_rate;
  END IF;

  IF p_livraison_fee < 0 OR p_livraison_fee > 100000 THEN
    RAISE EXCEPTION 'livraison_fee_invalide: % FCFA', p_livraison_fee;
  END IF;

  IF p_prix_base < 1 OR p_prix_base > 5000000 THEN
    RAISE EXCEPTION 'montant_invalide: % FCFA', p_prix_base;
  END IF;

  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RAISE EXCEPTION 'moyen_paiement_invalide: %', p_moyen_paiement;
  END IF;

  v_commission := CEIL(p_prix_base * p_commission_rate);
  -- montant_total facturé au client = articles + commission + livraison
  v_total      := p_prix_base + v_commission + p_livraison_fee;

  INSERT INTO public.payment_intents (
    order_id, client_id, prestataire_id,
    prix_base, commission_lassi, montant_total, livraison_fee,
    moyen_paiement, idempotency_key, statut
  ) VALUES (
    p_order_id, p_client_id, p_prestataire_id,
    p_prix_base, v_commission, v_total, p_livraison_fee,
    p_moyen_paiement, p_idempotency_key, 'pending'
  ) RETURNING id INTO v_pi_id;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (v_pi_id, 'created', jsonb_build_object(
    'prix_base',       p_prix_base,
    'commission',      v_commission,
    'livraison_fee',   p_livraison_fee,
    'total',           v_total,
    'moyen',           p_moyen_paiement,
    'commission_rate', p_commission_rate
  ));

  RETURN v_pi_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC, INTEGER)
  TO service_role;


-- ─── 4. initiate_order_payment — lit livraison_fee depuis orders ──────────────
-- Même signature (3 args) → CREATE OR REPLACE sans DROP.
-- Hérite de 20260810000000 : accepte status IN ('new', 'pending').

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
  v_livraison_fee   INTEGER;
  v_idempotency_key TEXT;
  v_pi_id           UUID;
  v_blocking_id     UUID;
  v_is_vip          BOOLEAN;
  v_commission_rate NUMERIC;
  v_commission      INTEGER;
BEGIN
  IF p_moyen_paiement NOT IN ('wave', 'orange_money') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_method');
  END IF;

  SELECT id, client_id, shop_id, status, total, discount_amount, livraison_fee
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

  -- Accepte 'pending' (commandes Wave/OM) ET 'new' (commandes cash converties)
  IF v_order.status NOT IN ('new', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  END IF;

  SELECT COALESCE(SUM(qty * unit_price), 0) INTO v_items_total
    FROM public.order_items WHERE order_id = p_order_id;

  -- prix_base = articles uniquement (livraison_fee stocké séparément)
  v_prix_base     := GREATEST(v_items_total - COALESCE(v_order.discount_amount, 0), 1);
  v_livraison_fee := COALESCE(v_order.livraison_fee, 0);

  -- orders.total = articles uniquement (pas livraison) → vérification intégrité
  IF v_prix_base <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  END IF;

  IF v_prix_base < 1 OR v_prix_base > 5000000 THEN
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

  SELECT EXISTS(
    SELECT 1 FROM public.vip_profils
    WHERE shop_id = v_order.shop_id AND actif = true
  ) INTO v_is_vip;

  v_commission_rate := CASE WHEN v_is_vip THEN 0.02 ELSE 0.01 END;
  v_commission      := CEIL(v_prix_base * v_commission_rate)::INTEGER;

  -- Clé inclut livraison_fee : évite de recycler un payment_intent sans livraison
  -- si le client réessaie avec livraison (et inversement).
  v_idempotency_key :=
    'pay_' || p_order_id::text
    || '_'  || v_prix_base::text
    || '_'  || p_moyen_paiement
    || '_'  || REPLACE(v_commission_rate::text, '.', 'p')
    || '_l' || v_livraison_fee::text;

  v_pi_id := public.create_payment_intent(
    p_order_id, p_client_id, v_prestataire_id,
    v_prix_base, p_moyen_paiement, v_idempotency_key,
    v_commission_rate, v_livraison_fee
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'payment_intent_id', v_pi_id,
    'prix_base',         v_prix_base,
    'commission',        v_commission,
    'commission_rate',   v_commission_rate,
    'is_vip',            v_is_vip,
    'livraison_fee',     v_livraison_fee,
    'montant_total',     v_prix_base + v_commission + v_livraison_fee,
    'prestataire_id',    v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT)
  TO service_role;


-- ─── 5. confirm_order_from_payment — payout exclut livraison_fee ─────────────
-- Le prestataire ne reçoit que sa rémunération sur les articles.
-- La livraison_fee est collectée par LASSI et reversée au livreur séparément.
-- Hérite de 20260808020000 : pay_method + payout_queue + audit log.

CREATE OR REPLACE FUNCTION public.confirm_order_from_payment(
  p_payment_intent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi                     public.payment_intents%ROWTYPE;
  v_pay_method             TEXT;
  v_payout_montant         NUMERIC;
  v_montant_hors_livraison NUMERIC;

  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;
BEGIN
  SELECT * INTO v_pi
  FROM public.payment_intents
  WHERE id = p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  END IF;

  IF v_pi.statut = 'split_done' THEN
    RETURN jsonb_build_object(
      'ok', true, 'already_done', true,
      'order_id', v_pi.order_id, 'reservation_id', v_pi.reservation_id
    );
  END IF;

  IF v_pi.statut NOT IN ('confirmed', 'simulated') THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'payment_not_confirmed', 'statut', v_pi.statut
    );
  END IF;

  -- Rémunération prestataire = total hors frais de livraison
  v_montant_hors_livraison := v_pi.montant_total - COALESCE(v_pi.livraison_fee, 0);

  v_payout_montant := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN
      FLOOR(
        (v_montant_hors_livraison * (1 - OM_MERCHANT_FEE) - v_pi.commission_lassi)
        / (1 + OM_CASHIN_FEE)
      )
    WHEN 'wave' THEN
      FLOOR(
        (v_montant_hors_livraison * (1 - WAVE_COLLECT_FEE) - v_pi.commission_lassi)
        / (1 + WAVE_PAYOUT_FEE)
      )
    ELSE
      v_pi.prix_base
  END;

  -- Garde R6 : payout_net <= prix_base (prix articles uniquement)
  IF v_payout_montant IS NULL OR v_payout_montant <= 0 OR v_payout_montant > v_pi.prix_base THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'payout_amount_invalid',
      'payout_montant',  v_payout_montant,
      'prix_base',       v_pi.prix_base,
      'total',           v_pi.montant_total,
      'livraison_fee',   v_pi.livraison_fee,
      'commission',      v_pi.commission_lassi
    );
  END IF;

  v_pay_method := CASE v_pi.moyen_paiement
    WHEN 'orange_money' THEN 'om'
    WHEN 'wave'         THEN 'wave'
    ELSE v_pi.moyen_paiement
  END;

  UPDATE public.payment_intents
  SET statut = 'split_done', split_done_at = NOW(), updated_at = NOW()
  WHERE id = p_payment_intent_id;

  IF v_pi.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'new', pay_method = v_pay_method
    WHERE id = v_pi.order_id AND status = 'pending';
  END IF;

  IF v_pi.reservation_id IS NOT NULL THEN
    UPDATE public.reservations_terrain
    SET statut = 'paye', updated_at = NOW()
    WHERE id = v_pi.reservation_id AND statut = 'en_attente';
  END IF;

  INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
  VALUES (p_payment_intent_id, v_pi.prestataire_id, v_payout_montant::INTEGER)
  ON CONFLICT (payment_intent_id) DO NOTHING;

  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (
    p_payment_intent_id, 'split_done',
    jsonb_build_object(
      'order_id',         v_pi.order_id,
      'reservation_id',   v_pi.reservation_id,
      'prix_base',        v_pi.prix_base,
      'commission',       v_pi.commission_lassi,
      'livraison_fee',    v_pi.livraison_fee,
      'total',            v_pi.montant_total,
      'montant_hors_liv', v_montant_hors_livraison,
      'payout_montant',   v_payout_montant,
      'moyen_paiement',   v_pi.moyen_paiement,
      'pay_method',       v_pay_method,
      'external_ref',     v_pi.external_ref
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id',       v_pi.order_id,
    'reservation_id', v_pi.reservation_id,
    'montant_total',  v_pi.montant_total,
    'payout_montant', v_payout_montant
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_from_payment(UUID) TO service_role;


-- ─── 6. reconcile_missing_payouts — même formule ─────────────────────────────

CREATE OR REPLACE FUNCTION public.reconcile_missing_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pi                     public.payment_intents%ROWTYPE;
  v_payout_montant         NUMERIC;
  v_montant_hors_livraison NUMERIC;
  v_count                  INTEGER := 0;

  OM_MERCHANT_FEE  CONSTANT NUMERIC := 0.01;
  OM_CASHIN_FEE    CONSTANT NUMERIC := 0.008;
  WAVE_COLLECT_FEE CONSTANT NUMERIC := 0.01;
  WAVE_PAYOUT_FEE  CONSTANT NUMERIC := 0.01;
BEGIN
  FOR v_pi IN
    SELECT pi.*
    FROM public.payment_intents pi
    WHERE pi.statut = 'split_done'
      AND pi.split_done_at >= NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.payout_queue pq
        WHERE pq.payment_intent_id = pi.id
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    v_montant_hors_livraison := v_pi.montant_total - COALESCE(v_pi.livraison_fee, 0);

    v_payout_montant := CASE v_pi.moyen_paiement
      WHEN 'orange_money' THEN
        FLOOR(
          (v_montant_hors_livraison * (1 - OM_MERCHANT_FEE) - v_pi.commission_lassi)
          / (1 + OM_CASHIN_FEE)
        )
      WHEN 'wave' THEN
        FLOOR(
          (v_montant_hors_livraison * (1 - WAVE_COLLECT_FEE) - v_pi.commission_lassi)
          / (1 + WAVE_PAYOUT_FEE)
        )
      ELSE
        v_pi.prix_base
    END;

    CONTINUE WHEN v_payout_montant IS NULL
               OR v_payout_montant <= 0
               OR v_payout_montant > v_pi.prix_base;

    INSERT INTO public.payout_queue (payment_intent_id, prestataire_id, montant)
    VALUES (v_pi.id, v_pi.prestataire_id, v_payout_montant::INTEGER)
    ON CONFLICT (payment_intent_id) DO NOTHING;

    INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
    VALUES (
      v_pi.id, 'payout_reconciled',
      jsonb_build_object(
        'payout_montant',   v_payout_montant,
        'livraison_fee',    v_pi.livraison_fee,
        'moyen_paiement',   v_pi.moyen_paiement,
        'reconciled_at',    NOW()
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'reconciled', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_missing_payouts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_missing_payouts() TO service_role;


-- ─── 7. create_order_atomic (DROP 11-args + CREATE 12-args) ──────────────────
-- Règle R3 : DROP avant CREATE, signature change 11 → 12 params.
-- Hérite de 20260808020000 : status='pending' pour wave/om, 'new' pour cash.

DROP FUNCTION IF EXISTS public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
);

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
  p_items           JSONB,
  p_pay_method      TEXT    DEFAULT 'wave',
  p_livraison_fee   INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_order_id UUID;
  v_status   TEXT;
  v_pm       TEXT;
BEGIN
  v_pm     := COALESCE(p_pay_method, 'wave');
  v_status := CASE WHEN v_pm IN ('wave', 'om') THEN 'pending' ELSE 'new' END;

  INSERT INTO public.orders (
    shop_id, client_id, client_name,
    total, discount_amount, promo_label,
    status, pay_method, order_type,
    note, idempotency_key, livraison_fee
  )
  VALUES (
    p_shop_id, p_client_id, p_client_name,
    p_total, p_discount_amount, p_promo_label,
    v_status, v_pm, p_order_type,
    p_note, p_idempotency_key,
    GREATEST(COALESCE(p_livraison_fee, 0), 0)
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_name, qty, unit_price)
  SELECT
    v_order_id,
    (item ->> 'product_name')::TEXT,
    (item ->> 'qty')::INTEGER,
    (item ->> 'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  IF p_total > 100000 THEN
    BEGIN
      PERFORM public.raise_fraud_flag(
        'high_amount', 'order', v_order_id::text, 'medium',
        jsonb_build_object('total', p_total, 'shop_id', p_shop_id, 'client_id', p_client_id)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order_atomic(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, INTEGER
) TO service_role;


-- ─── 8. Vérification post-migration ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'orders'
      AND column_name  = 'livraison_fee'
  ) THEN
    RAISE EXCEPTION '[lassi] orders.livraison_fee manquante';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'payment_intents'
      AND column_name  = 'livraison_fee'
  ) THEN
    RAISE EXCEPTION '[lassi] payment_intents.livraison_fee manquante';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname        = 'create_payment_intent'
      AND pronamespace   = 'public'::regnamespace
      AND pronargs       = 8
  ) THEN
    RAISE EXCEPTION '[lassi] create_payment_intent 8-args introuvable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname        = 'create_payment_intent'
      AND pronamespace   = 'public'::regnamespace
      AND pronargs       = 7
  ) THEN
    RAISE EXCEPTION '[lassi] create_payment_intent 7-args encore présente — DROP raté';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname        = 'create_order_atomic'
      AND pronamespace   = 'public'::regnamespace
      AND pronargs       = 12
  ) THEN
    RAISE EXCEPTION '[lassi] create_order_atomic 12-args introuvable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname        = 'create_order_atomic'
      AND pronamespace   = 'public'::regnamespace
      AND pronargs       = 11
  ) THEN
    RAISE EXCEPTION '[lassi] create_order_atomic 11-args encore présente — DROP raté';
  END IF;

  RAISE NOTICE '[lassi] migration vip_livraison_fee OK';
END;
$$;

NOTIFY pgrst, 'reload schema';
