-- ===========================================================================
-- LASSİ — Pack Visibilité payant dans le carrousel "Offre du Quartier"
-- ===========================================================================
-- Problème : les produits achetés via un pack Wave / OM / crédit ne
-- s'affichent jamais dans le carrousel carrousel_offre_quartier.
-- Ils n'apparaissaient que dans PromoBanner (shops.featured_product_ids)
-- mais pas dans la section "✨ Offre du Quartier" dédiée.
--
-- Solution :
--   1) Ajout de la colonne is_paid_pack pour distinguer les entrées
--      payantes des entrées classement (admin/Top5).
--   2) Mise à jour de expire_carrousel_recompenses() : supprime les entrées
--      payantes dont l'abonnement visibility a expiré.
--   3) Mise à jour de expire_visibility_subscriptions() : supprime aussi les
--      entrées carrousel payantes lors de l'expiration du forfait.
-- ===========================================================================

-- ─── 1. Nouvelle colonne is_paid_pack ─────────────────────────────────────────
ALTER TABLE public.carrousel_offre_quartier
  ADD COLUMN IF NOT EXISTS is_paid_pack BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Mise à jour expire_carrousel_recompenses : nettoyer aussi le payant ───
CREATE OR REPLACE FUNCTION public.expire_carrousel_recompenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── A. Expirer les récompenses classement dont le délai est dépassé ───────
  UPDATE recompenses_attribuees
  SET    est_actif = false
  WHERE  est_actif = true
    AND  valide_jusqu_a IS NOT NULL
    AND  valide_jusqu_a < NOW();

  -- ── B. Désactiver les entrées classement sans quota valide ────────────────
  UPDATE carrousel_offre_quartier coq
  SET    est_actif = false
  WHERE  is_paid_pack = false
    AND  est_actif    = true
    AND  NOT EXISTS (
      SELECT 1
      FROM   recompenses_attribuees ra
      WHERE  ra.prestataire_id = coq.prestataire_id
        AND  ra.est_actif      = true
        AND  ra.carrousel_produits > 0
        AND  (ra.valide_jusqu_a IS NULL OR ra.valide_jusqu_a > NOW())
    );

  -- ── C. Supprimer les entrées payantes dont l'abonnement est expiré ────────
  DELETE FROM carrousel_offre_quartier
  WHERE  is_paid_pack = true
    AND  NOT EXISTS (
      SELECT 1
      FROM   visibility_subscriptions vs
      JOIN   shops sh ON sh.id = vs.shop_id
      WHERE  sh.merchant_id = carrousel_offre_quartier.prestataire_id
        AND  vs.status      = 'active'
        AND  vs.offer_type  = 'quartier'
        AND  vs.expires_at  > NOW()
    );
END;
$$;

-- ─── 3. expire_visibility_subscriptions : nettoyer aussi le carrousel ─────────
CREATE OR REPLACE FUNCTION public.expire_visibility_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marquer les abonnements expirés
  UPDATE visibility_subscriptions
  SET    status = 'expired'
  WHERE  status = 'active'
    AND  expires_at < NOW();

  -- Retirer is_featured du shop pour les abonnements fraîchement expirés
  UPDATE shops s
  SET    is_featured = FALSE,
         featured_product_id = NULL
  FROM   visibility_subscriptions vs
  WHERE  vs.shop_id = s.id
    AND  vs.status  = 'expired'
    AND  vs.offer_type = 'quartier'
    AND  vs.expires_at >= NOW() - INTERVAL '1 day'
    AND  (s.featured_product_id IS NULL OR s.featured_product_id = vs.product_id);

  -- Supprimer les entrées payantes dans carrousel_offre_quartier pour les
  -- marchands dont le forfait quartier vient d'expirer
  DELETE FROM carrousel_offre_quartier c
  WHERE  c.is_paid_pack = true
    AND  NOT EXISTS (
      SELECT 1
      FROM   visibility_subscriptions vs
      JOIN   shops sh ON sh.id = vs.shop_id
      WHERE  sh.merchant_id = c.prestataire_id
        AND  vs.status     = 'active'
        AND  vs.offer_type = 'quartier'
        AND  vs.expires_at > NOW()
    );
END;
$$;

-- ─── 4. Droits ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.expire_carrousel_recompenses()    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_carrousel_recompenses()    TO service_role;
REVOKE EXECUTE ON FUNCTION public.expire_visibility_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_visibility_subscriptions() TO service_role;

-- ─── 5. Correction immédiate ──────────────────────────────────────────────────
SELECT public.expire_carrousel_recompenses();

DO $$
BEGIN
  RAISE NOTICE 'Migration paid_pack_carrousel appliquée — is_paid_pack ajouté, expire* mis à jour.';
END $$;
