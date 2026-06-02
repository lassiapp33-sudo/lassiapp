-- ─────────────────────────────────────────────────────────────────────────────
-- Table : signalements
-- Les utilisateurs signalent des problèmes (bug, paiement, commande, commerce…)
-- L'admin change le statut depuis le dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists signalements (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users(id) on delete set null,
  profil            text        not null check (profil in ('client', 'prestataire')),
  type              text        not null check (type in ('bug','paiement','commande','commerce','arnaque','autre')),
  description       text        not null,
  related_order_id  uuid        references orders(id) on delete set null,
  related_shop_id   uuid        references shops(id)  on delete set null,
  screenshot_url    text,
  status            text        not null default 'nouveau'
                                check (status in ('nouveau','en_cours','resolu')),
  created_at        timestamptz not null default now()
);

-- Index pour les lectures admin fréquentes
create index if not exists signalements_status_idx  on signalements(status);
create index if not exists signalements_user_idx    on signalements(user_id);
create index if not exists signalements_created_idx on signalements(created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table signalements enable row level security;

-- INSERT : tout utilisateur authentifié peut créer un signalement à son nom
create policy "signalements_insert" on signalements
  for insert to authenticated
  with check (user_id = auth.uid());

-- SELECT : l'utilisateur voit uniquement ses propres signalements
create policy "signalements_select_own" on signalements
  for select to authenticated
  using (user_id = auth.uid());

-- SELECT admin : les comptes admin voient tout
create policy "signalements_select_admin" on signalements
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- UPDATE admin : seul l'admin peut changer le statut
create policy "signalements_update_admin" on signalements
  for update to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- DELETE admin uniquement
create policy "signalements_delete_admin" on signalements
  for delete to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- ─── Bucket Storage ───────────────────────────────────────────────────────────
-- Créer le bucket 'signalements' depuis le dashboard Supabase → Storage :
-- - Accès : privé (non public)
-- - Les captures sont uploadées par l'utilisateur et lues uniquement par l'admin
