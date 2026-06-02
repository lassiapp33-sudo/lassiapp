-- =============================================================================
-- LASSI Phase 3 – Étape 2 : Schéma business
-- Colle TOUT ce fichier dans Supabase > SQL Editor > New query > Run
-- =============================================================================

-- ── SHOPS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'tangana',
  zone        TEXT NOT NULL DEFAULT 'Grand Dakar',
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_open     BOOLEAN NOT NULL DEFAULT true,
  is_vip      BOOLEAN NOT NULL DEFAULT false,
  rating      NUMERIC(3,1) NOT NULL DEFAULT 4.5,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shops_select_all" ON shops FOR SELECT USING (true);
CREATE POLICY "shops_insert_own" ON shops FOR INSERT WITH CHECK (merchant_id = auth.uid());
CREATE POLICY "shops_update_own" ON shops FOR UPDATE USING (merchant_id = auth.uid());
CREATE POLICY "shops_delete_own" ON shops FOR DELETE USING (merchant_id = auth.uid());

-- ── PRODUCTS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  photo_url   TEXT NOT NULL DEFAULT '🛍',
  price       INTEGER NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'autres',
  stock       TEXT NOT NULL DEFAULT 'in' CHECK (stock IN ('in','out')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_all" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert_own" ON products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()));
CREATE POLICY "products_update_own" ON products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()));
CREATE POLICY "products_delete_own" ON products FOR DELETE
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()));

-- ── ORDERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID REFERENCES shops(id) ON DELETE SET NULL,
  client_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name  TEXT NOT NULL DEFAULT 'Client',
  client_phone TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','ready','done','refused')),
  pay_method   TEXT NOT NULL DEFAULT 'wave' CHECK (pay_method IN ('wave','om','cash')),
  total        INTEGER NOT NULL DEFAULT 0,
  prep_time    TEXT,
  order_type   TEXT NOT NULL DEFAULT 'takeaway' CHECK (order_type IN ('takeaway','onsite')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid())
    OR client_id = auth.uid()
  );
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "orders_update_merchant" ON orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()));

-- ── ORDER ITEMS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  qty          INTEGER NOT NULL DEFAULT 1,
  unit_price   INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      JOIN shops s ON s.id = o.shop_id
      WHERE o.id = order_id
        AND (s.merchant_id = auth.uid() OR o.client_id = auth.uid())
    )
  );
CREATE POLICY "order_items_insert" ON order_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── DEBTS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  client_name  TEXT NOT NULL,
  client_phone TEXT,
  amount       INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'good' CHECK (status IN ('late','watch','good')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_merchant" ON debts FOR ALL
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM shops WHERE shops.id = shop_id AND shops.merchant_id = auth.uid()));

-- ── DEBT TRANSACTIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id    UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE debt_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_tx_merchant" ON debt_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM debts d
      JOIN shops s ON s.id = d.shop_id
      WHERE d.id = debt_id AND s.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debts d
      JOIN shops s ON s.id = d.shop_id
      WHERE d.id = debt_id AND s.merchant_id = auth.uid()
    )
  );

-- ── FAVORITES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, shop_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites_own" ON favorites FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── DONNÉES DE DÉMONSTRATION ──────────────────────────────────────────────────
INSERT INTO shops (name, subtitle, category, zone, latitude, longitude, is_open, is_vip, rating) VALUES
  ('Tangana Diallo & Frères',  'Petit-déj traditionnel · Medina',         'tangana', 'Medina',      14.6952, -17.4502, true,  true,  4.9),
  ('Tangana Chez Modou',       'Petit-déj maison · Grand Dakar',          'tangana', 'Grand Dakar', 14.7045, -17.4408, true,  false, 4.8),
  ('Café Touba Assane',        'Café Touba · Thé · Petit-déj',           'tangana', 'Grand Dakar', 14.7012, -17.4390, true,  false, 4.5),
  ('Chez Fatou Ndiaye',        'Pain-viande · Oeufs · Jus',              'tangana', 'Medina',      14.6978, -17.4480, true,  false, 4.7),
  ('KFC Sénégal',              'Poulet croustillant · Fast-food',         'food',    'Almadies',    14.7456, -17.5136, true,  false, 4.3),
  ('Tic Tac Resto',            'Burgers & tacos · Ouvert 24h/24',         'food',    'Medina',      14.6930, -17.4450, true,  false, 4.6),
  ('Dakar Burger',             'Fast-food local · Livraison 20 min',      'food',    'Plateau',     14.6928, -17.4467, true,  true,  4.7),
  ('Resto du Port',            'Poisson frais · Thiéboudienne',           'food',    'Plateau',     14.6910, -17.4390, true,  true,  4.7),
  ('Salon Khadija Beauté',     'Tresses · Extensions · Soins',            'hair',    'Medina',      14.6945, -17.4488, false, true,  4.9),
  ('Barber King',              'Coupe homme · Rasage · Locks',            'hair',    'Grand Dakar', 14.7088, -17.4425, true,  false, 4.6),
  ('Boutique Aïda Gaye',       'Epicerie · Produits locaux',              'stores',  'Grand Dakar', 14.7060, -17.4415, true,  false, 4.6),
  ('Mamadou Store',            'Epicerie · Boissons · Snacks',            'stores',  'Medina',      14.6960, -17.4472, true,  true,  4.8),
  ('FitZone Dakar',            'Cardio · Musculation · Cours collectifs', 'sport',   'Plateau',     14.6935, -17.4460, true,  true,  4.8),
  ('Power Gym',                'Musculation · Cours collectifs',           'sport',   'Grand Dakar', 14.7070, -17.4410, true,  false, 4.5),
  ('Boulangerie Diallo',       'Baguette · Croissant · Pain tradition',   'bakery',  'Medina',      14.6940, -17.4465, true,  true,  4.8),
  ('Pain d''Or',               'Viennoiseries · Pains speciaux',          'bakery',  'Plateau',     14.6920, -17.4450, true,  false, 4.6),
  ('Saveur du Sahel',          'Pain local · Galettes',                   'bakery',  'Parcelles',   14.7786, -17.4517, false, false, 4.4)
ON CONFLICT DO NOTHING;

-- Produits de démo pour Tangana Diallo & Frères
INSERT INTO products (shop_id, name, description, photo_url, price, category, stock)
SELECT s.id, 'Pain Oeuf Mayo',      'Pain croustillant, 2 oeufs, mayo',  '🥖', 500,  'petitdej', 'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Omelette spéciale',   '3 oeufs, oignons, poivron',          '🍳', 700,  'petitdej', 'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Pain Viande',          'Viande hachée épicée',               '🥪', 800,  'petitdej', 'out' FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Café Touba',           'Bien sucré, épicé',                  '☕', 200,  'boissons', 'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Thé Lipton',           'Au lait concentré',                  '🍵', 250,  'boissons', 'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Jus Bissap',           'Hibiscus frais, sucre naturel',      '🥤', 300,  'boissons', 'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères' UNION ALL
SELECT s.id, 'Riz au Poisson',       'Thiébou djen, légumes',              '🍚', 1500, 'plats',    'in'  FROM shops s WHERE s.name = 'Tangana Diallo & Frères';
