-- database.test.sql — Tests de la base ScanDrinks (jalons 1 et 2).
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§5, §6.3, §6.4, §8)
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

-- Mise en place, en tant que postgres : A est le compte du tabac, B un compte inconnu.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'compte-a@test.invalid'),
  ('00000000-0000-4000-8000-0000000000b2', 'compte-b@test.invalid');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock)
  values ('00000000-0000-4000-8000-00000000c0ca', 'Coca-Cola 33 cl', 24, 24, 48);
insert into public.barcodes (code, product_id, units)
  values ('2000000000015', '00000000-0000-4000-8000-00000000c0ca', 1);
insert into public.movements (id, product_id, kind, delta, barcode, employee)
  values ('00000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-00000000c0ca', 'in', 24, '2000000000015', 'Sam');

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
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
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
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
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
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 12, 2, 'Sam');
  if (result ->> 'delta')::int <> 24 or (result ->> 'stock')::int <> 24 or (result ->> 'duplicate')::boolean then
    raise exception 'ÉCHEC : entrée de 2 packs (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 12, 2, 'Sam');
  if not (result ->> 'duplicate')::boolean or (result ->> 'stock')::int <> 24 or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : envoi répété (%)', result;
  end if;
  if (select count(*) from public.movements where id = '00000000-0000-4000-8000-0000000000d1') <> 1 then
    raise exception 'ÉCHEC : doublon enregistré';
  end if;
  -- Renvoi tardif, alors que la saisie a changé entre-temps : on renvoie le premier enregistrement, sans contrôle.
  result := public.record_movement('00000000-0000-4000-8000-0000000000d1', lipton, '2000000000022', 'in', 24, 5, 'Sam');
  if not (result ->> 'duplicate')::boolean or (result ->> 'delta')::int <> 24 then
    raise exception 'ÉCHEC : renvoi tardif (%)', result;
  end if;

  result := public.record_movement('00000000-0000-4000-8000-0000000000d2', lipton, '2000000000039', 'out', 1, 6, 'Sam');
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
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 24, 1, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:units');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000015', 'in', 1, 1, 'Sam')$q$,
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

-- 10. Valeurs refusées.
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 12, 0, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'in', 12, 100, 'Sam')$q$,
  current_setting('scandrinks_test.lipton')), 'invalid_input:quantity');
select pg_temp.expect_error(format($q$select public.record_movement(gen_random_uuid(), %L, '2000000000022', 'inventory', 12, 1, 'Sam')$q$,
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
  if not public.list_employees() @> '["Sam"]'::jsonb then
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
  result := public.record_inventory('00000000-0000-4000-8000-0000000000e1', coca, 20, 'Sam');
  if (result ->> 'delta')::int <> -4 or (result ->> 'stock')::int <> 20 or (result ->> 'counted')::int <> 20
     or (result ->> 'duplicate')::boolean then
    raise exception 'ÉCHEC : inventaire (%)', result;
  end if;
  select * into inv from public.movements where id = '00000000-0000-4000-8000-0000000000e1';
  if inv.kind is distinct from 'inventory' or inv.counted is distinct from 20 or inv.barcode is not null then
    raise exception 'ÉCHEC : ligne d''inventaire (%)', to_jsonb(inv);
  end if;
  result := public.record_inventory('00000000-0000-4000-8000-0000000000e1', coca, 99, 'Sam');
  if not (result ->> 'duplicate')::boolean or (result ->> 'delta')::int <> -4 or (result ->> 'counted')::int <> 20
     or (result ->> 'stock')::int <> 20 then
    raise exception 'ÉCHEC : inventaire rejoué (%)', result;
  end if;
end
$$;
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', -1, 'Sam')$q$,
  'invalid_input:counted');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 10000, 'Sam')$q$,
  'invalid_input:counted');
select pg_temp.expect_error($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-0000000000ff', 5, 'Sam')$q$,
  'invalid_input:product');
select pg_temp.expect_error(format($q$select public.record_inventory(gen_random_uuid(), '00000000-0000-4000-8000-00000000c0ca', 5, %L)$q$,
  repeat('x', 31)), 'invalid_input:employee');
do $$
begin
  if (public.cancel_movement('00000000-0000-4000-8000-0000000000e1', 'Sam') ->> 'stock')::int <> 24 then
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
  values (gen_random_uuid(), %L, 'in', -5, 'Sam')$q$, current_setting('scandrinks_test.lipton')), '23514');
select pg_temp.expect_error(format($q$insert into public.movements (id, product_id, kind, delta, employee)
  values (gen_random_uuid(), %L, 'inventory', 3, 'Sam')$q$, current_setting('scandrinks_test.lipton')), '23514');
select pg_temp.expect_error(format($q$insert into public.movements (id, product_id, kind, delta, counted, employee)
  values (gen_random_uuid(), %L, 'out', -3, 3, 'Sam')$q$, current_setting('scandrinks_test.lipton')), '23514');

-- 20. Un prénom tapé avec une autre casse (« sam ») ne crée pas de doublon dans la liste.
-- Dans une transaction, now() est la même pour tous : « sam » est daté une minute plus tard.
insert into public.movements (id, product_id, kind, delta, employee, created_at)
  values (gen_random_uuid(), current_setting('scandrinks_test.lipton')::uuid, 'in', 1, 'sam', now() + interval '1 minute');
do $$
begin
  if not public.list_employees() @> '["Sam"]'::jsonb or public.list_employees() @> '["sam"]'::jsonb then
    raise exception 'ÉCHEC : casse des prénoms (%)', public.list_employees();
  end if;
end
$$;

reset role;
rollback;

select 'OK' as resultat;
