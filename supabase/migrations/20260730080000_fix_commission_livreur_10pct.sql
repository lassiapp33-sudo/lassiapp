-- ============================================================
-- Correction commission livreur : 15% → 10%
-- Seule la fonction marquer_livreur_verse est impactée.
-- ============================================================

CREATE OR REPLACE FUNCTION public.marquer_livreur_verse(p_livreur_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_at    timestamptz;
  v_brut       integer;
  v_nb         integer;
  v_commission integer;
  v_net        integer;
  v_id         uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'NON_AUTORISE';
  END IF;

  SELECT MAX(created_at) INTO v_last_at
  FROM public.versements_livreurs
  WHERE livreur_id = p_livreur_id;

  SELECT
    COALESCE(SUM(prix_livraison), 0)::integer,
    COUNT(*)::integer
  INTO v_brut, v_nb
  FROM public.livraisons
  WHERE livreur_id = p_livreur_id
    AND statut = 'terminee'
    AND terminee_at > COALESCE(v_last_at, '1970-01-01'::timestamptz);

  IF v_brut = 0 THEN
    RAISE EXCEPTION 'SOLDE_ZERO';
  END IF;

  v_commission := ROUND(v_brut * 0.10);
  v_net        := v_brut - v_commission;

  INSERT INTO public.versements_livreurs
    (livreur_id, montant_brut, commission_lassi, montant_net, nb_courses)
  VALUES
    (p_livreur_id, v_brut, v_commission, v_net, v_nb)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'versement_id', v_id,
    'montant_brut', v_brut,
    'commission',   v_commission,
    'montant_net',  v_net,
    'nb_courses',   v_nb
  );
END;
$$;
