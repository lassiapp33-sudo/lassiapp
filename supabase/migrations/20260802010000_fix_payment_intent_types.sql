-- ===========================================================================
-- Fix : check_montants rejette les paiements livraison et réservation table
-- ---------------------------------------------------------------------------
-- Problème : la contrainte n'accepte que CEIL(prix_base × 1%) ou ×2%.
-- Or :
--   - create-livraison-payment insère commission_lassi = 0 (LASSI prend tout)
--   - create-table-reservation insère commission_lassi = 200 (frais fixe)
--
-- Solution : colonne `type` + contrainte type-aware.
-- ===========================================================================

-- ─── 1. Colonne type ─────────────────────────────────────────────────────────

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'commande'
  CHECK (type IN ('commande', 'livraison', 'table_reservation', 'terrain', 'fitness', 'visibilite', 'credit'));

-- ─── 2. Contrainte check_montants (aware du type) ────────────────────────────
-- NOT VALID : ne revalide pas les anciennes lignes (déjà conformes).

ALTER TABLE public.payment_intents
  DROP CONSTRAINT IF EXISTS check_montants;

ALTER TABLE public.payment_intents
  ADD CONSTRAINT check_montants CHECK (
    -- L'invariant de base : total = base + commission (toujours)
    montant_total = prix_base + commission_lassi
    AND
    (
      -- Livraison LASSI : LASSI est le prestataire, pas de split tiers → commission = 0
      (type = 'livraison' AND commission_lassi = 0)
      OR
      -- Réservation table 5 Étoiles : frais service fixe 200 FCFA (acompte 3000)
      (type = 'table_reservation' AND commission_lassi = 200)
      OR
      -- Commandes, fitness, terrain, visibilité, crédit : 1% standard ou 2% VIP
      commission_lassi IN (
        CEIL(prix_base::numeric * 0.01)::integer,
        CEIL(prix_base::numeric * 0.02)::integer
      )
    )
  ) NOT VALID;

NOTIFY pgrst, 'reload schema';
