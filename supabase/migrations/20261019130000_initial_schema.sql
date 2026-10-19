-- 20261019130000_initial_schema.sql — ScanDrinks : schéma initial (jalon 1).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§5, §6.3, §6.4)
--
-- Le stock n'est jamais saisi : c'est la somme des mouvements non annulés
-- (RG-9). Toutes les écritures de l'app passent par les fonctions ci-dessous,
-- idempotentes grâce à l'identifiant généré par le téléphone. Seuls les comptes
-- inscrits dans allowed_users (le compte du tabac) lisent et écrivent.

-- ---------------------------------------------------------------------------
-- Accès
-- ---------------------------------------------------------------------------

create table public.allowed_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Schéma non exposé par l'API : la fonction security definer ne peut pas être
-- appelée directement par /rest/v1/rpc.
create schema private;
revoke all on schema private from public;

create function private.is_allowed() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.allowed_users where user_id = (select auth.uid()))
$$;

revoke all on function private.is_allowed() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  pack_size int not null check (pack_size between 1 and 999),
  alert_threshold int not null check (alert_threshold between 0 and 9999),
  target_stock int not null check (target_stock between 1 and 99999),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_target_above_threshold check (target_stock > alert_threshold)
);

create table public.barcodes (
  code text primary key check (code ~ '^[0-9]{8,14}$'),
  product_id uuid not null references public.products (id),
  units int not null check (units between 1 and 999),
  created_at timestamptz not null default now()
);

create index barcodes_product_id_idx on public.barcodes (product_id);

create table public.movements (
  id uuid primary key,
  product_id uuid not null references public.products (id),
  kind text not null check (kind in ('in', 'out', 'inventory')),
  delta int not null,
  barcode text,
  counted int check (counted between 0 and 9999),
  employee text not null check (char_length(employee) between 1 and 30),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text check (char_length(cancelled_by) between 1 and 30)
);

create index movements_product_id_idx on public.movements (product_id);
create index movements_created_at_idx on public.movements (created_at desc);

create view public.product_stock
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.pack_size,
  p.alert_threshold,
  p.target_stock,
  p.archived,
  p.created_at,
  p.updated_at,
  coalesce(sum(m.delta) filter (where m.cancelled_at is null), 0)::int as stock
from public.products p
left join public.movements m on m.product_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- Droits et Row Level Security
-- ---------------------------------------------------------------------------

-- Supabase ouvre par défaut tout le schéma public aux rôles de l'API : on
-- referme tout, puis on rend seulement lecture, ajout et modification au
-- compte connecté. Jamais de suppression : on archive (RG-11).
revoke all on table public.allowed_users, public.products, public.barcodes, public.movements, public.product_stock
  from public, anon, authenticated;
grant select, insert, update on table public.products, public.barcodes, public.movements to authenticated;
grant select on table public.product_stock to authenticated;

alter table public.allowed_users enable row level security;
alter table public.products enable row level security;
alter table public.barcodes enable row level security;
alter table public.movements enable row level security;

create policy products_select on public.products for select to authenticated
  using ((select private.is_allowed()));
create policy products_insert on public.products for insert to authenticated
  with check ((select private.is_allowed()));
create policy products_update on public.products for update to authenticated
  using ((select private.is_allowed())) with check ((select private.is_allowed()));

create policy barcodes_select on public.barcodes for select to authenticated
  using ((select private.is_allowed()));
create policy barcodes_insert on public.barcodes for insert to authenticated
  with check ((select private.is_allowed()));
create policy barcodes_update on public.barcodes for update to authenticated
  using ((select private.is_allowed())) with check ((select private.is_allowed()));

create policy movements_select on public.movements for select to authenticated
  using ((select private.is_allowed()));
create policy movements_insert on public.movements for insert to authenticated
  with check ((select private.is_allowed()));
create policy movements_update on public.movements for update to authenticated
  using ((select private.is_allowed())) with check ((select private.is_allowed()));

-- ---------------------------------------------------------------------------
-- Fonctions de l'app (security invoker : la RLS s'applique)
-- ---------------------------------------------------------------------------
-- Chaque fonction d'écriture vérifie d'abord l'accès (erreur 42501, « pas
-- accès au stock » dans l'app), puis ses paramètres : une valeur refusée lève
-- « invalid_input:<champ> ».

create function public.lookup_barcode(p_code text) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('code', b.code, 'units', b.units, 'product', to_jsonb(ps))
  from public.barcodes b
  join public.product_stock ps on ps.id = b.product_id
  where b.code = p_code
$$;

create function public.create_product(
  p_name text,
  p_pack_size int,
  p_alert_threshold int,
  p_target_stock int,
  p_barcodes jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_item jsonb;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_input:name';
  end if;
  if p_pack_size is null or p_pack_size not between 1 and 999 then
    raise exception 'invalid_input:pack_size';
  end if;
  if p_alert_threshold is null or p_alert_threshold not between 0 and 9999 then
    raise exception 'invalid_input:alert_threshold';
  end if;
  if p_target_stock is null or p_target_stock not between 1 and 99999 or p_target_stock <= p_alert_threshold then
    raise exception 'invalid_input:target_stock';
  end if;
  if p_barcodes is null or jsonb_typeof(p_barcodes) <> 'array' or jsonb_array_length(p_barcodes) = 0
     or (select count(distinct e ->> 'code') from jsonb_array_elements(p_barcodes) e) <> jsonb_array_length(p_barcodes) then
    raise exception 'invalid_input:barcodes';
  end if;

  for v_item in select e from jsonb_array_elements(p_barcodes) e loop
    if coalesce(v_item ->> 'code', '') !~ '^[0-9]{8,14}$' then
      raise exception 'invalid_input:code';
    end if;
    if coalesce(v_item ->> 'units', '') !~ '^[0-9]{1,3}$' or (v_item ->> 'units')::int not between 1 and 999 then
      raise exception 'invalid_input:units';
    end if;
    if exists (select 1 from public.barcodes where code = v_item ->> 'code') then
      raise exception 'barcode_taken:%', v_item ->> 'code';
    end if;
  end loop;

  insert into public.products (name, pack_size, alert_threshold, target_stock)
  values (v_name, p_pack_size, p_alert_threshold, p_target_stock)
  returning id into v_id;

  insert into public.barcodes (code, product_id, units)
  select e ->> 'code', v_id, (e ->> 'units')::int
  from jsonb_array_elements(p_barcodes) e;

  return (select to_jsonb(ps) from public.product_stock ps where ps.id = v_id);
end
$$;

create function public.attach_barcode(p_code text, p_product_id uuid, p_units int, p_move boolean) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{8,14}$' then
    raise exception 'invalid_input:code';
  end if;
  if p_units is null or p_units not between 1 and 999 then
    raise exception 'invalid_input:units';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'invalid_input:product';
  end if;

  select b.product_id into v_owner from public.barcodes b where b.code = p_code for update;

  if v_owner is null then
    insert into public.barcodes (code, product_id, units) values (p_code, p_product_id, p_units);
  elsif v_owner = p_product_id or coalesce(p_move, false) then
    -- RG-12 : déplacer un code ne change pas les mouvements passés.
    update public.barcodes set product_id = p_product_id, units = p_units where code = p_code;
  else
    return jsonb_build_object(
      'status', 'already_attached',
      'product_id', v_owner,
      'product_name', (select name from public.products where id = v_owner)
    );
  end if;
  return jsonb_build_object('status', 'attached');
end
$$;

create function public.record_movement(
  p_id uuid,
  p_product_id uuid,
  p_code text,
  p_kind text,
  p_units int,
  p_quantity int,
  p_employee text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee text := btrim(coalesce(p_employee, ''));
  v_existing public.movements%rowtype;
  v_pack_size int;
  v_code_units int;
  v_delta int;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'invalid_input:id';
  end if;

  -- Même identifiant déjà reçu (réseau instable, double envoi) : on renvoie le premier.
  select * into v_existing from public.movements where id = p_id;
  if found then
    return jsonb_build_object(
      'movement_id', v_existing.id,
      'delta', v_existing.delta,
      'stock', (select ps.stock from public.product_stock ps where ps.id = v_existing.product_id),
      'duplicate', true
    );
  end if;

  -- Verrou sur le produit : deux téléphones qui valident en même temps sont servis l'un après l'autre.
  select pack_size into v_pack_size from public.products where id = p_product_id for update;
  if not found then
    raise exception 'invalid_input:product';
  end if;
  if p_kind is null or p_kind not in ('in', 'out') then
    raise exception 'invalid_input:kind';
  end if;
  if p_quantity is null or p_quantity not between 1 and 99 then
    raise exception 'invalid_input:quantity';
  end if;
  if char_length(v_employee) not between 1 and 30 then
    raise exception 'invalid_input:employee';
  end if;
  if p_code is not null then
    select units into v_code_units from public.barcodes where code = p_code and product_id = p_product_id;
    if not found then
      raise exception 'invalid_input:code';
    end if;
    -- Ce qui est enregistré est exactement ce que la fiche a affiché.
    if p_units is distinct from v_code_units then
      raise exception 'invalid_input:units';
    end if;
  elsif p_units is null or p_units not in (1, v_pack_size) then
    raise exception 'invalid_input:units';
  end if;

  v_delta := (case when p_kind = 'in' then 1 else -1 end) * p_units * p_quantity;

  insert into public.movements (id, product_id, kind, delta, barcode, employee)
  values (p_id, p_product_id, p_kind, v_delta, p_code, v_employee)
  on conflict (id) do nothing;

  if not found then
    -- Inséré entre-temps par un envoi jumeau.
    select * into v_existing from public.movements where id = p_id;
    return jsonb_build_object(
      'movement_id', v_existing.id,
      'delta', v_existing.delta,
      'stock', (select ps.stock from public.product_stock ps where ps.id = v_existing.product_id),
      'duplicate', true
    );
  end if;

  return jsonb_build_object(
    'movement_id', p_id,
    'delta', v_delta,
    'stock', (select ps.stock from public.product_stock ps where ps.id = p_product_id),
    'duplicate', false
  );
end
$$;

create function public.cancel_movement(p_movement_id uuid, p_employee text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee text := btrim(coalesce(p_employee, ''));
  v_product uuid;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(v_employee) not between 1 and 30 then
    raise exception 'invalid_input:employee';
  end if;

  select product_id into v_product from public.movements where id = p_movement_id for update;
  if not found then
    raise exception 'invalid_input:movement';
  end if;
  perform 1 from public.products where id = v_product for update;

  -- RG-9 : annuler retire exactement l'effet du mouvement ; une seconde annulation ne change rien.
  update public.movements
  set cancelled_at = now(), cancelled_by = v_employee
  where id = p_movement_id and cancelled_at is null;

  return jsonb_build_object(
    'stock', (select ps.stock from public.product_stock ps where ps.id = v_product),
    'product_id', v_product
  );
end
$$;

create function public.list_employees() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.employee order by e.employee), '[]'::jsonb)
  from (select distinct employee from public.movements) e
$$;

revoke all on function
  public.lookup_barcode(text),
  public.create_product(text, int, int, int, jsonb),
  public.attach_barcode(text, uuid, int, boolean),
  public.record_movement(uuid, uuid, text, text, int, int, text),
  public.cancel_movement(uuid, text),
  public.list_employees()
from public, anon;

grant execute on function
  public.lookup_barcode(text),
  public.create_product(text, int, int, int, jsonb),
  public.attach_barcode(text, uuid, int, boolean),
  public.record_movement(uuid, uuid, text, text, int, int, text),
  public.cancel_movement(uuid, text),
  public.list_employees()
to authenticated;
