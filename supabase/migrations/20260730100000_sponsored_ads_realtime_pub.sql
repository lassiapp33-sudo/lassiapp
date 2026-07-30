-- ============================================================
-- LASSI · Annonces Sponsorisées — Realtime publication
-- Migration 2026-07-30
-- ============================================================
-- Active le realtime Supabase sur sponsored_ads afin que
-- MaCampagneScreen reçoive les changements de actual_views /
-- contact_count en temps réel sans polling.
-- ============================================================

-- Ajouter la table à la publication realtime si pas encore fait
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'sponsored_ads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sponsored_ads;
  END IF;
END;
$$;
