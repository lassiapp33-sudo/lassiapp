-- ============================================================
-- Fix : creer_annonce_sponsorisee ne débitait pas le crédit
-- ============================================================
-- PROBLÈME : shops_vip_protect (BEFORE UPDATE) restaure credit_balance
-- à l'ancienne valeur pour tout user 'authenticated' non-admin.
-- Or creer_annonce_sponsorisee est SECURITY DEFINER mais auth.role()
-- retourne quand même 'authenticated' (JWT du client) — le trigger ne
-- peut pas le distinguer d'un PATCH REST direct.
--
-- FIX : variable de session lassi.trusted_fn signalée par les RPC
-- internes autorisées avant leur UPDATE sur credit_balance.
-- Le trigger autorise l'opération si la variable est 'true'.
-- ============================================================

-- ─── 1. Mettre à jour le trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION shops_protect_vip_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_jwt_role TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  v_jwt_role := auth.role();

  -- Appels directs DB (pg_cron, migrations) : pas de JWT → autorisé
  IF v_jwt_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- service_role (Edge Functions) → autorisé
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- RPC SECURITY DEFINER de confiance (ex. creer_annonce_sponsorisee) : signale
  -- son intention via set_config('lassi.trusted_fn', 'true', true)
  IF current_setting('lassi.trusted_fn', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Utilisateur authentifié admin → autorisé
  IF v_jwt_role = 'authenticated' AND auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin
    FROM profiles WHERE id = auth.uid();
    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tout autre appelant : restaurer silencieusement les champs protégés
  NEW.is_vip                 := OLD.is_vip;
  NEW.vip_exclu              := OLD.vip_exclu;
  NEW.vip_manual             := OLD.vip_manual;
  NEW.vip_manual_until       := OLD.vip_manual_until;
  NEW.is_featured            := OLD.is_featured;
  NEW.featured_manual        := OLD.featured_manual;
  NEW.featured_manual_until  := OLD.featured_manual_until;
  NEW.featured_product_id    := OLD.featured_product_id;
  NEW.featured_product_ids   := OLD.featured_product_ids;
  NEW.featured_all_products  := OLD.featured_all_products;
  NEW.carte_pin_until        := OLD.carte_pin_until;
  NEW.recherche_boost_until  := OLD.recherche_boost_until;
  NEW.credit_balance         := OLD.credit_balance;
  NEW.manual_note            := OLD.manual_note;

  RETURN NEW;
END;
$$;

-- ─── 2. Mettre à jour creer_annonce_sponsorisee ──────────────────────────────
-- Signale au trigger qu'il s'agit d'un débit légitime avant l'UPDATE.

DROP FUNCTION IF EXISTS creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION creer_annonce_sponsorisee(
  p_shop_id        UUID,
  p_format         TEXT,
  p_titre          TEXT,
  p_corps          TEXT,
  p_image_url      TEXT,
  p_budget_credits INTEGER,
  p_duration_hours INTEGER,
  p_est_min        INTEGER,
  p_est_max        INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id UUID;
  v_balance     INTEGER;
  v_expires_at  TIMESTAMPTZ;
  v_ad_id       UUID;
BEGIN
  -- Vérifier que l'appelant est bien le propriétaire du shop
  SELECT merchant_id INTO v_merchant_id
  FROM shops WHERE id = p_shop_id;

  IF v_merchant_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validation du format
  IF p_format NOT IN ('classique', 'affiche') THEN
    RAISE EXCEPTION 'format_invalide';
  END IF;

  -- Vérifier le solde de crédit
  SELECT credit_balance INTO v_balance
  FROM shops WHERE id = p_shop_id;

  IF COALESCE(v_balance, 0) < p_budget_credits THEN
    RAISE EXCEPTION 'credit_insuffisant: % disponibles, % requis', COALESCE(v_balance, 0), p_budget_credits;
  END IF;

  -- Signaler au trigger que ce débit est autorisé (local à la transaction)
  PERFORM set_config('lassi.trusted_fn', 'true', true);

  -- Déduire le crédit
  UPDATE shops
  SET credit_balance = credit_balance - p_budget_credits
  WHERE id = p_shop_id;

  -- Retirer le signal (bonne pratique, même si la variable est locale)
  PERFORM set_config('lassi.trusted_fn', 'false', true);

  -- Calculer la date d'expiration
  v_expires_at := now() + (p_duration_hours || ' hours')::INTERVAL;

  -- Insérer l'annonce
  INSERT INTO sponsored_ads (
    shop_id, merchant_id, format, titre, corps, image_url,
    budget_credits, duration_hours,
    estimated_views_min, estimated_views_max,
    expires_at
  ) VALUES (
    p_shop_id, v_merchant_id, p_format, p_titre, p_corps, p_image_url,
    p_budget_credits, p_duration_hours,
    p_est_min, p_est_max,
    v_expires_at
  )
  RETURNING id INTO v_ad_id;

  RETURN json_build_object(
    'id',          v_ad_id,
    'expires_at',  v_expires_at,
    'new_balance', v_balance - p_budget_credits
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION creer_annonce_sponsorisee(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
