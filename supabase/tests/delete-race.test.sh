#!/usr/bin/env bash
# delete-race.test.sh — Une suppression de produit en même temps qu'un autre enregistrement, sur le PostgreSQL local.
#
# Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (RG-15, §6.3, §7, §8 « Jalon 6 »)
#
# Sur une base jetable, deux sessions simultanées ; la première garde son verrou 2 secondes :
#   1. un scan validé, puis la suppression : le scan passe, puis il est effacé avec le produit ;
#   2. la suppression, puis un scan : le scan attend son tour, puis il est refusé (« produit » inconnu) ;
#   3. la suppression, puis un code ajouté : l'ajout attend son tour, puis la clé étrangère le refuse ;
#   4. une annulation dans l'Historique commencée, puis la suppression : elle attend l'annulation, sans s'interbloquer ;
#   5. la suppression, puis une annulation : l'annulation attend son tour, puis elle est refusée (mouvement inconnu).
# Jamais de mouvement ni de code orphelin. Ne touche jamais au vrai projet Supabase. À lancer avec un compte qui peut
# créer des bases (run-local.sh le lance) :
#   su postgres -c "bash supabase/tests/delete-race.test.sh"
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)

fail() {
  echo "ÉCHEC : $*" >&2
  exit 1
}

# Une base neuve et vide (sans l'avis « n'existe pas » la première fois).
fresh() {
  PGOPTIONS='-c client_min_messages=warning' "${PSQL[@]}" -d postgres -c "drop database if exists $1" -c "create database $1"
}

# Une base ScanDrinks : l'imitation de Supabase, puis les migrations.
scandrinks() {
  fresh "$1"
  "${PSQL[@]}" -d "$1" -f "$ROOT/supabase/tests/supabase-stub.sql"
  for migration in "$ROOT"/supabase/migrations/*.sql; do
    "${PSQL[@]}" -d "$1" -f "$migration"
  done
}

# Le résultat d'une requête, sans en-tête, colonnes séparées par « | ».
value() {
  psql -X -q -At -v ON_ERROR_STOP=1 -d "$1" -c "$2"
}

# expect_equal <attendu> <obtenu> <ce qui est vérifié>
expect_equal() {
  [[ "$2" == "$1" ]] || fail "$3 : « $2 », attendu « $1 »"
}

# expect_contains <attendu> <obtenu> <ce qui est vérifié>
expect_contains() {
  [[ "$2" == *"$1"* ]] || fail "$3 : « $2 », attendu un texte qui contient « $1 »"
}

DB=scandrinks_delete_race
P1=00000000-0000-4000-8000-0000000000c1
P2=00000000-0000-4000-8000-0000000000c2
P3=00000000-0000-4000-8000-0000000000c3
P4=00000000-0000-4000-8000-0000000000c4
P5=00000000-0000-4000-8000-0000000000c5
M4=00000000-0000-4000-8000-0000000000e4
M5=00000000-0000-4000-8000-0000000000e5
scandrinks "$DB"
"${PSQL[@]}" -d "$DB" <<SQL
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'tabac@test.invalid');
insert into auth.sessions (id, user_id) values ('00000000-0000-4000-8000-00000000a1a1', '00000000-0000-4000-8000-0000000000a1');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock) values
  ('$P1', 'Course scan avant', 24, 24, 48),
  ('$P2', 'Course scan après', 24, 24, 48),
  ('$P3', 'Course code après', 24, 24, 48),
  ('$P4', 'Course annulation avant', 24, 24, 48),
  ('$P5', 'Course annulation après', 24, 24, 48);
insert into public.movements (id, product_id, kind, delta, employee) values
  ('00000000-0000-4000-8000-0000000000e1', '$P1', 'in', 12, 'Testeur'),
  ('00000000-0000-4000-8000-0000000000e2', '$P2', 'in', 12, 'Testeur'),
  ('00000000-0000-4000-8000-0000000000e3', '$P3', 'in', 12, 'Testeur'),
  ('$M4', '$P4', 'in', 12, 'Testeur'),
  ('$M5', '$P5', 'in', 12, 'Testeur');
SQL

# Le compte du tabac, connecté : rien ne s'affiche avant la réponse de la fonction appelée.
SESSION="set role authenticated; set request.jwt.claims = '{\"sub\":\"00000000-0000-4000-8000-0000000000a1\",\"role\":\"authenticated\",\"session_id\":\"00000000-0000-4000-8000-00000000a1a1\"}';"

# Une entrée d'une unité, sans code : scan <produit> <identifiant>.
scan() {
  echo "public.record_movement('$2', '$1', null, 'in', 1, 1, 'Testeur')"
}

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

# race <appel 1> <appel 2> : la session 1 fait l'appel 1 et garde son verrou 2 s ; la session 2 fait l'appel 2,
# 0,5 s après elle. La session 2 peut échouer sans arrêter le script : SECOND garde sa sortie, erreur comprise.
# FIRST garde la réponse de la session 1.
race() {
  psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "begin; $SESSION select $1; select pg_sleep(2); commit;" >"$OUT" 2>&1 &
  local first_pid=$!
  sleep 0.5
  SECOND="$(psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "$SESSION select $2;" 2>&1 || true)"
  wait "$first_pid" || fail "la session 1 a échoué : $(cat "$OUT")"
  FIRST="$(grep -m1 '^{' "$OUT" || true)"
}

# 1. Un scan validé, puis la suppression : elle attend le scan, puis l'efface avec le produit.
race "$(scan "$P1" 00000000-0000-4000-8000-0000000000f1)" "public.delete_product('$P1')"
expect_contains '"duplicate": false' "$FIRST" "scan avant la suppression, session 1"
expect_equal '{"status": "deleted"}' "$SECOND" "suppression après un scan, session 2"
expect_equal "0" "$(value "$DB" "select count(*) from public.movements where product_id = '$P1'")" "mouvements du produit supprimé après un scan"
expect_equal "0" "$(value "$DB" "select count(*) from public.products where id = '$P1'")" "produit supprimé après un scan"

# 2. La suppression, puis un scan : il attend la suppression, puis il est refusé.
race "public.delete_product('$P2')" "$(scan "$P2" 00000000-0000-4000-8000-0000000000f2)"
expect_equal '{"status": "deleted"}' "$FIRST" "suppression avant un scan, session 1"
expect_contains 'invalid_input:product' "$SECOND" "scan après la suppression, session 2"
expect_equal "0" "$(value "$DB" "select count(*) from public.movements where product_id = '$P2'")" "mouvements du produit supprimé avant un scan"

# 3. La suppression, puis un code ajouté : il attend la suppression, puis la clé étrangère le refuse.
race "public.delete_product('$P3')" "public.attach_barcode('2000000000114', '$P3', 1, false)"
expect_equal '{"status": "deleted"}' "$FIRST" "suppression avant un code ajouté, session 1"
expect_contains 'violates foreign key constraint' "$SECOND" "code ajouté après la suppression, session 2"
expect_equal "0" "$(value "$DB" "select count(*) from public.barcodes where code = '2000000000114'")" "code ajouté au produit supprimé"

# 4. Une annulation dans l'Historique commencée, puis la suppression du même produit. cancel_movement verrouille le
# mouvement, puis son produit : la session 1 prend d'abord ce verrou du mouvement, attend 1 s, puis annule. La
# suppression, arrivée entre-temps, doit attendre la fin de l'annulation, jamais s'interbloquer avec elle.
psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "begin; $SESSION select 1 from public.movements where id = '$M4' for update;
  select pg_sleep(1); select public.cancel_movement('$M4', 'Testeur'); select pg_sleep(1); commit;" >"$OUT" 2>&1 &
first_pid=$!
sleep 0.5
SECOND="$(psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "$SESSION select public.delete_product('$P4');" 2>&1 || true)"
wait "$first_pid" || fail "la session 1 (annulation) a échoué : $(cat "$OUT")"
FIRST="$(grep -m1 '^{' "$OUT" || true)"
expect_contains '"cancelled_by": "Testeur"' "$FIRST" "annulation commencée avant la suppression, session 1"
expect_equal '{"status": "deleted"}' "$SECOND" "suppression pendant une annulation, session 2"
expect_equal "0" "$(value "$DB" "select count(*) from public.movements where product_id = '$P4'")" "mouvements du produit supprimé pendant une annulation"
expect_equal "0" "$(value "$DB" "select count(*) from public.products where id = '$P4'")" "produit supprimé pendant une annulation"

# 5. La suppression, puis une annulation : elle attend la suppression, puis elle est refusée.
race "public.delete_product('$P5')" "public.cancel_movement('$M5', 'Testeur')"
expect_equal '{"status": "deleted"}' "$FIRST" "suppression avant une annulation, session 1"
expect_contains 'invalid_input:movement' "$SECOND" "annulation après la suppression, session 2"

"${PSQL[@]}" -d postgres -c "drop database $DB"
echo "Suppression en course OK"
