-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║   LASSİ — Suppression de compte : CASCADE sur les clés étrangères  ║
-- ║  Coller dans : Supabase Dashboard → SQL Editor → New Query → Run   ║
-- ╚══════════════════════════════════════════════════════════════════════╝
--
-- Ces ALTER TABLE garantissent que la suppression d'un profil ou d'une
-- boutique nettoie automatiquement toutes les données liées, et que le
-- numéro de téléphone est libéré pour une future réinscription.

-- ─── 1. Profil → Favoris ──────────────────────────────────────────────────────
ALTER TABLE favorites
  DROP CONSTRAINT IF EXISTS favorites_user_id_fkey,
  ADD  CONSTRAINT favorites_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── 2. Profil → Notifications ───────────────────────────────────────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD  CONSTRAINT notifications_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── 3. Profil → Conversations (en tant que client) ──────────────────────────
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_client_id_fkey,
  ADD  CONSTRAINT conversations_client_id_fkey
       FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ─── 4. Profil → Boutique (SET NULL : les boutiques sans commerçant restent) ─
--   Cela permet aux boutiques de seed de ne pas être supprimées si le
--   marchand est NULL. Mais si un commerçant quitte, sa boutique est dissociée.
--   L'Edge Function delete-account supprime explicitement la boutique avant
--   le profil pour ne pas laisser de boutique orpheline.
ALTER TABLE shops
  DROP CONSTRAINT IF EXISTS shops_merchant_id_fkey,
  ADD  CONSTRAINT shops_merchant_id_fkey
       FOREIGN KEY (merchant_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── 5. Boutique → Produits ───────────────────────────────────────────────────
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_shop_id_fkey,
  ADD  CONSTRAINT products_shop_id_fkey
       FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ─── 6. Boutique → Commandes ──────────────────────────────────────────────────
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_shop_id_fkey,
  ADD  CONSTRAINT orders_shop_id_fkey
       FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ─── 7. Commande → Lignes de commande ────────────────────────────────────────
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
  ADD  CONSTRAINT order_items_order_id_fkey
       FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- ─── 8. Boutique → Dettes ────────────────────────────────────────────────────
ALTER TABLE debts
  DROP CONSTRAINT IF EXISTS debts_shop_id_fkey,
  ADD  CONSTRAINT debts_shop_id_fkey
       FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ─── 9. Dette → Transactions ──────────────────────────────────────────────────
ALTER TABLE debt_transactions
  DROP CONSTRAINT IF EXISTS debt_transactions_debt_id_fkey,
  ADD  CONSTRAINT debt_transactions_debt_id_fkey
       FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE;

-- ─── 10. Boutique → Conversations ────────────────────────────────────────────
ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_shop_id_fkey,
  ADD  CONSTRAINT conversations_shop_id_fkey
       FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;

-- ─── 11. Conversation → Messages ─────────────────────────────────────────────
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey,
  ADD  CONSTRAINT messages_conversation_id_fkey
       FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;

-- ─── Vérification (optionnel) ─────────────────────────────────────────────────
-- SELECT conname, confdeltype
-- FROM pg_constraint
-- WHERE contype = 'f'
--   AND conrelid IN (
--     'favorites'::regclass, 'notifications'::regclass,
--     'conversations'::regclass, 'messages'::regclass,
--     'products'::regclass, 'orders'::regclass,
--     'order_items'::regclass, 'debts'::regclass,
--     'debt_transactions'::regclass
--   );
-- confdeltype = 'c' → CASCADE, 'n' → SET NULL
