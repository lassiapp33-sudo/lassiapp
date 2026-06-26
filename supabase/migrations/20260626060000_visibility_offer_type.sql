-- Ajouter offer_type sur visibility_subscriptions pour supporter
-- les paiements Wave/OM sur les offres "recherche" et "carte" (épingle dorée).
-- Jusqu'ici seul "quartier" était géré via create-visibility-payment.

ALTER TABLE public.visibility_subscriptions
  ADD COLUMN IF NOT EXISTS offer_type TEXT NOT NULL DEFAULT 'quartier'
    CHECK (offer_type IN ('quartier', 'recherche', 'carte'));

-- Stocker la durée du plan boost au moment de la création
-- (les plans '1m','3m','6m' boost ne sont pas dans visibility_plans — ils sont statiques).
ALTER TABLE public.visibility_subscriptions
  ADD COLUMN IF NOT EXISTS plan_duration_days INTEGER;

-- Rétrocompatibilité : les lignes existantes ont toutes offer_type = 'quartier' (défaut).
-- plan_duration_days peut rester NULL pour les anciennes lignes ; le webhook utilisera
-- sub.plan?.duration_days comme avant.
