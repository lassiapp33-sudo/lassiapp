-- ─── RLS Prestataire sur la table orders existante ───────────────────────────
-- La table utilise shop_id (UUID du commerce, pas de l'utilisateur).
-- On passe par la table shops pour vérifier que l'utilisateur connecté
-- est bien le propriétaire du commerce concerné par la commande.

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Le prestataire voit les commandes de ses commerces
DROP POLICY IF EXISTS "prestataire_sees_own_orders" ON orders;
CREATE POLICY "prestataire_sees_own_orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id          = orders.shop_id
        AND shops.merchant_id = auth.uid()
    )
  );

-- Le prestataire peut modifier le statut de ses commandes
DROP POLICY IF EXISTS "prestataire_updates_own_orders" ON orders;
CREATE POLICY "prestataire_updates_own_orders" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id          = orders.shop_id
        AND shops.merchant_id = auth.uid()
    )
  );
