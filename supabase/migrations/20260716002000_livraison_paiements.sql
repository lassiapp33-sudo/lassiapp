-- ============================================================
-- Livraison paiements : bridge payment_intents → livraisons
-- Le prestataire paie LASSI avant que la livraison soit créée.
-- Le prix est calculé côté serveur (Haversine) — jamais côté client.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.livraison_paiements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id   UUID REFERENCES public.payment_intents(id),
  demandeur_id        UUID NOT NULL REFERENCES auth.users(id),
  livraison_id        UUID REFERENCES public.livraisons(id), -- rempli après paiement
  -- Params de la livraison (stockés avant paiement pour create serveur-side après verify)
  depart_label        TEXT NOT NULL,
  depart_lat          NUMERIC(10,7) NOT NULL,
  depart_lng          NUMERIC(10,7) NOT NULL,
  arrivee_label       TEXT NOT NULL,
  arrivee_lat         NUMERIC(10,7) NOT NULL,
  arrivee_lng         NUMERIC(10,7) NOT NULL,
  contact_nom         TEXT,
  contact_tel         TEXT,
  distance_km         NUMERIC(8,2) NOT NULL,
  montant_calcule     INT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.livraison_paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demandeur voit ses paiements livraison"
  ON public.livraison_paiements FOR SELECT
  USING (demandeur_id = auth.uid());
