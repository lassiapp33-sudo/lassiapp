-- ============================================================
-- Fix : accepter_livraison échoue si l'INSERT notification plante
-- (contrainte CHECK type, RLS, FK, etc.)
-- La notification est maintenant isolée — son échec n'annule plus
-- l'acceptation de la livraison.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accepter_livraison(p_livraison_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_livreur BOOLEAN;
  v_updated    INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.livreurs l
    JOIN public.profiles p ON p.id = l.id
    WHERE l.id = auth.uid() AND l.actif = true AND p.role = 'livreur'
  ) INTO v_is_livreur;

  IF NOT v_is_livreur THEN
    RAISE EXCEPTION 'NON_AUTORISE: Vous n''êtes pas un livreur actif.';
  END IF;

  UPDATE public.livraisons
  SET statut      = 'acceptee',
      livreur_id  = auth.uid(),
      accepted_at = now()
  WHERE id     = p_livraison_id
    AND statut = 'en_attente';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'DEJA_PRISE: Cette livraison a déjà été acceptée.';
  END IF;

  -- Notifier le demandeur — isolé : son échec n'annule pas l'acceptation
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      l.demandeur_id,
      'livraison',
      'Livraison prise en charge',
      'Un livreur est en route pour récupérer votre colis.',
      jsonb_build_object('livraison_id', p_livraison_id)
    FROM public.livraisons l
    WHERE l.id = p_livraison_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;
