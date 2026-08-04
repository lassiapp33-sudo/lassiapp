-- ===========================================================================
-- LASSI — Commission 2 % pour les établissements 5 Étoiles
-- ---------------------------------------------------------------------------
-- AVANT : commission_lassi = CEIL(prix_base × 0.01) pour tous
-- APRÈS : commission_lassi = CEIL(prix_base × 0.02) si le shop a un profil
--         actif dans vip_profils, sinon CEIL(prix_base × 0.01)
--
-- Source de vérité VIP : vip_profils.actif = true (pas shops.is_vip)
-- La présence dans vip_profils = passage par l'admin via create-vip-gerant.
--
-- Changements :
--   1. check_montants       → accepte CEIL×0.01 OU CEIL×0.02
--   2. create_payment_intent → paramètre p_commission_rate (défaut 0.01)
--                              DROP requis car signature change (6 → 7 args)
--   3. initiate_order_payment → JOIN vip_profils → taux correct auto
--   4. creer_commande_alaune  → idem (affichage commission à la une)
-- ===========================================================================


-- ─── 1. Contrainte check_montants ────────────────────────────────────────────
-- Accepte désormais 1 % (standard) ou 2 % (VIP 5 Étoiles).
-- NOT VALID = ne revalide pas les anciennes lignes (elles restent à 1 %).

ALTER TABLE public.payment_intents
  DROP CONSTRAINT IF EXISTS check_montants;

ALTER TABLE public.payment_intents
  ADD CONSTRAINT check_montants CHECK (
    (
      commission_lassi = CEIL(prix_base * 0.01)  -- prestataire standard
      OR
      commission_lassi = CEIL(prix_base * 0.02)  -- établissement 5 Étoiles
    )
    AND montant_total = prix_base + commission_lassi
  ) NOT VALID;


-- ─── 2. create_payment_intent (DROP + CREATE — signature change 6 → 7 args) ─
-- Règle anti-PGRST203 : toujours DROP l'ancienne avant de créer la nouvelle
-- quand la signature change.

DROP FUNCTION IF EXISTS public.create_payment_intent(
  UUID, UUID, UUID, INTEGER, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_order_id        UUID,
  p_client_id       UUID,
  p_prestataire_id  UUID,
  p_prix_base       INTEGER,
  p_moyen_paiement  TEXT,
  p_idempotency_key TEXT,
  p_commission_rate NUMERIC DEFAULT 0.01   -- 0.01 standard / 0.02 VIP
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
  -- Idempotence : même clé → retourner l'existant
  SELECT id INTO v_pi_id
    FROM public.payment_intents
    WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_pi_id; END IF;

  -- Taux : 1 % standard ou 2 % VIP — imposé par l'appelant (initiate_order_payment)
  -- Bornes de sécurité : on refuse tout taux hors [0.01, 0.02]
  IF p_commission_rate NOT IN (0.01, 0.02) THEN
    RAISE EXCEPTION 'commission_rate_invalide: %', p_commission_rate;
  END IF;

  v_commission := CEIL(p_prix_base * p_commission_rate);
  v_total      := p_prix_base + v_commission;

  IF p_prix_base < 1 OR p_prix_base > 5000000 THEN
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
    'prix_base',       p_prix_base,
    'commission',      v_commission,
    'total',           v_total,
    'moyen',           p_moyen_paiement,
    'commission_rate', p_commission_rate
  ));

  RETURN v_pi_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_payment_intent(UUID, UUID, UUID, INTEGER, TEXT, TEXT, NUMERIC)
  TO service_role;


-- ─── 3. initiate_order_payment — détection VIP + taux dynamique ──────────────
-- Même signature (3 args) → CREATE OR REPLACE sans DROP.

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
  v_is_vip          BOOLEAN;
  v_commission_rate NUMERIC;
  v_commission      INTEGER;
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

  -- Taux VIP : 2 % si le shop a un profil actif dans vip_profils, sinon 1 %
  SELECT EXISTS(
    SELECT 1 FROM public.vip_profils
    WHERE shop_id = v_order.shop_id AND actif = true
  ) INTO v_is_vip;

  v_commission_rate := CASE WHEN v_is_vip THEN 0.02 ELSE 0.01 END;
  v_commission      := CEIL(v_prix_base * v_commission_rate)::INTEGER;

  -- La clé d'idempotence inclut le taux pour éviter de recycler un ancien
  -- payment_intent à 1 % si le shop vient d'être promu VIP (ou inversement).
  v_idempotency_key :=
    'pay_' || p_order_id::text
    || '_'  || v_prix_base::text
    || '_'  || p_moyen_paiement
    || '_'  || REPLACE(v_commission_rate::text, '.', 'p');  -- ex: "0p02"

  v_pi_id := public.create_payment_intent(
    p_order_id, p_client_id, v_prestataire_id,
    v_prix_base, p_moyen_paiement, v_idempotency_key,
    v_commission_rate
  );

  RETURN jsonb_build_object(
    'ok',                true,
    'payment_intent_id', v_pi_id,
    'prix_base',         v_prix_base,
    'commission',        v_commission,
    'commission_rate',   v_commission_rate,
    'is_vip',            v_is_vip,
    'montant_total',     v_prix_base + v_commission,
    'prestataire_id',    v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT)
  TO service_role;


-- ─── 4. creer_commande_alaune — commission affichée correcte pour VIP ─────────
-- Même signature (3 args) → CREATE OR REPLACE sans DROP.

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
  v_client_id       uuid := auth.uid();
  v_actif           boolean;
  v_expire_at       timestamptz;
  v_presta_id       uuid;
  v_elements        jsonb;
  v_element         jsonb;
  v_nom             text;
  v_prix            numeric;
  v_shop_id         uuid;
  v_shop_name       text;
  v_is_vip          boolean;
  v_commission_rate numeric;
  v_commission      numeric;
  v_total           numeric;
  v_total_client    numeric;
  v_profile_name    text;
  v_order_result    jsonb;
  v_order_id        uuid;
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

  -- Taux VIP : 2 % si profil 5 Étoiles actif, sinon 1 %
  SELECT EXISTS(
    SELECT 1 FROM vip_profils WHERE shop_id = v_shop_id AND actif = true
  ) INTO v_is_vip;

  v_commission_rate := CASE WHEN v_is_vip THEN 0.02 ELSE 0.01 END;
  v_total           := v_prix * p_qty;
  v_commission      := CEIL(v_total * v_commission_rate);
  v_total_client    := v_total + v_commission;

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
    'orderId',         v_order_id,
    'total',           v_total,
    'commission',      v_commission,
    'commissionRate',  v_commission_rate,
    'isVip',          v_is_vip,
    'totalClient',    v_total_client,
    'elementNom',     v_nom,
    'shopName',       v_shop_name,
    'shopId',         v_shop_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.creer_commande_alaune(uuid, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.creer_commande_alaune(uuid, text, integer) TO authenticated;


-- ─── 5. Vérification post-migration ──────────────────────────────────────────
-- Validation instantanée : s'assure que les fonctions sont cohérentes.

DO $$
BEGIN
  -- create_payment_intent existe bien avec 7 args
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_payment_intent'
      AND pronamespace = 'public'::regnamespace
      AND pronargs = 7
  ) THEN
    RAISE EXCEPTION '[lassi] create_payment_intent 7-args introuvable après migration';
  END IF;

  -- L'ancienne version 6-args n'existe plus
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'create_payment_intent'
      AND pronamespace = 'public'::regnamespace
      AND pronargs = 6
  ) THEN
    RAISE EXCEPTION '[lassi] create_payment_intent 6-args encore présente — DROP raté';
  END IF;

  RAISE NOTICE '[lassi] migration vip_commission_2pct OK';
END;
$$;

NOTIFY pgrst, 'reload schema';
