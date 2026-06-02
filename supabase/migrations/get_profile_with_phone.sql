-- ─── Mise à jour get_profile_by_id : ajoute phone pour le bouton appel ─────────
-- Permet au marchand de récupérer le numéro du client (et vice-versa) dans le chat,
-- afin d'ouvrir WhatsApp sur le bon numéro.
-- SECURITY DEFINER = exécuté avec les droits owner, contourne le RLS.

-- DROP obligatoire : PostgreSQL interdit de changer le type de retour avec CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.get_profile_by_id(UUID);

CREATE FUNCTION public.get_profile_by_id(p_user_id UUID)
RETURNS TABLE(full_name TEXT, avatar_url TEXT, phone TEXT)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name, avatar_url, phone FROM profiles WHERE id = p_user_id;
$$;

REVOKE ALL    ON FUNCTION public.get_profile_by_id(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(UUID) TO authenticated;
