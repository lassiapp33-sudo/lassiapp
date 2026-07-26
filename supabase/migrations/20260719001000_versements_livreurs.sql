-- ============================================================
-- VERSEMENTS LIVREURS — suivi des rémunérations et paiements
-- ============================================================

-- Table : historique des versements aux livreurs
CREATE TABLE IF NOT EXISTS public.versements_livreurs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  livreur_id       uuid        NOT NULL REFERENCES public.livreurs(id) ON DELETE CASCADE,
  montant_brut     integer     NOT NULL CHECK (montant_brut > 0),
  commission_lassi integer     NOT NULL CHECK (commission_lassi >= 0),
  montant_net      integer     NOT NULL CHECK (montant_net >= 0),
  nb_courses       integer     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_versements_livreur
  ON public.versements_livreurs (livreur_id, created_at DESC);

ALTER TABLE public.versements_livreurs ENABLE ROW LEVEL SECURITY;

-- Livreur voit son propre historique de paiements
DROP POLICY IF EXISTS "livreur voit ses versements" ON public.versements_livreurs;
CREATE POLICY "livreur voit ses versements" ON public.versements_livreurs
  FOR SELECT USING (livreur_id = auth.uid());

-- Admin gère tous les versements
DROP POLICY IF EXISTS "admin gere versements" ON public.versements_livreurs;
CREATE POLICY "admin gere versements" ON public.versements_livreurs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ─── Fonction atomique : marquer un livreur comme versé ───────────────────────
-- Calcule les courses terminées non encore payées, insère un versement,
-- et retourne le détail. Réservé aux admins.
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

  -- Date du dernier versement pour ce livreur (NULL si jamais payé)
  SELECT MAX(created_at) INTO v_last_at
  FROM public.versements_livreurs
  WHERE livreur_id = p_livreur_id;

  -- Total des courses terminées depuis le dernier versement
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

  v_commission := ROUND(v_brut * 0.15);
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
