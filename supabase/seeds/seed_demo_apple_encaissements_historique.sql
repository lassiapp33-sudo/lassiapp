-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DÉMO APPLE v2-complement — Encaissements + Historique client
-- ─ Complète seed_demo_apple_prestataire.sql sans toucher aux commandes existantes
-- ─ PARTIE A : payout_queue + payment_intents → alimente "Mes encaissements"
-- ─ PARTIE B : orders où merchant = client   → alimente "Mon historique"
-- ─ Compte : +221 78 166 69 99 / lassana33 / merchant.demo.apple@lassi.tech
-- ─ À exécuter APRÈS le seed principal dans : Supabase → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_merchant_id    uuid;
  v_shop_id        uuid;
  v_other_shop_id  uuid;
  v_pi_id          uuid;
  v_ord_id         uuid;
  v_comm           integer;
  v_total          integer;
  v_moyen          text;
  v_ref            text;
  v_idem           text;
  r                RECORD;
BEGIN

  -- ══════════════════════════════════════════════════════════════════
  -- 0. TROUVER LE MARCHAND
  -- ══════════════════════════════════════════════════════════════════
  SELECT id INTO v_merchant_id
  FROM profiles
  WHERE phone ILIKE '%781666999%'
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION
      'Compte Testapple introuvable (tél 78 166 69 99). '
      'Exécutez d''abord seed_demo_apple_prestataire.sql.';
  END IF;
  RAISE NOTICE '✓ merchant_id = %', v_merchant_id;

  SELECT id INTO v_shop_id
  FROM shops
  WHERE merchant_id = v_merchant_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_shop_id IS NULL THEN
    RAISE EXCEPTION 'Aucune boutique. Exécutez d''abord le seed principal.';
  END IF;
  RAISE NOTICE '✓ shop_id = %', v_shop_id;


  -- ══════════════════════════════════════════════════════════════════
  -- PARTIE A — MES ENCAISSEMENTS
  -- Pour chaque commande "done" du shop → 1 payment_intent + 1 payout_queue
  -- ══════════════════════════════════════════════════════════════════

  -- Nettoyage sécurisé (idempotent) : payout_queue d'abord (FK), puis PI
  -- Les payment_logs sont protégés par une rule NO DELETE — on les laisse
  DELETE FROM payout_queue WHERE prestataire_id = v_merchant_id;

  -- Supprimer les PI dont aucun payment_log ne les référence
  -- (les PI du seed démo n'en ont pas, la suppression passe toujours)
  DELETE FROM payment_intents
  WHERE prestataire_id = v_merchant_id
    AND id NOT IN (SELECT payment_intent_id FROM payment_logs);

  RAISE NOTICE '✓ Anciens encaissements nettoyés';

  -- Boucle sur toutes les commandes done du shop
  FOR r IN
    SELECT o.id         AS order_id,
           o.client_id,
           o.total      AS prix,
           o.pay_method,
           o.created_at
    FROM   orders o
    WHERE  o.shop_id = v_shop_id
      AND  o.status  = 'done'
    ORDER  BY o.created_at
  LOOP
    v_comm  := CEIL(r.prix * 0.01);
    v_total := r.prix + v_comm;
    v_moyen := CASE r.pay_method WHEN 'wave' THEN 'wave' ELSE 'orange_money' END;
    v_idem  := 'apple-demo-pi-' || r.order_id::text;
    v_ref   := CASE r.pay_method
                 WHEN 'wave' THEN 'WV-DEMO-' || UPPER(LEFT(r.order_id::text, 8))
                 ELSE             'OM-DEMO-' || UPPER(LEFT(r.order_id::text, 8))
               END;

    -- Insérer ou ignorer si doublon (idempotent)
    INSERT INTO payment_intents (
      order_id, client_id, prestataire_id,
      prix_base, commission_lassi, montant_total,
      moyen_paiement, idempotency_key, statut,
      external_ref,
      confirmed_at, split_done_at,
      created_at,   updated_at
    )
    VALUES (
      r.order_id,
      r.client_id,
      v_merchant_id,
      r.prix,
      v_comm,
      v_total,
      v_moyen,
      v_idem,
      'split_done',
      v_ref,
      r.created_at + interval '3 minutes',
      r.created_at + interval '8 minutes',
      r.created_at,
      r.created_at + interval '8 minutes'
    )
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING id INTO v_pi_id;

    -- Si DO NOTHING a joué, récupérer l'ID existant
    IF v_pi_id IS NULL THEN
      SELECT id INTO v_pi_id
      FROM payment_intents
      WHERE idempotency_key = v_idem;
    END IF;

    IF v_pi_id IS NULL THEN
      RAISE NOTICE '⚠ PI non créé pour commande %', r.order_id;
      CONTINUE;
    END IF;

    -- Payout correspondant
    INSERT INTO payout_queue (
      payment_intent_id, prestataire_id,
      montant, statut,
      external_payout_ref,
      created_at, updated_at, processed_at
    )
    VALUES (
      v_pi_id,
      v_merchant_id,
      r.prix,   -- le prestataire reçoit le prix_base (LASSI garde la commission)
      'paid',
      'PO-' || v_ref,
      r.created_at + interval '10 minutes',
      r.created_at + interval '10 minutes',
      r.created_at + interval '10 minutes'
    )
    ON CONFLICT (payment_intent_id) DO NOTHING;

  END LOOP;

  RAISE NOTICE '✓ PARTIE A terminée — encaissements créés pour % commandes',
    (SELECT COUNT(*) FROM orders WHERE shop_id = v_shop_id AND status = 'done');


  -- ══════════════════════════════════════════════════════════════════
  -- PARTIE B — MON HISTORIQUE
  -- Commandes passées par le marchand EN TANT QUE CLIENT
  -- On cherche une autre boutique existante dans la DB
  -- ══════════════════════════════════════════════════════════════════

  -- Trouver une boutique extérieure (active de préférence)
  SELECT id INTO v_other_shop_id
  FROM   shops
  WHERE  merchant_id <> v_merchant_id
  ORDER  BY is_open DESC, created_at DESC
  LIMIT  1;

  IF v_other_shop_id IS NULL THEN
    RAISE NOTICE '⚠ Aucune autre boutique trouvée — PARTIE B ignorée';
    RAISE NOTICE '  → Créez une boutique tierce ou inscrivez un autre prestataire, puis relancez.';
  ELSE
    RAISE NOTICE '✓ other_shop_id = %', v_other_shop_id;

    -- Nettoyer les anciennes commandes-client du marchand (dans une autre boutique)
    DELETE FROM order_items
    WHERE  order_id IN (
      SELECT id FROM orders
      WHERE  client_id = v_merchant_id AND shop_id <> v_shop_id
    );
    DELETE FROM orders
    WHERE  client_id = v_merchant_id AND shop_id <> v_shop_id;

    -- 6 commandes historiques où le marchand est client (Juin–Août 2026)

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 3500, 'done', 'wave', 'emporter', '2026-06-10 12:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Plat du jour', 1, 3500);

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 4500, 'done', 'om', 'emporter', '2026-06-22 19:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Menu spécial', 1, 4000), (v_ord_id, 'Boisson', 1, 500);

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 3000, 'done', 'wave', 'emporter', '2026-07-05 13:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Plat principal', 1, 3000);

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 5500, 'done', 'om', 'emporter', '2026-07-18 20:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Formule midi', 2, 2500), (v_ord_id, 'Eau minérale', 1, 500);

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 2800, 'done', 'wave', 'emporter', '2026-08-03 12:00:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Plat du chef', 1, 2800);

    INSERT INTO orders (shop_id, client_id, client_name, total, status, pay_method, order_type, created_at)
    VALUES (v_other_shop_id, v_merchant_id, 'Testapple', 4200, 'done', 'om', 'emporter', '2026-08-14 19:30:00+00')
    RETURNING id INTO v_ord_id;
    INSERT INTO order_items (order_id, product_name, qty, unit_price)
    VALUES (v_ord_id, 'Poulet braisé', 1, 3500), (v_ord_id, 'Jus naturel', 1, 700);

    RAISE NOTICE '✓ PARTIE B terminée — 6 commandes client du marchand insérées';
  END IF;


  -- ══════════════════════════════════════════════════════════════════
  -- RÉSUMÉ
  -- ══════════════════════════════════════════════════════════════════
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════';
  RAISE NOTICE '✅ SEED COMPLEMENT TERMINÉ';
  RAISE NOTICE '   Encaissements (payout_queue paid) : %',
    (SELECT COUNT(*) FROM payout_queue WHERE prestataire_id = v_merchant_id AND statut = 'paid');
  RAISE NOTICE '   Total encaissé (FCFA)             : %',
    (SELECT COALESCE(SUM(montant), 0) FROM payout_queue WHERE prestataire_id = v_merchant_id AND statut = 'paid');
  RAISE NOTICE '   Commandes client (historique)     : %',
    (SELECT COUNT(*) FROM orders WHERE client_id = v_merchant_id AND shop_id <> v_shop_id);
  RAISE NOTICE '════════════════════════════════════════════════';

END $$;
