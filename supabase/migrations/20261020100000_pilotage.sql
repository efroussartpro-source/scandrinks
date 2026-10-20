-- 20261020100000_pilotage.sql — ScanDrinks : le pilotage (jalon 2).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2 à §4.4, §5, §6.3)
--
-- Inventaire, fiche modifiable, archivage et retrait d'un code ; création de
-- fiche rejouable avec l'identifiant du téléphone ; droits de mise à jour
-- limités aux colonnes que l'app modifie. Compatible avec l'app du jalon 1
-- encore en service : mêmes noms et mêmes paramètres, ou paramètre ajouté
-- avec une valeur par défaut.

-- ---------------------------------------------------------------------------
-- Accès
-- ---------------------------------------------------------------------------

-- Un compte absent de allowed_users est prévenu dès le premier scan (m16), au
-- lieu de croire le catalogue vide.
create or replace function public.lookup_barcode(p_code text) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object('code', b.code, 'units', b.units, 'product', to_jsonb(ps))
    from public.barcodes b
    join public.product_stock ps on ps.id = b.product_id
    where b.code = p_code
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Fiches produit
-- ---------------------------------------------------------------------------

-- Contrôle des champs d'une fiche (RG-7), commun à la création et à la
-- modification. Renvoie le nom nettoyé.
create function private.checked_product_name(p_name text, p_pack_size int, p_alert_threshold int, p_target_stock int)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
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
  return v_name;
end
$$;

revoke all on function private.checked_product_name(text, int, int, int) from public, anon;
grant execute on function private.checked_product_name(text, int, int, int) to authenticated;

-- L'identifiant vient du téléphone (m10) : une création rejouée après une réponse
-- perdue renvoie la fiche déjà créée. La liste des codes peut être vide (§4.4).
drop function public.create_product(text, int, int, int, jsonb);

create function public.create_product(
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

-- RG-10 : changer le pack Metro ne change pas les mouvements passés (le stock est leur somme).
create function public.update_product(
  p_id uuid,
  p_name text,
  p_pack_size int,
  p_alert_threshold int,
  p_target_stock int
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_name := private.checked_product_name(p_name, p_pack_size, p_alert_threshold, p_target_stock);

  update public.products
  set name = v_name, pack_size = p_pack_size, alert_threshold = p_alert_threshold, target_stock = p_target_stock, updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'invalid_input:product';
  end if;

  return (select to_jsonb(ps) from public.product_stock ps where ps.id = p_id);
end
$$;

-- RG-11 : on archive au lieu de supprimer ; l'historique reste.
create function public.set_product_archived(p_product_id uuid, p_archived boolean) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_archived is null then
    raise exception 'invalid_input:archived';
  end if;

  update public.products set archived = p_archived, updated_at = now() where id = p_product_id;
  if not found then
    raise exception 'invalid_input:product';
  end if;

  return (select to_jsonb(ps) from public.product_stock ps where ps.id = p_product_id);
end
$$;

-- Retirer un code supprime l'association ; les mouvements gardent le code en texte.
-- Un code déjà retiré renvoie le même résultat : l'appel peut être rejoué.
create function public.detach_barcode(p_code text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{8,14}$' then
    raise exception 'invalid_input:code';
  end if;

  delete from public.barcodes where code = p_code;
  return jsonb_build_object('status', 'detached');
end
$$;

-- ---------------------------------------------------------------------------
-- Inventaire (RG-4)
-- ---------------------------------------------------------------------------

-- Le stock prend la valeur comptée : l'écart avec le stock du moment devient un
-- mouvement d'inventaire. Idempotent, comme record_movement.
create function public.record_inventory(p_id uuid, p_product_id uuid, p_counted int, p_employee text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee text := btrim(coalesce(p_employee, ''));
  v_existing public.movements%rowtype;
  v_stock int;
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
      'counted', v_existing.counted,
      'stock', (select ps.stock from public.product_stock ps where ps.id = v_existing.product_id),
      'duplicate', true
    );
  end if;

  -- Verrou sur le produit : un mouvement d'un autre téléphone ne peut pas fausser l'écart.
  perform 1 from public.products where id = p_product_id for update;
  if not found then
    raise exception 'invalid_input:product';
  end if;
  if p_counted is null or p_counted not between 0 and 9999 then
    raise exception 'invalid_input:counted';
  end if;
  if char_length(v_employee) not between 1 and 30 then
    raise exception 'invalid_input:employee';
  end if;

  select ps.stock into v_stock from public.product_stock ps where ps.id = p_product_id;
  v_delta := p_counted - v_stock;

  insert into public.movements (id, product_id, kind, delta, counted, employee)
  values (p_id, p_product_id, 'inventory', v_delta, p_counted, v_employee)
  on conflict (id) do nothing;

  if not found then
    -- Inséré entre-temps par un envoi jumeau.
    select * into v_existing from public.movements where id = p_id;
    return jsonb_build_object(
      'movement_id', v_existing.id,
      'delta', v_existing.delta,
      'counted', v_existing.counted,
      'stock', (select ps.stock from public.product_stock ps where ps.id = v_existing.product_id),
      'duplicate', true
    );
  end if;

  return jsonb_build_object(
    'movement_id', p_id,
    'delta', v_delta,
    'counted', p_counted,
    'stock', (select ps.stock from public.product_stock ps where ps.id = p_product_id),
    'duplicate', false
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Prénoms
-- ---------------------------------------------------------------------------

-- Une seule orthographe par prénom, sans tenir compte de la casse (« Sam » et
-- « sam ») : la première enregistrée.
create or replace function public.list_employees() returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(e.employee order by lower(e.employee), e.employee), '[]'::jsonb)
  from (
    select distinct on (lower(employee)) employee
    from public.movements
    order by lower(employee), created_at, employee
  ) e
$$;

-- ---------------------------------------------------------------------------
-- Droits et contraintes (m11)
-- ---------------------------------------------------------------------------

-- Seules les colonnes que l'app modifie restent modifiables. Retirer le droit sur
-- la table retire aussi ceux des colonnes : on retire d'abord, puis on rend.
revoke update on table public.products, public.barcodes, public.movements from authenticated;
grant update (name, pack_size, alert_threshold, target_stock, archived, updated_at) on table public.products to authenticated;
grant update (product_id, units) on table public.barcodes to authenticated;
grant update (cancelled_at, cancelled_by) on table public.movements to authenticated;

-- Retirer un code est la seule suppression permise ; produits et mouvements ne
-- se suppriment jamais (RG-11).
grant delete on table public.barcodes to authenticated;
create policy barcodes_delete on public.barcodes for delete to authenticated
  using ((select private.is_allowed()));

-- Le signe de la variation suit le type de mouvement ; seul un inventaire a une valeur comptée.
alter table public.movements
  add constraint movements_delta_sign check ((kind = 'in' and delta > 0) or (kind = 'out' and delta < 0) or kind = 'inventory'),
  add constraint movements_counted_inventory check ((kind = 'inventory') = (counted is not null));

revoke all on function
  public.create_product(text, int, int, int, jsonb, uuid),
  public.update_product(uuid, text, int, int, int),
  public.set_product_archived(uuid, boolean),
  public.detach_barcode(text),
  public.record_inventory(uuid, uuid, int, text)
from public, anon;

grant execute on function
  public.create_product(text, int, int, int, jsonb, uuid),
  public.update_product(uuid, text, int, int, int),
  public.set_product_archived(uuid, boolean),
  public.detach_barcode(text),
  public.record_inventory(uuid, uuid, int, text)
to authenticated;
