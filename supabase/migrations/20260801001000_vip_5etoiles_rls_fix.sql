-- ===========================================================================
-- LASSI — VIP 5 Étoiles · Correctif RLS (Phase 1 bis)
-- ===========================================================================
-- Remplace les policies trop larges de la migration 20260801000000 :
--   • Lecture filtrée sur actif = true (les profils suspendus disparaissent du public)
--   • Admin utilise service_role dans lassi-admin → pas de policy is_admin nécessaire
--   • Gérant : update éditorial sur vip_profils (pas de changement de actif/shop_id)
--   • Gérant : ALL sur vip_prestations et vip_horaires de son établissement
-- ===========================================================================

-- ─── Suppression des policies de la migration précédente ────────────────────

drop policy if exists "vip_profils_select_all"         on public.vip_profils;
drop policy if exists "vip_profils_admin_all"           on public.vip_profils;
drop policy if exists "vip_prestations_select_all"      on public.vip_prestations;
drop policy if exists "vip_prestations_admin_or_gerant" on public.vip_prestations;
drop policy if exists "vip_horaires_select_all"         on public.vip_horaires;
drop policy if exists "vip_horaires_admin_or_gerant"    on public.vip_horaires;

-- ─── Nouvelles policies ──────────────────────────────────────────────────────

-- Lecture publique : profils actifs uniquement
create policy vip_profils_lecture on public.vip_profils
  for select using (actif = true);

-- Lecture publique : prestations des profils actifs seulement
create policy vip_prestations_lecture on public.vip_prestations
  for select using (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.actif = true
    )
  );

-- Lecture publique : horaires des profils actifs seulement
create policy vip_horaires_lecture on public.vip_horaires
  for select using (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.actif = true
    )
  );

-- Gérant : gestion complète de ses prestations
create policy vip_prestations_gerant on public.vip_prestations
  for all
  using (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.gerant_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.gerant_user_id = auth.uid()
    )
  );

-- Gérant : gestion complète de ses horaires
create policy vip_horaires_gerant on public.vip_horaires
  for all
  using (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.gerant_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.vip_profils p
      where p.id = vip_profil_id and p.gerant_user_id = auth.uid()
    )
  );

-- Gérant : update des champs éditoriaux de son profil uniquement
-- (shop_id, actif, categorie, telephone_gerant, cree_par restent réservés à l'admin via service_role)
create policy vip_profils_gerant_update on public.vip_profils
  for update
  using (gerant_user_id = auth.uid())
  with check (gerant_user_id = auth.uid());

notify pgrst, 'reload schema';
