-- rollback-pilotage.sql — Retour arrière de la migration « pilotage » (jalon 2), en cas de problème grave.
--
-- Rétablit les fonctions, les droits et les contraintes du jalon 1, en une seule transaction.
-- Les données restent : les inventaires déjà enregistrés et les produits archivés gardent leur état.
-- Les corps des fonctions viennent tels quels de 20261019130000_initial_schema.sql.
begin;

drop function public.record_inventory(uuid, uuid, int, text);
drop function public.detach_barcode(text);
drop function public.set_product_archived(uuid, boolean);
drop function public.update_product(uuid, text, int, int, int);
drop function public.create_product(text, int, int, int, jsonb, uuid);
drop function private.checked_product_name(text, int, int, int);

create or replace function public.lookup_barcode(p_code text) returns jsonb
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

revoke all on function public.create_product(text, int, int, int, jsonb) from public, anon;
grant execute on function public.create_product(text, int, int, int, jsonb) to authenticated;

create or replace function public.list_employees() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.employee order by e.employee), '[]'::jsonb)
  from (select distinct employee from public.movements) e
$$;

drop policy barcodes_delete on public.barcodes;
revoke delete on table public.barcodes from authenticated;
alter table public.movements drop constraint movements_delta_sign, drop constraint movements_counted_inventory;
grant update on table public.products, public.barcodes, public.movements to authenticated;

commit;
