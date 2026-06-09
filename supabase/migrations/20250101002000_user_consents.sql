-- user_consents.sql
-- Preuve de consentement CGU + Politique de confidentialité à l'inscription.
-- Conserve la version acceptée et la date, pour chaque utilisateur et chaque rôle.

create table if not exists user_consents (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  cgu_version     text        not null,
  privacy_version text        not null,
  user_role       text        not null check (user_role in ('client','prestataire')),
  accepted_at     timestamptz not null default now()
);

-- Index pour les requêtes de re-consentement (vérification de version)
create index if not exists user_consents_user_id_idx on user_consents(user_id);

-- RLS : activé — l'utilisateur ne voit que ses propres consentements
alter table user_consents enable row level security;

-- Lecture : uniquement ses propres lignes
drop policy if exists "user_consents_select_own" on user_consents;
create policy "user_consents_select_own"
  on user_consents for select
  using (auth.uid() = user_id);

-- Insertion : uniquement pour soi-même (à l'inscription)
drop policy if exists "user_consents_insert_own" on user_consents;
create policy "user_consents_insert_own"
  on user_consents for insert
  with check (auth.uid() = user_id);

-- Aucun update ni delete autorisé (immuable — preuve juridique)
