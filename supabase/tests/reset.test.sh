#!/usr/bin/env bash
# reset.test.sh — Teste la remise à zéro du jour J (supabase/remise-a-zero.sql) sur le PostgreSQL local.
#
# Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§8, §9 « Mise en service », « La remise à zéro »)
#
# Sur des bases jetables, quatre cas :
#   1. ScanDrinks avec des données : tout est effacé sauf le compte du tabac, et le bilan le dit ;
#   2. relancée : rien ne change ;
#   3. un autre projet : arrêt, rien n'est touché ; de même pour un « sosie », qui aurait les mêmes tables sans les fonctions ;
#   4. ScanDrinks sans compte autorisé : arrêt, rien n'est touché.
# Ne touche jamais au vrai projet Supabase. À lancer avec un compte qui peut créer des bases (run-local.sh le lance) :
#   su postgres -c "bash supabase/tests/reset.test.sh"
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RESET="$ROOT/supabase/remise-a-zero.sql"
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

# La remise à zéro, lancée comme dans l'éditeur SQL : sa sortie (le bilan, ou le message d'arrêt) et son code de sortie.
run_reset() {
  psql -X -q -At -v ON_ERROR_STOP=1 -d "$1" -f "$RESET" 2>&1
}

# expect_equal <attendu> <obtenu> <ce qui est vérifié>
expect_equal() {
  [[ "$2" == "$1" ]] || fail "$3 : « $2 », attendu « $1 »"
}

[[ -f "$RESET" ]] || fail "script absent : $RESET"

# 1. ScanDrinks avec des données : un compte autorisé, 2 produits, 3 codes et 4 mouvements, dont un annulé.
DB=scandrinks_reset
scandrinks "$DB"
"${PSQL[@]}" -d "$DB" <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'tabac@test.invalid');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock) values
  ('00000000-0000-4000-8000-00000000c0ca', 'Coca-Cola 33 cl', 24, 24, 48),
  ('00000000-0000-4000-8000-0000000011b0', 'Lipton Pêche 50 cl', 12, 12, 24);
insert into public.barcodes (code, product_id, units) values
  ('2000000000015', '00000000-0000-4000-8000-00000000c0ca', 24),
  ('2000000000022', '00000000-0000-4000-8000-00000000c0ca', 1),
  ('2000000000039', '00000000-0000-4000-8000-0000000011b0', 12);
insert into public.movements (id, product_id, kind, delta, barcode, counted, employee, cancelled_at, cancelled_by) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000c0ca', 'in', 24, '2000000000015', null, 'Sam', null, null),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-00000000c0ca', 'out', -1, '2000000000022', null, 'Léa', null, null),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000011b0', 'in', 12, '2000000000039', null, 'Sam', now(), 'Léa'),
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000011b0', 'inventory', 3, null, 3, 'Léa', null, null);
SQL
out=$(run_reset "$DB") || fail "remise à zéro en erreur : $out"
expect_equal "Remise à zéro faite : 2 produit(s), 3 code(s) et 4 mouvement(s) effacés. Compte du tabac gardé (1)." "$out" "bilan"
counts="select (select count(*) from public.products), (select count(*) from public.barcodes), (select count(*) from public.movements),
  (select count(*) from public.allowed_users), (select count(*) from auth.users)"
expect_equal "0|0|0|1|1" "$(value "$DB" "$counts")" "produits|codes|mouvements|comptes autorisés|comptes de connexion"

# 2. Relancée : rien ne change.
out=$(run_reset "$DB") || fail "seconde remise à zéro en erreur : $out"
expect_equal "Remise à zéro faite : 0 produit(s), 0 code(s) et 0 mouvement(s) effacés. Compte du tabac gardé (1)." "$out" "bilan relancé"
expect_equal "0|0|0|1|1" "$(value "$DB" "$counts")" "produits|codes|mouvements|comptes autorisés|comptes de connexion, relancée"

# 3. Un autre projet : une table products, sans les fonctions de ScanDrinks. Arrêt, et la ligne reste.
OTHER=scandrinks_reset_autre
fresh "$OTHER"
"${PSQL[@]}" -d "$OTHER" -c "create table public.products (id int)" -c "insert into public.products values (1)"
if out=$(run_reset "$OTHER"); then fail "un autre projet a été remis à zéro : $out"; fi
[[ "$out" == *"Arrêt : ce projet n'est pas ScanDrinks"* ]] || fail "autre projet, message : $out"
expect_equal "1" "$(value "$OTHER" "select count(*) from public.products")" "ligne de l'autre projet"

# 3 bis. Un projet « sosie » : les quatre tables de ScanDrinks, avec des lignes, mais pas ses fonctions. Arrêt aussi.
LOOKALIKE=scandrinks_reset_sosie
fresh "$LOOKALIKE"
"${PSQL[@]}" -d "$LOOKALIKE" <<'SQL'
create table public.products (id int);
create table public.barcodes (id int);
create table public.movements (id int);
create table public.allowed_users (id int);
insert into public.products values (1);
insert into public.allowed_users values (1);
SQL
if out=$(run_reset "$LOOKALIKE"); then fail "un projet sosie a été remis à zéro : $out"; fi
[[ "$out" == *"Arrêt : ce projet n'est pas ScanDrinks"* ]] || fail "projet sosie, message : $out"
expect_equal "1" "$(value "$LOOKALIKE" "select count(*) from public.products")" "ligne du projet sosie"

# 4. ScanDrinks sans compte autorisé : arrêt, et le produit reste.
NO_ACCOUNT=scandrinks_reset_sans_compte
scandrinks "$NO_ACCOUNT"
"${PSQL[@]}" -d "$NO_ACCOUNT" -c "insert into public.products (name, pack_size, alert_threshold, target_stock) values ('Coca-Cola 33 cl', 24, 24, 48)"
if out=$(run_reset "$NO_ACCOUNT"); then fail "une base sans compte autorisé a été remise à zéro : $out"; fi
[[ "$out" == *"Arrêt : aucun compte du tabac"* ]] || fail "sans compte autorisé, message : $out"
expect_equal "1" "$(value "$NO_ACCOUNT" "select count(*) from public.products")" "produit de la base sans compte autorisé"

"${PSQL[@]}" -d postgres -c "drop database $DB" -c "drop database $OTHER" -c "drop database $LOOKALIKE" -c "drop database $NO_ACCOUNT"
echo "Remise à zéro : OK"
