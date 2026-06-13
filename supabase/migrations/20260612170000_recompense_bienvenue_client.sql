-- ============================================================
-- LASSI · Message de bienvenue (nouveau compte client)
-- Migration 2026-06-12 (Phase 14 bis)
-- ============================================================
-- Étend trg_recompense_bienvenue() (20260612160000_recompense_bienvenue.sql) :
-- en plus du cadeau "Offre du Quartier" pour les nouveaux prestataires,
-- un nouveau compte CLIENT reçoit une notification (type='vip') qui
-- explique en quelques points l'essentiel de LASSI (découvrir les
-- commerces du quartier, commander, suivre la commande, discuter avec
-- le commerçant, classement "Top clients").
-- Le trigger AFTER INSERT ON profiles existe déjà — seule la fonction
-- est remplacée (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION trg_recompense_bienvenue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'merchant' THEN
    IF NOT EXISTS (
      SELECT 1 FROM recompenses_attribuees
      WHERE prestataire_id = NEW.id AND type_classement = 'bienvenue'
    ) THEN
      INSERT INTO recompenses_attribuees (
        prestataire_id, type_classement, periode, rang,
        badge, carrousel_produits, est_actif
      ) VALUES (
        NEW.id, 'bienvenue', to_char(now(), 'YYYY-MM'), 0,
        '🎁 Bienvenue sur LASSI', 4, true
      );

      INSERT INTO notifications (user_id, type, title, body, data) VALUES (
        NEW.id, 'vip', '🎁 Bienvenue sur LASSI !',
        'Pour démarrer, tu reçois 4 emplacements offerts dans le carrousel "Offre du Quartier" pour mettre en avant tes produits auprès de tous les clients.',
        '{}'::jsonb
      );
    END IF;

  ELSIF NEW.role = 'client' THEN
    INSERT INTO notifications (user_id, type, title, body, data) VALUES (
      NEW.id, 'vip', '👋 Bienvenue sur LASSI !',
      'LASSI te connecte aux commerces et prestataires de ton quartier à Dakar : explore, commande en quelques clics, suis ta commande en direct, discute avec le commerçant et cumule des points pour grimper dans le classement "Top clients".',
      '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;
