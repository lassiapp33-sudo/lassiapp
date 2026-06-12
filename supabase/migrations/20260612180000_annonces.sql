-- ============================================================
-- LASSI · Système d'annonces (notifications système type PUBG)
-- Migration 2026-06-12 (Phase 15)
-- ============================================================
-- Annonces diffusées au démarrage de l'app sous forme de modale plein
-- écran (useAnnonces + AnnonceModal), une seule fois par compte :
--   - annonces        : contenu + ciblage (audience) + activation/expiration
--   - annonces_lues   : suivi de lecture par utilisateur (jamais réaffichée)
--
-- Ciblage (audience) :
--   - 'tous'          : tous les comptes (clients + prestataires)
--   - 'prestataires'  : profiles.role = 'merchant'
--   - 'clients'       : profiles.role = 'client'
--
-- Écriture réservée aux admins (lassi-admin, profiles.is_admin = true),
-- même pattern que admin_and_disputes.sql (20250101030000).
-- ============================================================

CREATE TABLE IF NOT EXISTS annonces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre       TEXT NOT NULL,
  corps       TEXT NOT NULL,
  icone       TEXT NOT NULL DEFAULT '📢',
  tag         TEXT,
  audience    TEXT NOT NULL DEFAULT 'tous' CHECK (audience IN ('tous', 'prestataires', 'clients')),
  est_actif   BOOLEAN NOT NULL DEFAULT true,
  expire_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS annonces_lues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id  UUID NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lu_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (annonce_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_annonces_lues_user ON annonces_lues(user_id);
CREATE INDEX IF NOT EXISTS idx_annonces_actives ON annonces(est_actif, audience);

ALTER TABLE annonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE annonces_lues ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié (le ciblage fin par audience +
-- statut "lu" est géré par get_annonces_non_lues ci-dessous)
DROP POLICY IF EXISTS "annonces_read" ON annonces;
CREATE POLICY "annonces_read" ON annonces
  FOR SELECT USING (auth.role() = 'authenticated');

-- Écriture (création / désactivation) : admins uniquement
DROP POLICY IF EXISTS "annonces_admin_write" ON annonces;
CREATE POLICY "annonces_admin_write" ON annonces
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- annonces_lues : chaque utilisateur gère uniquement ses propres lectures
DROP POLICY IF EXISTS "annonces_lues_own" ON annonces_lues;
CREATE POLICY "annonces_lues_own" ON annonces_lues
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Fonction : annonces actives non lues pour l'utilisateur connecté,
-- ciblées selon son rôle (profiles.role), les plus récentes en premier.
-- SECURITY DEFINER pour pouvoir joindre `profiles` sans dépendre de ses
-- policies ; search_path fixé par sécurité (cf. 20260611120000).
-- ============================================================
CREATE OR REPLACE FUNCTION get_annonces_non_lues()
RETURNS SETOF annonces
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.*
  FROM annonces a
  JOIN profiles p ON p.id = auth.uid()
  WHERE a.est_actif = true
    AND (a.expire_at IS NULL OR a.expire_at > now())
    AND (
      a.audience = 'tous'
      OR (a.audience = 'prestataires' AND p.role = 'merchant')
      OR (a.audience = 'clients' AND p.role = 'client')
    )
    AND NOT EXISTS (
      SELECT 1 FROM annonces_lues al
      WHERE al.annonce_id = a.id AND al.user_id = auth.uid()
    )
  ORDER BY a.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION get_annonces_non_lues() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_annonces_non_lues() TO authenticated;
