-- =============================================================================
-- LASSI — Purge des shops de test par nom (visibles dans screenshots)
-- =============================================================================
-- Shops visibles dans l'app après migration 260000 :
-- Ouzesport, Lasssport, Mama, Restaurant Testapple, Lassana, Secul,
-- ouze, Bjy, Gaba, Balde Coiffeur, Bab, mab, Tangana Démo Apple
-- + tous les shops dont merchant_id n'a plus d'auth.users (orphelins restants)
-- =============================================================================

CREATE TEMP TABLE _purge_merchant_ids (id UUID PRIMARY KEY) ON COMMIT DROP;

-- Collecte par nom de shop (tous les prestataires test)
INSERT INTO _purge_merchant_ids
SELECT DISTINCT s.merchant_id FROM public.shops s
WHERE s.merchant_id IS NOT NULL
  AND (
    LOWER(s.name) LIKE '%ouzesport%'
    OR LOWER(s.name) LIKE '%lasssport%'
    OR LOWER(s.name) LIKE '%lassport%'
    OR LOWER(s.name) LIKE 'mama'
    OR LOWER(s.name) LIKE '%restaurant testapple%'
    OR LOWER(s.name) LIKE '%testapple%'
    OR LOWER(s.name) LIKE 'lassana'
    OR LOWER(s.name) LIKE 'secul%'
    OR LOWER(s.name) = 'ouze'
    OR LOWER(s.name) = 'bjy'
    OR LOWER(s.name) LIKE 'gaba%'
    OR LOWER(s.name) LIKE '%balde%coiffeur%'
    OR LOWER(s.name) LIKE '%bald%coiff%'
    OR LOWER(s.name) = 'bab'
    OR LOWER(s.name) = 'mab'
    OR LOWER(s.name) LIKE '%tangana%mo%'
    OR LOWER(s.name) LIKE '%tangana%demo%'
  )
ON CONFLICT DO NOTHING;

-- Orphelins résiduels (prestataires dont auth.users n'existe plus)
INSERT INTO _purge_merchant_ids
SELECT p.id FROM public.profiles p
WHERE p.role = 'prestataire'
  AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _purge_merchant_ids) THEN
    RAISE NOTICE '[purge] Aucun shop test trouvé.';
    RETURN;
  END IF;
  RAISE NOTICE '[purge] % merchant_ids à purger : %',
    (SELECT COUNT(*) FROM _purge_merchant_ids),
    (SELECT ARRAY_AGG(id) FROM _purge_merchant_ids);
END $$;

-- ── 1. Rendre prestataire_id nullable + DROP check_montants ──────────────────
-- check_montants est NOT VALID mais se ré-applique sur UPDATE.
-- Les rows test ont commission=10% (hors 1%/2%) → violation sur UPDATE.
-- On drop, on fait le ménage, on re-ajoute NOT VALID.

ALTER TABLE public.payment_intents
  ALTER COLUMN prestataire_id DROP NOT NULL;

ALTER TABLE public.payment_intents
  ALTER COLUMN client_id DROP NOT NULL;

ALTER TABLE public.payment_intents
  DROP CONSTRAINT IF EXISTS check_montants;

-- ── 2. NULL-out toutes FK de payment_intents → nos cibles ────────────────────
UPDATE public.payment_intents SET prestataire_id = NULL
  WHERE prestataire_id IN (SELECT id FROM _purge_merchant_ids);

UPDATE public.payment_intents SET client_id = NULL
  WHERE client_id IN (SELECT id FROM _purge_merchant_ids);

UPDATE public.payment_intents SET order_id = NULL
  WHERE order_id IN (
    SELECT id FROM public.orders
    WHERE shop_id   IN (SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_merchant_ids))
       OR client_id IN (SELECT id FROM _purge_merchant_ids)
  );

-- Re-add check_montants NOT VALID (ne revalide pas les anciennes lignes orphelines)
ALTER TABLE public.payment_intents
  ADD CONSTRAINT check_montants CHECK (
    montant_total = prix_base + commission_lassi
    AND (
      (type = 'livraison'          AND commission_lassi = 0)
      OR (type = 'table_reservation' AND commission_lassi = 200)
      OR commission_lassi IN (
           CEIL(prix_base::numeric * 0.01)::integer,
           CEIL(prix_base::numeric * 0.02)::integer
         )
    )
  ) NOT VALID;

-- ── 3. payout_queue ──────────────────────────────────────────────────────────
DELETE FROM public.payout_queue
  WHERE prestataire_id IN (SELECT id FROM _purge_merchant_ids);

-- ── 4. payments ──────────────────────────────────────────────────────────────
UPDATE public.payments SET prestataire_id = NULL
  WHERE prestataire_id IN (SELECT id FROM _purge_merchant_ids);

-- ── 5. Favoris ────────────────────────────────────────────────────────────────
DELETE FROM public.favorites
  WHERE user_id IN (SELECT id FROM _purge_merchant_ids);

-- ── 6. Réservations de table ──────────────────────────────────────────────────
-- Par client test + par vip_profil lié aux shops test (FK vip_profils→shops)
DELETE FROM public.table_reservations
  WHERE client_id IN (SELECT id FROM _purge_merchant_ids)
     OR vip_profil_id IN (
       SELECT vp.id FROM public.vip_profils vp
       JOIN public.shops s ON s.id = vp.shop_id
       WHERE s.merchant_id IN (SELECT id FROM _purge_merchant_ids)
     );

-- ── 7. Commandes ─────────────────────────────────────────────────────────────
-- SET NULL sur avis.order_id (FK ON DELETE SET NULL) déclenche le trigger
-- BEFORE UPDATE trg_avis_column_guard → "Modification non autorisée".
-- On disable les triggers utilisateur sur avis aussi.
ALTER TABLE public.orders      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.avis        DISABLE TRIGGER USER;

DELETE FROM public.order_items WHERE order_id IN (
  SELECT id FROM public.orders WHERE client_id IN (SELECT id FROM _purge_merchant_ids)
);
DELETE FROM public.orders WHERE client_id IN (SELECT id FROM _purge_merchant_ids);

DELETE FROM public.order_items WHERE order_id IN (
  SELECT o.id FROM public.orders o
  JOIN public.shops s ON s.id = o.shop_id
  WHERE s.merchant_id IN (SELECT id FROM _purge_merchant_ids)
);
DELETE FROM public.orders WHERE shop_id IN (
  SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_merchant_ids)
);

ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avis        ENABLE TRIGGER USER;

-- ── 8. Boutiques (cascade → classements, vip_rankings) ───────────────────────
DELETE FROM public.debts    WHERE shop_id IN (SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_merchant_ids));
DELETE FROM public.products WHERE shop_id IN (SELECT id FROM public.shops WHERE merchant_id IN (SELECT id FROM _purge_merchant_ids));
DELETE FROM public.shops    WHERE merchant_id IN (SELECT id FROM _purge_merchant_ids);

-- ── 9. Litiges ────────────────────────────────────────────────────────────────
DELETE FROM public.dispute_messages WHERE dispute_id IN (
  SELECT id FROM public.disputes
  WHERE reporter_id IN (SELECT id FROM _purge_merchant_ids)
     OR against_id  IN (SELECT id FROM _purge_merchant_ids)
);
DELETE FROM public.disputes
  WHERE reporter_id IN (SELECT id FROM _purge_merchant_ids)
     OR against_id  IN (SELECT id FROM _purge_merchant_ids);
DELETE FROM public.dispute_messages WHERE sender_id IN (SELECT id FROM _purge_merchant_ids);

-- ── 9b. fitness_abonnements_clients + reservations_terrain ───────────────────
DELETE FROM public.fitness_abonnements_clients
  WHERE prestataire_id IN (SELECT id FROM _purge_merchant_ids)
     OR client_id       IN (SELECT id FROM _purge_merchant_ids);

DELETE FROM public.reservations_terrain
  WHERE prestataire_id IN (SELECT id FROM _purge_merchant_ids)
     OR client_id       IN (SELECT id FROM _purge_merchant_ids);

-- ── 10. Profils ───────────────────────────────────────────────────────────────
DELETE FROM public.profiles WHERE id IN (SELECT id FROM _purge_merchant_ids);

-- ── 11. auth.users ────────────────────────────────────────────────────────────
DELETE FROM auth.users WHERE id IN (SELECT id FROM _purge_merchant_ids);

-- ── 12. Shops orphelins résiduels ─────────────────────────────────────────────
DELETE FROM public.shops
WHERE merchant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = shops.merchant_id);

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
