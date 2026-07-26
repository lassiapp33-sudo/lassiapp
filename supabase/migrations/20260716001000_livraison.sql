-- ============================================================
-- LIVRAISON — tables, RLS, fonctions
-- ============================================================

-- 1. Rôle livreur dans profiles (inclut 'merchant' pour les données existantes)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check2;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check2
  CHECK (role IN ('client', 'merchant', 'prestataire', 'livreur', 'admin'));

-- 2. Table livreurs (infos spécifiques)
CREATE TABLE IF NOT EXISTS public.livreurs (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_complet TEXT NOT NULL,
  telephone   TEXT NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT true,
  cree_par    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Table livraisons
CREATE TABLE IF NOT EXISTS public.livraisons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  demandeur_id    UUID NOT NULL REFERENCES auth.users(id),
  demandeur_type  TEXT NOT NULL CHECK (demandeur_type IN ('client', 'prestataire')),

  order_id        UUID,

  depart_label    TEXT NOT NULL,
  depart_lat      DOUBLE PRECISION NOT NULL,
  depart_lng      DOUBLE PRECISION NOT NULL,

  arrivee_label   TEXT NOT NULL,
  arrivee_lat     DOUBLE PRECISION NOT NULL,
  arrivee_lng     DOUBLE PRECISION NOT NULL,

  contact_nom     TEXT,
  contact_tel     TEXT,

  distance_km     NUMERIC(6,2) NOT NULL,
  prix_livraison  INT NOT NULL,

  statut          TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'acceptee', 'terminee', 'annulee')),
  livreur_id      UUID REFERENCES auth.users(id),
  accepted_at     TIMESTAMPTZ,
  terminee_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_livraisons_statut
  ON public.livraisons (statut, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_livraisons_livreur
  ON public.livraisons (livreur_id, statut);
CREATE INDEX IF NOT EXISTS idx_livraisons_demandeur
  ON public.livraisons (demandeur_id, created_at DESC);

-- 4. RLS
ALTER TABLE public.livreurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livraisons ENABLE ROW LEVEL SECURITY;

-- livreurs
DROP POLICY IF EXISTS "livreur lit sa fiche" ON public.livreurs;
CREATE POLICY "livreur lit sa fiche" ON public.livreurs
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "admin gere livreurs" ON public.livreurs;
CREATE POLICY "admin gere livreurs" ON public.livreurs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- livraisons
DROP POLICY IF EXISTS "demandeur voit ses livraisons" ON public.livraisons;
CREATE POLICY "demandeur voit ses livraisons" ON public.livraisons
  FOR SELECT USING (auth.uid() = demandeur_id);

DROP POLICY IF EXISTS "livreur voit pool et siennes" ON public.livraisons;
CREATE POLICY "livreur voit pool et siennes" ON public.livraisons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'livreur')
    AND (statut = 'en_attente' OR livreur_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin voit toutes livraisons" ON public.livraisons;
CREATE POLICY "admin voit toutes livraisons" ON public.livraisons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "creer sa livraison" ON public.livraisons;
CREATE POLICY "creer sa livraison" ON public.livraisons
  FOR INSERT WITH CHECK (auth.uid() = demandeur_id);

-- Le livreur peut mettre à jour (accepter / terminer via les fonctions SECURITY DEFINER)
DROP POLICY IF EXISTS "livreur update ses livraisons" ON public.livraisons;
CREATE POLICY "livreur update ses livraisons" ON public.livraisons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'livreur')
  );

-- 5. Fonction : accepter une livraison (atomique, anti double-acceptation)
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
  SET statut     = 'acceptee',
      livreur_id = auth.uid(),
      accepted_at = now()
  WHERE id = p_livraison_id
    AND statut = 'en_attente';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'DEJA_PRISE: Cette livraison a déjà été acceptée.';
  END IF;

  -- Notifier le demandeur
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    l.demandeur_id,
    'livraison',
    'Livraison acceptée',
    'Un livreur a pris en charge votre commande.',
    jsonb_build_object('livraison_id', p_livraison_id)
  FROM public.livraisons l WHERE l.id = p_livraison_id;

  RETURN true;
END;
$$;

-- 6. Fonction : terminer une livraison
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
  WHERE id = p_livraison_id
    AND livreur_id = auth.uid()
    AND statut = 'acceptee';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'IMPOSSIBLE: Livraison introuvable ou non acceptée par vous.';
  END IF;

  -- Notifier le demandeur
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT
    l.demandeur_id,
    'livraison',
    'Livraison arrivée !',
    'Votre commande a été livrée.',
    jsonb_build_object('livraison_id', p_livraison_id)
  FROM public.livraisons l WHERE l.id = p_livraison_id;

  RETURN true;
END;
$$;

-- 7. Accès admin aux livraisons (UPDATE pour annulation)
DROP POLICY IF EXISTS "admin gere livraisons" ON public.livraisons;
CREATE POLICY "admin gere livraisons" ON public.livraisons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = true)
  );
