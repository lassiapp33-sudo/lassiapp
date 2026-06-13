-- ===========================================================================
-- LASSİ — Portefeuille crédit LASSI + "Booster recherche"
--
-- 1) credit_balance : solde dépensable par boutique, alimenté par les dons
--    admin (recompenses_attribuees.credit_lassi) et consommable pour acheter
--    un forfait de visibilité réel (quartier / recherche / carte) tant que
--    Wave/Orange Money ne sont pas encore configurés.
-- 2) recherche_boost_until : pendant du carte_pin_until (20260613010000) pour
--    l'offre "Booster ma position dans les recherches" — colonne dédiée
--    plutôt que recompenses_attribuees pour garantir que l'achat est TOUJOURS
--    appliqué (getBadgesActifsBatch ne retient qu'UNE récompense par
--    prestataire et pourrait masquer priorite_recherche si une autre
--    récompense active existe).
--
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor, APRÈS
-- 20260613010000_epingle_doree_carte.sql.
-- ===========================================================================

-- ─── 1. Nouvelles colonnes ──────────────────────────────────────────────────

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS credit_balance       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recherche_boost_until TIMESTAMPTZ;

ALTER TABLE shops
  ADD CONSTRAINT shops_credit_balance_non_negative CHECK (credit_balance >= 0);

-- ─── 2. shops_effective : exposer is_effectively_recherche_boost ──────────
-- DROP + CREATE car l'ajout des colonnes décale SELECT s.* (cf. migration
-- précédente sur shops_effective).

DROP VIEW IF EXISTS shops_effective CASCADE;
CREATE VIEW shops_effective WITH (security_invoker = on) AS
  SELECT
    s.*,
    (
      (s.is_vip = TRUE OR (s.vip_manual = TRUE AND (s.vip_manual_until IS NULL OR s.vip_manual_until > NOW())))
      AND s.vip_exclu = FALSE
    ) AS is_effectively_vip,
    (
      s.is_featured = TRUE
      OR (
        s.featured_manual = TRUE
        AND (s.featured_manual_until IS NULL OR s.featured_manual_until > NOW())
      )
    ) AS is_effectively_featured,
    (s.carte_pin_until IS NOT NULL AND s.carte_pin_until > NOW()) AS is_effectively_carte_pin,
    (s.recherche_boost_until IS NOT NULL AND s.recherche_boost_until > NOW()) AS is_effectively_recherche_boost
  FROM shops s;

-- ─── 3. Étendre shops_protect_vip_fields aux nouvelles colonnes ────────────
-- credit_balance et recherche_boost_until ne doivent être modifiables que par
-- service_role (Edge Functions) ou un admin — jamais par un PATCH direct du
-- marchand sur sa propre ligne shops.

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

  -- Appels directs DB (pg_cron, migrations, SECURITY DEFINER functions) → autorisés
  IF v_jwt_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- service_role JWT (Edge Functions admin) → autorisé
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Utilisateur authentifié : vérifier s'il est admin
  IF v_jwt_role = 'authenticated' AND auth.uid() IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin
    FROM profiles WHERE id = auth.uid();
    IF COALESCE(v_is_admin, FALSE) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Tous les autres : restaurer silencieusement les champs protégés
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

-- ─── 4. increment_shop_credit : créditer le portefeuille (don admin) ──────
-- Appelé par admin-attribuer-recompense quand creditLassi > 0.

CREATE OR REPLACE FUNCTION increment_shop_credit(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE shops
  SET    credit_balance = credit_balance + p_amount
  WHERE  id = p_shop_id
  RETURNING credit_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ─── 5. spend_shop_credit : débiter le portefeuille (achat forfait) ───────
-- Débit atomique : ne débite que si le solde est suffisant. Retourne le
-- nouveau solde, ou NULL si le solde était insuffisant (aucune ligne mise à
-- jour) — permet à l'appelant de détecter l'échec sans race condition.

CREATE OR REPLACE FUNCTION spend_shop_credit(p_shop_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE shops
  SET    credit_balance = credit_balance - p_amount
  WHERE  id = p_shop_id
    AND  credit_balance >= p_amount
  RETURNING credit_balance INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ─── 6. grant_recherche_boost : activer/prolonger le "Booster recherche" ───
-- Même logique que grant_carte_pin (20260613010000) : prolonge depuis
-- l'expiration actuelle si encore active, sinon depuis maintenant.

CREATE OR REPLACE FUNCTION grant_recherche_boost(p_shop_id UUID, p_days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_until TIMESTAMPTZ;
BEGIN
  UPDATE shops
  SET    recherche_boost_until = GREATEST(COALESCE(recherche_boost_until, NOW()), NOW()) + (p_days || ' days')::INTERVAL
  WHERE  id = p_shop_id
  RETURNING recherche_boost_until INTO v_new_until;

  RETURN v_new_until;
END;
$$;
