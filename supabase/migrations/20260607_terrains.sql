-- ─── Extension GIST pour l'anti-double-booking ───────────────────────────────
create extension if not exists btree_gist;

-- ─── Table terrains ───────────────────────────────────────────────────────────
create table if not exists public.terrains (
  id              uuid default gen_random_uuid() primary key,
  prestataire_id  uuid references public.profiles(id) on delete cascade not null,
  nom             text not null,
  description     text,
  images          text[] default '{}',
  prix_horaire    integer not null,
  sport_type      text not null default 'football'
                    check (sport_type in ('football','basketball','tennis','volleyball','autre')),
  capacite        integer not null default 10,
  adresse         text,
  latitude        double precision,
  longitude       double precision,
  actif           boolean not null default true,
  created_at      timestamptz default now() not null
);

-- ─── Table terrain_horaires ───────────────────────────────────────────────────
create table if not exists public.terrain_horaires (
  id              uuid default gen_random_uuid() primary key,
  terrain_id      uuid references public.terrains(id) on delete cascade not null,
  jour_semaine    integer not null check (jour_semaine between 0 and 6),
  heure_ouverture time not null default '08:00',
  heure_fermeture time not null default '22:00',
  ferme           boolean not null default false,
  unique (terrain_id, jour_semaine)
);

-- ─── Table reservations_terrain ───────────────────────────────────────────────
create table if not exists public.reservations_terrain (
  id                  uuid default gen_random_uuid() primary key,
  client_id           uuid references public.profiles(id) not null,
  terrain_id          uuid references public.terrains(id) not null,
  prestataire_id      uuid references public.profiles(id) not null,
  date_reservation    date not null,
  heure_debut         time not null,
  heure_fin           time not null,
  duree_heures        numeric(4,2) not null,
  prix_total          integer not null,
  commission_lassi    integer not null default 0,
  montant_prestataire integer not null default 0,
  moyen_paiement      text check (moyen_paiement in ('wave','orange_money')),
  paiement_ref        text,
  receipt_code        text unique,
  receipt_valid_until timestamptz,
  receipt_status      text not null default 'pending'
                        check (receipt_status in ('pending','valide','utilise','expire')),
  statut              text not null default 'en_attente'
                        check (statut in ('en_attente','paye','utilise','expire','annule')),
  created_at          timestamptz default now() not null,

  -- Anti-double-booking : empêche tout chevauchement sur le même terrain le même jour
  exclude using gist (
    terrain_id with =,
    tsrange(
      (date_reservation + heure_debut)::timestamp,
      (date_reservation + heure_fin)::timestamp
    ) with &&
  ) where (statut not in ('annule','expire'))
);

-- ─── Index ────────────────────────────────────────────────────────────────────
create index if not exists idx_terrains_prestataire     on public.terrains(prestataire_id);
create index if not exists idx_res_terrain_date         on public.reservations_terrain(terrain_id, date_reservation);
create index if not exists idx_res_terrain_client       on public.reservations_terrain(client_id);
create index if not exists idx_res_terrain_prestataire  on public.reservations_terrain(prestataire_id);

-- ─── RLS terrains ─────────────────────────────────────────────────────────────
alter table public.terrains enable row level security;

create policy "terrains_select_public" on public.terrains
  for select using (actif = true or auth.uid() = prestataire_id);

create policy "terrains_insert" on public.terrains
  for insert with check (auth.uid() = prestataire_id);

create policy "terrains_update" on public.terrains
  for update using (auth.uid() = prestataire_id);

create policy "terrains_delete" on public.terrains
  for delete using (auth.uid() = prestataire_id);

-- ─── RLS terrain_horaires ─────────────────────────────────────────────────────
alter table public.terrain_horaires enable row level security;

create policy "horaires_select" on public.terrain_horaires
  for select using (true);

create policy "horaires_insert" on public.terrain_horaires
  for insert with check (
    auth.uid() = (select prestataire_id from public.terrains where id = terrain_id)
  );

create policy "horaires_update" on public.terrain_horaires
  for update using (
    auth.uid() = (select prestataire_id from public.terrains where id = terrain_id)
  );

create policy "horaires_delete" on public.terrain_horaires
  for delete using (
    auth.uid() = (select prestataire_id from public.terrains where id = terrain_id)
  );

-- ─── RLS reservations_terrain ─────────────────────────────────────────────────
alter table public.reservations_terrain enable row level security;

create policy "res_select_client" on public.reservations_terrain
  for select using (auth.uid() = client_id);

create policy "res_select_prestataire" on public.reservations_terrain
  for select using (auth.uid() = prestataire_id);

create policy "res_insert" on public.reservations_terrain
  for insert with check (auth.uid() = client_id);

create policy "res_update_prestataire" on public.reservations_terrain
  for update using (auth.uid() = prestataire_id or auth.uid() = client_id);

-- ─── Fonction get_crenaux_pris ────────────────────────────────────────────────
create or replace function public.get_crenaux_pris(p_terrain_id uuid, p_date date)
returns table(heure_debut text, heure_fin text)
language sql security definer
as $$
  select
    to_char(heure_debut, 'HH24:MI') as heure_debut,
    to_char(heure_fin,   'HH24:MI') as heure_fin
  from public.reservations_terrain
  where terrain_id      = p_terrain_id
    and date_reservation = p_date
    and statut not in ('annule','expire');
$$;

-- ─── Fonction verify_terrain_receipt ─────────────────────────────────────────
create or replace function public.verify_terrain_receipt(
  p_receipt_code    text,
  p_prestataire_id  uuid
)
returns json
language plpgsql security definer
as $$
declare
  v_res public.reservations_terrain%rowtype;
begin
  select * into v_res
  from public.reservations_terrain
  where receipt_code    = p_receipt_code
    and prestataire_id  = p_prestataire_id
    and statut          = 'paye'
    and receipt_status  = 'valide'
    and receipt_valid_until > now();

  if not found then
    return json_build_object('success', false, 'error', 'Code invalide, expiré ou déjà utilisé');
  end if;

  update public.reservations_terrain
  set statut = 'utilise', receipt_status = 'utilise'
  where id = v_res.id;

  return json_build_object(
    'success',          true,
    'client_id',        v_res.client_id,
    'terrain_id',       v_res.terrain_id,
    'heure_debut',      to_char(v_res.heure_debut, 'HH24:MI'),
    'heure_fin',        to_char(v_res.heure_fin,   'HH24:MI'),
    'date_reservation', to_char(v_res.date_reservation, 'YYYY-MM-DD')
  );
end;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.reservations_terrain;
