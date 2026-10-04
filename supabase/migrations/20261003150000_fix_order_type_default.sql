-- Le défaut 'takeaway' viole la contrainte orders_order_type_check ('place'|'emporter')
-- → on le corrige en 'place' (commande standard = sur place par défaut)
ALTER TABLE orders ALTER COLUMN order_type SET DEFAULT 'place';
