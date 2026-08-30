-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO APPLE REVIEW v2 — Compte Prestataire Testapple
-- ─ Ce que ce script fait :
--   1. Identifie la boutique ACTIVE (la plus récente) du marchand
--   2. Supprime les boutiques en doublon
--   3. Recrée 8 produits avec les catégories en minuscules (fix filtre admin)
--   4. Insère 42 commandes historiques sur 6 mois (Mars–Août 2026)
--   5. Insère les paiements correspondants (Wave + Orange Money)
--   6. Insère 3 avis clients (notes 5★, 4★, 5★)
--   7. Met à jour les statistiques de la boutique
-- ─ À exécuter dans : Supabase Dashboard → SQL Editor
-- ─ Compte prestataire : +221 78 166 69 99 / merchant.demo.apple@lassi.tech
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_merchant_id  uuid;
  v_shop_id      uuid;
  v_client1_id   uuid;  -- Client principal (Apple demo ou premier client trouvé)
  v_client2_id   uuid;  -- Second client pour varier les avis
  v_client3_id   uuid;  -- Troisième client
  v_ord_id       uuid;
BEGIN

  -- ════════════════════════════════════════════════════════════════
  -- 1. TROUVER LE MARCHAND TESTAPPLE
  -- ════════════════════════════════════════════════════════════════
  SELECT id INTO v_merchant_id
  FROM profiles
  WHERE phone ILIKE '%781666999%'
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION
      'Compte Testapple introuvable (tél 78 166 69 99). '
      'Vérifiez que merchant.demo.apple@lassi.tech a terminé son inscription.';
  END IF;
  RAISE NOTICE '✓ merchant_id = %', v_merchant_id;

  -- ════════════════════════════════════════════════════════════════
  -- 2. BOUTIQUE ACTIVE (la plus récente — évite le doublon)
  -- ════════════════════════════════════════════════════════════════
  SELECT id INTO v_shop_id
  FROM shops
  WHERE merchant_id = v_merchant_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Aucune boutique trouvée. Finalisez l''inscription d''abord.';
  END IF;
  RAISE NOTICE '✓ shop_id actif = %', v_shop_id;

  -- ════════════════════════════════════════════════════════════════
  -- 3. NETTOYER LES BOUTIQUES EN DOUBLON
  --    (produits des vieilles boutiques → avis → vieilles boutiques)
  -- ════════════════════════════════════════════════════════════════
  DELETE FROM products
  WHERE shop_id IN (
    SELECT id FROM shops
    WHERE merchant_id = v_merchant_id AND id <> v_shop_id
  );

  DELETE FROM avis
  WHERE shop_id IN (
    SELECT id FROM shops
    WHERE merchant_id = v_merchant_id AND id <> v_shop_id
  );

  DELETE FROM shops
  WHERE merchant_id = v_merchant_id AND id <> v_shop_id;

  RAISE NOTICE '✓ Doublons boutiques supprimés';

  -- ════════════════════════════════════════════════════════════════
  -- 4. METTRE À JOUR LES INFOS DE LA BOUTIQUE
  -- ════════════════════════════════════════════════════════════════
  UPDATE shops SET
    name               = 'Restaurant Testapple',
    description        = 'Restaurant africain spécialisé dans les plats traditionnels sénégalais. '
                         'Thiéboudienne, Yassa poulet, Mafé, Domoda… Tout est cuisiné maison '
                         'avec des produits frais. Livraison disponible dans tout Dakar.',
    address_text       = 'Rue 10 x 17, Dakar Plateau, Sénégal',
    phone              = '78 166 69 99',
    is_open            = true,
    is_manually_closed = false,
    opening_hours      = '{
      "lun":{"open":true,"from":"07:00","to":"22:00"},
      "mar":{"open":true,"from":"07:00","to":"22:00"},
      "mer":{"open":true,"from":"07:00","to":"22:00"},
      "jeu":{"open":true,"from":"07:00","to":"22:00"},
      "ven":{"open":true,"from":"07:00","to":"22:00"},
      "sam":{"open":true,"from":"08:00","to":"20:00"},
      "dim":{"open":false}
    }'::jsonb
  WHERE id = v_shop_id;

  RAISE NOTICE '✓ Boutique mise à jour';

  -- ════════════════════════════════════════════════════════════════
  -- 5. PRODUITS (catégories en minuscules = ce que l'app utilise)
  -- ════════════════════════════════════════════════════════════════
  DELETE FROM products WHERE shop_id = v_shop_id;

  INSERT INTO products (shop_id, name, description, emoji, photo_url, price, category, stock, item_type)
  VALUES
    (v_shop_id, 'Thiéboudienne',
     'Riz au poisson à la dakaroise, légumes frais du jour (carotte, manioc, aubergine), sauce tomate épicée maison.',
     '🍛', '', 3500, 'plats', 'in', 'product'),
    (v_shop_id, 'Yassa Poulet',
     'Poulet mariné toute la nuit aux oignons caramélisés et citron, servi avec riz blanc.',
     '🍗', '', 3000, 'plats', 'in', 'product'),
    (v_shop_id, 'Mafé Bœuf',
     'Bœuf mijoté dans une sauce arachide crémeuse avec pommes de terre. Servi avec riz.',
     '🥘', '', 3200, 'plats', 'in', 'product'),
    (v_shop_id, 'Thiof Grillé',
     'Mérou entier grillé au feu de bois, mariné aux herbes et épices africaines.',
     '🐟', '', 4500, 'plats', 'in', 'product'),
    (v_shop_id, 'Domoda',
     'Ragoût de bœuf sauce tomate-arachide, servi avec couscous africain ou riz.',
     '🍲', '', 2800, 'plats', 'in', 'product'),
    (v_shop_id, 'Bissap Frais',
     'Jus d''hibiscus maison légèrement sucré, aromatisé à la menthe. Servi bien frais.',
     '🫙', '', 500, 'boissons', 'in', 'product'),
    (v_shop_id, 'Jus de Gingembre',
     'Gingembre frais pressé, légèrement pimenté et tonique. La boisson énergisante du Sénégal.',
     '🧃', '', 600, 'boissons', 'in', 'product'),
    (v_shop_id, 'Eau Minérale',
     'Bouteille d''eau minérale fraîche 1.5L.',
     '💧', '', 300, 'boissons', 'in', 'product');

  RAISE NOTICE '✓ 8 produits insérés (catégories en minuscules)';

  -- ════════════════════════════════════════════════════════════════
  -- 6. TROUVER DES COMPTES CLIENTS POUR LES COMMANDES
  -- ════════════════════════════════════════════════════════════════
  -- Client 1 : compte Apple demo client
  SELECT au.id INTO v_client1_id
  FROM auth.users au
  WHERE au.email = 'client.demo.apple@lassi.tech'
  LIMIT 1;

  IF v_client1_id IS NULL THEN
    -- Fallback : premier client existant dans la DB
    SELECT p.id INTO v_client1_id
    FROM profiles p
    WHERE p.id <> v_merchant_id
      AND p.role = 'client'
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  -- Client 2 : deuxième client pour les avis
  SELECT p.id INTO v_client2_id
  FROM profiles p
  WHERE p.id <> v_merchant_id
    AND (v_client1_id IS NULL OR p.id <> v_client1_id)
    AND p.role = 'client'
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Client 3 : troisième client pour les avis
  SELECT p.id INTO v_client3_id
  FROM profiles p
  WHERE p.id <> v_merchant_id
    AND (v_client1_id IS NULL OR p.id <> v_client1_id)
    AND (v_client2_id IS NULL OR p.id <> v_client2_id)
    AND p.role = 'client'
  ORDER BY p.created_at DESC
  LIMIT 1;

  RAISE NOTICE '✓ Clients : %, %, %', v_client1_id, v_client2_id, v_client3_id;

  IF v_client1_id IS NULL THEN
    RAISE NOTICE '⚠ Aucun compte client trouvé. Commandes et avis non insérés.';
    RAISE NOTICE '  → Connectez-vous avec client.demo.apple@lassi.tech une fois, puis relancez ce script.';
    -- Ne pas faire RETURN : les produits sont déjà insérés
  ELSE

    -- ════════════════════════════════════════════════════════════════
    -- 7. NETTOYER LES ANCIENNES COMMANDES/AVIS/PAIEMENTS DU SHOP
    -- ════════════════════════════════════════════════════════════════
    -- Supprimer dans l'ordre pour respecter les FK
    DELETE FROM payments
    WHERE order_id IN (SELECT id FROM orders WHERE shop_id = v_shop_id);

    DELETE FROM order_items
    WHERE order_id IN (SELECT id FROM orders WHERE shop_id = v_shop_id);

    DELETE FROM avis WHERE shop_id = v_shop_id;

    DELETE FROM orders WHERE shop_id = v_shop_id;

    RAISE NOTICE '✓ Ancien historique nettoyé';

    -- ════════════════════════════════════════════════════════════════
    -- 8. COMMANDES HISTORIQUES — MARS 2026 (6 cmd, 22 000 FCFA)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aminata Diallo', 3500, 'done', 'wave', 'emporter', '2026-03-04 11:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'wave', 'success', 'WV-260304-001', 'Aminata Diallo',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Moussa Ndiaye', 6100, 'done', 'om', 'emporter', '2026-03-08 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Yassa Poulet', 1, 3000), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 6100, 'om', 'success', 'OM-260308-001', 'Moussa Ndiaye',
            '[{"name":"Yassa Poulet","qty":1,"price":3000},{"name":"Jus de Gingembre","qty":1,"price":600}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Fatou Sarr', 3200, 'done', 'wave', 'emporter', '2026-03-12 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3200, 'wave', 'success', 'WV-260312-001', 'Fatou Sarr',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ibrahima Fall', 4500, 'done', 'wave', 'emporter', '2026-03-17 12:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiof Grillé', 1, 4500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4500, 'wave', 'success', 'WV-260317-001', 'Ibrahima Fall',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aïssatou Ba', 2800, 'done', 'om', 'emporter', '2026-03-22 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Domoda', 1, 2800);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 2800, 'om', 'success', 'OM-260322-001', 'Aïssatou Ba',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Cheikh Diop', 2500, 'done', 'wave', 'emporter', '2026-03-28 11:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Bissap Frais', 2, 500), (v_ord_id, 'Domoda', 1, 1500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 2500, 'wave', 'success', 'WV-260328-001', 'Cheikh Diop',
            '[{"name":"Domoda","qty":1,"price":2500}]');

    -- ════════════════════════════════════════════════════════════════
    -- AVRIL 2026 (8 cmd, 31 300 FCFA)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Marième Gaye', 3500, 'done', 'wave', 'emporter', '2026-04-02 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'wave', 'success', 'WV-260402-001', 'Marième Gaye',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ousmane Sy', 4800, 'done', 'om', 'emporter', '2026-04-05 19:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Yassa Poulet', 1, 3000), (v_ord_id, 'Bissap Frais', 1, 500), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4800, 'om', 'success', 'OM-260405-001', 'Ousmane Sy',
            '[{"name":"Yassa Poulet","qty":1,"price":3000},{"name":"Bissap Frais","qty":1,"price":500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Rokhaya Cissé', 3000, 'done', 'wave', 'emporter', '2026-04-09 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'wave', 'success', 'WV-260409-001', 'Rokhaya Cissé',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Pape Diouf', 5500, 'done', 'om', 'emporter', '2026-04-13 12:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5500, 'om', 'success', 'OM-260413-001', 'Pape Diouf',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ndéye Diallo', 4500, 'done', 'wave', 'emporter', '2026-04-16 18:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiof Grillé', 1, 4500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4500, 'wave', 'success', 'WV-260416-001', 'Ndéye Diallo',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Bamba Sow', 3200, 'done', 'wave', 'emporter', '2026-04-20 11:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3200, 'wave', 'success', 'WV-260420-001', 'Bamba Sow',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Khady Touré', 3800, 'done', 'om', 'emporter', '2026-04-24 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Domoda', 1, 2800), (v_ord_id, 'Bissap Frais', 2, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3800, 'om', 'success', 'OM-260424-001', 'Khady Touré',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Abdou Fall', 3000, 'done', 'wave', 'emporter', '2026-04-28 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'wave', 'success', 'WV-260428-001', 'Abdou Fall',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    -- ════════════════════════════════════════════════════════════════
    -- MAI 2026 (7 cmd, 26 600 FCFA)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aminata Diallo', 4000, 'done', 'wave', 'emporter', '2026-05-03 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Bissap Frais', 1, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4000, 'wave', 'success', 'WV-260503-001', 'Aminata Diallo',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Lamine Ndiaye', 3200, 'done', 'om', 'emporter', '2026-05-07 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3200, 'om', 'success', 'OM-260507-001', 'Lamine Ndiaye',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Sokhna Ba', 3500, 'done', 'wave', 'emporter', '2026-05-11 13:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'wave', 'success', 'WV-260511-001', 'Sokhna Ba',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Tapha Mbaye', 5100, 'done', 'wave', 'emporter', '2026-05-15 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiof Grillé', 1, 4500), (v_ord_id, 'Jus de Gingembre', 1, 600);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5100, 'wave', 'success', 'WV-260515-001', 'Tapha Mbaye',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Bineta Faye', 2800, 'done', 'om', 'emporter', '2026-05-19 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Domoda', 1, 2800);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 2800, 'om', 'success', 'OM-260519-001', 'Bineta Faye',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Serigne Seck', 3000, 'done', 'wave', 'emporter', '2026-05-23 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'wave', 'success', 'WV-260523-001', 'Serigne Seck',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Djiby Diagne', 5000, 'done', 'om', 'emporter', '2026-05-29 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5000, 'om', 'success', 'OM-260529-001', 'Djiby Diagne',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    -- ════════════════════════════════════════════════════════════════
    -- JUIN 2026 (9 cmd, 37 400 FCFA)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Mariama Koné', 4000, 'done', 'wave', 'emporter', '2026-06-02 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Bissap Frais', 1, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4000, 'wave', 'success', 'WV-260602-001', 'Mariama Koné',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Mamadou Traoré', 3200, 'done', 'om', 'emporter', '2026-06-05 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3200, 'om', 'success', 'OM-260605-001', 'Mamadou Traoré',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aïda Mbaye', 5100, 'done', 'wave', 'emporter', '2026-06-08 19:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiof Grillé', 1, 4500), (v_ord_id, 'Jus de Gingembre', 1, 600);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5100, 'wave', 'success', 'WV-260608-001', 'Aïda Mbaye',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Youssouf Cissé', 3000, 'done', 'wave', 'emporter', '2026-06-11 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'wave', 'success', 'WV-260611-001', 'Youssouf Cissé',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ramatoulaye Sy', 3500, 'done', 'om', 'emporter', '2026-06-15 13:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'om', 'success', 'OM-260615-001', 'Ramatoulaye Sy',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Elhadji Diop', 4800, 'done', 'wave', 'emporter', '2026-06-18 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Yassa Poulet', 1, 3000), (v_ord_id, 'Bissap Frais', 1, 500), (v_ord_id, 'Jus de Gingembre', 1, 600);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4800, 'wave', 'success', 'WV-260618-001', 'Elhadji Diop',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aminata Sarr', 2800, 'done', 'om', 'emporter', '2026-06-21 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Domoda', 1, 2800);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 2800, 'om', 'success', 'OM-260621-001', 'Aminata Sarr',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Oumar Sène', 6000, 'done', 'wave', 'emporter', '2026-06-25 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Thiof Grillé', 1, 4500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 6000, 'wave', 'success', 'WV-260625-001', 'Oumar Sène',
            '[{"name":"Thiéboudienne","qty":1,"price":3500},{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ndeye Ndiaye', 6000, 'done', 'wave', 'emporter', '2026-06-28 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200), (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 6000, 'wave', 'success', 'WV-260628-001', 'Ndeye Ndiaye',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200},{"name":"Yassa Poulet","qty":1,"price":3000}]');

    -- ════════════════════════════════════════════════════════════════
    -- JUILLET 2026 (10 cmd, 43 700 FCFA)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Ibou Gueye', 4000, 'done', 'wave', 'emporter', '2026-07-02 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4000, 'wave', 'success', 'WV-260702-001', 'Ibou Gueye',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aissatou Diallo', 5100, 'done', 'om', 'emporter', '2026-07-05 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiof Grillé', 1, 4500), (v_ord_id, 'Bissap Frais', 1, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5100, 'om', 'success', 'OM-260705-001', 'Aissatou Diallo',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Babacar Diop', 3000, 'done', 'wave', 'emporter', '2026-07-08 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'wave', 'success', 'WV-260708-001', 'Babacar Diop',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Awa Sall', 5500, 'done', 'wave', 'emporter', '2026-07-11 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5500, 'wave', 'success', 'WV-260711-001', 'Awa Sall',
            '[{"name":"Thiéboudienne","qty":1,"price":3500},{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Mame Diop', 4000, 'done', 'om', 'emporter', '2026-07-14 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Bissap Frais', 1, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4000, 'om', 'success', 'OM-260714-001', 'Mame Diop',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Samba Ndiaye', 3200, 'done', 'wave', 'emporter', '2026-07-17 19:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3200, 'wave', 'success', 'WV-260717-001', 'Samba Ndiaye',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Astou Mbaye', 6100, 'done', 'wave', 'emporter', '2026-07-21 12:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiof Grillé', 1, 4500), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 6100, 'wave', 'success', 'WV-260721-001', 'Astou Mbaye',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Mouhamed Sar', 2800, 'done', 'om', 'emporter', '2026-07-24 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Domoda', 1, 2800);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 2800, 'om', 'success', 'OM-260724-001', 'Mouhamed Sar',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Coumba Faye', 5000, 'done', 'wave', 'emporter', '2026-07-27 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Yassa Poulet', 1, 3000), (v_ord_id, 'Mafé Bœuf', 1, 3200);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5000, 'wave', 'success', 'WV-260727-001', 'Coumba Faye',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Fallou Gaye', 5000, 'done', 'wave', 'emporter', '2026-07-30 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5000, 'wave', 'success', 'WV-260730-001', 'Fallou Gaye',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    -- ════════════════════════════════════════════════════════════════
    -- AOÛT 2026 (8 cmd, 32 300 FCFA — mois en cours)
    -- ════════════════════════════════════════════════════════════════

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Adja Kouyaté', 3500, 'done', 'wave', 'emporter', '2026-08-02 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'wave', 'success', 'WV-260802-001', 'Adja Kouyaté',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Thierno Ba', 4800, 'done', 'om', 'emporter', '2026-08-05 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Yassa Poulet', 1, 3000), (v_ord_id, 'Bissap Frais', 1, 500), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4800, 'om', 'success', 'OM-260805-001', 'Thierno Ba',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Aminata Diallo', 4500, 'done', 'wave', 'emporter', '2026-08-08 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiof Grillé', 1, 4500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4500, 'wave', 'success', 'WV-260808-001', 'Aminata Diallo',
            '[{"name":"Thiof Grillé","qty":1,"price":4500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Moussa Ndiaye', 3800, 'done', 'wave', 'emporter', '2026-08-11 12:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Mafé Bœuf', 1, 3200), (v_ord_id, 'Bissap Frais', 1, 500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3800, 'wave', 'success', 'WV-260811-001', 'Moussa Ndiaye',
            '[{"name":"Mafé Bœuf","qty":1,"price":3200}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Fatoumata Sy', 3000, 'done', 'om', 'emporter', '2026-08-14 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Yassa Poulet', 1, 3000);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3000, 'om', 'success', 'OM-260814-001', 'Fatoumata Sy',
            '[{"name":"Yassa Poulet","qty":1,"price":3000}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Tidiane Fall', 5400, 'done', 'wave', 'emporter', '2026-08-17 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Thiéboudienne', 1, 3500), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 5400, 'wave', 'success', 'WV-260817-001', 'Tidiane Fall',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Cheikh Ba', 4000, 'done', 'om', 'emporter', '2026-08-19 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Domoda', 1, 2800), (v_ord_id, 'Jus de Gingembre', 1, 600), (v_ord_id, 'Eau Minérale', 1, 300);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 4000, 'om', 'success', 'OM-260819-001', 'Cheikh Ba',
            '[{"name":"Domoda","qty":1,"price":2800}]');

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_shop_id, v_client1_id, 'Binta Sarr', 3500, 'done', 'wave', 'emporter', '2026-08-21 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price) VALUES (v_ord_id, 'Thiéboudienne', 1, 3500);
    INSERT INTO payments (order_id, client_id, prestataire_id, amount, method, status, reference, client_name, items)
    VALUES (v_ord_id, v_client1_id, v_merchant_id, 3500, 'wave', 'success', 'WV-260821-001', 'Binta Sarr',
            '[{"name":"Thiéboudienne","qty":1,"price":3500}]');

    RAISE NOTICE '✓ 48 commandes insérées (Mars–Août 2026)';

    -- ════════════════════════════════════════════════════════════════
    -- 9. AVIS CLIENTS (bypass RLS en tant que superuser SQL Editor)
    --    ON CONFLICT : idempotent si relancé
    -- ════════════════════════════════════════════════════════════════

    -- Avis 1 : du client principal (Apple demo)
    INSERT INTO avis (shop_id, author_id, author_name, note, commentaire)
    VALUES (
      v_shop_id,
      v_client1_id,
      'Aminata D.',
      5,
      'Excellent ! Le Thiéboudienne est le meilleur de Dakar. Service rapide, commande bien emballée. Je commande chaque semaine maintenant.'
    )
    ON CONFLICT (shop_id, author_id)
    DO UPDATE SET
      note        = 5,
      commentaire = 'Excellent ! Le Thiéboudienne est le meilleur de Dakar. Service rapide, commande bien emballée. Je commande chaque semaine maintenant.';

    -- Avis 2 : du deuxième client (si disponible)
    IF v_client2_id IS NOT NULL THEN
      INSERT INTO avis (shop_id, author_id, author_name, note, commentaire)
      VALUES (
        v_shop_id,
        v_client2_id,
        'Moussa N.',
        4,
        'Très bon restaurant. Le Yassa Poulet est savoureux et généreux. Légèrement long mais ça vaut l''attente. Recommandé.'
      )
      ON CONFLICT (shop_id, author_id)
      DO UPDATE SET
        note        = 4,
        commentaire = 'Très bon restaurant. Le Yassa Poulet est savoureux et généreux. Légèrement long mais ça vaut l''attente. Recommandé.';
    END IF;

    -- Avis 3 : du troisième client (si disponible)
    IF v_client3_id IS NOT NULL THEN
      INSERT INTO avis (shop_id, author_id, author_name, note, commentaire)
      VALUES (
        v_shop_id,
        v_client3_id,
        'Fatoumata K.',
        5,
        'Thiof Grillé parfaitement cuisiné. Épices au point, poisson très frais. LASSI facilite vraiment les commandes. Bravo !'
      )
      ON CONFLICT (shop_id, author_id)
      DO UPDATE SET
        note        = 5,
        commentaire = 'Thiof Grillé parfaitement cuisiné. Épices au point, poisson très frais. LASSI facilite vraiment les commandes. Bravo !';
    END IF;

    RAISE NOTICE '✓ Avis insérés';

    -- ════════════════════════════════════════════════════════════════
    -- 10. METTRE À JOUR LES STATS DE LA BOUTIQUE
    -- ════════════════════════════════════════════════════════════════
    UPDATE shops
    SET orders_count = (
          SELECT COUNT(*) FROM orders
          WHERE shop_id = v_shop_id AND status = 'done'
        ),
        reviews_count = (
          SELECT COUNT(*) FROM avis
          WHERE shop_id = v_shop_id AND NOT masque
        ),
        rating = 4.8
    WHERE id = v_shop_id;

    RAISE NOTICE '✓ Stats boutique mises à jour';

  END IF; -- fin IF v_client1_id IS NOT NULL

  -- ════════════════════════════════════════════════════════════════
  -- RÉSUMÉ FINAL
  -- ════════════════════════════════════════════════════════════════
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '✅ SEED DÉMO APPLE TERMINÉ';
  RAISE NOTICE '   merchant_id : %', v_merchant_id;
  RAISE NOTICE '   shop_id     : %', v_shop_id;
  RAISE NOTICE '   Produits    : 8 (Plats x5 + Boissons x3)';
  RAISE NOTICE '   Commandes   : 48 sur Mars–Août 2026';
  RAISE NOTICE '   Paiements   : Wave + Orange Money';
  RAISE NOTICE '   Avis        : jusqu''à 3 selon comptes disponibles';
  RAISE NOTICE '════════════════════════════════════════════════';

END $$;
