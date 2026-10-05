-- Purge comptes test : Lassana Coulibaly (781054001) + Banii (761890003)
-- Exécuté le 2026-10-05 — ne plus rejouer
DO $$
DECLARE
  uid1 uuid := '98aadeb4-d1c2-46e2-9424-c62cb48b5922';
  uid2 uuid := '19e32b80-ad41-421c-976b-ea2aef7c9403';
  sid1 uuid; sid2 uuid;
BEGIN
  SET LOCAL row_security = off;
  SELECT id INTO sid1 FROM shops WHERE merchant_id = uid1;
  SELECT id INTO sid2 FROM shops WHERE merchant_id = uid2;
  -- réservations de table (prestataire_id)
  DELETE FROM table_reservations WHERE prestataire_id IN (uid1, uid2) OR client_id IN (uid1, uid2);
  -- payment_intents
  DELETE FROM payment_intents WHERE prestataire_id IN (uid1::text, uid2::text);
  DELETE FROM payment_intents WHERE client_id IN (uid1, uid2);
  -- reservations terrain + abonnements
  IF sid1 IS NOT NULL THEN DELETE FROM reservations_terrain WHERE shop_id = sid1; END IF;
  IF sid2 IS NOT NULL THEN DELETE FROM reservations_terrain WHERE shop_id = sid2; END IF;
  IF sid1 IS NOT NULL THEN DELETE FROM abonnements WHERE shop_id = sid1; END IF;
  IF sid2 IS NOT NULL THEN DELETE FROM abonnements WHERE shop_id = sid2; END IF;
  -- shops CASCADE (produits, orders, order_items, conversations…)
  IF sid1 IS NOT NULL THEN DELETE FROM shops WHERE id = sid1; END IF;
  IF sid2 IS NOT NULL THEN DELETE FROM shops WHERE id = sid2; END IF;
  -- profiles CASCADE (notifications, favoris…)
  DELETE FROM profiles WHERE id IN (uid1, uid2);
  -- auth.users — libère les numéros
  DELETE FROM auth.users WHERE id IN (uid1, uid2);
END $$;
