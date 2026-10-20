-- 20261020180000_suivi.sql — ScanDrinks : le suivi (jalon 3).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.5, §4.6, §6.3, §6.4)
--
-- Session vérifiée à chaque appel, historique par pages, annulation qui dit
-- qui a annulé et quand, création de fiche sans conflit possible. Compatible
-- avec l'app du jalon 2 encore en service : mêmes noms, mêmes paramètres,
-- réponses seulement complétées. Rien n'est retiré, ni objet ni donnée.

-- ---------------------------------------------------------------------------
-- Accès
-- ---------------------------------------------------------------------------

-- Après un changement de mot de passe, tous les téléphones sont déconnectés :
-- leurs sessions disparaissent de auth.sessions. Un jeton encore valide est
-- alors refusé tout de suite, sans attendre son expiration, avec le code
-- PT401, que l'API rend en 401 (« session expirée » dans l'app).
create or replace function private.is_allowed() returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.sessions s
    where s.id = (auth.jwt() ->> 'session_id')::uuid and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'session_revoked' using errcode = 'PT401';
  end if;
  return exists (select 1 from public.allowed_users where user_id = (select auth.uid()));
end
$$;

-- ---------------------------------------------------------------------------
-- Historique (§4.5)
-- ---------------------------------------------------------------------------

-- Tous les mouvements, du plus récent au plus ancien, produits archivés compris.
-- La page suivante part du dernier mouvement affiché (sa date et son
-- identifiant) : un mouvement ajouté entre-temps ne décale rien.
create function public.list_history(
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
      'product_name', h.product_name
    ) order by h.created_at desc, h.id desc)
    from (
      select m.id, m.kind, m.delta, m.counted, m.employee, m.created_at, m.cancelled_at, m.cancelled_by,
             m.product_id, p.name as product_name
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
-- Annulation
-- ---------------------------------------------------------------------------

-- La réponse dit qui a annulé et quand : si un autre téléphone l'a fait juste
-- avant, la ligne affiche son prénom à lui, pas celui de ce téléphone.
create or replace function public.cancel_movement(p_movement_id uuid, p_employee text) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_employee text := btrim(coalesce(p_employee, ''));
  v_movement public.movements%rowtype;
begin
  if not private.is_allowed() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(v_employee) not between 1 and 30 then
    raise exception 'invalid_input:employee';
  end if;

  select * into v_movement from public.movements where id = p_movement_id for update;
  if not found then
    raise exception 'invalid_input:movement';
  end if;
  perform 1 from public.products where id = v_movement.product_id for update;

  -- RG-9 : annuler retire exactement l'effet du mouvement ; une seconde
  -- annulation ne change rien et garde le premier auteur.
  if v_movement.cancelled_at is null then
    update public.movements
    set cancelled_at = now(), cancelled_by = v_employee
    where id = p_movement_id
    returning cancelled_at, cancelled_by into v_movement.cancelled_at, v_movement.cancelled_by;
  end if;

  return jsonb_build_object(
    'stock', (select ps.stock from public.product_stock ps where ps.id = v_movement.product_id),
    'product_id', v_movement.product_id,
    'cancelled_at', v_movement.cancelled_at,
    'cancelled_by', v_movement.cancelled_by
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Création de fiche (p7)
-- ---------------------------------------------------------------------------

-- L'identifiant vient du téléphone (m10). La fiche s'insère avant le contrôle
-- des codes : une création rejouée, ou deux envois simultanés du même
-- identifiant, renvoient la fiche du premier, sans autre contrôle ni erreur de
-- conflit. Un code refusé ensuite annule toute la création.
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
  v_name := private.checked_product_name(p_name, p_pack_size, p_alert_threshold, p_target_stock);

  insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values (coalesce(p_id, gen_random_uuid()), v_name, p_pack_size, p_alert_threshold, p_target_stock)
  on conflict (id) do nothing
  returning id into v_id;
  if v_id is null then
    -- Même identifiant déjà reçu : la fiche existante, telle quelle.
    return (select to_jsonb(ps) from public.product_stock ps where ps.id = p_id);
  end if;

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

  insert into public.barcodes (code, product_id, units)
  select e ->> 'code', v_id, (e ->> 'units')::int
  from jsonb_array_elements(p_barcodes) e;

  return (select to_jsonb(ps) from public.product_stock ps where ps.id = v_id);
end
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

-- Les fonctions remplacées gardent leurs droits ; la nouvelle est fermée à tous,
-- puis ouverte au seul compte connecté.
revoke all on function public.list_history(timestamptz, uuid, int) from public, anon;
grant execute on function public.list_history(timestamptz, uuid, int) to authenticated;
