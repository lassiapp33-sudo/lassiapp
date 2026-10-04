-- ============================================================
-- reservations_terrain — payout_statut (colonne manquante)
-- Permet de suivre l'état du reversement prestataire terrain
-- et d'éviter les doubles déclenchements.
-- ============================================================

ALTER TABLE reservations_terrain
  ADD COLUMN IF NOT EXISTS payout_statut TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_statut IN ('pending', 'ok', 'erreur'));

CREATE INDEX IF NOT EXISTS idx_res_terrain_payout_statut
  ON reservations_terrain(payout_statut)
  WHERE payout_statut = 'pending';

-- ============================================================
-- Carrousel Offre du Quartier — pack payant visibilité
-- Distingue les entrées pack payant (is_paid_pack=true)
-- des récompenses classement (is_paid_pack=false/null).
-- ============================================================

ALTER TABLE carrousel_offre_quartier
  ADD COLUMN IF NOT EXISTS is_paid_pack BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_carrousel_paid_pack
  ON carrousel_offre_quartier(prestataire_id, is_paid_pack);

-- ============================================================
-- recompute_shop_quartier_featuring(p_shop_id UUID)
-- Réactive / désactive les entrées paid_pack selon que la
-- boutique a au moins un abonnement visibilité quartier actif.
-- ============================================================
CREATE OR REPLACE FUNCTION recompute_shop_quartier_featuring(p_shop_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merchant_id UUID;
  v_has_active  BOOLEAN;
BEGIN
  -- Trouver le merchant_id de la boutique
  SELECT merchant_id INTO v_merchant_id
  FROM shops WHERE id = p_shop_id;

  IF v_merchant_id IS NULL THEN RETURN; END IF;

  -- Vérifie si au moins un abonnement quartier actif existe
  SELECT EXISTS (
    SELECT 1 FROM visibility_subscriptions
    WHERE merchant_id = v_merchant_id
      AND offer_type  = 'quartier'
      AND status      = 'active'
      AND expires_at  > now()
  ) INTO v_has_active;

  -- Mettre à jour est_actif des entrées paid_pack de ce marchand
  UPDATE carrousel_offre_quartier
  SET    est_actif = v_has_active
  WHERE  prestataire_id = v_merchant_id
    AND  is_paid_pack   = true;
END;
$$;

GRANT EXECUTE ON FUNCTION recompute_shop_quartier_featuring(UUID) TO service_role;
