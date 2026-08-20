-- ============================================================
-- Fix : terminer_livraison échoue si l'INSERT notification plante
-- Même cause que accepter_livraison — notification isolée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.terminer_livraison(p_livraison_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT;
BEGIN
  UPDATE public.livraisons
  SET statut      = 'terminee',
      terminee_at = now()
  WHERE id        = p_livraison_id
    AND livreur_id = auth.uid()
    AND statut    = 'acceptee';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'IMPOSSIBLE: Livraison introuvable ou non acceptée par vous.';
  END IF;

  -- Notifier le demandeur — isolé : son échec n'annule pas la clôture
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      l.demandeur_id,
      'livraison',
      'Livraison arrivée',
      'Votre livraison est arrivée à destination.',
      jsonb_build_object('livraison_id', p_livraison_id)
    FROM public.livraisons l
    WHERE l.id = p_livraison_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN true;
END;
$$;
