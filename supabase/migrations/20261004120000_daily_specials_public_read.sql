-- Permet aux clients authentifiés de lire les plats du jour
-- (la lecture était bloquée pour le rôle `authenticated`, seul `anon` passait via la clé REST du site)
ALTER TABLE public.daily_specials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_specials_public_read" ON public.daily_specials;
CREATE POLICY "daily_specials_public_read"
  ON public.daily_specials
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "daily_specials_merchant_write" ON public.daily_specials;
CREATE POLICY "daily_specials_merchant_write"
  ON public.daily_specials
  FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM public.shops WHERE merchant_id = auth.uid()
    )
  );
