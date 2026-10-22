-- 20261022130000_fin_de_journee.sql — ScanDrinks : la fin de journée (jalon 5).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.5, §4.8, RG-14, §6.3)
--
-- Chaque soir, l'équipe saisit les ventes du jour, lues sur la caisse : une
-- vente par produit, en unités. Une vente est une sortie (kind = 'out') qui
-- porte le jour des ventes (sale_day) ; un produit a au plus une vente active
-- par jour. Le stock (vue product_stock) et l'annulation (cancel_movement)
-- n'ont rien à changer. Compatible avec l'app du jalon 4 encore en service,
-- qui voit une vente comme une sortie : colonne ajoutée à la fin, même
-- signature pour list_history, réponses seulement complétées. Rien n'est
-- retiré.

-- ---------------------------------------------------------------------------
-- Jour des ventes
-- ---------------------------------------------------------------------------

-- Seule une sortie porte un jour de ventes. La colonne n'est pas modifiable
-- depuis l'app : seules cancelled_at et cancelled_by le sont (jalon 2).
alter table public.movements
  add column sale_day date,
  add constraint movements_sale_day_out check (sale_day is null or kind = 'out');

-- Au plus une vente active par produit et par jour : une seconde saisie attend
-- que la première soit annulée.
create unique index movements_one_active_sale on public.movements (product_id, sale_day)
  where sale_day is not null and cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Enregistrement d'une fin de journée
-- ---------------------------------------------------------------------------

-- Les ventes d'un jour, en une seule transaction. Chaque ligne a son
-- identifiant, tiré par le téléphone : rejouée (réponse perdue, « Réessayer »),
-- elle compte ce qui avait été enregistré, sans doublon. Le jour est l'un des
-- 7 derniers à l'heure de Paris, aujourd'hui compris. Les produits sont
-- verrouillés avant tout contrôle, toujours dans le même ordre : deux
-- téléphones qui enregistrent en même temps passent l'un après l'autre, et le
-- second voit les ventes du premier. Si un produit a déjà une vente active ce
-- jour-là, rien n'est enregistré et la réponse nomme les produits concernés.
create function public.record_sales(p_day date, p_lines jsonb, p_employee text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee text := btrim(coalesce(p_employee, ''));
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_lines int;
  v_ids int;
  v_distinct_ids int;
  v_products int;
  v_distinct_products int;
  v_bad_quantities int;
  v_locked int;
  v_conflicts jsonb;
  v_new int;
  v_units int;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(v_employee) not between 1 and 30 then
    raise exception 'invalid_input:employee';
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 6 then
    raise exception 'invalid_input:day';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 200
     or exists (select 1 from jsonb_array_elements(p_lines) e where jsonb_typeof(e) <> 'object') then
    raise exception 'invalid_input:lines';
  end if;

  select count(*), count(l.id), count(distinct l.id), count(l.product_id), count(distinct l.product_id),
         count(*) filter (where l.quantity is null or l.quantity not between 1 and 999)
    into v_lines, v_ids, v_distinct_ids, v_products, v_distinct_products, v_bad_quantities
  from jsonb_to_recordset(p_lines) as l(id uuid, product_id uuid, quantity int);
  if v_distinct_ids <> v_ids or v_distinct_products <> v_products then
    raise exception 'invalid_input:lines';
  end if;
  if v_ids <> v_lines then
    raise exception 'invalid_input:id';
  end if;
  if v_products <> v_lines then
    raise exception 'invalid_input:product';
  end if;
  if v_bad_quantities > 0 then
    raise exception 'invalid_input:quantity';
  end if;

  -- Verrou sur les produits, par ordre d'identifiant : jamais d'interblocage entre deux téléphones.
  select count(*) into v_locked
  from (
    select p.id
    from public.products p
    where p.id in (select l.product_id from jsonb_to_recordset(p_lines) as l(product_id uuid))
    order by p.id
    for update
  ) locked;
  if v_locked <> v_lines then
    raise exception 'invalid_input:product';
  end if;

  -- Ligne déjà reçue : ce doit être la vente de ce produit, ce jour-là.
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as l(id uuid, product_id uuid)
    join public.movements m on m.id = l.id
    where m.kind <> 'out' or m.sale_day is distinct from p_day or m.product_id <> l.product_id
  ) then
    raise exception 'invalid_input:id';
  end if;

  -- Déjà saisi pour ce jour, sous un autre identifiant (un autre téléphone) : rien n'est enregistré.
  select jsonb_agg(p.name order by p.name) into v_conflicts
  from jsonb_to_recordset(p_lines) as l(id uuid, product_id uuid)
  join public.products p on p.id = l.product_id
  where not exists (select 1 from public.movements m where m.id = l.id)
    and exists (
      select 1 from public.movements m
      where m.product_id = l.product_id and m.sale_day = p_day and m.cancelled_at is null
    );
  if v_conflicts is not null then
    return jsonb_build_object('status', 'already_recorded', 'products', v_conflicts);
  end if;

  insert into public.movements (id, product_id, kind, delta, employee, sale_day)
  select l.id, l.product_id, 'out', -l.quantity, v_employee, p_day
  from jsonb_to_recordset(p_lines) as l(id uuid, product_id uuid, quantity int)
  where not exists (select 1 from public.movements m where m.id = l.id);
  get diagnostics v_new = row_count;

  -- Ce qui est enregistré pour ces lignes, rejouées comprises.
  select coalesce(sum(-m.delta), 0) into v_units
  from jsonb_to_recordset(p_lines) as l(id uuid)
  join public.movements m on m.id = l.id;

  return jsonb_build_object('status', 'recorded', 'units', v_units, 'duplicate', v_new = 0);
end
$$;

-- ---------------------------------------------------------------------------
-- Historique
-- ---------------------------------------------------------------------------

-- Comme au jalon 3, avec en plus le jour des ventes de chaque ligne (vide pour
-- un autre mouvement).
create or replace function public.list_history(
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit int default 50
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid_input:limit';
  end if;
  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'invalid_input:cursor';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', h.id,
      'kind', h.kind,
      'delta', h.delta,
      'counted', h.counted,
      'employee', h.employee,
      'created_at', h.created_at,
      'cancelled_at', h.cancelled_at,
      'cancelled_by', h.cancelled_by,
      'product_id', h.product_id,
      'product_name', h.product_name,
      'sale_day', h.sale_day
    ) order by h.created_at desc, h.id desc)
    from (
      select m.id, m.kind, m.delta, m.counted, m.employee, m.created_at, m.cancelled_at, m.cancelled_by,
             m.product_id, p.name as product_name, m.sale_day
      from public.movements m
      join public.products p on p.id = m.product_id
      where p_before_created_at is null or (m.created_at, m.id) < (p_before_created_at, p_before_id)
      order by m.created_at desc, m.id desc
      limit p_limit
    ) h
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

-- list_history, remplacée, garde ses droits ; la nouvelle fonction est fermée à
-- tous, puis ouverte au seul compte connecté.
revoke all on function public.record_sales(date, jsonb, text) from public, anon;
grant execute on function public.record_sales(date, jsonb, text) to authenticated;
