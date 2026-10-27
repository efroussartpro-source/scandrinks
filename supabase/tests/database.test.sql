-- database.test.sql — Tests de la base ScanDrinks (jalons 1 à 3, les images des codes, la fin de journée, puis la suppression).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §4.8, §5, §6.3, §6.4, §8)
--
-- À lancer sur une base où les migrations sont appliquées : le vrai projet
-- (outil execute_sql) ou le PostgreSQL local (supabase/tests/run-local.sh).
-- Tout tourne dans une transaction annulée à la fin : la base reste telle
-- quelle. La vraie base contient des données d'essai : les codes utilisés ici
-- sont fictifs (préfixe 2, réservé à l'usage interne GS1) et aucun cas ne
-- suppose une base vide. Chaque vérification lève « ÉCHEC : … » ; la dernière
-- ligne affiche OK.

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

-- Exécute une instruction et renvoie le nombre de lignes touchées.
create function pg_temp.run(p_sql text) returns bigint
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- Essaie une instruction et ignore son erreur : une écriture que la RLS doit rendre sans effet (cas 26).
create function pg_temp.attempt(p_sql text) returns void
language plpgsql
as $$
begin
  execute p_sql;
exception
  when others then
    null;
end
$$;

-- Mise en place, en tant que postgres : A est le compte du tabac, B un compte inconnu.
-- Chaque jeton porte sa session (session_id), qui doit exister (cas 21).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'compte-a@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'compte-b@test.invalid');
insert into auth.sessions (id, user_id) values
  ('00000000-0000-4000-8000-00000000a1a1', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-00000000b2b2', '00000000-0000-4000-8000-0000000000b2');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values ('00000000-0000-4000-8000-00000000c0ca', 'Coca-Cola 33 cl', 24, 24, 48);
insert into public.barcodes (code, product_id, units)
  values ('2000000000015', '00000000-0000-4000-8000-00000000c0ca', 1);
insert into public.movements (id, product_id, kind, delta, barcode, employee)
  values ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000c0ca', 'in', 24, '2000000000015', 'Testeur');

-- 1. Sans connexion (anon) : tout est refusé, lectures comme écritures.
set local role anon;
select pg_temp.expect_error('select 1 from public.products', '42501');
select pg_temp.expect_error('select 1 from public.product_stock', '42501');
select pg_temp.expect_error($q$select public.lookup_barcode('2000000000015')$q$, '42501');
select pg_temp.expect_error($q$select public.create_product('Intrus', 1, 0, 1, '[]')$q$, '42501');
select pg_temp.expect_error($q$select public.attach_barcode('2000000000015', '00000000-0000-4000-8000-00000000c0ca', 1, false)$q$, '42501');
select pg_temp.expect_error($q$select public.record_movement(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', null, 'in', 1, 1, 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.cancel_movement('00000000-0000-4000-8000-0000000000e0', 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 1, 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.update_product('00000000-0000-4000-8000-00000000c0ca', 'Intrus', 1, 0, 1)$q$, '42501');
select pg_temp.expect_error($q$select public.set_product_archived('00000000-0000-4000-8000-00000000c0ca', true)$q$, '42501');
select pg_temp.expect_error($q$select public.detach_barcode('2000000000015')$q$, '42501');
reset role;

-- 2. Compte connecté mais absent de allowed_users (B) : il ne voit et n'écrit rien,
-- et la recherche d'un code le dit (m16) au lieu de laisser croire le catalogue vide.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error($q$select public.lookup_barcode('2000000000015')$q$, '42501');
do $$
begin
  if exists (select 1 from public.product_stock) then
    raise exception 'ÉCHEC : B voit le stock';
  end if;
end
$$;
select pg_temp.expect_error($q$select public.record_movement('00000000-0000-4000-8000-0000000000f1',
  '00000000-0000-4000-8000-00000000c0ca', '2000000000015', 'in', 1, 1, 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.create_product('Intrus', 6, 6, 12, '[{"code":"20000011","units":6}]')$q$, '42501');
select pg_temp.expect_error($q$select public.attach_barcode('2000000000015', '00000000-0000-4000-8000-00000000c0ca', 1, false)$q$, '42501');
select pg_temp.expect_error($q$select public.cancel_movement('00000000-0000-4000-8000-0000000000e0', 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 1, 'Intrus')$q$, '42501');
select pg_temp.expect_error($q$select public.update_product('00000000-0000-4000-8000-00000000c0ca', 'Intrus', 1, 0, 1)$q$, '42501');
select pg_temp.expect_error($q$select public.set_product_archived('00000000-0000-4000-8000-00000000c0ca', true)$q$, '42501');
select pg_temp.expect_error($q$select public.detach_barcode('2000000000015')$q$, '42501');
select pg_temp.expect_error($q$insert into public.products (name, pack_size, alert_threshold, target_stock) values ('Intrus', 6, 6, 12)$q$, '42501');
select pg_temp.expect_error('select 1 from public.allowed_users', '42501');

-- 3. Compte du tabac (A) : création d'une fiche avec le code du pack et celui de la canette.
-- La liste des comptes autorisés n'est ni lisible ni modifiable depuis l'app (m12).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
select pg_temp.expect_error('select 1 from public.allowed_users', '42501');
select pg_temp.expect_error($q$insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000b2')$q$, '42501');
do $$
declare
  created jsonb;
  found_pack jsonb;
begin
  created := public.create_product('  Lipton Pêche 50 cl  ', 12, 12, 24,
    '[{"code":"2000000000022","units":12},{"code":"2000000000039","units":1}]');
  perform set_config('scandrinks_test.lipton', created ->> 'id', true);
  if created ->> 'name' <> 'Lipton Pêche 50 cl' or (created ->> 'stock')::int <> 0 or (created ->> 'pack_size')::int <> 12 then
    raise exception 'ÉCHEC : création (%)', created;
  end if;
  found_pack := public.lookup_barcode('2000000000022');
  if (found_pack ->> 'units')::int is distinct from 12 or (found_pack -> 'product' ->> 'stock')::int is distinct from 0
     or found_pack -> 'product' ->> 'id' is distinct from created ->> 'id' then
    raise exception 'ÉCHEC : recherche du pack (%)', found_pack;
  end if;
  if (public.lookup_barcode('2000000000039') ->> 'units')::int is distinct from 1 then
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
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 12, 2, 'Testeur');
  if (result ->> 'delta')::int <> 24 or (result ->> 'stock')::int <> 24 or (result ->> 'duplicate')::boolean then
    raise exception 'ÉCHEC : entrée de 2 packs (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 12, 2, 'Testeur');
  if not (result ->> 'duplicate')::boolean or (result ->> 'stock')::int <> 24 or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : envoi répété (%)', result;
  end if;
  if (select count(*) from public.movements where id = '00000000-0000-4000-8000-0000000000d1') <> 1 then
    raise exception 'ÉCHEC : doublon enregistré';
  end if;
  -- Renvoi tardif, alors que la saisie a changé entre-temps : on renvoie le premier enregistrement, sans contrôle.
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 24, 5, 'Testeur');
  if not (result ->> 'duplicate')::boolean or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : renvoi tardif (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d2', lipton, '2000000000039', 'out', 1, 6, 'Testeur');
  if (result ->> 'delta')::int <> -6 or (result ->> 'stock')::int <> 18 then
    raise exception 'ÉCHEC : sortie de 6 canettes (%)', result;
  end if;

  result := public.cancel_movement('00000000-0000-4000-8000-0000000000d1', 'Testeur');
  if (result ->> 'stock')::int <> -6 or (result ->> 'product_id')::uuid <> lipton then
    raise exception 'ÉCHEC : annulation (%)', result;
  end if;
  result := public.cancel_movement('00000000-0000-4000-8000-0000000000d1', 'Testeuse');
  if (result ->> 'stock')::int <> -6 then
    raise exception 'ÉCHEC : seconde annulation (%)', result;
  end if;
  if (select cancelled_by from public.movements where id = '00000000-0000-4000-8000-0000000000d1') is distinct from 'Testeur' then
    raise exception 'ÉCHEC : auteur de l''annulation';
  end if;
end
$$;
select pg_temp.expect_error($q$select public.cancel_movement('00000000-0000-4000-8000-0000000000ff', 'Testeur')$q$, 'invalid_input:movement');

-- 7. Les unités enregistrées sont celles du code, ou 1 ou le pack Metro en saisie manuelle.
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 24, 1, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000015', 'in', 1, 1, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:code');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, null, 'in', 5, 1, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
do $$
declare
  result jsonb;
begin
  result := public.record_movement('00000000-0000-4000-8000-0000000000d3', current_setting('scandrinks_test.lipton')::uuid,
    null, 'in', 12, 1, 'Testeur');
  if (result ->> 'delta')::int <> 12 or (result ->> 'stock')::int <> 6 then
    raise exception 'ÉCHEC : saisie manuelle d''un pack (%)', result;
  end if;
end
$$;

-- 8. Code d'un autre produit : rien sans accord, puis déplacement (RG-12).
-- Une fonction stable (lookup_barcode) voit la base telle qu'au début de la requête qui
-- l'appelle : chaque relecture suit l'écriture dans une requête distincte.
do $$
declare
  lipton uuid := current_setting('scandrinks_test.lipton')::uuid;
  coca uuid := '00000000-0000-4000-8000-00000000c0ca';
  stock_lipton int := (select stock from public.product_stock where id = lipton);
  stock_coca int := (select stock from public.product_stock where id = coca);
  result jsonb;
begin
  result := public.attach_barcode('2000000000015', lipton, 1, false);
  if result ->> 'status' <> 'already_attached' or result ->> 'product_name' <> 'Coca-Cola 33 cl'
     or (result ->> 'product_id')::uuid <> coca then
    raise exception 'ÉCHEC : code déjà associé (%)', result;
  end if;
  if (public.lookup_barcode('2000000000015') -> 'product' ->> 'id')::uuid is distinct from coca then
    raise exception 'ÉCHEC : code déplacé sans accord';
  end if;

  result := public.attach_barcode('2000000000015', lipton, 1, true);
  if result ->> 'status' <> 'attached' or (public.lookup_barcode('2000000000015') -> 'product' ->> 'id')::uuid is distinct from lipton then
    raise exception 'ÉCHEC : déplacement du code (%)', result;
  end if;
  if (select stock from public.product_stock where id = lipton) <> stock_lipton
     or (select stock from public.product_stock where id = coca) <> stock_coca then
    raise exception 'ÉCHEC : le déplacement a changé un stock (RG-12)';
  end if;

  -- Code nouveau, puis nouvelles unités pour un code du même produit.
  if public.attach_barcode('20000011', lipton, 6, false) ->> 'status' <> 'attached' then
    raise exception 'ÉCHEC : ajout d''un code';
  end if;
  if public.attach_barcode('20000011', lipton, 4, false) ->> 'status' <> 'attached' then
    raise exception 'ÉCHEC : mise à jour d''un code';
  end if;
  if (public.lookup_barcode('20000011') ->> 'units')::int is distinct from 4 then
    raise exception 'ÉCHEC : unités du code mis à jour';
  end if;
end
$$;

-- 9. Création avec un code déjà pris.
select pg_temp.expect_error($q$select public.create_product('Doublon', 6, 6, 12, '[{"code":"2000000000022","units":6}]')$q$,
  'barcode_taken:2000000000022');
do $$
begin
  if exists (select 1 from public.products where name = 'Doublon') then
    raise exception 'ÉCHEC : la création refusée a laissé un produit';
  end if;
end
$$;

-- 10. Valeurs refusées.
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 12, 0, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 12, 100, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'inventory', 12, 1, 'Testeur')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:kind');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 12, 1, %L)$q$,
  current_setting('scandrinks_test.lipton'), repeat('x', 31)), 'invalid_input:employee');
select pg_temp.expect_error(format($q$select public.attach_barcode('20000028', %L, 0, false)$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
select pg_temp.expect_error($q$select public.create_product('Seuil', 6, 6, 6, '[{"code":"20000028","units":6}]')$q$,
  'invalid_input:target_stock');
select pg_temp.expect_error(format($q$select public.create_product(%L, 6, 6, 12, '[{"code":"20000028","units":6}]')$q$,
  repeat('x', 81)), 'invalid_input:name');

-- 11. Prénoms déjà utilisés (la vraie base peut en contenir d'autres).
do $$
begin
  if not public.list_employees() @> '["Testeur"]'::jsonb then
    raise exception 'ÉCHEC : prénoms (%)', public.list_employees();
  end if;
end
$$;

-- 12. Pas de suppression : on archive (RG-11), l'historique reste.
select pg_temp.expect_error('delete from public.movements', '42501');
select pg_temp.expect_error('delete from public.products', '42501');

-- 13. Création rejouée avec le même identifiant (m10) : un seul produit, celui du premier envoi.
do $$
declare
  created jsonb;
  replayed jsonb;
  changed jsonb;
begin
  created := public.create_product('Schweppes Agrumes 33 cl', 24, 24, 48, '[{"code":"2000000000046","units":24}]',
    'c0000000-0000-4000-8000-000000000001');
  if (created ->> 'id')::uuid <> 'c0000000-0000-4000-8000-000000000001' then
    raise exception 'ÉCHEC : création avec l''identifiant du téléphone (%)', created;
  end if;
  replayed := public.create_product('Schweppes Agrumes 33 cl', 24, 24, 48, '[{"code":"2000000000046","units":24}]',
    'c0000000-0000-4000-8000-000000000001');
  if replayed ->> 'id' <> created ->> 'id'
     or (select count(*) from public.products where id = 'c0000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'ÉCHEC : création rejouée (%)', replayed;
  end if;
  changed := public.create_product('Autre nom', 6, 6, 12, '[{"code":"2000000000053","units":24}]',
    'c0000000-0000-4000-8000-000000000001');
  if changed ->> 'name' <> 'Schweppes Agrumes 33 cl' or public.lookup_barcode('2000000000053') is not null then
    raise exception 'ÉCHEC : rejeu avec une autre saisie (%)', changed;
  end if;
end
$$;

-- 14. Produit sans code (« Nouveau produit » depuis le Stock, code illisible).
do $$
declare
  created jsonb;
begin
  created := public.create_product('Sans code', 6, 6, 12, '[]');
  if created ->> 'name' <> 'Sans code'
     or exists (select 1 from public.barcodes where product_id = (created ->> 'id')::uuid) then
    raise exception 'ÉCHEC : produit sans code (%)', created;
  end if;
end
$$;

-- 15. Inventaire (RG-4) : écart = compté − stock du moment ; rejoué, il ne compte qu'une fois.
do $$
declare
  coca uuid := '00000000-0000-4000-8000-00000000c0ca';
  result jsonb;
  inv public.movements%rowtype;
begin
  result := public.record_inventory('00000000-0000-4000-8000-0000000000e1', coca, 20, 'Testeur');
  if (result ->> 'delta')::int <> -4 or (result ->> 'stock')::int <> 20 or (result ->> 'counted')::int <> 20
     or (result ->> 'duplicate')::boolean then
    raise exception 'ÉCHEC : inventaire (%)', result;
  end if;
  select * into inv from public.movements where id = '00000000-0000-4000-8000-0000000000e1';
  if inv.kind is distinct from 'inventory' or inv.counted is distinct from 20 or inv.barcode is not null then
    raise exception 'ÉCHEC : ligne d''inventaire (%)', to_jsonb(inv);
  end if;
  result := public.record_inventory('00000000-0000-4000-8000-0000000000e1', coca, 99, 'Testeur');
  if not (result ->> 'duplicate')::boolean or (result ->> 'delta')::int <> -4 or (result ->> 'counted')::int <> 20
     or (result ->> 'stock')::int <> 20 then
    raise exception 'ÉCHEC : inventaire rejoué (%)', result;
  end if;
end
$$;
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', -1, 'Testeur')$q$,
  'invalid_input:counted');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 10000, 'Testeur')$q$,
  'invalid_input:counted');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-0000000000ff', 5, 'Testeur')$q$,
  'invalid_input:product');
select pg_temp.expect_error(format($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 5, %L)$q$,
  repeat('x', 31)), 'invalid_input:employee');
do $$
begin
  if (public.cancel_movement('00000000-0000-4000-8000-0000000000e1', 'Testeur') ->> 'stock')::int <> 24 then
    raise exception 'ÉCHEC : annulation d''un inventaire';
  end if;
end
$$;

-- 16. Modification de la fiche (RG-10) : le stock et les mouvements passés ne changent pas.
do $$
declare
  lipton uuid := current_setting('scandrinks_test.lipton')::uuid;
  updated jsonb;
begin
  updated := public.update_product(lipton, '  Lipton Pêche 33 cl ', 24, 10, 40);
  if updated ->> 'name' <> 'Lipton Pêche 33 cl' or (updated ->> 'pack_size')::int <> 24
     or (updated ->> 'alert_threshold')::int <> 10 or (updated ->> 'target_stock')::int <> 40 or (updated ->> 'stock')::int <> 6 then
    raise exception 'ÉCHEC : modification de la fiche (%)', updated;
  end if;
  if (select delta from public.movements where id = '00000000-0000-4000-8000-0000000000d3') is distinct from 12 then
    raise exception 'ÉCHEC : un mouvement passé a changé (RG-10)';
  end if;
end
$$;
select pg_temp.expect_error(format($q$select public.update_product(%L, 'Lipton', 24, 10, 10)$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:target_stock');
select pg_temp.expect_error(format($q$select public.update_product(%L, 'Lipton', 0, 10, 40)$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:pack_size');
select pg_temp.expect_error(format($q$select public.update_product(%L, %L, 24, 10, 40)$q$,
  current_setting('scandrinks_test.lipton'), repeat('x', 81)), 'invalid_input:name');
select pg_temp.expect_error($q$select public.update_product('00000000-0000-4000-8000-0000000000ff', 'Lipton', 24, 10, 40)$q$,
  'invalid_input:product');

-- 17. Archivage (RG-11) : le code trouve toujours le produit, marqué archivé ; puis réactivation.
do $$
declare
  coca uuid := '00000000-0000-4000-8000-00000000c0ca';
  result jsonb;
begin
  if public.attach_barcode('2000000000060', coca, 24, false) ->> 'status' <> 'attached' then
    raise exception 'ÉCHEC : nouveau code du Coca';
  end if;
  result := public.set_product_archived(coca, true);
  if (result ->> 'archived')::boolean is not true or (select archived from public.product_stock where id = coca) is not true then
    raise exception 'ÉCHEC : archivage (%)', result;
  end if;
  if (public.lookup_barcode('2000000000060') -> 'product' ->> 'archived')::boolean is not true then
    raise exception 'ÉCHEC : code d''un produit archivé';
  end if;
  result := public.set_product_archived(coca, false);
  if (result ->> 'archived')::boolean then
    raise exception 'ÉCHEC : réactivation (%)', result;
  end if;
end
$$;
select pg_temp.expect_error($q$select public.set_product_archived('00000000-0000-4000-8000-00000000c0ca', null)$q$,
  'invalid_input:archived');
select pg_temp.expect_error($q$select public.set_product_archived('00000000-0000-4000-8000-0000000000ff', true)$q$,
  'invalid_input:product');

-- 18. Retrait d'un code : il ne désigne plus rien, et les mouvements gardent le code en texte.
do $$
begin
  if public.detach_barcode('2000000000022') ->> 'status' is distinct from 'detached' then
    raise exception 'ÉCHEC : retrait du code';
  end if;
  if public.lookup_barcode('2000000000022') is not null then
    raise exception 'ÉCHEC : le code retiré désigne encore un produit';
  end if;
  if (select barcode from public.movements where id = '00000000-0000-4000-8000-0000000000d1') is distinct from '2000000000022' then
    raise exception 'ÉCHEC : le mouvement a perdu son code';
  end if;
  if public.detach_barcode('2000000000022') ->> 'status' <> 'detached' then
    raise exception 'ÉCHEC : retrait rejoué';
  end if;
end
$$;
select pg_temp.expect_error($q$select public.detach_barcode('abc')$q$, 'invalid_input:code');

-- 19. Écritures directes (m11) : seules les colonnes prévues se modifient, et le signe suit le type.
select pg_temp.expect_error($q$update public.movements set delta = 1000 where id = '00000000-0000-4000-8000-0000000000d2'$q$, '42501');
select pg_temp.expect_error($q$update public.products set created_at = now()$q$, '42501');
select pg_temp.expect_error(format($q$insert into public.movements (id, product_id, kind, delta, employee)
  values (gen_random_uuid(), %L, 'in', -5, 'Testeur')$q$, current_setting('scandrinks_test.lipton')), '23514');
select pg_temp.expect_error(format($q$insert into public.movements (id, product_id, kind, delta, employee)
  values (gen_random_uuid(), %L, 'inventory', 3, 'Testeur')$q$, current_setting('scandrinks_test.lipton')), '23514');
select pg_temp.expect_error(format($q$insert into public.movements (id, product_id, kind, delta, counted, employee)
  values (gen_random_uuid(), %L, 'out', -3, 3, 'Testeur')$q$, current_setting('scandrinks_test.lipton')), '23514');

-- 20. Un prénom tapé avec une autre casse (« testeur ») ne crée pas de doublon dans la liste.
-- Dans une transaction, now() est la même pour tous : « testeur » est daté une minute plus tard.
insert into public.movements (id, product_id, kind, delta, employee, created_at)
  values (gen_random_uuid(), current_setting('scandrinks_test.lipton')::uuid, 'in', 1, 'testeur', now() + interval '1 minute');
do $$
begin
  if not public.list_employees() @> '["Testeur"]'::jsonb or public.list_employees() @> '["testeur"]'::jsonb then
    raise exception 'ÉCHEC : casse des prénoms (%)', public.list_employees();
  end if;
end
$$;

-- 21. Session fermée (« tous les téléphones déconnectés » après un changement de mot de passe)
-- ou expirée : tout est refusé avec PT401, que l'API rend en 401 (session expirée dans l'app),
-- même si le jeton n'a pas encore expiré. Les lectures aussi.
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000dead"}', true);
select pg_temp.expect_error('select 1 from public.product_stock', 'PT401');
select pg_temp.expect_error($q$select public.lookup_barcode('2000000000022')$q$, 'PT401');
reset role;
insert into auth.sessions (id, user_id, not_after)
  values ('00000000-0000-4000-8000-0000a1a1dead', '00000000-0000-4000-8000-0000000000a1', now() - interval '1 minute');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-0000a1a1dead"}', true);
select pg_temp.expect_error('select 1 from public.product_stock', 'PT401');
select pg_temp.expect_error($q$select public.lookup_barcode('2000000000022')$q$, 'PT401');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);

-- 22. Historique (§4.5) : du plus récent au plus ancien, page après page, tous produits
-- confondus, archivés compris. À heure égale, l'identifiant départage : aucune ligne sautée
-- ni répétée d'une page à l'autre. Ces quatre mouvements sont datés après tous les autres
-- (celui du cas 20 compris, à une minute), ceux de la vraie base aussi.
reset role;
insert into public.products (id, name, pack_size, alert_threshold, target_stock, archived)
  values ('00000000-0000-4000-8000-00000000a5a5', 'Oasis Tropical 33 cl', 24, 24, 48, true);
insert into public.movements (id, product_id, kind, delta, employee, created_at) values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-00000000c0ca', 'in', 1, 'Testeur', now() + interval '4 minutes'),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-00000000a5a5', 'in', 24, 'Testeuse', now() + interval '3 minutes'),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-00000000c0ca', 'out', -2, 'Testeur', now() + interval '2 minutes'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-00000000c0ca', 'out', -1, 'Testeur', now() + interval '2 minutes');
set local role authenticated;
do $$
declare
  page1 jsonb := public.list_history(null, null, 2);
  page2 jsonb;
  tie jsonb;
begin
  if jsonb_path_query_array(page1, '$[*].id')
       <> '["00000000-0000-4000-8000-000000001001", "00000000-0000-4000-8000-000000001002"]'::jsonb
     or (select array_agg(k order by k) from jsonb_object_keys(page1 -> 0) k) <> array['cancelled_at', 'cancelled_by', 'counted',
       'created_at', 'delta', 'employee', 'id', 'kind', 'product_id', 'product_name', 'sale_day']
     or page1 -> 0 ->> 'product_name' <> 'Coca-Cola 33 cl' or page1 -> 0 ->> 'employee' <> 'Testeur'
     or page1 -> 0 ->> 'kind' <> 'in' or (page1 -> 0 ->> 'delta')::int <> 1 or page1 -> 0 ->> 'cancelled_at' is not null
     or page1 -> 1 ->> 'product_name' <> 'Oasis Tropical 33 cl' then
    raise exception 'ÉCHEC : première page de l''historique (%)', page1;
  end if;
  page2 := public.list_history((page1 -> 1 ->> 'created_at')::timestamptz, (page1 -> 1 ->> 'id')::uuid, 2);
  if jsonb_path_query_array(page2, '$[*].id')
       <> '["00000000-0000-4000-8000-000000001004", "00000000-0000-4000-8000-000000001003"]'::jsonb then
    raise exception 'ÉCHEC : page suivante de l''historique (%)', page2;
  end if;
  if exists (select 1 from jsonb_array_elements(page1) a join jsonb_array_elements(page2) b on a ->> 'id' = b ->> 'id') then
    raise exception 'ÉCHEC : une ligne figure sur deux pages (%, %)', page1, page2;
  end if;
  tie := public.list_history((page2 -> 0 ->> 'created_at')::timestamptz, (page2 -> 0 ->> 'id')::uuid, 1);
  if jsonb_path_query_array(tie, '$[*].id') <> '["00000000-0000-4000-8000-000000001003"]'::jsonb then
    raise exception 'ÉCHEC : à heure égale, une ligne sautée (%)', tie;
  end if;
end
$$;
select pg_temp.expect_error('select public.list_history(null, null, 0)', 'invalid_input:limit');
select pg_temp.expect_error('select public.list_history(null, null, 101)', 'invalid_input:limit');
select pg_temp.expect_error('select public.list_history(null, null, null)', 'invalid_input:limit');
select pg_temp.expect_error('select public.list_history(now(), null, 10)', 'invalid_input:cursor');
select pg_temp.expect_error($q$select public.list_history(null, '00000000-0000-4000-8000-000000001001', 10)$q$, 'invalid_input:cursor');
set local role anon;
select pg_temp.expect_error('select public.list_history()', '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error('select public.list_history()', '42501');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);

-- 23. Annulation déjà faite (par un autre téléphone) : la réponse donne le premier auteur et
-- l'heure de l'annulation, le stock ne bouge plus, et l'historique la montre.
do $$
declare
  cancelled jsonb;
  again jsonb;
begin
  cancelled := public.cancel_movement('00000000-0000-4000-8000-000000001001', 'Testeur');
  again := public.cancel_movement('00000000-0000-4000-8000-000000001001', 'Testeuse');
  if cancelled ->> 'cancelled_by' is distinct from 'Testeur' or cancelled ->> 'cancelled_at' is null
     or again ->> 'cancelled_by' is distinct from 'Testeur' or again ->> 'cancelled_at' is distinct from cancelled ->> 'cancelled_at'
     or (again ->> 'stock')::int is distinct from (cancelled ->> 'stock')::int then
    raise exception 'ÉCHEC : annulation déjà faite (%, %)', cancelled, again;
  end if;
  if public.list_history(null, null, 1) -> 0 ->> 'cancelled_by' is distinct from 'Testeur' then
    raise exception 'ÉCHEC : annulation absente de l''historique (%)', public.list_history(null, null, 1);
  end if;
end
$$;

-- 24. Suppressions (p4) : refusées sans connexion ; un compte sans accès (B) ne retire rien.
-- Toute instruction de suppression reste dans une chaîne, exécutée par pg_temp.run.
set local role anon;
select pg_temp.expect_error('delete from public.barcodes', '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
do $$
begin
  if pg_temp.run('delete from public.barcodes') <> 0 then
    raise exception 'ÉCHEC : B a retiré des codes';
  end if;
end
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);

-- 25 à 29. Images des codes (§4.7, §6.3, §6.4). Mise en place, en tant que postgres : le produit
-- « Test images », le code de la canette, puis celui du pack, ajouté après lui (sans la préférence
-- du pack, l'image de la canette, plus ancienne, l'emporterait). Les noms des images sont tirés au hasard.
reset role;
insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values ('00000000-0000-4000-8000-00000000f070', 'Test images', 6, 6, 12);
insert into public.barcodes (code, product_id, units, created_at) values
  ('2000000000084', '00000000-0000-4000-8000-00000000f070', 1, now()),
  ('2000000000077', '00000000-0000-4000-8000-00000000f070', 6, now() + interval '1 minute');
select set_config('scandrinks_test.unit_photo', format('codes/2000000000084/%s.jpg', gen_random_uuid()), true),
  set_config('scandrinks_test.pack_photo', format('codes/2000000000077/%s.jpg', gen_random_uuid()), true);

-- 25. Le compartiment des images : privé, des JPEG de 256 Ko au plus.
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'photos' and name = 'photos' and not public
                 and file_size_limit = 262144 and allowed_mime_types = array['image/jpeg']) then
    raise exception 'ÉCHEC : compartiment photos (%)', (select to_jsonb(b) from storage.buckets b where b.id = 'photos');
  end if;
end
$$;

-- 26. Stockage : A ajoute puis lit les images ; sans connexion ou sans accès (B), ni ajout ni lecture ;
-- un nom hors de codes/<code>/<uuid>.jpg est refusé ; une image ne se modifie ni ne se supprime.
-- Toute instruction de suppression reste dans une chaîne, essayée par pg_temp.attempt.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
insert into storage.objects (bucket_id, name) values
  ('photos', current_setting('scandrinks_test.unit_photo')),
  ('photos', current_setting('scandrinks_test.pack_photo'));
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'photos'
      and name in (current_setting('scandrinks_test.unit_photo'), current_setting('scandrinks_test.pack_photo'))) <> 2 then
    raise exception 'ÉCHEC : A ne lit pas les images ajoutées';
  end if;
end
$$;
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('photos', 'autre/%s.jpg')$q$,
  gen_random_uuid()), '42501');
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('photos', 'codes/abc/%s.jpg')$q$,
  gen_random_uuid()), '42501');
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('photos', 'codes/2000000000084/%s.png')$q$,
  gen_random_uuid()), '42501');
select pg_temp.attempt(format($q$update storage.objects set name = 'codes/2000000000084/%s.jpg' where name = %L$q$,
  gen_random_uuid(), current_setting('scandrinks_test.unit_photo')));
select pg_temp.attempt(format($q$delete from storage.objects where name = %L$q$, current_setting('scandrinks_test.unit_photo')));
set local role anon;
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('photos', 'codes/2000000000084/%s.jpg')$q$,
  gen_random_uuid()), '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error(format($q$insert into storage.objects (bucket_id, name) values ('photos', 'codes/2000000000084/%s.jpg')$q$,
  gen_random_uuid()), '42501');
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'photos') then
    raise exception 'ÉCHEC : B voit les images';
  end if;
end
$$;
reset role;
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'photos' and name = current_setting('scandrinks_test.unit_photo')) then
    raise exception 'ÉCHEC : une image a été modifiée ou supprimée';
  end if;
end
$$;

-- 27. set_barcode_photo : l'image d'un code. Celle du produit est celle du code du pack, sinon celle
-- d'un autre code ; la recherche d'un code donne les deux. Rejouée, la fonction répond pareil.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
do $$
declare
  unit_photo text := current_setting('scandrinks_test.unit_photo');
  pack_photo text := current_setting('scandrinks_test.pack_photo');
  product_photo text;
  saved jsonb;
  replayed jsonb;
  found jsonb;
begin
  saved := public.set_barcode_photo('2000000000084', unit_photo, 'off');
  if saved <> jsonb_build_object('code', '2000000000084', 'photo_path', unit_photo, 'photo_source', 'off') then
    raise exception 'ÉCHEC : image du code de la canette (%)', saved;
  end if;
  select ps.photo_path into product_photo from public.product_stock ps where ps.id = '00000000-0000-4000-8000-00000000f070';
  if product_photo is distinct from unit_photo then
    raise exception 'ÉCHEC : sans image du pack, le produit prend celle de la canette (%)', product_photo;
  end if;
  perform public.set_barcode_photo('2000000000077', pack_photo, 'equipe');
  select ps.photo_path into product_photo from public.product_stock ps where ps.id = '00000000-0000-4000-8000-00000000f070';
  if product_photo is distinct from pack_photo then
    raise exception 'ÉCHEC : le produit prend l''image du pack (%)', product_photo;
  end if;
  found := public.lookup_barcode('2000000000084');
  if found ->> 'photo_path' is distinct from unit_photo or found ->> 'photo_source' is distinct from 'off'
     or found -> 'product' ->> 'photo_path' is distinct from pack_photo then
    raise exception 'ÉCHEC : recherche du code de la canette (%)', found;
  end if;
  replayed := public.set_barcode_photo('2000000000084', unit_photo, 'off');
  if replayed <> saved then
    raise exception 'ÉCHEC : enregistrement rejoué (%, %)', saved, replayed;
  end if;
end
$$;
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000091', 'codes/2000000000091/%s.jpg', 'off')$q$,
  gen_random_uuid()), 'invalid_input:code');
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000084', %L, 'autre')$q$,
  current_setting('scandrinks_test.unit_photo')), 'invalid_input:source');
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000084', %L, 'off')$q$,
  current_setting('scandrinks_test.pack_photo')), 'invalid_input:path');
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000084', 'codes/2000000000084/%s.jpg', 'off')$q$,
  gen_random_uuid()), 'invalid_input:photo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000084', %L, 'off')$q$,
  current_setting('scandrinks_test.unit_photo')), '42501');
set local role anon;
select pg_temp.expect_error(format($q$select public.set_barcode_photo('2000000000084', %L, 'off')$q$,
  current_setting('scandrinks_test.unit_photo')), '42501');

-- 28. Contraintes : un chemin d'un autre code, une provenance sans chemin ou un chemin sans provenance
-- sont refusés, même écrits directement.
reset role;
select pg_temp.expect_error(format($q$update public.barcodes set photo_path = %L where code = '2000000000084'$q$,
  current_setting('scandrinks_test.pack_photo')), '23514');
select pg_temp.expect_error($q$update public.barcodes set photo_path = null where code = '2000000000084'$q$, '23514');
select pg_temp.expect_error($q$update public.barcodes set photo_source = null where code = '2000000000084'$q$, '23514');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
select pg_temp.expect_error($q$update public.barcodes set photo_path = 'codes/2000000000084/pas-une-image.jpg'
  where code = '2000000000084'$q$, '23514');

-- 29. Sans image : la recherche du code et le produit le disent par un chemin vide.
do $$
declare
  found jsonb := public.lookup_barcode('2000000000015');
begin
  if not (found ? 'photo_path' and found ? 'photo_source' and found -> 'product' ? 'photo_path')
     or found ->> 'photo_path' is not null or found ->> 'photo_source' is not null then
    raise exception 'ÉCHEC : recherche d''un code sans image (%)', found;
  end if;
  if (select ps.photo_path from public.product_stock ps where ps.id = '00000000-0000-4000-8000-00000000c0ca') is not null then
    raise exception 'ÉCHEC : le Coca n''a pas d''image';
  end if;
end
$$;

-- 30 à 33. Fin de journée (§4.8, RG-14) : les ventes d'un jour, enregistrées par record_sales. Mise en place, en
-- tant que postgres : trois produits avec une entrée de 12 chacun, le jour de Paris (celui que la base prend pour
-- « aujourd'hui ») et deux aides, une ligne de fin de journée (la quantité en JSON, pour essayer aussi 1.5 ou null)
-- et ce jour.
reset role;
insert into public.products (id, name, pack_size, alert_threshold, target_stock) values
  ('00000000-0000-4000-8000-00000000f0a1', 'Test ventes A', 6, 6, 12),
  ('00000000-0000-4000-8000-00000000f0b1', 'Test ventes B', 6, 6, 12),
  ('00000000-0000-4000-8000-00000000f0c1', 'Test ventes C', 6, 6, 12);
insert into public.movements (id, product_id, kind, delta, employee) values
  ('00000000-0000-4000-8000-00000000e0a1', '00000000-0000-4000-8000-00000000f0a1', 'in', 12, 'Testeur'),
  ('00000000-0000-4000-8000-00000000e0b1', '00000000-0000-4000-8000-00000000f0b1', 'in', 12, 'Testeur'),
  ('00000000-0000-4000-8000-00000000e0c1', '00000000-0000-4000-8000-00000000f0c1', 'in', 12, 'Testeur');
select set_config('scandrinks_test.today', ((now() at time zone 'Europe/Paris')::date)::text, true);

create function pg_temp.line(p_id uuid, p_product uuid, p_quantity jsonb) returns jsonb
language sql
as $$
  select jsonb_build_object('id', p_id, 'product_id', p_product, 'quantity', p_quantity)
$$;

create function pg_temp.today() returns date
language sql
as $$
  select current_setting('scandrinks_test.today')::date
$$;

-- 30. Saisie (le stock baisse), rejeu, conflit, annulation puis nouvelle saisie.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
do $$
declare
  today date := pg_temp.today();
  a uuid := '00000000-0000-4000-8000-00000000f0a1';
  b uuid := '00000000-0000-4000-8000-00000000f0b1';
  c uuid := '00000000-0000-4000-8000-00000000f0c1';
  s1 uuid := '00000000-0000-4000-8000-0000000050a1';
  s2 uuid := '00000000-0000-4000-8000-0000000050b2';
  s3 uuid := '00000000-0000-4000-8000-0000000050a3';
  s4 uuid := '00000000-0000-4000-8000-0000000050c4';
  s5 uuid := '00000000-0000-4000-8000-0000000050a5';
  first_save jsonb := jsonb_build_array(pg_temp.line(s1, a, '3'), pg_temp.line(s2, b, '2'));
  result jsonb;
  sale public.movements%rowtype;
  stock_of jsonb;
begin
  result := public.record_sales(today, first_save, ' Testeur ');
  if result is distinct from '{"status": "recorded", "units": 5, "duplicate": false}'::jsonb then
    raise exception 'ÉCHEC : fin de journée (%)', result;
  end if;
  select jsonb_object_agg(ps.name, ps.stock) into stock_of from public.product_stock ps where ps.id in (a, b, c);
  if stock_of is distinct from '{"Test ventes A": 9, "Test ventes B": 10, "Test ventes C": 12}'::jsonb then
    raise exception 'ÉCHEC : stocks après la fin de journée (%)', stock_of;
  end if;
  select * into sale from public.movements where id = s1;
  if not found or sale.kind <> 'out' or sale.delta <> -3 or sale.sale_day is distinct from today or sale.barcode is not null
     or sale.employee <> 'Testeur' or sale.counted is not null or sale.cancelled_at is not null then
    raise exception 'ÉCHEC : ligne de vente (%)', to_jsonb(sale);
  end if;

  -- Rejouée (réponse perdue, « Réessayer ») : la même réponse, rien n'est compté deux fois.
  result := public.record_sales(today, first_save, 'Testeur');
  if result is distinct from '{"status": "recorded", "units": 5, "duplicate": true}'::jsonb then
    raise exception 'ÉCHEC : fin de journée rejouée (%)', result;
  end if;
  -- Rejouée avec une autre quantité : c'est ce qui avait été enregistré qui compte.
  result := public.record_sales(today, jsonb_build_array(pg_temp.line(s1, a, '4')), 'Testeur');
  if result is distinct from '{"status": "recorded", "units": 3, "duplicate": true}'::jsonb then
    raise exception 'ÉCHEC : fin de journée rejouée, quantité changée (%)', result;
  end if;

  -- A a déjà sa vente du jour : rien n'est enregistré, pas même la ligne de C.
  result := public.record_sales(today, jsonb_build_array(pg_temp.line(s3, a, '1'), pg_temp.line(s4, c, '2')), 'Testeur');
  if result is distinct from '{"status": "already_recorded", "products": ["Test ventes A"]}'::jsonb then
    raise exception 'ÉCHEC : vente déjà saisie (%)', result;
  end if;
  if exists (select 1 from public.movements where id in (s3, s4)) then
    raise exception 'ÉCHEC : une ligne a été enregistrée malgré le conflit';
  end if;
  select jsonb_object_agg(ps.name, ps.stock) into stock_of from public.product_stock ps where ps.id in (a, b, c);
  if stock_of is distinct from '{"Test ventes A": 9, "Test ventes B": 10, "Test ventes C": 12}'::jsonb then
    raise exception 'ÉCHEC : stocks après le conflit (%)', stock_of;
  end if;

  -- Annulée dans l'Historique, la vente de A se saisit de nouveau.
  perform public.cancel_movement(s1, 'Testeur');
  result := public.record_sales(today, jsonb_build_array(pg_temp.line(s5, a, '1')), 'Testeur');
  if result is distinct from '{"status": "recorded", "units": 1, "duplicate": false}'::jsonb then
    raise exception 'ÉCHEC : nouvelle saisie après annulation (%)', result;
  end if;
  if (select ps.stock from public.product_stock ps where ps.id = a) is distinct from 11 then
    raise exception 'ÉCHEC : stock de A après annulation puis nouvelle saisie (%)',
      (select ps.stock from public.product_stock ps where ps.id = a);
  end if;
end
$$;

-- 31. Bornes (RG-14) : les 7 derniers jours de Paris, de 1 à 999 par produit, une ligne par produit.
do $$
declare
  result jsonb := public.record_sales(pg_temp.today() - 6,
    jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000050c6', '00000000-0000-4000-8000-00000000f0c1', '1')), 'Testeur');
begin
  if result ->> 'status' is distinct from 'recorded' then
    raise exception 'ÉCHEC : le 7e jour (aujourd''hui − 6) est refusé (%)', result;
  end if;
end
$$;
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today() - 7,
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), 'Testeur')$q$, 'invalid_input:day');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today() + 1,
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), 'Testeur')$q$, 'invalid_input:day');
select pg_temp.expect_error($q$select public.record_sales(null,
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), 'Testeur')$q$, 'invalid_input:day');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '0')), 'Testeur')$q$, 'invalid_input:quantity');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1000')), 'Testeur')$q$, 'invalid_input:quantity');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1.5')), 'Testeur')$q$, '22P02');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(), '[]', 'Testeur')$q$, 'invalid_input:lines');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(), '{}', 'Testeur')$q$, 'invalid_input:lines');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(), jsonb_build_array(
  pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1'),
  pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '2')), 'Testeur')$q$, 'invalid_input:lines');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(), jsonb_build_array(
  pg_temp.line('00000000-0000-4000-8000-0000000050d7', '00000000-0000-4000-8000-00000000f0c1', '1'),
  pg_temp.line('00000000-0000-4000-8000-0000000050d7', '00000000-0000-4000-8000-00000000c0ca', '1')), 'Testeur')$q$,
  'invalid_input:lines');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), gen_random_uuid(), '1')), 'Testeur')$q$, 'invalid_input:product');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(null, '00000000-0000-4000-8000-00000000f0c1', '1')), 'Testeur')$q$, 'invalid_input:id');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000050b2', '00000000-0000-4000-8000-00000000f0a1', '2')), 'Testeur')$q$,
  'invalid_input:id');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today() - 1,
  jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000050b2', '00000000-0000-4000-8000-00000000f0b1', '2')), 'Testeur')$q$,
  'invalid_input:id');
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), '  ')$q$, 'invalid_input:employee');

-- 32. Droits et contraintes : sans connexion ou sans accès (B), rien ; écrites directement, une entrée ne porte pas de
-- jour de ventes, et un produit n'a qu'une vente active par jour ; le jour d'une vente ne se modifie pas.
set local role anon;
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), 'Intrus')$q$, '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error($q$select public.record_sales(pg_temp.today(),
  jsonb_build_array(pg_temp.line(gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', '1')), 'Intrus')$q$, '42501');
reset role;
select pg_temp.expect_error($q$insert into public.movements (id, product_id, kind, delta, employee, sale_day)
  values (gen_random_uuid(), '00000000-0000-4000-8000-00000000f0c1', 'in', 1, 'Testeur', pg_temp.today())$q$, '23514');
select pg_temp.expect_error($q$insert into public.movements (id, product_id, kind, delta, employee, sale_day)
  values (gen_random_uuid(), '00000000-0000-4000-8000-00000000f0b1', 'out', -1, 'Testeur', pg_temp.today())$q$, '23505');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
select pg_temp.expect_error($q$update public.movements set sale_day = pg_temp.today() - 1
  where id = '00000000-0000-4000-8000-0000000050b2'$q$, '42501');

-- 33. Historique (§4.5) : chaque ligne donne son jour de ventes, vide pour un autre mouvement.
do $$
declare
  history jsonb := public.list_history(null, null, 100);
  sale jsonb;
  entry jsonb;
begin
  select h into sale from jsonb_array_elements(history) h where h ->> 'id' = '00000000-0000-4000-8000-0000000050b2';
  select h into entry from jsonb_array_elements(history) h where h ->> 'id' = '00000000-0000-4000-8000-00000000e0b1';
  if sale ->> 'sale_day' is distinct from pg_temp.today()::text then
    raise exception 'ÉCHEC : jour de ventes absent de l''historique (%)', sale;
  end if;
  if entry is null or not entry ? 'sale_day' or entry -> 'sale_day' is distinct from 'null'::jsonb then
    raise exception 'ÉCHEC : une entrée de l''historique sans jour de ventes vide (%)', entry;
  end if;
end
$$;

-- 34 à 36. Suppression définitive (RG-15, jalon 6). Mise en place, en tant que postgres : le produit D, avec le code
-- de son pack (une image au stockage) et celui de sa canette, et des mouvements de toutes sortes (entrée, sortie
-- annulée, inventaire, vente du jour) ; le produit E, témoin, avec son entrée.
reset role;
select set_config('scandrinks_test.deleted_photo', format('codes/2000000000091/%s.jpg', gen_random_uuid()), true);
insert into public.products (id, name, pack_size, alert_threshold, target_stock) values
  ('00000000-0000-4000-8000-00000000d0d1', 'Test suppression', 6, 6, 12),
  ('00000000-0000-4000-8000-00000000e0e1', 'Témoin suppression', 6, 6, 12);
insert into storage.objects (bucket_id, name) values ('photos', current_setting('scandrinks_test.deleted_photo'));
insert into public.barcodes (code, product_id, units, photo_path, photo_source) values
  ('2000000000091', '00000000-0000-4000-8000-00000000d0d1', 6, current_setting('scandrinks_test.deleted_photo'), 'equipe'),
  ('2000000000107', '00000000-0000-4000-8000-00000000d0d1', 1, null, null);
insert into public.movements (id, product_id, kind, delta, barcode, counted, employee, cancelled_at, cancelled_by, sale_day) values
  ('00000000-0000-4000-8000-00000000d1e1', '00000000-0000-4000-8000-00000000d0d1', 'in', 6, '2000000000091', null, 'Testeur', null, null, null),
  ('00000000-0000-4000-8000-00000000d1e2', '00000000-0000-4000-8000-00000000d0d1', 'out', -1, '2000000000107', null, 'Testeur', now(), 'Testeur', null),
  ('00000000-0000-4000-8000-00000000d1e3', '00000000-0000-4000-8000-00000000d0d1', 'inventory', -2, null, 4, 'Testeur', null, null, null),
  ('00000000-0000-4000-8000-00000000d1e4', '00000000-0000-4000-8000-00000000d0d1', 'out', -1, null, null, 'Testeur', null, null, pg_temp.today()),
  ('00000000-0000-4000-8000-00000000e1e1', '00000000-0000-4000-8000-00000000e0e1', 'in', 12, null, null, 'Testeur', null, null, null);

-- 34. Droits : sans connexion ou sans accès (B), la suppression est refusée, même par la fonction qui efface ;
-- un identifiant vide aussi. D reste entier, et l'Historique montre ses lignes.
set local role anon;
select pg_temp.expect_error($q$select public.delete_product('00000000-0000-4000-8000-00000000d0d1')$q$, '42501');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000b2b2"}', true);
select pg_temp.expect_error($q$select public.delete_product('00000000-0000-4000-8000-00000000d0d1')$q$, '42501');
select pg_temp.expect_error($q$select private.erase_product('00000000-0000-4000-8000-00000000d0d1')$q$, '42501');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","session_id":"00000000-0000-4000-8000-00000000a1a1"}', true);
select pg_temp.expect_error($q$select public.delete_product(null)$q$, 'invalid_input:product');
do $$
declare
  d uuid := '00000000-0000-4000-8000-00000000d0d1';
begin
  if (select count(*) from public.products where id = d) <> 1
     or (select count(*) from public.barcodes where product_id = d) <> 2
     or (select count(*) from public.movements where product_id = d) <> 4 then
    raise exception 'ÉCHEC : une suppression refusée a entamé D';
  end if;
  if not exists (select 1 from jsonb_array_elements(public.list_history(null, null, 100)) h where h ->> 'product_id' = d::text) then
    raise exception 'ÉCHEC : l''Historique ne montre pas les lignes de D avant sa suppression';
  end if;
end
$$;

-- 35. Effacement (RG-15), en tant que A : la fiche, ses codes et tous ses mouvements, annulés et ventes compris. E ne
-- bouge pas. Rejouée, ou pour un produit inconnu, la suppression répond pareil. Le code effacé est de nouveau libre.
do $$
declare
  d uuid := '00000000-0000-4000-8000-00000000d0d1';
  e uuid := '00000000-0000-4000-8000-00000000e0e1';
  result jsonb;
begin
  result := public.delete_product(d);
  if result is distinct from '{"status": "deleted"}'::jsonb then
    raise exception 'ÉCHEC : suppression (%)', result;
  end if;
  if exists (select 1 from public.products where id = d) or exists (select 1 from public.product_stock where id = d) then
    raise exception 'ÉCHEC : la fiche supprimée existe encore';
  end if;
  if exists (select 1 from public.barcodes where product_id = d or code in ('2000000000091', '2000000000107')) then
    raise exception 'ÉCHEC : un code du produit supprimé existe encore';
  end if;
  if exists (select 1 from public.movements where product_id = d) then
    raise exception 'ÉCHEC : un mouvement du produit supprimé existe encore';
  end if;
  if public.lookup_barcode('2000000000091') is not null then
    raise exception 'ÉCHEC : le code du produit supprimé désigne encore un produit';
  end if;
  if (select stock from public.product_stock where id = e) is distinct from 12
     or (select count(*) from public.movements where product_id = e) <> 1 then
    raise exception 'ÉCHEC : la suppression a touché un autre produit';
  end if;
  if public.delete_product(d) is distinct from '{"status": "deleted"}'::jsonb
     or public.delete_product(gen_random_uuid()) is distinct from '{"status": "deleted"}'::jsonb then
    raise exception 'ÉCHEC : une suppression rejouée ne répond pas pareil';
  end if;
  perform public.create_product('Recréé', 6, 6, 12, '[{"code":"2000000000091","units":6}]');
  if not exists (select 1 from public.barcodes b join public.products p on p.id = b.product_id
                 where b.code = '2000000000091' and p.name = 'Recréé') then
    raise exception 'ÉCHEC : le code du produit supprimé n''est pas de nouveau libre';
  end if;
end
$$;

-- 36. Historique : plus aucune ligne du produit supprimé. Son image, elle, reste au stockage (RG-15).
do $$
begin
  if exists (select 1 from jsonb_array_elements(public.list_history(null, null, 100)) h
             where h ->> 'product_id' = '00000000-0000-4000-8000-00000000d0d1') then
    raise exception 'ÉCHEC : l''Historique montre encore une ligne du produit supprimé';
  end if;
end
$$;
reset role;
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'photos' and name = current_setting('scandrinks_test.deleted_photo')) then
    raise exception 'ÉCHEC : l''image du produit supprimé a quitté le stockage';
  end if;
end
$$;

reset role;
rollback;

select 'OK' as resultat;
