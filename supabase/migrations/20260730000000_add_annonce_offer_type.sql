-- Ajouter 'annonce' comme valeur valide de offer_type dans visibility_subscriptions.
-- Le CHECK existant n'acceptait que ('quartier', 'recherche', 'carte').
-- Les paiements OM pour les annonces sponsorisées utilisent offer_type = 'annonce'.

ALTER TABLE public.visibility_subscriptions
  DROP CONSTRAINT IF EXISTS visibility_subscriptions_offer_type_check;

ALTER TABLE public.visibility_subscriptions
  ADD CONSTRAINT visibility_subscriptions_offer_type_check
    CHECK (offer_type IN ('quartier', 'recherche', 'carte', 'annonce'));
