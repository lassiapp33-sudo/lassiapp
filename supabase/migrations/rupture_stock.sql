-- ─────────────────────────────────────────────────────────────────────────────
-- Rupture de stock / disponibilité produits
-- Le champ stock ('in'|'out') existe déjà.
-- On ajoute : disponible_le (date de retour prévue, nullable) + RLS owner.
-- ─────────────────────────────────────────────────────────────────────────────

-- Colonne optionnelle : date de retour prévue (peut rester NULL)
alter table products
  add column if not exists disponible_le timestamptz default null;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Lecture publique (déjà probablement en place, on le réaffirme)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'products' and policyname = 'products_public_read'
  ) then
    execute $policy$
      create policy "products_public_read" on products
        for select to anon, authenticated
        using (true);
    $policy$;
  end if;
end $$;

-- UPDATE : seul le propriétaire du shop peut modifier ses produits (stock, disponible_le…)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'products' and policyname = 'products_owner_update'
  ) then
    execute $policy$
      create policy "products_owner_update" on products
        for update to authenticated
        using  (shop_id in (select id from shops where owner_id = auth.uid()))
        with check (shop_id in (select id from shops where owner_id = auth.uid()));
    $policy$;
  end if;
end $$;
