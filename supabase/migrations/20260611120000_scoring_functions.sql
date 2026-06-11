-- ============================================================
-- LASSI · Système de classements & récompenses · Calcul des points
-- Migration 2026-06-11 (Phase 3)
-- ============================================================
-- Fonctions SECURITY DEFINER : accumulation de points (appelées à chaque
-- commande validée) + calcul des classements (snapshots figés dans
-- `classements`, exécuté par pg_cron — voir Phase 5).
-- search_path fixé à `public` sur toutes les fonctions SECURITY DEFINER
-- (recommandation sécurité Supabase).
-- ============================================================

-- ============================================================
-- FONCTION : ajouter des points à un prestataire (appelée à chaque commande validée)
-- ============================================================
CREATE OR REPLACE FUNCTION ajouter_points_commande(
  p_prestataire_id UUID,
  p_sous_categorie TEXT,
  p_quartier TEXT,
  p_montant INTEGER
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_points INTEGER;
BEGIN
  -- Barème : 10 points par commande + 1 point par tranche de 1000 FCFA
  v_points := 10 + (p_montant / 1000);

  INSERT INTO prestataire_scores (prestataire_id, sous_categorie, quartier, points_semaine, points_mois, nb_commandes_semaine, nb_commandes_mois)
  VALUES (p_prestataire_id, p_sous_categorie, p_quartier, v_points, v_points, 1, 1)
  ON CONFLICT (prestataire_id) DO UPDATE SET
    points_semaine = prestataire_scores.points_semaine + v_points,
    points_mois = prestataire_scores.points_mois + v_points,
    nb_commandes_semaine = prestataire_scores.nb_commandes_semaine + 1,
    nb_commandes_mois = prestataire_scores.nb_commandes_mois + 1,
    sous_categorie = p_sous_categorie,
    quartier = p_quartier,
    updated_at = now();
END;
$$;

-- ============================================================
-- FONCTION : ajouter points à un client (à chaque commande)
-- ============================================================
CREATE OR REPLACE FUNCTION ajouter_points_client(
  p_client_id UUID,
  p_prestataire_id UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO client_scores (client_id, prestataire_prefere_id, points_semaine, points_mois, nb_commandes_mois)
  VALUES (p_client_id, p_prestataire_id, 10, 10, 1)
  ON CONFLICT (client_id) DO UPDATE SET
    points_semaine = client_scores.points_semaine + 10,
    points_mois = client_scores.points_mois + 10,
    nb_commandes_mois = client_scores.nb_commandes_mois + 1,
    prestataire_prefere_id = p_prestataire_id,
    updated_at = now();
END;
$$;

-- ============================================================
-- FONCTION MAÎTRESSE : calculer le classement SOUS-CATÉGORIE (hebdo)
-- ============================================================
CREATE OR REPLACE FUNCTION calculer_classement_sous_categorie(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sous_cat TEXT;
  v_rec RECORD;
  v_rang INTEGER;
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
      LIMIT 20
    LOOP
      v_rang := v_rang + 1;
      INSERT INTO classements (type, periode, sous_categorie, prestataire_id, rang, points, nom_affiche, image_url, est_actif)
      VALUES ('sous_categorie', p_periode, v_sous_cat, v_rec.prestataire_id, v_rang, v_rec.points_semaine, v_rec.nom_boutique, v_rec.image_url, true);

      -- Attribuer Top VIP aux 3 premiers
      IF v_rang <= 3 THEN
        INSERT INTO recompenses_attribuees (prestataire_id, type_classement, periode, rang, badge, top_vip, valide_jusqu_a, est_actif)
        VALUES (
          v_rec.prestataire_id, 'sous_categorie', p_periode, v_rang,
          CASE v_rang WHEN 1 THEN '🏆 Champion de la semaine' WHEN 2 THEN '🥈 2e de la semaine' ELSE '🥉 3e de la semaine' END,
          true, now() + interval '7 days', true
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Réinitialiser les points de la semaine
  UPDATE prestataire_scores SET points_semaine = 0, nb_commandes_semaine = 0;
END;
$$;

-- ============================================================
-- FONCTION MAÎTRESSE : calculer le classement MONDIAL (mensuel)
-- ============================================================
CREATE OR REPLACE FUNCTION calculer_classement_mondial(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_rang INTEGER := 0;
BEGIN
  UPDATE classements SET est_actif = false WHERE type = 'mondial' AND periode = p_periode;
  UPDATE recompenses_attribuees SET est_actif = false WHERE type_classement = 'mondial';
  UPDATE carrousel_offre_quartier SET est_actif = false;

  FOR v_rec IN
    -- Nom/logo de la boutique : table shops (merchant_id = prestataire_id), pas profiles
    SELECT ps.prestataire_id, ps.points_mois, s.name AS nom_boutique, s.logo_url AS image_url
    FROM prestataire_scores ps
    JOIN shops s ON s.merchant_id = ps.prestataire_id
    WHERE ps.points_mois > 0
    ORDER BY ps.points_mois DESC
    LIMIT 40
  LOOP
    v_rang := v_rang + 1;
    INSERT INTO classements (type, periode, prestataire_id, rang, points, nom_affiche, image_url, est_actif)
    VALUES ('mondial', p_periode, v_rec.prestataire_id, v_rang, v_rec.points_mois, v_rec.nom_boutique, v_rec.image_url, true);
    -- Les récompenses dégressives sont attribuées côté Edge Function
    -- (lit config/rewards.ts PALIERS_MONDIAL) — voir Phase 4
  END LOOP;

  UPDATE prestataire_scores SET points_mois = 0, nb_commandes_mois = 0;
END;
$$;

-- ============================================================
-- FONCTION : classement QUARTIERS (mensuel)
-- ============================================================
CREATE OR REPLACE FUNCTION calculer_classement_quartiers(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec RECORD; v_rang INTEGER := 0;
BEGIN
  UPDATE classements SET est_actif = false WHERE type = 'quartier' AND periode = p_periode;
  FOR v_rec IN
    SELECT quartier, SUM(points_mois) AS total
    FROM prestataire_scores WHERE quartier IS NOT NULL
    GROUP BY quartier ORDER BY total DESC LIMIT 10
  LOOP
    v_rang := v_rang + 1;
    INSERT INTO classements (type, periode, quartier, rang, points, nom_affiche, est_actif)
    VALUES ('quartier', p_periode, v_rec.quartier, v_rang, v_rec.total, v_rec.quartier, true);
  END LOOP;
END;
$$;

-- ============================================================
-- FONCTION : classement CLIENTS (mensuel)
-- ============================================================
CREATE OR REPLACE FUNCTION calculer_classement_clients(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec RECORD; v_rang INTEGER := 0;
BEGIN
  UPDATE classements SET est_actif = false WHERE type = 'client' AND periode = p_periode;
  FOR v_rec IN
    -- profiles n'a pas de colonne full_name/image_url : ce sont name/avatar_url
    SELECT cs.client_id, cs.points_mois, p.name AS full_name, p.avatar_url AS image_url
    FROM client_scores cs JOIN profiles p ON p.id = cs.client_id
    WHERE cs.points_mois > 0
    ORDER BY cs.points_mois DESC LIMIT 10
  LOOP
    v_rang := v_rang + 1;
    INSERT INTO classements (type, periode, client_id, rang, points, nom_affiche, image_url, est_actif)
    VALUES ('client', p_periode, v_rec.client_id, v_rang, v_rec.points_mois, v_rec.full_name, v_rec.image_url, true);

    IF v_rang = 1 THEN
      INSERT INTO recompenses_attribuees (client_id, type_classement, periode, rang, badge, est_actif)
      VALUES (v_rec.client_id, 'client', p_periode, 1, '🎖️ Supporter n°1', true);
    END IF;
  END LOOP;
  UPDATE client_scores SET points_semaine = 0;
END;
$$;
