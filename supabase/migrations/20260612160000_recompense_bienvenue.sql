-- ============================================================
-- LASSI · Récompense de bienvenue (nouveau compte prestataire)
-- Migration 2026-06-12 (Phase 14)
-- ============================================================
-- À la création d'un compte prestataire (profiles.role = 'merchant'),
-- on attribue automatiquement :
--   - une récompense recompenses_attribuees (type_classement='bienvenue',
--     rang=0, carrousel_produits=4, est_actif=true) → 4 emplacements
--     offerts dans le carrousel "Offre di Quartier" ;
--   - une notification (type='vip') annonçant ce cadeau, visible dans
--     l'écran Notifications de l'app.
--
-- Garde NOT EXISTS : n'attribue le cadeau qu'une seule fois par
-- prestataire, quel que soit le nombre d'INSERT déclenchés (trigger
-- auth.users + upsert applicatif dans services/auth.ts:register()).
--
-- carrousel_presta_manage (20260612150000_recompenses_manuelles.sql)
-- n'autorisait la gestion du carrousel qu'aux types 'mondial' et
-- 'manuel'. On élargit pour accepter aussi 'bienvenue'.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_recompense_bienvenue()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'merchant' AND NOT EXISTS (
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
      'Pour démarrer, tu reçois 4 emplacements offerts dans le carrousel "Offre di Quartier" pour mettre en avant tes produits auprès de tous les clients.',
      '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_recompense_bienvenue ON profiles;
CREATE TRIGGER trg_profiles_recompense_bienvenue
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trg_recompense_bienvenue();

DROP POLICY IF EXISTS "carrousel_presta_manage" ON carrousel_offre_quartier;
CREATE POLICY "carrousel_presta_manage" ON carrousel_offre_quartier
  FOR ALL USING (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement IN ('mondial', 'manuel', 'bienvenue')
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  )
  WITH CHECK (
    auth.uid() = prestataire_id
    AND EXISTS (
      SELECT 1 FROM recompenses_attribuees ra
      WHERE ra.prestataire_id = auth.uid()
        AND ra.type_classement IN ('mondial', 'manuel', 'bienvenue')
        AND ra.est_actif = true
        AND ra.carrousel_produits > 0
    )
  );
