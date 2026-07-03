-- ============================================================
-- LASSI · Initialisation automatique client_scores
-- 2026-07-03
-- ============================================================
-- Même approche que 20260703000000_prestataire_scores_auto_init :
-- dès la création d'un compte client, insérer une ligne dans
-- client_scores (0 points) pour qu'il apparaisse immédiatement
-- dans le classement live, sans attendre sa première commande.
--
-- Fix 1 : trigger AFTER INSERT ON profiles (role='client') →
--         insertion dans client_scores avec 0 points.
-- Fix 2 : backfill pour les clients déjà existants.
-- Fix 3 : RPC get_classement_live_clients — classement temps
--         réel (SECURITY DEFINER, contourne le RLS owner-only
--         de client_scores) pour l'affichage quand le snapshot
--         pg_cron n'existe pas encore.
-- ============================================================

-- ─── 1. Trigger : auto-init à la création d'un profil client ─────────────────

CREATE OR REPLACE FUNCTION init_client_scores_on_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'client' THEN
    INSERT INTO client_scores (client_id)
    VALUES (NEW.id)
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION init_client_scores_on_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_init_client_scores ON profiles;
CREATE TRIGGER trg_init_client_scores
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION init_client_scores_on_profile();

-- ─── 2. Backfill : clients existants sans ligne client_scores ─────────────────

INSERT INTO client_scores (client_id)
SELECT p.id
FROM profiles p
WHERE p.role = 'client'
AND NOT EXISTS (
  SELECT 1 FROM client_scores cs WHERE cs.client_id = p.id
);

-- ─── 3. RPC live : classement clients (avant snapshot pg_cron) ───────────────
-- SECURITY DEFINER nécessaire : client_scores a un RLS owner-only
-- (auth.uid() = client_id), impossible à lire publiquement autrement.

CREATE OR REPLACE FUNCTION get_classement_live_clients()
RETURNS TABLE(
  client_id   UUID,
  rang        INTEGER,
  points      INTEGER,
  nom_affiche TEXT,
  image_url   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cs.client_id,
    ROW_NUMBER() OVER (ORDER BY cs.points_mois DESC, cs.updated_at ASC)::INTEGER AS rang,
    cs.points_mois AS points,
    COALESCE(p.name, '?') AS nom_affiche,
    p.avatar_url AS image_url
  FROM client_scores cs
  JOIN profiles p ON p.id = cs.client_id
  ORDER BY cs.points_mois DESC, cs.updated_at ASC
  LIMIT 10;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_classement_live_clients() TO anon, authenticated;
