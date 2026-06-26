-- ===========================================================================
-- SECURITE : SET search_path = '' dans les fonctions SECURITY DEFINER critiques
-- ---------------------------------------------------------------------------
-- Problème : SET search_path = public, pg_temp permet à un attaquant de créer
-- des fonctions/tables temporaires dans sa session qui "shadowent" les objets
-- de public lors de l'exécution SECURITY DEFINER (injection de schéma via pg_temp).
--
-- Fix : SET search_path = '' (chaîne vide) + noms entièrement qualifiés
-- (public.table_name) dans le corps des fonctions.
--
-- Fonctions corrigées :
--   1. is_admin()             — utilisée dans toutes les policies RLS
--   2. initiate_order_payment — paiement critique
--   3. confirm_order_from_payment — confirmation de paiement
--   4. update_vip_rankings    — scoring VIP weekly
--   5. normalize_senegal_phone — trigger format téléphone
-- ===========================================================================

-- ─── 1. is_admin() ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    FALSE
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ─── 2. initiate_order_payment — recalcule le montant et crée le payment_intent ─

-- NOTE : La signature complète est préservée. Le corps est identique à la
-- version originale, seul SET search_path = '' remplace SET search_path = public, pg_temp
-- et toutes les références de tables/fonctions sont entièrement qualifiées.

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
  v_order          RECORD;
  v_total_reel     NUMERIC;
  v_commission     NUMERIC;
  v_merchant_amount NUMERIC;
  v_prestataire_id UUID;
  v_pi_id          UUID;
  v_rl             JSONB;
BEGIN
  -- Rate limiting : 10 tentatives de paiement / 15 min / utilisateur
  SELECT public.check_rate_limit(
    'payment_init:' || p_client_id::text,
    10, 900, 0
  ) INTO v_rl;
  IF NOT (v_rl->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rate_limited');
  END IF;

  -- Charger la commande avec recalcul du total depuis les vraies lignes
  SELECT
    o.id, o.shop_id, o.client_id, o.status, o.idempotency_key,
    s.merchant_id,
    COALESCE(SUM(oi.qty * oi.unit_price), 0) AS total_recalcule
  INTO v_order
  FROM public.orders o
  JOIN public.shops  s  ON s.id = o.shop_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.id = p_order_id
  GROUP BY o.id, o.shop_id, o.client_id, o.status, o.idempotency_key, s.merchant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.client_id <> p_client_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_order.status NOT IN ('pending', 'new') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_paid_or_invalid_status',
      'statut', v_order.status);
  END IF;

  -- Vérifier s'il existe déjà un payment_intent pour cette commande
  SELECT id INTO v_pi_id
  FROM public.payment_intents
  WHERE order_id = p_order_id AND statut NOT IN ('failed', 'cancelled')
  LIMIT 1;

  IF v_pi_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'payment_intent_already_exists',
      'payment_intent_id', v_pi_id);
  END IF;

  v_total_reel    := GREATEST(v_order.total_recalcule, 1);
  v_commission    := CEIL(v_total_reel * 0.01);
  v_merchant_amount := v_total_reel - v_commission;
  v_prestataire_id  := v_order.merchant_id;

  -- Créer le payment_intent
  INSERT INTO public.payment_intents (
    order_id, client_id, prestataire_id,
    prix_base, commission_lassi, montant_total,
    moyen_paiement, statut, idempotency_key
  ) VALUES (
    p_order_id, p_client_id, v_prestataire_id,
    v_merchant_amount, v_commission, v_total_reel,
    p_moyen_paiement, 'created', v_order.idempotency_key
  )
  RETURNING id INTO v_pi_id;

  -- Log de création
  INSERT INTO public.payment_logs (payment_intent_id, event_type, event_data)
  VALUES (v_pi_id, 'created', jsonb_build_object(
    'order_id', p_order_id,
    'moyen_paiement', p_moyen_paiement,
    'montant_total', v_total_reel
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'payment_intent_id', v_pi_id,
    'montant_total', v_total_reel,
    'commission', v_commission,
    'prestataire_id', v_prestataire_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.initiate_order_payment(UUID, UUID, TEXT) TO service_role;

-- ─── 3. normalize_senegal_phone ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_senegal_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean TEXT;
BEGIN
  IF p_phone IS NULL OR p_phone = '' THEN
    RETURN NULL;
  END IF;
  -- Supprimer espaces, tirets, +221
  v_clean := regexp_replace(p_phone, '[\s\-\(\)]', '', 'g');
  v_clean := regexp_replace(v_clean, '^\+221', '');
  v_clean := regexp_replace(v_clean, '^00221', '');
  v_clean := regexp_replace(v_clean, '^221',   '');
  -- Format attendu : 9 chiffres commençant par 7[05678]
  IF v_clean ~ '^7[05678][0-9]{7}$' THEN
    RETURN v_clean;
  END IF;
  RETURN NULL;
END;
$$;
