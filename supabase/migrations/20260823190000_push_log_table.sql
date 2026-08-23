create table if not exists push_log (
  id         bigserial primary key,
  user_id    uuid,
  platform   text,
  status     text,
  token_prefix text,
  error_msg  text,
  created_at timestamptz default now()
);

alter table push_log enable row level security;

-- Seuls les admins peuvent lire, la fonction push-log (service_role) insère
create policy "admins can read push_log"
  on push_log for select
  using (exists (
    select 1 from profiles where id = auth.uid() and is_admin = true
  ));
