-- ============================================================
-- LASSI · Initialisation automatique prestataire_scores
-- 2026-07-03
-- ============================================================
-- Problème : à la création d'un compte prestataire, aucune ligne
-- n'est insérée dans prestataire_scores. Le prestataire n'apparaît
-- pas dans le classement avant sa première commande validée.
--
-- Fix 1 : trigger AFTER INSERT ON shops → insertion immédiate dans
--         prestataire_scores avec 0 points.
-- Fix 2 : backfill pour les boutiques déjà existantes.
-- Fix 3 : deux RPCs "live" permettant à l'app d'afficher le
--         classement en temps réel (prestataire_scores) quand
--         le snapshot pg_cron n'existe pas encore pour la période.
-- ============================================================

-- ─── 1. Trigger : auto-init à la création d'une boutique ─────────────────────

CREATE OR REPLACE FUNCTION init_prestataire_scores_on_shop()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sous_cat TEXT;
BEGIN
  -- Même logique que trg_scoring_commande_validee : 1re sous-catégorie ou catégorie principale
  v_sous_cat := COALESCE(NULLIF(to_jsonb(NEW.subcategories) ->> 0, ''), NEW.category, 'autre');

  INSERT INTO prestataire_scores (prestataire_id, sous_categorie, quartier)
  VALUES (NEW.merchant_id, v_sous_cat, NEW.zone)
  ON CONFLICT (prestataire_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION init_prestataire_scores_on_shop() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_init_prestataire_scores ON shops;
CREATE TRIGGER trg_init_prestataire_scores
  AFTER INSERT ON shops
  FOR EACH ROW
  EXECUTE FUNCTION init_prestataire_scores_on_shop();

-- ─── 2. Backfill : boutiques existantes sans ligne prestataire_scores ─────────

INSERT INTO prestataire_scores (prestataire_id, sous_categorie, quartier)
SELECT
  s.merchant_id,
  COALESCE(NULLIF(to_jsonb(s.subcategories) ->> 0, ''), s.category, 'autre'),
  s.zone
FROM shops s
WHERE NOT EXISTS (
  SELECT 1 FROM prestataire_scores ps WHERE ps.prestataire_id = s.merchant_id
);

-- ─── 3. RPC live : classement sous-catégorie (avant snapshot pg_cron) ─────────

CREATE OR REPLACE FUNCTION get_classement_live_sous_categorie(p_sous_categorie TEXT)
RETURNS TABLE(
  prestataire_id UUID,
  rang           INTEGER,
  points         INTEGER,
  nom_affiche    TEXT,
  image_url      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ps.prestataire_id,
    ROW_NUMBER() OVER (ORDER BY ps.points_semaine DESC, ps.updated_at ASC)::INTEGER AS rang,
    ps.points_semaine AS points,
    COALESCE(s.name, '?') AS nom_affiche,
    s.logo_url AS image_url
  FROM prestataire_scores ps
  JOIN shops s ON s.merchant_id = ps.prestataire_id
  WHERE ps.sous_categorie = p_sous_categorie
  ORDER BY ps.points_semaine DESC, ps.updated_at ASC
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_sous_categorie(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_classement_live_sous_categorie(TEXT) TO anon, authenticated;

-- ─── 4. RPC live : classement mondial (avant snapshot pg_cron) ───────────────

CREATE OR REPLACE FUNCTION get_classement_live_mondial()
RETURNS TABLE(
  prestataire_id UUID,
  rang           INTEGER,
  points         INTEGER,
  nom_affiche    TEXT,
  image_url      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ps.prestataire_id,
    ROW_NUMBER() OVER (ORDER BY ps.points_mois DESC, ps.updated_at ASC)::INTEGER AS rang,
    ps.points_mois AS points,
    COALESCE(s.name, '?') AS nom_affiche,
    s.logo_url AS image_url
  FROM prestataire_scores ps
  JOIN shops s ON s.merchant_id = ps.prestataire_id
  ORDER BY ps.points_mois DESC, ps.updated_at ASC
  LIMIT 40;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_mondial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_classement_live_mondial() TO anon, authenticated;
