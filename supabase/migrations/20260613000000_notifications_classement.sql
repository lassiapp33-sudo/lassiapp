-- ============================================================
-- LASSI · Notifications classement hebdo & récompenses mérite (Phase 16)
-- Migration 2026-06-13
-- ============================================================
-- calculer_classement_sous_categorie() (20260611120000_scoring_functions.sql)
-- calculait le classement et attribuait le Top VIP (rang 1-3) sans jamais
-- notifier les prestataires. Cette migration remplace la fonction
-- (CREATE OR REPLACE, seule la fonction change — le cron 'classement-hebdo'
-- et les privilèges service_role de 20260611150000_classements_securite.sql
-- restent inchangés) pour ajouter, dans la table `notifications`
-- (type='vip', même valeur que la récompense de bienvenue) :
--
--   1. Pour CHAQUE prestataire ayant marqué des points cette semaine
--      (points_semaine > 0) : une notification "classement mis à jour" avec
--      son rang réel dans sa sous-catégorie, même s'il est hors du top 20
--      affiché dans `classements` (la LIMIT 20 ne s'applique plus qu'à
--      l'INSERT dans `classements`, le rang est désormais calculé pour tout
--      le monde).
--   2. Pour le Top 3 (déjà récompensé via recompenses_attribuees/top_vip) :
--      une notification "mérite" supplémentaire annonçant le badge et la
--      mise en avant Top VIP de 7 jours.
-- ============================================================

CREATE OR REPLACE FUNCTION calculer_classement_sous_categorie(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sous_cat TEXT;
  v_rec RECORD;
  v_rang INTEGER;
  v_ordinal TEXT;
  v_badge TEXT;
BEGIN
  -- Désactiver l'ancien classement de cette période
  UPDATE classements SET est_actif = false WHERE type = 'sous_categorie' AND periode = p_periode;

  -- Pour chaque sous-catégorie distincte
  FOR v_sous_cat IN SELECT DISTINCT sous_categorie FROM prestataire_scores WHERE sous_categorie IS NOT NULL
  LOOP
    v_rang := 0;
    FOR v_rec IN
      -- Nom/logo de la boutique : table shops (merchant_id = prestataire_id), pas profiles
      SELECT ps.prestataire_id, ps.points_semaine, s.name AS nom_boutique, s.logo_url AS image_url
      FROM prestataire_scores ps
      JOIN shops s ON s.merchant_id = ps.prestataire_id
      WHERE ps.sous_categorie = v_sous_cat AND ps.points_semaine > 0
      ORDER BY ps.points_semaine DESC
    LOOP
      v_rang := v_rang + 1;
      v_ordinal := CASE WHEN v_rang = 1 THEN '1er' ELSE v_rang || 'e' END;

      -- Le classement affiché (podium + liste) reste limité au top 20
      IF v_rang <= 20 THEN
        INSERT INTO classements (type, periode, sous_categorie, prestataire_id, rang, points, nom_affiche, image_url, est_actif)
        VALUES ('sous_categorie', p_periode, v_sous_cat, v_rec.prestataire_id, v_rang, v_rec.points_semaine, v_rec.nom_boutique, v_rec.image_url, true);
      END IF;

      -- Attribuer Top VIP aux 3 premiers + notification mérite
      IF v_rang <= 3 THEN
        v_badge := CASE v_rang WHEN 1 THEN '🏆 Champion de la semaine' WHEN 2 THEN '🥈 2e de la semaine' ELSE '🥉 3e de la semaine' END;

        INSERT INTO recompenses_attribuees (prestataire_id, type_classement, periode, rang, badge, top_vip, valide_jusqu_a, est_actif)
        VALUES (
          v_rec.prestataire_id, 'sous_categorie', p_periode, v_rang,
          v_badge, true, now() + interval '7 days', true
        );

        INSERT INTO notifications (user_id, type, title, body, data) VALUES (
          v_rec.prestataire_id, 'vip',
          '🏆 Félicitations, ' || v_badge || ' !',
          'Grâce à votre travail et à la confiance de vos clients, vous terminez ' || v_ordinal || ' de la catégorie « ' || v_sous_cat || ' » cette semaine. En récompense, vous obtenez le badge ' || v_badge || ' et une mise en avant Top VIP sur la page d''accueil pendant 7 jours. Bravo, et continuez sur cette lancée pour décrocher encore plus de récompenses !',
          jsonb_build_object('type_classement', 'sous_categorie', 'rang', v_rang, 'periode', p_periode)
        );
      END IF;

      -- Notification hebdo : classement mis à jour (tous les prestataires classés)
      INSERT INTO notifications (user_id, type, title, body, data) VALUES (
        v_rec.prestataire_id, 'vip',
        '📊 Votre classement de la semaine est arrivé',
        'Bonjour ! Le classement de la catégorie « ' || v_sous_cat || ' » vient d''être mis à jour : vous terminez ' || v_ordinal || ' cette semaine. Rendez-vous dans la section Classement pour voir le détail et votre évolution. Merci pour votre sérieux, continuez sur cette belle dynamique !',
        jsonb_build_object('sous_categorie', v_sous_cat, 'rang', v_rang, 'periode', p_periode)
      );
    END LOOP;
  END LOOP;

  -- Réinitialiser les points de la semaine
  UPDATE prestataire_scores SET points_semaine = 0, nb_commandes_semaine = 0;
END;
$$;
