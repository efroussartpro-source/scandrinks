-- rollback-suivi.sql — Retour arrière de la migration 20261020180000_suivi.sql (jalon 3).
--
-- À exécuter (éditeur SQL de Supabase, ou outil execute_sql) seulement si la
-- migration bloque les téléphones : tous refusés en 401, ou erreur dans
-- private.is_allowed(). Remet les fonctions telles qu'au jalon 2, recopiées des
-- migrations d'origine : is_allowed sans contrôle de session (jalon 1),
-- cancel_movement (jalon 1) et create_product (jalon 2). Rien n'est retiré :
-- list_history reste en place, l'app du jalon 2 ne l'appelle pas. Les droits
-- des fonctions remplacées ne changent pas.

begin;

create or replace function private.is_allowed() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.allowed_users where user_id = (select auth.uid()))
$$;

create or replace function public.cancel_movement(p_movement_id uuid, p_employee text) returns jsonb
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

create or replace function public.create_product(
  p_name text,
  p_pack_size int,
  p_alert_threshold int,
  p_target_stock int,
  p_barcodes jsonb,
  p_id uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_id uuid;
  v_item jsonb;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Même identifiant déjà reçu : on renvoie la fiche créée, sans autre contrôle.
  if p_id is not null and exists (select 1 from public.products where id = p_id) then
    return (select to_jsonb(ps) from public.product_stock ps where ps.id = p_id);
  end if;
  v_name := private.checked_product_name(p_name, p_pack_size, p_alert_threshold, p_target_stock);
  if p_barcodes is null or jsonb_typeof(p_barcodes) <> 'array' then
    raise exception 'invalid_input:barcodes';
  end if;
  if (select count(distinct e ->> 'code') from jsonb_array_elements(p_barcodes) e) <> jsonb_array_length(p_barcodes) then
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

  insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values (coalesce(p_id, gen_random_uuid()), v_name, p_pack_size, p_alert_threshold, p_target_stock)
  returning id into v_id;

  insert into public.barcodes (code, product_id, units)
  select e ->> 'code', v_id, (e ->> 'units')::int
  from jsonb_array_elements(p_barcodes) e;

  return (select to_jsonb(ps) from public.product_stock ps where ps.id = v_id);
end
$$;

commit;
