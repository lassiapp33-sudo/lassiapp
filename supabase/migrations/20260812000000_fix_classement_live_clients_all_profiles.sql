-- ===========================================================================
-- LASSI — Fix get_classement_live_clients : inclure TOUS les clients
-- ---------------------------------------------------------------------------
-- Bug : la RPC lisait depuis client_scores (JOIN strict) → seuls les clients
-- déjà notés par un prestataire apparaissaient. Les autres clients étaient
-- invisibles même s'ils avaient passé des commandes ce mois-ci.
-- Fix : calculer les points directement depuis profiles/orders/avis comme
-- le fait calcul_classements_mois (même logique : LEFT JOIN).
-- ===========================================================================

DROP FUNCTION IF EXISTS get_classement_live_clients();

CREATE FUNCTION get_classement_live_clients()
RETURNS TABLE(
  client_id   UUID,
  rang        INTEGER,
  points      INTEGER,
  nom_affiche TEXT,
  image_url   TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH
  month_bounds AS (
    SELECT
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')                       AS mois_start,
      DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month'  AS mois_end
  ),
  client_orders AS (
    SELECT o.client_id, COUNT(*) AS nb_cmds
    FROM orders o, month_bounds mb
    WHERE o.status    = 'done'
      AND o.created_at >= mb.mois_start
      AND o.created_at <  mb.mois_end
      AND o.client_id IS NOT NULL
    GROUP BY o.client_id
  ),
  client_avis AS (
    SELECT a.author_id, COUNT(*) AS nb_avis
    FROM avis a, month_bounds mb
    WHERE NOT a.masque
      AND a.created_at >= mb.mois_start
      AND a.created_at <  mb.mois_end
    GROUP BY a.author_id
  ),
  scores AS (
    SELECT
      p.id         AS client_id,
      p.name       AS nom,
      p.avatar_url AS img,
      (
        COALESCE(co.nb_cmds, 0) * 10
        + COALESCE(ca.nb_avis,  0) * 5
      )::INTEGER AS points
    FROM profiles p
    LEFT JOIN client_orders co ON co.client_id = p.id
    LEFT JOIN client_avis   ca ON ca.author_id  = p.id
    WHERE p.role = 'client'
  )
  SELECT
    client_id,
    ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC)::INTEGER AS rang,
    points,
    COALESCE(nom, '?') AS nom_affiche,
    img                AS image_url
  FROM scores
  ORDER BY points DESC, client_id ASC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_clients() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_clients() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
