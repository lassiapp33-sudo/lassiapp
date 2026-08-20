-- ============================================================
-- Correction des notifications de livraison
-- Règle : push UNIQUEMENT au demandeur (client ou prestataire).
-- Admin et prestataire de la commande : vue dashboard uniquement.
-- ============================================================

-- ── accepter_livraison ────────────────────────────────────────────────────────
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

  -- Notification au demandeur uniquement (client OU prestataire selon demandeur_type)
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    l.demandeur_id,
    'livraison',
    'Livraison prise en charge',
    'Un livreur est en route pour récupérer votre colis.',
    jsonb_build_object('livraison_id', p_livraison_id)
  FROM public.livraisons l
  WHERE l.id = p_livraison_id;

  RETURN true;
END;
$$;

-- ── terminer_livraison ────────────────────────────────────────────────────────
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

  -- Notification au demandeur uniquement — libellé identique client/prestataire
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    l.demandeur_id,
    'livraison',
    'Livraison arrivée',
    'Votre livraison est arrivée à destination.',
    jsonb_build_object('livraison_id', p_livraison_id)
  FROM public.livraisons l
  WHERE l.id = p_livraison_id;

  RETURN true;
END;
$$;
