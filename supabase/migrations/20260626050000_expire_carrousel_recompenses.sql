-- ===========================================================================
-- LASSİ — Expiration automatique du carrousel "Offre du Quartier"
-- ===========================================================================
-- Problème : quand la récompense d'un prestataire expire (valide_jusqu_a < NOW()),
-- ses entrées dans carrousel_offre_quartier restent est_actif=true indéfiniment
-- → ses produits continuent d'apparaître sur l'accueil client gratuitement.
--
-- Solution :
--   A) expire_carrousel_recompenses() :
--      1. Passe est_actif=false sur les recompenses_attribuees périmées.
--      2. Passe est_actif=false sur les entrées carrousel dont le propriétaire
--         n'a plus aucune récompense valide avec carrousel_produits > 0.
--   B) pg_cron : job horaire "expire-carrousel".
--   C) Exécution immédiate pour corriger l'état existant.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.expire_carrousel_recompenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── A. Expirer les récompenses dont le délai est dépassé ─────────────────
  -- (valide_jusqu_a IS NULL = Illimité → jamais expiré)
  UPDATE recompenses_attribuees
  SET    est_actif = false
  WHERE  est_actif = true
    AND  valide_jusqu_a IS NOT NULL
    AND  valide_jusqu_a < NOW();

  -- ── B. Désactiver les entrées carrousel sans quota valide ─────────────────
  -- Un prestataire perd son droit au carrousel si :
  --   • toutes ses récompenses avec carrousel_produits > 0 sont expirées, OU
  --   • elles ont été révoquées manuellement par l'admin (est_actif = false).
  UPDATE carrousel_offre_quartier coq
  SET    est_actif = false
  WHERE  est_actif = true
    AND  NOT EXISTS (
      SELECT 1
      FROM   recompenses_attribuees ra
      WHERE  ra.prestataire_id = coq.prestataire_id
        AND  ra.est_actif      = true
        AND  ra.carrousel_produits > 0
        AND  (ra.valide_jusqu_a IS NULL OR ra.valide_jusqu_a > NOW())
    );
END;
$$;

-- Droits : seul service_role peut exécuter cette fonction
REVOKE EXECUTE ON FUNCTION public.expire_carrousel_recompenses() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_carrousel_recompenses() TO service_role;

-- ── pg_cron : toutes les heures à :00 ────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('expire-carrousel');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'expire-carrousel',
  '0 * * * *',
  'SELECT public.expire_carrousel_recompenses()'
);

-- ── Correction immédiate de l'état existant ───────────────────────────────────
SELECT public.expire_carrousel_recompenses();

DO $$
BEGIN
  RAISE NOTICE 'expire_carrousel_recompenses() planifié (horaire) et exécuté immédiatement.';
END $$;
