-- ===========================================================================
-- LASSI — Fix get_classement_live_clients : exclure les prestataires
-- ---------------------------------------------------------------------------
-- Bug : la RPC ne filtrait pas p.role = 'client', donc les prestataires
-- (ex : gérants VIP) ayant une ligne dans client_scores apparaissaient
-- dans le classement "Top clients" côté client.
-- ===========================================================================

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
  WHERE p.role = 'client'
  ORDER BY cs.points_mois DESC, cs.updated_at ASC
  LIMIT 100;
$$;

REVOKE EXECUTE ON FUNCTION get_classement_live_clients() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_classement_live_clients() TO anon, authenticated;

-- Nettoyer les lignes orphelines : prestataires dans client_scores
DELETE FROM client_scores
WHERE client_id IN (
  SELECT id FROM profiles WHERE role <> 'client'
);

NOTIFY pgrst, 'reload schema';
