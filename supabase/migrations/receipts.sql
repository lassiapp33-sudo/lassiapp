-- receipts.sql
-- Système de reçu client : code unique + QR + validité 40 min côté serveur.
-- La durée est définie ici ; modifier RECEIPT_VALIDITY_MINUTES pour changer partout.

-- ─── Colonnes reçu sur la table orders ──────────────────────────────────────

alter table orders
  add column if not exists receipt_code        text unique,
  add column if not exists validated_at        timestamptz,
  add column if not exists receipt_valid_until timestamptz,
  add column if not exists receipt_status      text not null default 'aucun'
    check (receipt_status in ('aucun','valide','utilise','expire'));

-- ─── Constante de validité (minutes) ─────────────────────────────────────────
-- Changer cette valeur pour modifier la durée globalement.

create or replace function receipt_validity_minutes()
returns int language sql immutable as $$ select 40 $$;

-- ─── Génération du code reçu ──────────────────────────────────────────────────
-- Charset : lettres majuscules sans I/O + chiffres sans 0/1 → lisible sans ambiguïté.

create or replace function generate_receipt(p_order_id uuid)
returns void language plpgsql security definer as $$
declare
  v_chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code   text;
  v_exists boolean;
begin
  -- Boucle anti-collision (probabilité quasi-nulle mais safe)
  loop
    select string_agg(
      substr(v_chars, (floor(random() * length(v_chars)) + 1)::int, 1),
      ''
    )
    into v_code
    from generate_series(1, 8);

    select exists(select 1 from orders where receipt_code = v_code)
    into v_exists;

    exit when not v_exists;
  end loop;

  update orders set
    receipt_code        = v_code,
    validated_at        = now(),
    receipt_valid_until = now() + (receipt_validity_minutes() * interval '1 minute'),
    receipt_status      = 'valide'
  where id = p_order_id
    and receipt_code is null;   -- idempotent : ne réécrase pas si déjà généré
end;
$$;

-- ─── Trigger : génère le reçu dès que la commande passe à "ready" ────────────

create or replace function trigger_generate_receipt()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'ready'
     and (old.status is distinct from 'ready')
     and new.receipt_code is null
  then
    perform generate_receipt(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_order_ready on orders;
create trigger on_order_ready
  after update of status on orders
  for each row
  execute function trigger_generate_receipt();

-- ─── RPC client : vérification de validité (lecture + expiration paresseuse) ─

create or replace function is_receipt_valid(p_order_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v row%rowtype;   -- alias pour orders
  r orders%rowtype;
begin
  select * into r
  from orders
  where id = p_order_id
    and client_id = auth.uid();

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'introuvable');
  end if;

  -- Expiration paresseuse
  if r.receipt_status = 'valide' and now() >= r.receipt_valid_until then
    update orders set receipt_status = 'expire' where id = p_order_id;
    r.receipt_status := 'expire';
  end if;

  return jsonb_build_object(
    'valid',               r.receipt_status = 'valide' and now() < r.receipt_valid_until,
    'status',              r.receipt_status,
    'receipt_code',        r.receipt_code,
    'receipt_valid_until', r.receipt_valid_until,
    'validated_at',        r.validated_at
  );
end;
$$;

-- ─── RPC prestataire : vérification atomique + marquage "utilisé" ─────────────
-- Sécurité : le prestataire ne peut valider que les reçus de SA boutique.
-- Atomique : FOR UPDATE empêche la double utilisation simultanée.

create or replace function verify_receipt(p_code text)
returns jsonb language plpgsql security definer as $$
declare
  v_order_id    uuid;
  v_status      text;
  v_valid_until timestamptz;
  v_total       numeric;
  v_client_name text;
begin
  -- Trouve et verrouille la commande (appartenant à une boutique du prestataire connecté)
  select o.id, o.receipt_status, o.receipt_valid_until, o.total
  into v_order_id, v_status, v_valid_until, v_total
  from orders o
  where o.receipt_code = upper(trim(p_code))
    and o.shop_id in (select id from shops where merchant_id = auth.uid())
  for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'introuvable');
  end if;

  -- Expiration paresseuse
  if v_status = 'valide' and now() >= v_valid_until then
    update orders set receipt_status = 'expire' where id = v_order_id;
    return jsonb_build_object('success', false, 'reason', 'expire');
  end if;

  if v_status = 'utilise' then
    return jsonb_build_object('success', false, 'reason', 'deja_utilise');
  end if;

  if v_status != 'valide' then
    return jsonb_build_object('success', false, 'reason', coalesce(v_status, 'aucun'));
  end if;

  -- Marquage atomique : utilisé + commande terminée
  update orders
  set receipt_status = 'utilise',
      status         = 'done'
  where id             = v_order_id
    and receipt_status = 'valide';   -- garde-fou anti-race-condition

  if not found then
    -- Une autre transaction a gagné la course
    return jsonb_build_object('success', false, 'reason', 'deja_utilise');
  end if;

  -- Nom du client (best-effort)
  select name into v_client_name
  from profiles
  where id = (select client_id from orders where id = v_order_id);

  return jsonb_build_object(
    'success',     true,
    'total',       v_total,
    'client_name', coalesce(v_client_name, 'Client')
  );
end;
$$;

-- ─── pg_cron : expiration automatique toutes les 5 min (optionnel) ───────────
-- Décommente si pg_cron est activé sur ton projet Supabase.
-- select cron.schedule('expire-receipts', '*/5 * * * *', $$
--   update orders
--   set receipt_status = 'expire'
--   where receipt_status = 'valide'
--     and receipt_valid_until < now();
-- $$);
