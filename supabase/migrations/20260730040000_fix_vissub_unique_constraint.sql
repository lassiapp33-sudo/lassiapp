-- La contrainte unique idx_vissub_shop_active_unique portait sur (shop_id) seul,
-- ce qui empêchait d'avoir simultanément une Offre du Quartier + une Annonce + un Boost actifs.
-- On la remplace par (shop_id, offer_type) : un seul actif PAR TYPE PAR SHOP.

DROP INDEX IF EXISTS public.idx_vissub_shop_active_unique;

CREATE UNIQUE INDEX idx_vissub_shop_offer_active_unique
  ON public.visibility_subscriptions (shop_id, offer_type)
  WHERE status = 'active';
