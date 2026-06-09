-- push_tokens : un token push par appareil par utilisateur (multi-device)
-- Chaque appareil connecté enregistre son token Expo ici.
-- L'unicité est sur (user_id, token) pour éviter les doublons si l'app
-- appelle savePushToken plusieurs fois depuis le même appareil.

create table if not exists push_tokens (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  token       text        not null,
  platform    text,                    -- 'ios' | 'android'
  updated_at  timestamptz not null default now(),
  constraint push_tokens_user_token_key unique (user_id, token)
);

-- Index pour les recherches par user_id (Edge Functions)
create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

-- L'utilisateur gère uniquement ses propres tokens
drop policy if exists "push_tokens_self" on push_tokens;
create policy "push_tokens_self" on push_tokens
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
