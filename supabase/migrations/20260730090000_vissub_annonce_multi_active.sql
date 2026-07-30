-- Permet plusieurs annonces sponsorisées actives simultanément par boutique.
-- La contrainte unique (shop_id, offer_type) WHERE status='active' s'applique
-- uniquement aux offres quartier/recherche/carte (une seule active à la fois).
-- Les annonces sont des campagnes indépendantes → contrainte retirée pour elles.

DROP INDEX IF EXISTS public.idx_vissub_shop_offer_active_unique;

CREATE UNIQUE INDEX idx_vissub_shop_offer_active_unique
  ON public.visibility_subscriptions (shop_id, offer_type)
  WHERE status = 'active'
    AND offer_type IN ('quartier', 'recherche', 'carte');
