-- ============================================================
-- Fix : créditer les points classement lors de la validation
--       d'une réservation terrain (basket/football/etc.)
--
-- Cause : le trigger trg_orders_scoring ne couvre que la table
-- `orders`. Les terrains utilisent `reservations_terrain` → aucun
-- point n'était jamais crédité → classement figé.
--
-- Solution : trigger AFTER UPDATE sur reservations_terrain qui
-- appelle ajouter_points_commande / ajouter_points_client dès que
-- validated_at passe de NULL à non-NULL (scan QR validé).
-- ============================================================

-- ─── 1. Fonction trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_scoring_terrain_valide()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sous_categorie TEXT;
  v_quartier       TEXT;
  v_sport_type     TEXT;
BEGIN
  -- Sous-catégorie : 1re sous-catégorie de la boutique du prestataire,
  -- puis catégorie, puis sport_type du terrain, puis 'terrain' en dernier recours
  SELECT
    COALESCE(to_jsonb(s.subcategories) ->> 0, s.category),
    s.zone,
    t.sport_type
  INTO v_sous_categorie, v_quartier, v_sport_type
  FROM terrains t
  LEFT JOIN shops s ON s.merchant_id = NEW.prestataire_id
  WHERE t.id = NEW.terrain_id;

  v_sous_categorie := COALESCE(v_sous_categorie, v_sport_type, 'terrain');

  -- Crédite le prestataire
  PERFORM ajouter_points_commande(
    NEW.prestataire_id,   -- profiles.id du gérant de terrain
    v_sous_categorie,
    v_quartier,
    NEW.prix_total
  );

  -- Crédite le client
  IF NEW.client_id IS NOT NULL THEN
    PERFORM ajouter_points_client(NEW.client_id, NEW.prestataire_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION trg_scoring_terrain_valide() FROM PUBLIC;

-- ─── 2. Trigger ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_reservations_terrain_scoring ON reservations_terrain;

CREATE TRIGGER trg_reservations_terrain_scoring
  AFTER UPDATE ON reservations_terrain
  FOR EACH ROW
  WHEN (NEW.validated_at IS NOT NULL AND OLD.validated_at IS NULL)
  EXECUTE FUNCTION trg_scoring_terrain_valide();

-- ─── 3. Backfill : points de la semaine courante ─────────────────────────────
-- Crédite prestataire_scores pour les réservations déjà validées depuis
-- le dernier reset hebdomadaire (lundi UTC de la semaine courante).
-- Le cron pg_cron de dimanche lira ces scores et mettra à jour classements.

DO $$
DECLARE
  v_rec            RECORD;
  v_sous_categorie TEXT;
  v_quartier       TEXT;
  v_sport_type     TEXT;
  v_week_start     TIMESTAMPTZ;
  v_count          INTEGER := 0;
BEGIN
  v_week_start := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  FOR v_rec IN
    SELECT rt.prestataire_id, rt.client_id, rt.prix_total, rt.terrain_id
    FROM reservations_terrain rt
    WHERE rt.validated_at >= v_week_start
      AND rt.statut = 'utilise'
  LOOP
    SELECT
      COALESCE(to_jsonb(s.subcategories) ->> 0, s.category),
      s.zone,
      t.sport_type
    INTO v_sous_categorie, v_quartier, v_sport_type
    FROM terrains t
    LEFT JOIN shops s ON s.merchant_id = v_rec.prestataire_id
    WHERE t.id = v_rec.terrain_id;

    v_sous_categorie := COALESCE(v_sous_categorie, v_sport_type, 'terrain');

    PERFORM ajouter_points_commande(
      v_rec.prestataire_id,
      v_sous_categorie,
      v_quartier,
      v_rec.prix_total
    );

    IF v_rec.client_id IS NOT NULL THEN
      PERFORM ajouter_points_client(v_rec.client_id, v_rec.prestataire_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill terrain scoring : % réservation(s) créditée(s)', v_count;
END $$;

NOTIFY pgrst, 'reload schema';
