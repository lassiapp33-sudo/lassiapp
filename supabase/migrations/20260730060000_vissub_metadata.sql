-- Stocker les métadonnées de l'annonce au moment du paiement OM/Wave
-- afin que le webhook puisse créer l'annonce directement sans intermédiaire crédit.
ALTER TABLE public.visibility_subscriptions
  ADD COLUMN IF NOT EXISTS metadata JSONB;
