-- ─── Table promotions ────────────────────────────────────────────────────────

create table if not exists promotions (
  id          uuid        primary key default gen_random_uuid(),
  shop_id     uuid        references shops(id) on delete cascade not null,
  titre       text        not null,
  type        text        not null check (type in ('pourcentage','montant_fixe','quantite_offerte','prix_barre')),
  valeur      numeric     not null check (valeur > 0),
  cible_type  text        not null check (cible_type in ('vitrine','categorie','produit')),
  cible_id    uuid,                    -- product id ou category id si applicable
  montant_min numeric     default 0,   -- montant minimum de commande
  date_debut  timestamptz,             -- null = active dès maintenant
  date_fin    timestamptz,             -- null = pas d'expiration
  actif       boolean     default true,
  created_at  timestamptz default now()
);

-- ─── RLS ────────────────────────────────────────────────────────────────────

alter table promotions enable row level security;

-- Lecture publique (les clients voient les promos actives)
create policy "promotions_select_public"
  on promotions for select
  using (true);

-- Création : uniquement le propriétaire du shop
create policy "promotions_insert_owner"
  on promotions for insert
  with check (
    shop_id in (
      select id from shops where merchant_id = auth.uid()
    )
  );

-- Modification : uniquement le propriétaire du shop
create policy "promotions_update_owner"
  on promotions for update
  using (
    shop_id in (
      select id from shops where merchant_id = auth.uid()
    )
  );

-- Suppression : uniquement le propriétaire du shop
create policy "promotions_delete_owner"
  on promotions for delete
  using (
    shop_id in (
      select id from shops where merchant_id = auth.uid()
    )
  );

-- ─── Colonnes discount dans orders ───────────────────────────────────────────

alter table orders
  add column if not exists discount_amount numeric default 0,
  add column if not exists promo_label     text;

-- ─── Index ────────────────────────────────────────────────────────────────────

create index if not exists promotions_shop_idx  on promotions(shop_id);
create index if not exists promotions_actif_idx on promotions(actif);
