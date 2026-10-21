-- remise-a-zero.sql — Remise à zéro de ScanDrinks, le matin du jour J, avant l'inventaire du premier jour.
--
-- Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service », « La remise à zéro »)
--
-- CE QUE FAIT CE SCRIPT
--   Il efface tous les produits, tous les codes-barres et tous les mouvements (l'Historique) : la base repart
--   vide, et chaque fiche se recrée au premier scan.
--   Il garde le compte du tabac : ni la liste des comptes autorisés (allowed_users) ni les comptes de connexion
--   (Supabase Auth) ne sont touchés. Les téléphones restent connectés.
--   Les fichiers des images restent dans le stockage : plus aucun code n'y renvoie, ils ne s'affichent plus.
--   Supabase n'efface pas un fichier par une requête SQL.
--
-- QUAND ET OÙ LE LANCER
--   Le matin du jour J, avant l'inventaire. C'est le porteur du projet qui le lance, jamais Claude :
--   tableau de bord Supabase › organisation « ScanDrinks » › projet « scandrinks » (jamais « Webia »)
--   › SQL Editor › nouvelle requête. Coller tout ce fichier, toucher « Run », puis confirmer l'avertissement
--   d'opération destructive.
--
-- SÉCURITÉS
--   - Il vérifie d'abord qu'il tourne sur ScanDrinks, en y cherchant ses tables et ses fonctions. Sur un autre
--     projet, il s'arrête de lui-même, sans rien toucher.
--   - Sans compte du tabac dans allowed_users, il s'arrête aussi, sans rien toucher.
--   - Tout se fait en une seule transaction : au moindre problème, rien n'est effacé et l'éditeur affiche le
--     message d'arrêt.
--   - Relancé, il ne change rien.
--
-- RÉSULTAT ATTENDU, sur une seule ligne :
--   « Remise à zéro faite : N produit(s), N code(s) et N mouvement(s) effacés. Compte du tabac gardé (1). »

begin;

-- Le bilan, lu à la fin. Vidé d'abord : l'éditeur SQL peut garder la session d'un lancement précédent.
create temporary table if not exists reset_report (products bigint, barcodes bigint, movements bigint, accounts bigint);
delete from reset_report;

do $$
declare
  accounts_before bigint;
  deleted_movements bigint;
  deleted_barcodes bigint;
  deleted_products bigint;
begin
  -- Garde 1 : les tables et les fonctions de ScanDrinks sont là.
  if to_regclass('public.products') is null or to_regclass('public.barcodes') is null
     or to_regclass('public.movements') is null or to_regclass('public.allowed_users') is null
     or (select count(distinct p.proname) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('record_movement', 'record_inventory', 'list_history')) <> 3 then
    raise exception 'Arrêt : ce projet n''est pas ScanDrinks. Rien n''a été effacé. Choisis le projet « scandrinks », puis relance.';
  end if;

  -- Garde 2 : le compte du tabac est inscrit.
  select count(*) into accounts_before from public.allowed_users;
  if accounts_before = 0 then
    raise exception 'Arrêt : aucun compte du tabac dans allowed_users. Rien n''a été effacé.';
  end if;

  -- Effacement, dans l'ordre des liens entre les tables : les mouvements et les codes renvoient aux produits.
  delete from public.movements;
  get diagnostics deleted_movements = row_count;
  delete from public.barcodes;
  get diagnostics deleted_barcodes = row_count;
  delete from public.products;
  get diagnostics deleted_products = row_count;

  -- Vérification : les trois tables sont vides, et le compte du tabac n'a pas bougé.
  if exists (select 1 from public.movements) or exists (select 1 from public.barcodes) or exists (select 1 from public.products)
     or (select count(*) from public.allowed_users) <> accounts_before then
    raise exception 'Arrêt : vérification ratée. Rien n''a été effacé.';
  end if;

  insert into reset_report values (deleted_products, deleted_barcodes, deleted_movements, accounts_before);
end
$$;

commit;

select format('Remise à zéro faite : %s produit(s), %s code(s) et %s mouvement(s) effacés. Compte du tabac gardé (%s).',
  products, barcodes, movements, accounts) as resultat
from reset_report;
