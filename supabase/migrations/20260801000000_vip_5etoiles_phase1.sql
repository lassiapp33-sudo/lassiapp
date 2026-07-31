-- ===========================================================================
-- LASSI — Module VIP 5 Étoiles · Phase 1 : base de données
-- ===========================================================================
-- Adaptations Phase 0 :
--   • Table cible : shops (pas prestataires)
--   • shops.is_vip DÉJÀ GÉRÉ par pg_cron hebdomadaire → on ne touche PAS à is_vip
--     et on ne crée PAS de trigger de sync (conflit garanti).
--     La colonne "5 Étoiles" sur shops est inutile : on joint vip_profils.
--   • prestataire_id → shop_id (FK shops)
--   • gerant_user_id → auth.users (nullable ; lié quand le gérant s'authentifie)
--   • telephone_gerant stocké en format local 7XXXXXXXX (= profiles.phone)
--   • RLS alignée sur le pattern existant (is_admin pour l'admin, gerant_user_id pour le gérant)
-- ===========================================================================

-- ─── 1. Enum des catégories VIP ─────────────────────────────────────────────

do $$ begin
  create type public.vip_categorie as enum (
    'restauration',
    'musculation_fitness',
    'boulangerie_patisserie',
    'beaute_tressage',
    'coiffure'
  );
exception when duplicate_object then null;
end $$;

-- ─── 2. Table vip_profils ────────────────────────────────────────────────────
-- Une ligne = un établissement 5 Étoiles.
-- Créée par l'admin, editée par l'admin et/ou le gérant.

create table if not exists public.vip_profils (
  id               uuid        primary key default gen_random_uuid(),
  shop_id          uuid        not null unique references public.shops(id) on delete cascade,
  gerant_user_id   uuid        unique references auth.users(id) on delete set null,
  categorie        public.vip_categorie not null,

  -- identité affichée sur la fiche royale
  initiale         text        not null,               -- lettre du blason, ex. "T"
  nom_affiche      text        not null,               -- "Le Tapaba"
  baseline         text,                               -- "Table sénégalaise depuis 2011"
  adresse_courte   text,                               -- "Guédiawaye · Cité Sonatel"
  mot_du_gerant    text,
  signature_mot    text,                               -- "Ndèye Fatou, en cuisine depuis l'ouverture"

  -- gabarit visuel
  gabarit          text        not null default 'palais'
                   check (gabarit in ('palais','maison')),

  -- connexion du gérant (format local sénégalais : 7[05678][0-9]{7})
  telephone_gerant text        not null
                   check (telephone_gerant ~ '^7[05678][0-9]{7}$'),

  actif            boolean     not null default true,
  cree_par         uuid        references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index partiel : profils actifs uniquement
create index if not exists idx_vip_profils_actif
  on public.vip_profils (categorie) where actif = true;

-- Index sur shop_id pour les JOIN courants
create index if not exists idx_vip_profils_shop
  on public.vip_profils (shop_id);

-- ─── 3. Table vip_prestations ────────────────────────────────────────────────
-- Registre des plats, formules ou abonnements de l'établissement.

create table if not exists public.vip_prestations (
  id             uuid    primary key default gen_random_uuid(),
  vip_profil_id  uuid    not null references public.vip_profils(id) on delete cascade,
  section        text    not null default 'carte',   -- "carte", "patisserie", "abonnements"…
  nom            text    not null,
  description    text,
  prix           integer not null check (prix >= 0), -- F CFA entier
  prix_barre     integer check (prix_barre is null or prix_barre > prix),
  unite          text,                               -- "3 h", "l'unité", "30 jours"
  mention        text,                               -- "Spécialité de la maison"
  est_signature  boolean not null default false,
  disponible     boolean not null default true,
  ordre          integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_vip_prestations_profil
  on public.vip_prestations (vip_profil_id, section, ordre);

-- Une seule prestation signature par établissement
create unique index if not exists idx_vip_signature_unique
  on public.vip_prestations (vip_profil_id) where est_signature = true;

-- ─── 4. Table vip_horaires ───────────────────────────────────────────────────
-- Horaires normalisés par jour (0 = dimanche … 6 = samedi).
-- Séparée de shops.opening_hours (JSONB) pour permettre les notes par jour.

create table if not exists public.vip_horaires (
  id             uuid      primary key default gen_random_uuid(),
  vip_profil_id  uuid      not null references public.vip_profils(id) on delete cascade,
  jour           smallint  not null check (jour between 0 and 6),
  ouverture      time,
  fermeture      time,
  ferme          boolean   not null default false,
  note           text,                               -- "Sur rendez-vous seulement"
  unique (vip_profil_id, jour)
);

-- ─── 5. Trigger updated_at sur vip_profils ───────────────────────────────────

create or replace function public.touch_vip_profil_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_vip_profil_updated_at on public.vip_profils;
create trigger trg_vip_profil_updated_at
  before update on public.vip_profils
  for each row execute function public.touch_vip_profil_updated_at();

-- ─── 6. RLS ──────────────────────────────────────────────────────────────────

alter table public.vip_profils    enable row level security;
alter table public.vip_prestations enable row level security;
alter table public.vip_horaires    enable row level security;

-- vip_profils : lecture publique
do $$ begin
  create policy "vip_profils_select_all"
    on public.vip_profils for select using (true);
exception when duplicate_object then null; end $$;

-- vip_profils : écriture = admin seulement
do $$ begin
  create policy "vip_profils_admin_all"
    on public.vip_profils for all
    using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
    with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
exception when duplicate_object then null; end $$;

-- vip_prestations : lecture publique
do $$ begin
  create policy "vip_prestations_select_all"
    on public.vip_prestations for select using (true);
exception when duplicate_object then null; end $$;

-- vip_prestations : écriture = admin OU gérant de ce profil
do $$ begin
  create policy "vip_prestations_admin_or_gerant"
    on public.vip_prestations for all
    using (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.vip_profils vp
        where vp.id = vip_profil_id and vp.gerant_user_id = auth.uid()
      )
    )
    with check (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.vip_profils vp
        where vp.id = vip_profil_id and vp.gerant_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- vip_horaires : lecture publique
do $$ begin
  create policy "vip_horaires_select_all"
    on public.vip_horaires for select using (true);
exception when duplicate_object then null; end $$;

-- vip_horaires : écriture = admin OU gérant
do $$ begin
  create policy "vip_horaires_admin_or_gerant"
    on public.vip_horaires for all
    using (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.vip_profils vp
        where vp.id = vip_profil_id and vp.gerant_user_id = auth.uid()
      )
    )
    with check (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.vip_profils vp
        where vp.id = vip_profil_id and vp.gerant_user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

-- ─── 7. RPC get_vip_liste ────────────────────────────────────────────────────
-- Utilisée par l'écran liste (09) et la carte.
-- Retourne les profils actifs avec les champs de la shop pour l'affichage.

create or replace function public.get_vip_liste(
  p_categorie public.vip_categorie default null
)
returns table (
  vip_profil_id  uuid,
  shop_id        uuid,
  nom_affiche    text,
  baseline       text,
  adresse_courte text,
  initiale       text,
  gabarit        text,
  categorie      public.vip_categorie,
  latitude       double precision,
  longitude      double precision,
  rating         numeric,
  est_ouvert     boolean
)
language sql
security definer
set search_path = public
as $$
  select
    vp.id                      as vip_profil_id,
    vp.shop_id,
    vp.nom_affiche,
    vp.baseline,
    vp.adresse_courte,
    vp.initiale,
    vp.gabarit,
    vp.categorie,
    s.latitude,
    s.longitude,
    s.rating,
    (not s.is_manually_closed) as est_ouvert
  from public.vip_profils vp
  join public.shops s on s.id = vp.shop_id
  where vp.actif = true
    and (p_categorie is null or vp.categorie = p_categorie)
  order by s.rating desc nulls last;
$$;

grant execute on function public.get_vip_liste(public.vip_categorie) to anon, authenticated;

-- ─── 8. RPC get_vip_fiche ────────────────────────────────────────────────────
-- Charge la fiche complète d'un établissement 5 Étoiles côté client.

create or replace function public.get_vip_fiche(p_shop_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select json_build_object(
    'profil', json_build_object(
      'id',              vp.id,
      'shop_id',         vp.shop_id,
      'categorie',       vp.categorie,
      'initiale',        vp.initiale,
      'nom_affiche',     vp.nom_affiche,
      'baseline',        vp.baseline,
      'adresse_courte',  vp.adresse_courte,
      'mot_du_gerant',   vp.mot_du_gerant,
      'signature_mot',   vp.signature_mot,
      'gabarit',         vp.gabarit,
      'actif',           vp.actif,
      'updated_at',      vp.updated_at
    ),
    'prestations', (
      select json_agg(pr order by pr.section, pr.ordre)
      from public.vip_prestations pr
      where pr.vip_profil_id = vp.id
    ),
    'horaires', (
      select json_agg(h order by h.jour)
      from public.vip_horaires h
      where h.vip_profil_id = vp.id
    ),
    'shop', json_build_object(
      'id', s.id,
      'name', s.name,
      'rating', s.rating,
      'reviews_count', s.reviews_count,
      'is_manually_closed', s.is_manually_closed,
      'logo_url', s.logo_url,
      'latitude', s.latitude,
      'longitude', s.longitude
    )
  )
  into v_result
  from public.vip_profils vp
  join public.shops s on s.id = vp.shop_id
  where vp.shop_id = p_shop_id and vp.actif = true;

  return v_result;
end $$;

grant execute on function public.get_vip_fiche(uuid) to anon, authenticated;

-- ─── 9. RPC lier_gerant_vip ──────────────────────────────────────────────────
-- Appelée au login du gérant : lie gerant_user_id au vip_profil si le
-- telephone_gerant correspond au phone du compte auth connecté.

create or replace function public.lier_gerant_vip()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_profil_id uuid;
begin
  -- Récupère le numéro du compte connecté
  select phone into v_phone
  from public.profiles
  where id = auth.uid();

  if v_phone is null then
    return null;
  end if;

  -- Cherche un profil VIP avec ce téléphone gérant
  select id into v_profil_id
  from public.vip_profils
  where telephone_gerant = v_phone
    and (gerant_user_id is null or gerant_user_id = auth.uid());

  if v_profil_id is null then
    return null;
  end if;

  -- Lie le compte au profil
  update public.vip_profils
  set gerant_user_id = auth.uid()
  where id = v_profil_id;

  return v_profil_id;
end $$;

grant execute on function public.lier_gerant_vip() to authenticated;

-- ─── 10. Recharger le cache PostgREST ────────────────────────────────────────

notify pgrst, 'reload schema';
