-- database.test.sql — Tests de la base ScanDrinks (jalon 1).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§5, §6.3, §6.4, §8)
--
-- À lancer sur une base où la migration est appliquée : le vrai projet
-- (outil execute_sql) ou le PostgreSQL local (supabase/tests/run-local.sh).
-- Tout tourne dans une transaction annulée à la fin : la base reste vide.
-- Chaque vérification lève « ÉCHEC : … » ; la dernière ligne affiche OK.

begin;

-- Vérifie qu'une requête échoue avec le message (ou le code SQLSTATE) attendu.
create function pg_temp.expect_error(p_sql text, p_expected text) returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception 'ÉCHEC : « % » aurait dû échouer avec %', p_sql, p_expected;
exception
  when others then
    if sqlerrm like 'ÉCHEC%' then
      raise;
    end if;
    if sqlerrm <> p_expected and sqlstate <> p_expected then
      raise exception 'ÉCHEC : « % » a échoué avec « % » (%), attendu %', p_sql, sqlerrm, sqlstate, p_expected;
    end if;
end
$$;

-- Mise en place, en tant que postgres : A est le compte du tabac, B un compte inconnu.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'compte-a@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'compte-b@test.invalid');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values ('00000000-0000-4000-8000-00000000c0ca', 'Coca-Cola 33 cl', 24, 24, 48);
insert into public.barcodes (code, product_id, units)
  values ('5449000000996', '00000000-0000-4000-8000-00000000c0ca', 1);
insert into public.movements (id, product_id, kind, delta, barcode, employee)
  values ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000c0ca', 'in', 24, '5449000000996', 'Sam');

-- 1. Sans connexion (anon) : tout est refusé.
set local role anon;
select pg_temp.expect_error('select 1 from public.products', '42501');
select pg_temp.expect_error('select 1 from public.product_stock', '42501');
select pg_temp.expect_error($q$select public.lookup_barcode('5449000000996')$q$, '42501');
reset role;

-- 2. Compte connecté mais absent de allowed_users (B) : il ne voit et n'écrit rien.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
do $$
begin
  if public.lookup_barcode('5449000000996') is not null then
    raise exception 'ÉCHEC : B voit le code du Coca';
  end if;
  if exists (select 1 from public.product_stock) then
    raise exception 'ÉCHEC : B voit le stock';
  end if;
end
$$;
select pg_temp.expect_error($q$select public.record_movement('00000000-0000-4000-8000-0000000000f1',
  '00000000-0000-4000-8000-00000000c0ca', '5449000000996', 'in', 1, 1, 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.create_product('Intrus', 6, 6, 12, '[{"code":"96385074","units":6}]')$q$, '42501');

-- 3. Compte du tabac (A) : création d'une fiche avec le code du pack et celui de la canette.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  created jsonb;
  found_pack jsonb;
begin
  created := public.create_product('  Lipton Pêche 50 cl  ', 12, 12, 24,
    '[{"code":"3502110123091","units":12},{"code":"3228886043714","units":1}]');
  perform set_config('scandrinks_test.lipton', created ->> 'id', true);
  if created ->> 'name' <> 'Lipton Pêche 50 cl' or (created ->> 'stock')::int <> 0 or (created ->> 'pack_size')::int <> 12 then
    raise exception 'ÉCHEC : création (%)', created;
  end if;
  found_pack := public.lookup_barcode('3502110123091');
  if (found_pack ->> 'units')::int <> 12 or (found_pack -> 'product' ->> 'stock')::int <> 0
     or found_pack -> 'product' ->> 'id' <> created ->> 'id' then
    raise exception 'ÉCHEC : recherche du pack (%)', found_pack;
  end if;
  if (public.lookup_barcode('3228886043714') ->> 'units')::int <> 1 then
    raise exception 'ÉCHEC : code de la canette';
  end if;
end
$$;

-- 4 à 6. Entrée de 2 packs, envoi répété, sortie de 6 canettes, annulation.
do $$
declare
  lipton uuid := current_setting('scandrinks_test.lipton')::uuid;
  result jsonb;
begin
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '3502110123091', 'in', 12, 2, 'Sam');
  if (result ->> 'delta')::int <> 24 or (result ->> 'stock')::int <> 24 or (result ->> 'duplicate')::boolean then
    raise exception 'ÉCHEC : entrée de 2 packs (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '3502110123091', 'in', 12, 2, 'Sam');
  if not (result ->> 'duplicate')::boolean or (result ->> 'stock')::int <> 24 or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : envoi répété (%)', result;
  end if;
  if (select count(*) from public.movements where id = '00000000-0000-4000-8000-0000000000d1') <> 1 then
    raise exception 'ÉCHEC : doublon enregistré';
  end if;
  -- Renvoi tardif, alors que la saisie a changé entre-temps : on renvoie le premier enregistrement, sans contrôle.
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '3502110123091', 'in', 24, 5, 'Sam');
  if not (result ->> 'duplicate')::boolean or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : renvoi tardif (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d2', lipton, '3228886043714', 'out', 1, 6, 'Sam');
  if (result ->> 'delta')::int <> -6 or (result ->> 'stock')::int <> 18 then
    raise exception 'ÉCHEC : sortie de 6 canettes (%)', result;
  end if;

  result := public.cancel_movement('00000000-0000-4000-8000-0000000000d1', 'Sam');
  if (result ->> 'stock')::int <> -6 or (result ->> 'product_id')::uuid <> lipton then
    raise exception 'ÉCHEC : annulation (%)', result;
  end if;
  result := public.cancel_movement('00000000-0000-4000-8000-0000000000d1', 'Léa');
  if (result ->> 'stock')::int <> -6 then
    raise exception 'ÉCHEC : seconde annulation (%)', result;
  end if;
  if (select cancelled_by from public.movements where id = '00000000-0000-4000-8000-0000000000d1') is distinct from 'Sam' then
    raise exception 'ÉCHEC : auteur de l''annulation';
  end if;
end
$$;
select pg_temp.expect_error($q$select public.cancel_movement('00000000-0000-4000-8000-0000000000ff', 'Sam')$q$, 'invalid_input:movement');

-- 7. Les unités enregistrées sont celles du code, ou 1 ou le pack Metro en saisie manuelle.
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '3502110123091', 'in', 24, 1, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '5449000000996', 'in', 1, 1, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:code');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, null, 'in', 5, 1, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
do $$
declare
  result jsonb;
begin
  result := public.record_movement('00000000-0000-4000-8000-0000000000d3', current_setting('scandrinks_test.lipton')::uuid,
    null, 'in', 12, 1, 'Sam');
  if (result ->> 'delta')::int <> 12 or (result ->> 'stock')::int <> 6 then
    raise exception 'ÉCHEC : saisie manuelle d''un pack (%)', result;
  end if;
end
$$;

-- 8. Code d'un autre produit : rien sans accord, puis déplacement (RG-12).
do $$
declare
  lipton uuid := current_setting('scandrinks_test.lipton')::uuid;
  coca uuid := '00000000-0000-4000-8000-00000000c0ca';
  stock_lipton int := (select stock from public.product_stock where id = lipton);
  stock_coca int := (select stock from public.product_stock where id = coca);
  result jsonb;
begin
  result := public.attach_barcode('5449000000996', lipton, 1, false);
  if result ->> 'status' <> 'already_attached' or result ->> 'product_name' <> 'Coca-Cola 33 cl'
     or (result ->> 'product_id')::uuid <> coca then
    raise exception 'ÉCHEC : code déjà associé (%)', result;
  end if;
  if (public.lookup_barcode('5449000000996') -> 'product' ->> 'id')::uuid <> coca then
    raise exception 'ÉCHEC : code déplacé sans accord';
  end if;

  result := public.attach_barcode('5449000000996', lipton, 1, true);
  if result ->> 'status' <> 'attached' or (public.lookup_barcode('5449000000996') -> 'product' ->> 'id')::uuid <> lipton then
    raise exception 'ÉCHEC : déplacement du code (%)', result;
  end if;
  if (select stock from public.product_stock where id = lipton) <> stock_lipton
     or (select stock from public.product_stock where id = coca) <> stock_coca then
    raise exception 'ÉCHEC : le déplacement a changé un stock (RG-12)';
  end if;

  -- Code nouveau, puis nouvelles unités pour un code du même produit.
  if public.attach_barcode('96385074', lipton, 6, false) ->> 'status' <> 'attached'
     or public.attach_barcode('96385074', lipton, 4, false) ->> 'status' <> 'attached'
     or (public.lookup_barcode('96385074') ->> 'units')::int <> 4 then
    raise exception 'ÉCHEC : ajout puis mise à jour d''un code';
  end if;
end
$$;

-- 9. Création avec un code déjà pris.
select pg_temp.expect_error($q$select public.create_product('Doublon', 6, 6, 12, '[{"code":"3502110123091","units":6}]')$q$,
  'barcode_taken:3502110123091');

-- 10. Valeurs refusées.
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '3502110123091', 'in', 12, 0, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '3502110123091', 'in', 12, 100, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '3502110123091', 'inventory', 12, 1, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:kind');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '3502110123091', 'in', 12, 1, %L)$q$,
  current_setting('scandrinks_test.lipton'), repeat('x', 31)), 'invalid_input:employee');
select pg_temp.expect_error(format($q$select public.attach_barcode('40170725', %L, 0, false)$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
select pg_temp.expect_error($q$select public.create_product('Seuil', 6, 6, 6, '[{"code":"40170725","units":6}]')$q$,
  'invalid_input:target_stock');
select pg_temp.expect_error(format($q$select public.create_product(%L, 6, 6, 12, '[{"code":"40170725","units":6}]')$q$,
  repeat('x', 81)), 'invalid_input:name');

-- 11. Prénoms déjà utilisés.
do $$
begin
  if public.list_employees() <> '["Sam"]'::jsonb then
    raise exception 'ÉCHEC : prénoms (%)', public.list_employees();
  end if;
end
$$;

-- 12. Pas de suppression : on archive (RG-11), l'historique reste.
select pg_temp.expect_error('delete from public.movements', '42501');
select pg_temp.expect_error('delete from public.products', '42501');

reset role;
rollback;

select 'OK' as resultat;
