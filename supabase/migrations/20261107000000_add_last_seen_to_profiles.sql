-- Migration: add last_seen column to profiles + RPC update_last_seen
-- Tracks last app open per user (nullable, no default)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- SECURITY DEFINER : fonction appelée par le client via RPC, met à jour
-- uniquement la ligne de l'utilisateur connecté (auth.uid())
CREATE OR REPLACE FUNCTION public.update_last_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE profiles SET last_seen = NOW() WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.update_last_seen() TO authenticated;
