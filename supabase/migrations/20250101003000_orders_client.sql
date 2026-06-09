-- ─── Ajout client_id à la table orders existante ────────────────────────────
-- La table orders existe déjà avec : shop_id, total, pay_method, order_items
-- On ajoute client_id (UUID de l'acheteur) et les politiques RLS client.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_client_id_idx ON orders (client_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Le client voit uniquement ses propres commandes
DROP POLICY IF EXISTS "client_sees_own_orders" ON orders;
CREATE POLICY "client_sees_own_orders" ON orders
  FOR SELECT USING (auth.uid() = client_id);

-- Le client peut annuler sa commande si elle est encore 'new' (pas prise en charge)
DROP POLICY IF EXISTS "client_cancels_pending_orders" ON orders;
CREATE POLICY "client_cancels_pending_orders" ON orders
  FOR UPDATE USING (auth.uid() = client_id AND status = 'new')
  WITH CHECK (status = 'refused');

-- ─── NOTE Edge Function ───────────────────────────────────────────────────────
-- La Edge Function "create-order" doit inclure :
--   client_id: (await supabase.auth.getUser()).data.user?.id
-- pour que la politique "client_sees_own_orders" fonctionne.
