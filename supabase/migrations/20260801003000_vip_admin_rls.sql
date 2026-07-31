-- Politique RLS permettant aux administrateurs de tout voir et modifier
-- sur les tables 5 Étoiles (actif ou non, sans restriction).
-- Les admins sont identifiés par is_admin = true dans public.profiles.

-- ── vip_profils ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_vip_profils_all" ON public.vip_profils;
CREATE POLICY "admin_vip_profils_all" ON public.vip_profils
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── vip_prestations ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_vip_prestations_all" ON public.vip_prestations;
CREATE POLICY "admin_vip_prestations_all" ON public.vip_prestations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── vip_horaires ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_vip_horaires_all" ON public.vip_horaires;
CREATE POLICY "admin_vip_horaires_all" ON public.vip_horaires
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
