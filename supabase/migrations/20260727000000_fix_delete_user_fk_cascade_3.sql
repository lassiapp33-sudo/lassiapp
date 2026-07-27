-- ===========================================================================
-- Fix FK constraints bloquant la suppression d'un utilisateur (3e lot)
-- ---------------------------------------------------------------------------
-- Tables ajoutées après 20260624020000_fix_delete_user_fk_cascade.sql :
--   order_ratings   (2026-07-06) : rater_id / rated_id → NOT NULL, pas de CASCADE
--   livraisons      (2026-07-16) : demandeur_id → NOT NULL ; livreur_id → nullable
--   livraison_paiements (2026-07-16) : demandeur_id → NOT NULL, pas de CASCADE
--   livreurs        (2026-07-16) : cree_par → nullable, pas de SET NULL
--
-- Symptôme : admin.auth.admin.deleteUser() lève une violation FK → le profil
-- est déjà supprimé par l'Edge Function mais auth.users reste → le numéro
-- de téléphone reste "pris" et bloque la réinscription.
-- ===========================================================================

-- ── order_ratings ─────────────────────────────────────────────────────────────
-- rater_id et rated_id sont NOT NULL → ON DELETE CASCADE (supprimer les notes
-- quand l'un des deux acteurs est supprimé).

ALTER TABLE order_ratings
  DROP CONSTRAINT IF EXISTS order_ratings_rater_id_fkey;
ALTER TABLE order_ratings
  ADD CONSTRAINT order_ratings_rater_id_fkey
  FOREIGN KEY (rater_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE order_ratings
  DROP CONSTRAINT IF EXISTS order_ratings_rated_id_fkey;
ALTER TABLE order_ratings
  ADD CONSTRAINT order_ratings_rated_id_fkey
  FOREIGN KEY (rated_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── livraisons ────────────────────────────────────────────────────────────────
-- demandeur_id est NOT NULL → ON DELETE CASCADE
-- livreur_id est nullable → ON DELETE SET NULL

ALTER TABLE livraisons
  DROP CONSTRAINT IF EXISTS livraisons_demandeur_id_fkey;
ALTER TABLE livraisons
  ADD CONSTRAINT livraisons_demandeur_id_fkey
  FOREIGN KEY (demandeur_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE livraisons
  DROP CONSTRAINT IF EXISTS livraisons_livreur_id_fkey;
ALTER TABLE livraisons
  ADD CONSTRAINT livraisons_livreur_id_fkey
  FOREIGN KEY (livreur_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── livraison_paiements ───────────────────────────────────────────────────────
-- demandeur_id est NOT NULL → ON DELETE CASCADE

ALTER TABLE livraison_paiements
  DROP CONSTRAINT IF EXISTS livraison_paiements_demandeur_id_fkey;
ALTER TABLE livraison_paiements
  ADD CONSTRAINT livraison_paiements_demandeur_id_fkey
  FOREIGN KEY (demandeur_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── livreurs ──────────────────────────────────────────────────────────────────
-- cree_par est nullable → ON DELETE SET NULL

ALTER TABLE livreurs
  DROP CONSTRAINT IF EXISTS livreurs_cree_par_fkey;
ALTER TABLE livreurs
  ADD CONSTRAINT livreurs_cree_par_fkey
  FOREIGN KEY (cree_par) REFERENCES auth.users(id) ON DELETE SET NULL;
