-- ============================================================
-- LASSİ — Migration Vitrine v2 : sous-catégories, types, horaires
-- À exécuter UNE SEULE FOIS dans Supabase > SQL Editor
-- ============================================================


-- ─── 1. NOUVELLES COLONNES SHOPS ─────────────────────────────────────────────

ALTER TABLE shops
  -- Sous-catégories choisies à l'inscription (ex: ["hommes","femmes"])
  ADD COLUMN IF NOT EXISTS subcategories      JSONB    NOT NULL DEFAULT '[]'::jsonb,
  -- Description libre du commerce
  ADD COLUMN IF NOT EXISTS description        TEXT,
  -- Type de vitrine : produits / prestations / abonnements
  ADD COLUMN IF NOT EXISTS shop_type          TEXT     NOT NULL DEFAULT 'products'
    CONSTRAINT shops_shop_type_check CHECK (shop_type IN ('products','services','memberships')),
  -- Adresse textuelle libre (ex : "Face à la pharmacie, Médina")
  ADD COLUMN IF NOT EXISTS address_text       TEXT,
  -- Horaires par jour (JSONB — structure définie côté app)
  ADD COLUMN IF NOT EXISTS opening_hours      JSONB,
  -- Override "exceptionnellement fermé" (Korité, imprévu…)
  ADD COLUMN IF NOT EXISTS is_manually_closed BOOLEAN  NOT NULL DEFAULT FALSE,
  -- URLs des photos de la galerie (bucket Storage "covers")
  ADD COLUMN IF NOT EXISTS gallery_urls       JSONB    NOT NULL DEFAULT '[]'::jsonb;


-- ─── 2. NOUVELLES COLONNES PRODUCTS ──────────────────────────────────────────

ALTER TABLE products
  -- Type d'item selon le métier du commerce
  ADD COLUMN IF NOT EXISTS item_type       TEXT NOT NULL DEFAULT 'product'
    CONSTRAINT products_item_type_check CHECK (item_type IN ('product','service','membership')),
  -- Durée estimée en minutes (pour les prestations 'service')
  ADD COLUMN IF NOT EXISTS duration        INTEGER,
  -- Période de la formule (pour les abonnements 'membership')
  ADD COLUMN IF NOT EXISTS formula_period  TEXT
    CONSTRAINT products_formula_period_check CHECK (formula_period IS NULL OR formula_period IN (
      'seance','jour','semaine','mois','trimestre','annee'
    ));


-- ─── 3. DÉRIVER shop_type POUR LES BOUTIQUES EXISTANTES ─────────────────────
--   hair  → services (coiffeurs facturent des prestations)
--   sport → memberships (salles de sport vendent des abonnements)
--   autre → products (tangana, resto, boulangerie, commerçants)

UPDATE shops
  SET shop_type = CASE
    WHEN category = 'hair'  THEN 'services'
    WHEN category = 'sport' THEN 'memberships'
    ELSE 'products'
  END;


-- ─── 4. DÉRIVER item_type POUR LES PRODUITS EXISTANTS ────────────────────────

UPDATE products p
  SET item_type = CASE
    WHEN s.shop_type = 'services'    THEN 'service'
    WHEN s.shop_type = 'memberships' THEN 'membership'
    ELSE 'product'
  END
FROM shops s
WHERE p.shop_id = s.id;


-- ─── 5. INDEX POUR LA RECHERCHE PAR SOUS-CATÉGORIE ───────────────────────────
-- Permet de filtrer efficacement les boutiques par sous-catégorie côté client

CREATE INDEX IF NOT EXISTS shops_subcategories_gin
  ON shops USING GIN (subcategories);

CREATE INDEX IF NOT EXISTS shops_shop_type_idx
  ON shops (shop_type);
