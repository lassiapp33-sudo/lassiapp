-- ============================================================
-- LASSI · Script de simulation des notifications
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
-- ÉTAPE 1 : Remplacer l'email ci-dessous par celui du compte
--           à tester, puis exécuter (Run) la totalité du script.
--
-- Le script insère 7 notifications de test :
--   1. Récompense admin (cadeau manuel)
--   2. Pack visibilité activé (crédit LASSI)
--   3. Pack visibilité activé (Wave)
--   4. Top VIP de la semaine
--   5. Mérite classement semaine (Top 3)
--   6. Mise à jour classement semaine (tous les classés)
--   7. Classement mondial mensuel
--
-- Les notifications Realtime arriveront immédiatement si
-- l'app est ouverte. Sinon elles seront visibles au prochain
-- démarrage (carte rich + liste).
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_email   TEXT := 'TON_EMAIL@example.com';  -- ← MODIFIER ICI
BEGIN

  -- Résolution de l'ID utilisateur
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur "%" non trouvé dans auth.users', v_email;
  END IF;

  RAISE NOTICE 'Simulation pour user_id = %', v_user_id;

  -- ──────────────────────────────────────────────────────────
  -- 1. Récompense donnée manuellement par l'admin
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🎁 Un cadeau de la part de l''équipe LASSI !',
    'Bonjour ! L''équipe LASSI a le plaisir de vous offrir le badge 🌟 Partenaire LASSI, un certificat de reconnaissance partageable, une priorité dans les résultats de recherche, 10 000 FCFA de crédit LASSI, 2 emplacements dans l''Offre du Quartier, et une mise en avant Top VIP sur la page d''accueil.',
    '{"type_classement": "manuel", "badge": "🌟", "credit_lassi": 10000}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 2. Pack visibilité activé avec crédit LASSI
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🎉 Forfait activé avec ton crédit LASSI !',
    'Ton crédit LASSI a été utilisé pour activer le forfait « 3 mois » de l''Offre du Quartier jusqu''au 28 septembre 2026. Il te reste 4 500 FCFA de crédit LASSI.',
    '{"subscription_id": "sim-credit-001", "forfait": "3_mois", "type_paiement": "credit"}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 3. Pack visibilité activé avec Wave
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🎉 Offre du Quartier activée — Paiement Wave reçu !',
    'Ton paiement Wave de 15 000 FCFA a été confirmé. Ton forfait « 6 mois » de l''Offre du Quartier est maintenant actif. Tes produits sont mis en avant jusqu''au 28 décembre 2026.',
    '{"subscription_id": "sim-wave-001", "forfait": "6_mois", "type_paiement": "wave", "montant": 15000}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 4. Top VIP de la semaine
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🏆 Tu es Top VIP cette semaine !',
    'Félicitations ! Tu occupes la 1ère place dans ta catégorie cette semaine. Continue à offrir un service d''exception pour maintenir ta position et accéder aux récompenses Top VIP. Visibilité maximale activée pour 7 jours.',
    '{"type_classement": "sous_categorie", "rang": 1, "top_vip": true}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 5. Mérite classement semaine (récompense Top 3)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🥇 Mérite de la semaine — Top 3 !',
    'Bravo ! Tu termines 2ème de ta sous-catégorie cette semaine. Tu reçois : badge 🔥 Coup de cœur, 5 000 FCFA de crédit LASSI, 1 emplacement supplémentaire dans l''Offre du Quartier.',
    '{"type_classement": "sous_categorie", "rang": 2, "badge": "🔥", "credit_lassi": 5000, "carrousel_produits": 1}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 6. Mise à jour classement semaine (tous les classés)
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '📊 Résultats hebdomadaires mis à jour',
    'Votre classement de la semaine 26 est disponible. Vous êtes classé 8ème dans votre sous-catégorie. Consultez l''onglet Classement pour voir votre score et les récompenses des meilleurs.',
    '{"type_classement": "sous_categorie", "rang": 8, "periode": "2026-W26"}'
  );

  -- ──────────────────────────────────────────────────────────
  -- 7. Classement mondial mensuel
  -- ──────────────────────────────────────────────────────────
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_user_id,
    'vip',
    '🌍 Classement mondial de juin 2026 !',
    'Le classement mondial LASSI de juin 2026 vient d''être publié. Vous êtes classé 15ème parmi tous les prestataires LASSI. Récompense attribuée : priorité de recherche activée pour 30 jours.',
    '{"type_classement": "mondial", "rang": 15, "periode": "2026-06", "priorite_recherche": true}'
  );

  RAISE NOTICE '✅ 7 notifications de simulation insérées avec succès pour %', v_email;
END $$;
