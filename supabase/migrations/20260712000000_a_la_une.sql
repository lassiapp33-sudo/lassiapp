-- ============================================
-- TABLE : blocs "À la une"
-- ============================================
CREATE TABLE IF NOT EXISTS public.a_la_une (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 80),
  description TEXT CHECK (char_length(description) <= 300),
  categorie_id TEXT NOT NULL,
  sous_categorie_id TEXT,
  elements JSONB NOT NULL DEFAULT '[]',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Index pour lecture rapide
CREATE INDEX IF NOT EXISTS idx_alaune_actif_expire
  ON public.a_la_une (categorie_id, actif, expire_at DESC);
CREATE INDEX IF NOT EXISTS idx_alaune_prestataire
  ON public.a_la_une (prestataire_id, created_at DESC);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.a_la_une ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut LIRE les blocs actifs non expirés
CREATE POLICY "lecture blocs actifs" ON public.a_la_une
  FOR SELECT USING (actif = true AND expire_at > now());

-- Le prestataire peut lire TOUS ses propres blocs (même expirés = historique)
CREATE POLICY "prestataire lit ses blocs" ON public.a_la_une
  FOR SELECT USING (auth.uid() = prestataire_id);

-- Le prestataire crée ses propres blocs
CREATE POLICY "prestataire cree bloc" ON public.a_la_une
  FOR INSERT WITH CHECK (auth.uid() = prestataire_id);

-- Le prestataire modifie ses propres blocs
CREATE POLICY "prestataire modifie bloc" ON public.a_la_une
  FOR UPDATE USING (auth.uid() = prestataire_id);

-- ============================================
-- FONCTION : créer un bloc avec contrôle de quota (10/jour)
-- ============================================
CREATE OR REPLACE FUNCTION public.creer_a_la_une(
  p_titre TEXT,
  p_description TEXT,
  p_categorie_id TEXT,
  p_sous_categorie_id TEXT,
  p_elements JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_new_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.a_la_une
  WHERE prestataire_id = auth.uid()
    AND created_at >= date_trunc('day', now());

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'QUOTA_ATTEINT: Vous avez atteint la limite de 10 blocs À la une pour aujourd''hui.';
  END IF;

  IF jsonb_array_length(p_elements) > 20 THEN
    RAISE EXCEPTION 'TROP_ELEMENTS: Maximum 20 éléments par bloc.';
  END IF;

  INSERT INTO public.a_la_une (
    prestataire_id, titre, description, categorie_id, sous_categorie_id, elements
  ) VALUES (
    auth.uid(), p_titre, p_description, p_categorie_id, p_sous_categorie_id, p_elements
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ============================================
-- FONCTION : réactiver un ancien bloc (consomme 1 quota)
-- ============================================
CREATE OR REPLACE FUNCTION public.reactiver_a_la_une(p_bloc_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_old RECORD;
  v_new_id UUID;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.a_la_une
  WHERE prestataire_id = auth.uid()
    AND created_at >= date_trunc('day', now());

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'QUOTA_ATTEINT: Limite de 10 blocs par jour atteinte (réactivation incluse).';
  END IF;

  SELECT * INTO v_old
  FROM public.a_la_une
  WHERE id = p_bloc_id AND prestataire_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INTROUVABLE: Bloc introuvable.';
  END IF;

  INSERT INTO public.a_la_une (
    prestataire_id, titre, description, categorie_id, sous_categorie_id, elements
  ) VALUES (
    auth.uid(), v_old.titre, v_old.description, v_old.categorie_id,
    v_old.sous_categorie_id, v_old.elements
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ============================================
-- pg_cron : désactiver les blocs expirés (toutes les 10 min)
-- ============================================
SELECT cron.schedule(
  'expire-a-la-une',
  '*/10 * * * *',
  $$ UPDATE public.a_la_une SET actif = false
     WHERE actif = true AND expire_at <= now(); $$
);
