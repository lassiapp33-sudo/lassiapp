-- =============================================================================
-- LASSI — Purge des prestataires de test avant lancement grand public
-- =============================================================================
-- Root cause identifié après 7 tentatives :
--   payment_intents.prestataire_id → profiles(id) ON DELETE CASCADE
--   Supprimer profiles → cascade DELETE payment_intents → RI check XX000
--   prestataire_id est NOT NULL → impossible de le NULL-outer directement
-- Solution définitive :
--   1. DROP NOT NULL sur prestataire_id
--   2. NULL-out prestataire_id + client_id + order_id dans payment_intents
--      → coupe TOUTES les cascades sans toucher aux payment_intents eux-mêmes
--   3. Supprimer orders, shops, profiles, auth.users librement (aucune cascade)
-- =============================================================================

-- ── Collecte des IDs à purger ────────────────────────────────────────────────

CREATE TEMP TABLE _purge_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _purge_ids
SELECT DISTINCT x FROM (
  -- Profiles orphelins (auth.users supprimé directement via dashboard Supabase)
  SELECT p.id FROM public.profiles p
  WHERE p.role = 'prestataire'
    AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)

  UNION

  -- merchant.demo.apple@lassi.tech
  SELECT u.id FROM auth.users u
  WHERE u.email = 'merchant.demo.apple@lassi.tech'

  UNION

  -- Tangana Démo (par nom de shop)
  SELECT s.merchant_id FROM public.shops s
  WHERE s.merchant_id IS NOT NULL
    AND LOWER(s.name) LIKE '%tangana%mo%'
) t(x)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _purge_ids) THEN
    RAISE NOTICE '[purge] Aucun prestataire test trouvé.';
    RETURN;
  END IF;
  RAISE NOTICE '[purge] % IDs à purger', (SELECT COUNT(*) FROM _purge_ids);
END $$;

-- ── 1. Rendre prestataire_id nullable (DROP NOT NULL) ────────────────────────
-- Sans ça, UPDATE SET prestataire_id = NULL échoue (NOT NULL constraint).
-- On ne restaure pas NOT NULL après : les payment_intents orphelins test
-- auront prestataire_id = NULL ce qui est acceptable pour des données test.

ALTER TABLE public.payment_intents
  ALTER COLUMN prestataire_id DROP NOT NULL;

-- ── 2. NULL-out toutes les FK de payment_intents vers nos cibles ──────────────
-- Coupe les cascades AVANT de supprimer quoi que ce soit.
-- Après ces UPDATEs, aucune ligne de payment_intents ne référence nos IDs.

UPDATE public.payment_intents
  SET prestataire_id = NULL
  WHERE prestataire_id IN (SELECT id FROM _purge_ids);

UPDATE public.payment_intents
  SET client_id = NULL
  WHERE client_id IN (SELECT id FROM _purge_ids);

UPDATE public.payment_intents
  SET order_id = NULL
  WHERE order_id IN (
    SELECT id FROM public.orders
    WHERE shop_id   IN (SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_ids))
       OR client_id IN (SELECT id FROM _purge_ids)
  );

-- ── 3. payout_queue ──────────────────────────────────────────────────────────
DELETE FROM public.payout_queue
  WHERE prestataire_id IN (SELECT id FROM _purge_ids);

-- ── 4. payments : NULL-out prestataire_id ─────────────────────────────────────
UPDATE public.payments
  SET prestataire_id = NULL
  WHERE prestataire_id IN (SELECT id FROM _purge_ids);

-- ── 5. Favoris ────────────────────────────────────────────────────────────────
DELETE FROM public.favorites
  WHERE user_id IN (SELECT id FROM _purge_ids);

-- ── 6. Réservations de table ──────────────────────────────────────────────────
DELETE FROM public.table_reservations
  WHERE client_id IN (SELECT id FROM _purge_ids);

-- ── 7. Commandes client ───────────────────────────────────────────────────────
DELETE FROM public.order_items
  WHERE order_id IN (
    SELECT id FROM public.orders WHERE client_id IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.orders
  WHERE client_id IN (SELECT id FROM _purge_ids);

-- ── 8. Boutiques + commandes boutique ─────────────────────────────────────────
-- payment_intents.order_id est NULL-outé (étape 2) → pas de FK violation
-- classements.prestataire_id → shops(id) ON DELETE CASCADE ✓
-- vip_rankings.shop_id       → shops(id) ON DELETE CASCADE ✓
DELETE FROM public.order_items
  WHERE order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.shops s ON s.id = o.shop_id
    WHERE s.merchant_id IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.orders
  WHERE shop_id IN (
    SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.debts
  WHERE shop_id IN (
    SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.products
  WHERE shop_id IN (
    SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.shops
  WHERE merchant_id IN (SELECT id FROM _purge_ids);

-- ── 9. Litiges ────────────────────────────────────────────────────────────────
DELETE FROM public.dispute_messages
  WHERE dispute_id IN (
    SELECT id FROM public.disputes
    WHERE reporter_id IN (SELECT id FROM _purge_ids)
       OR against_id  IN (SELECT id FROM _purge_ids)
  );
DELETE FROM public.disputes
  WHERE reporter_id IN (SELECT id FROM _purge_ids)
     OR against_id  IN (SELECT id FROM _purge_ids);
DELETE FROM public.dispute_messages
  WHERE sender_id IN (SELECT id FROM _purge_ids);

-- ── 10. Profils ───────────────────────────────────────────────────────────────
-- prestataire_id est déjà NULL dans payment_intents → aucune cascade
DELETE FROM public.profiles
  WHERE id IN (SELECT id FROM _purge_ids);

-- ── 11. auth.users ────────────────────────────────────────────────────────────
DELETE FROM auth.users
  WHERE id IN (SELECT id FROM _purge_ids);

-- ── 12. Shops orphelins résiduels ────────────────────────────────────────────
DELETE FROM public.shops
  WHERE merchant_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = shops.merchant_id
    );

DO $$ BEGIN RAISE NOTICE '[purge] Terminé.'; END $$;

-- ── Recalcul classements ──────────────────────────────────────────────────────
DO $recalc$
DECLARE v_n INTEGER;
BEGIN
  SELECT public.calcul_classements_semaine() INTO v_n;
  RAISE NOTICE '[purge] Recalcul semaine : % entrées', v_n;
  SELECT public.calcul_classements_mois() INTO v_n;
  RAISE NOTICE '[purge] Recalcul mois : % entrées', v_n;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[purge] Erreur recalcul : %', SQLERRM;
END $recalc$;

NOTIFY pgrst, 'reload schema';
