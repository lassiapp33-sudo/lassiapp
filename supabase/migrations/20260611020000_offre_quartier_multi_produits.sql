-- ===========================================================================
-- LASSİ — "Offre du quartier" : mise en avant de plusieurs produits ou de
-- toute la vitrine (mise en avant manuelle admin uniquement).
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ===========================================================================

-- ─── 1. Nouvelles colonnes ─────────────────────────────────────────────────

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS featured_product_ids  UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured_all_products BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Migrer l'ancien featured_product_id (mise en avant manuelle) ───────
-- Le champ singulier reste utilisé par le flux d'abonnement payé
-- (verify-visibility-payment) — on copie juste sa valeur dans le nouveau
-- tableau pour les commerces déjà mis en avant manuellement par l'admin.

UPDATE shops
SET    featured_product_ids = ARRAY[featured_product_id]
WHERE  featured_manual = TRUE
  AND  featured_product_id IS NOT NULL
  AND  featured_product_ids = '{}';

-- ─── 3. shops_effective : exposer les nouvelles colonnes (s.* les inclut) ──
-- DROP + CREATE car SELECT s.* fige la liste des colonnes à la création de
-- la vue (cf. 20260610030000_offre_quartier.sql).
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
    ) AS is_effectively_featured
  FROM shops s;

-- ─── 4. Étendre shops_protect_vip_fields aux nouveaux champs ───────────────

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
  NEW.manual_note            := OLD.manual_note;

  RETURN NEW;
END;
$$;
