-- ============================================================
-- LASSI · Brancher le scoring classements dans les commandes
-- Migration 2026-06-12 (Phase 11)
-- ============================================================
-- Objectif : à chaque commande qui passe au statut 'validated',
-- créditer les points classement du prestataire (ajouter_points_commande)
-- et du client (ajouter_points_client) — voir 20260611120000_scoring_functions.sql.
--
-- confirm_order_from_payment / verify_receipt (qui font transitionner
-- orders.status vers 'validated') ont été créées directement dans le SQL
-- Editor Supabase pendant la Phase 7 paiements et ne sont versionnées dans
-- aucun fichier de ce repo : impossible de retrouver leur corps actuel pour
-- y insérer les PERFORM sans risquer d'écraser leur logique (paiement,
-- reçu, notifications...).
--
-- À la place : un trigger AFTER UPDATE sur `orders`, déclenché au premier
-- passage status -> 'validated' (quelle que soit la fonction qui fait
-- cette transition aujourd'hui ou demain), qui dérive prestataire/sous-
-- catégorie/quartier/client depuis orders + shops et crédite les deux
-- scores. Idempotent : ne se déclenche qu'une seule fois par commande
-- (OLD.status IS DISTINCT FROM 'validated').
-- ============================================================

CREATE OR REPLACE FUNCTION trg_scoring_commande_validee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prestataire_id UUID;
  v_sous_categorie TEXT;
  v_quartier TEXT;
BEGIN
  -- sous_categorie : 1re sous-catégorie de la boutique (même valeur que
  -- shopStore.context.subcategories[0] côté app), avec repli sur category.
  -- to_jsonb(...)->>0 fonctionne que `subcategories` soit text[] ou jsonb.
  SELECT s.merchant_id, COALESCE(to_jsonb(s.subcategories) ->> 0, s.category), s.zone
  INTO v_prestataire_id, v_sous_categorie, v_quartier
  FROM shops s
  WHERE s.id = NEW.shop_id;

  IF v_prestataire_id IS NOT NULL THEN
    PERFORM ajouter_points_commande(v_prestataire_id, v_sous_categorie, v_quartier, NEW.total);

    IF NEW.client_id IS NOT NULL THEN
      PERFORM ajouter_points_client(NEW.client_id, v_prestataire_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION trg_scoring_commande_validee() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_orders_scoring ON orders;

CREATE TRIGGER trg_orders_scoring
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'validated' AND OLD.status IS DISTINCT FROM 'validated')
  EXECUTE FUNCTION trg_scoring_commande_validee();
