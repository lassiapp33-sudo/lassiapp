-- ============================================
-- Ajout colonne image_url sur a_la_une
-- + mise à jour fonction creer_a_la_une
-- + bucket Storage bloc-images
-- ============================================

ALTER TABLE public.a_la_une ADD COLUMN IF NOT EXISTS image_url TEXT;

-- DROP obligatoire car nouvelle signature (évite PGRST203)
DROP FUNCTION IF EXISTS public.creer_a_la_une(TEXT, TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.creer_a_la_une(
  p_titre TEXT,
  p_description TEXT,
  p_categorie_id TEXT,
  p_sous_categorie_id TEXT,
  p_elements JSONB,
  p_image_url TEXT DEFAULT NULL
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
    prestataire_id, titre, description, categorie_id, sous_categorie_id, elements, image_url
  ) VALUES (
    auth.uid(), p_titre, p_description, p_categorie_id, p_sous_categorie_id, p_elements, p_image_url
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ============================================
-- Bucket Storage bloc-images (public, 5 Mo max)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bloc-images',
  'bloc-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "bloc-images upload authenticated" ON storage.objects;
CREATE POLICY "bloc-images upload authenticated" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bloc-images');

DROP POLICY IF EXISTS "bloc-images lecture publique" ON storage.objects;
CREATE POLICY "bloc-images lecture publique" ON storage.objects
  FOR SELECT USING (bucket_id = 'bloc-images');

DROP POLICY IF EXISTS "bloc-images delete own" ON storage.objects;
CREATE POLICY "bloc-images delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'bloc-images' AND (storage.foldername(name))[1] = auth.uid()::text);
