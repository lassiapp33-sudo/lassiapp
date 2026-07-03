-- ============================================================
-- MIGRATION : Catégorie Musculation/Fitness — Abonnements
-- Date      : 2026-07-03
-- ============================================================

-- ─── 1. Table des offres d'abonnement (créées par le prestataire) ─────────────

create table if not exists fitness_abonnement_offres (
  id             uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references profiles(id) on delete cascade,
  nom            text not null check (char_length(nom) between 1 and 100),
  description    text check (char_length(description) <= 500),
  prix           integer not null check (prix > 0),
  duree_jours    integer not null default 30 check (duree_jours > 0),
  actif          boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists fitness_abonnement_offres_prestataire_idx
  on fitness_abonnement_offres(prestataire_id);

create index if not exists fitness_abonnement_offres_prestataire_actif_idx
  on fitness_abonnement_offres(prestataire_id, actif);

-- RLS
alter table fitness_abonnement_offres enable row level security;

-- Lecture publique (toutes les offres actives visibles aux clients)
create policy "fitness_offres_select_public"
  on fitness_abonnement_offres for select
  using (true);

-- Écriture uniquement par le prestataire propriétaire
create policy "fitness_offres_insert_own"
  on fitness_abonnement_offres for insert
  with check (prestataire_id = auth.uid());

create policy "fitness_offres_update_own"
  on fitness_abonnement_offres for update
  using (prestataire_id = auth.uid())
  with check (prestataire_id = auth.uid());

create policy "fitness_offres_delete_own"
  on fitness_abonnement_offres for delete
  using (prestataire_id = auth.uid());


-- ─── 2. Table des abonnements clients ────────────────────────────────────────

create table if not exists fitness_abonnements_clients (
  id                 uuid primary key default gen_random_uuid(),
  offre_id           uuid not null references fitness_abonnement_offres(id),
  client_id          uuid not null references profiles(id) on delete cascade,
  prestataire_id     uuid not null references profiles(id),
  nom_offre          text not null,       -- snapshot au moment de l'achat
  prix_paye          integer not null,    -- snapshot
  date_achat         timestamptz not null default now(),
  date_expiration    timestamptz not null,
  statut             text not null default 'actif'
                       check (statut in ('actif', 'expire')),
  payment_intent_id  uuid                -- référence à payment_intents (sans FK pour flexibilité)
);

-- Index performance
create index if not exists fitness_abo_client_statut_idx
  on fitness_abonnements_clients(client_id, statut);

create index if not exists fitness_abo_prestataire_statut_idx
  on fitness_abonnements_clients(prestataire_id, statut);

create index if not exists fitness_abo_statut_expiration_idx
  on fitness_abonnements_clients(statut, date_expiration);

-- RLS
alter table fitness_abonnements_clients enable row level security;

-- Client voit ses propres abonnements
create policy "fitness_abo_client_select"
  on fitness_abonnements_clients for select
  using (client_id = auth.uid());

-- Prestataire voit les abonnements de sa salle
create policy "fitness_abo_prestataire_select"
  on fitness_abonnements_clients for select
  using (prestataire_id = auth.uid());

-- INSERT uniquement via service_role (edge function) — jamais direct client
-- Aucune policy insert/update/delete pour authenticated : la service_role bypasse RLS.


-- ─── 3. pg_cron : expiration quotidienne + nettoyage 30 jours ─────────────────

-- Expiration automatique à 00h05 UTC (= Dakar, Sénégal UTC+0)
select cron.schedule(
  'expire-fitness-abonnements',
  '5 0 * * *',
  $$
    -- Marquer expirés les abonnements dont la date_expiration est passée
    update fitness_abonnements_clients
    set statut = 'expire'
    where statut = 'actif' and date_expiration < now();

    -- Supprimer définitivement les abonnements expirés depuis plus de 30 jours
    delete from fitness_abonnements_clients
    where statut = 'expire' and date_expiration < now() - interval '30 days';
  $$
);

-- Notifications d'expiration fitness à 00h10 UTC
select cron.schedule(
  'notify-fitness-expiry',
  '10 0 * * *',
  $$
    -- Notification 3 jours avant l'expiration
    insert into notifications (user_id, type, title, body, data)
    select
      client_id,
      'pay',
      '⏰ Abonnement fitness bientôt expiré',
      'Ton abonnement « ' || nom_offre || ' » expire dans 3 jours. Pense à le renouveler !',
      jsonb_build_object('type', 'fitness_abonnement')
    from fitness_abonnements_clients
    where
      statut = 'actif'
      and date_expiration::date = (current_date + interval '3 days')::date;

    -- Notification le jour de l'expiration
    insert into notifications (user_id, type, title, body, data)
    select
      client_id,
      'pay',
      '❌ Abonnement fitness expiré',
      'Ton abonnement « ' || nom_offre || ' » a expiré aujourd''hui.',
      jsonb_build_object('type', 'fitness_abonnement')
    from fitness_abonnements_clients
    where
      statut = 'expire'
      and date_expiration::date = current_date;
  $$
);
