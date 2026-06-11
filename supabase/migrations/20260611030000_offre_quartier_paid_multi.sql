-- ===========================================================================
-- LASSİ — "Offre du quartier" : abonnement payant multi-produits / vitrine
-- entière (le marchand choisit lui-même au moment du paiement).
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor, APRÈS
-- 20260611020000_offre_quartier_multi_produits.sql.
-- ===========================================================================

-- ─── 1. Nouvelles colonnes sur visibility_subscriptions ────────────────────
-- product_ids  : produits choisis par le marchand pour ce forfait
-- all_products : "toute la vitrine" (alternative à product_ids)

ALTER TABLE visibility_subscriptions
  ADD COLUMN IF NOT EXISTS product_ids  UUID[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS all_products BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 2. Backfill depuis l'ancien product_id (souscriptions existantes) ─────

UPDATE visibility_subscriptions
SET    product_ids = ARRAY[product_id]
WHERE  product_id IS NOT NULL
  AND  product_ids = '{}';
