-- ===========================================================================
-- LASSİ — "Épingle dorée" (carte) : mise en avant du pin d'un commerce sur
-- la carte (offre "carte" du sélecteur de visibilité).
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ===========================================================================

-- ─── 1. Nouvelle colonne ────────────────────────────────────────────────────
-- Tant que carte_pin_until est dans le futur, le pin du commerce sur la carte
-- est affiché en doré (épinglé), quelle que soit l'origine (don admin via
-- recompenses_attribuees ou futur achat via crédit LASSI).

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS carte_pin_until TIMESTAMPTZ;

-- ─── 2. shops_effective : exposer is_effectively_carte_pin ─────────────────
-- DROP + CREATE car l'ajout de carte_pin_until à shops décale les colonnes
-- de SELECT s.* (cf. migrations précédentes sur shops_effective).
-- WITH (security_invoker = on) pour préserver le correctif de
-- 20260610020000_section2_shops_effective_invoker.sql.

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
    (s.carte_pin_until IS NOT NULL AND s.carte_pin_until > NOW()) AS is_effectively_carte_pin
  FROM shops s;

-- ─── 3. Étendre shops_protect_vip_fields à carte_pin_until ─────────────────
-- Même protection que les autres champs de mise en avant : un marchand ne
-- peut pas s'auto-attribuer l'épingle dorée via un PATCH direct sur shops.

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
  NEW.manual_note            := OLD.manual_note;

  RETURN NEW;
END;
$$;

-- ─── 4. grant_carte_pin : helper réutilisable pour activer/prolonger l'épingle ──
-- Prolonge l'épingle dorée de p_days jours à partir de son expiration actuelle
-- si elle est encore active, sinon à partir de maintenant. Utilisable depuis
-- n'importe quelle Edge Function (service_role) : don admin OU futur achat via
-- crédit LASSI (offre "carte"). Retourne la nouvelle date d'expiration.

CREATE OR REPLACE FUNCTION grant_carte_pin(p_shop_id UUID, p_days INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_until TIMESTAMPTZ;
BEGIN
  UPDATE shops
  SET    carte_pin_until = GREATEST(COALESCE(carte_pin_until, NOW()), NOW()) + (p_days || ' days')::INTERVAL
  WHERE  id = p_shop_id
  RETURNING carte_pin_until INTO v_new_until;

  RETURN v_new_until;
END;
$$;
