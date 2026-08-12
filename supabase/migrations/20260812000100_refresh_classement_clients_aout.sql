-- ===========================================================================
-- LASSI — Regénère le snapshot Top clients pour août 2026
-- ---------------------------------------------------------------------------
-- Le snapshot du 2026-08 ne contenait qu'un seul client (Taphas).
-- On relance calcul_classements_mois pour recalculer correctement depuis
-- profiles LEFT JOIN orders/avis → tous les clients apparaissent (0 pts inclus).
-- ===========================================================================

DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT calcul_classements_mois('2026-08') INTO v_n;
  RAISE NOTICE 'Snapshot clients août 2026 régénéré : % lignes', v_n;
END $$;
