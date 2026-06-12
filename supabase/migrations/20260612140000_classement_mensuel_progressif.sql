-- ============================================================
-- LASSI · Classements mensuels progressifs (Phase 12)
-- Migration 2026-06-12
-- ============================================================
-- Avant : Mondial / Quartier / Top clients n'étaient calculés et affichés
-- qu'une fois par mois (1er du mois 00h00) -> pendant tout le mois en
-- cours, les utilisateurs voyaient le classement FIGÉ du mois précédent.
-- Peu motivant : on ne voit sa progression qu'une fois par mois.
--
-- Après : chaque dimanche (cron classement-hebdo), en plus de "Ma
-- catégorie" (hebdo, inchangé), on calcule un APERÇU du classement
-- Mondial / Quartier / Top clients pour le MOIS EN COURS, basé sur les
-- points cumulés depuis le 1er du mois. Aucun reset, aucune récompense
-- touchée : juste un instantané à jour dans `classements`.
--
-- Le 1er du mois (cron classement-mensuel), calcul FINAL du mois qui
-- vient de se terminer (comme avant) : récompenses (Top VIP, Supporter
-- n°1, carrousel...) + reset des compteurs mensuels pour démarrer le
-- nouveau mois.
--
-- Bonus : corrige un bug d'ordre dans le job mensuel — calculer_classement
-- _quartiers lisait prestataire_scores.points_mois APRÈS que
-- calculer_classement_mondial les ait remis à 0 (le classement quartiers
-- mensuel ne contenait donc jamais rien). Quartiers est désormais calculé
-- EN PREMIER.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Aperçu MONDIAL (sans reset, sans toucher récompenses/carrousel)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculer_apercu_classement_mondial(p_periode TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec RECORD;
  v_rang INTEGER := 0;
BEGIN
  UPDATE classements SET est_actif = false WHERE type = 'mondial' AND periode = p_periode;

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
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION calculer_apercu_classement_mondial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculer_apercu_classement_mondial(text) TO service_role;

-- ------------------------------------------------------------
-- 2) Aperçu CLIENTS (sans reset, sans badge Supporter n°1)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculer_apercu_classement_clients(p_periode TEXT)
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
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION calculer_apercu_classement_clients(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calculer_apercu_classement_clients(text) TO service_role;

-- ------------------------------------------------------------
-- 3) Replanification des jobs pg_cron
-- ------------------------------------------------------------

-- HEBDO : chaque dimanche 23h59
--   - Ma catégorie : officiel, hebdo, reset points_semaine (inchangé)
--   - Aperçu Mondial / Quartier / Top clients du mois EN COURS (live, sans reset)
SELECT cron.schedule(
  'classement-hebdo',
  '59 23 * * 0',
  $$
    SELECT calculer_classement_sous_categorie(to_char(now(), 'IYYY') || '-S' || to_char(now(), 'IW'));
    SELECT calculer_classement_quartiers(to_char(now(), 'YYYY-MM'));
    SELECT calculer_apercu_classement_mondial(to_char(now(), 'YYYY-MM'));
    SELECT calculer_apercu_classement_clients(to_char(now(), 'YYYY-MM'));
  $$
);

-- MENSUEL : le 1er du mois à 00h00 -> calcul FINAL du mois qui vient de
-- se terminer (quartiers en premier pour lire points_mois avant le reset
-- effectué par calculer_classement_mondial)
SELECT cron.schedule(
  'classement-mensuel',
  '0 0 1 * *',
  $$
    SELECT calculer_classement_quartiers(to_char(now() - interval '1 day', 'YYYY-MM'));
    SELECT calculer_classement_mondial(to_char(now() - interval '1 day', 'YYYY-MM'));
    SELECT calculer_classement_clients(to_char(now() - interval '1 day', 'YYYY-MM'));
  $$
);
