-- ============================================================
-- LASSI · Fonction get_annonces_recentes()
-- Migration 2026-06-28
-- ============================================================
-- Retourne les annonces actives des 7 derniers jours pour
-- l'utilisateur connecté (ciblage par rôle), avec le statut
-- lu/non-lu. Utilisée par le centre de notifications unifié
-- pour afficher les annonces admin dans la liste (sans popup).
-- ============================================================

CREATE OR REPLACE FUNCTION get_annonces_recentes()
RETURNS TABLE (
  id         UUID,
  titre      TEXT,
  corps      TEXT,
  icone      TEXT,
  tag        TEXT,
  created_at TIMESTAMPTZ,
  est_lue    BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.titre,
    a.corps,
    a.icone,
    a.tag,
    a.created_at,
    EXISTS(
      SELECT 1 FROM annonces_lues al
      WHERE al.annonce_id = a.id AND al.user_id = auth.uid()
    ) AS est_lue
  FROM annonces a
  JOIN profiles p ON p.id = auth.uid()
  WHERE
    a.est_actif = true
    AND a.created_at >= now() - INTERVAL '7 days'
    AND (a.expire_at IS NULL OR a.expire_at > now())
    AND (
      a.audience = 'tous'
      OR (a.audience = 'prestataires' AND p.role = 'merchant')
      OR (a.audience = 'clients' AND p.role = 'client')
    )
  ORDER BY a.created_at DESC
  LIMIT 20;
$$;

REVOKE EXECUTE ON FUNCTION get_annonces_recentes() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_annonces_recentes() TO authenticated;
