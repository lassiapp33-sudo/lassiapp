-- ===========================================================================
-- LASSI — Diagnostic + fix direct classement Top clients
-- ---------------------------------------------------------------------------
-- On bypasse calcul_classements_mois et on réinsère directement tous les
-- clients (role='client') dans classements pour 2026-08.
-- Les RAISE NOTICE permettent de voir exactement ce qui se passe.
-- ===========================================================================

DO $$
DECLARE
  v_periode    TEXT := '2026-08';
  v_mois_start TIMESTAMPTZ;
  v_mois_end   TIMESTAMPTZ;
  v_nb_profils INTEGER;
  v_nb_avant   INTEGER;
  v_nb_apres   INTEGER;
BEGIN
  v_mois_start := '2026-08-01 00:00:00+00';
  v_mois_end   := '2026-09-01 00:00:00+00';

  -- ── Diagnostic ────────────────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_nb_profils FROM profiles WHERE role = 'client';
  RAISE NOTICE '[DIAG] Profils role=client : %', v_nb_profils;

  SELECT COUNT(*) INTO v_nb_avant
  FROM classements WHERE type = 'client' AND periode = v_periode;
  RAISE NOTICE '[DIAG] Classements type=client periode=% AVANT : %', v_periode, v_nb_avant;

  -- ── Fix : suppression + réinsertion directe ───────────────────────────────
  DELETE FROM classements WHERE type = 'client' AND periode = v_periode;

  INSERT INTO classements
    (type, sous_categorie, periode, rang, points, nom_affiche, image_url, client_id, est_actif)
  WITH
  client_orders AS (
    SELECT o.client_id, COUNT(*) AS nb_cmds
    FROM orders o
    WHERE o.status    = 'done'
      AND o.created_at >= v_mois_start
      AND o.created_at <  v_mois_end
      AND o.client_id IS NOT NULL
    GROUP BY o.client_id
  ),
  client_avis AS (
    SELECT a.author_id, COUNT(*) AS nb_avis
    FROM avis a
    WHERE NOT a.masque
      AND a.created_at >= v_mois_start
      AND a.created_at <  v_mois_end
    GROUP BY a.author_id
  ),
  scores_c AS (
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
  ),
  ranked_c AS (
    SELECT client_id, nom, img, points,
      ROW_NUMBER() OVER (ORDER BY points DESC, client_id ASC) AS rang
    FROM scores_c
  )
  SELECT
    'client', NULL, v_periode,
    rang::INTEGER, points, COALESCE(nom, '?'), img,
    client_id, TRUE
  FROM ranked_c
  WHERE rang <= 100;

  SELECT COUNT(*) INTO v_nb_apres
  FROM classements WHERE type = 'client' AND periode = v_periode;
  RAISE NOTICE '[DIAG] Classements type=client periode=% APRES  : %', v_periode, v_nb_apres;

END $$;
