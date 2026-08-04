-- Permet au gérant de voir son propre profil VIP même si actif = false.
-- Sans cette policy, un profil désactivé par l'admin rendrait le gérant
-- invisible à getMonProfilVip() et le redirigerait vers MerchantNavigator.

DO $$ BEGIN
  CREATE POLICY vip_profils_gerant_select ON public.vip_profils
    FOR SELECT
    USING (gerant_user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
