#!/usr/bin/env bash
# sales-race.test.sh — Deux fins de journée envoyées au même instant (record_sales), sur le PostgreSQL local.
#
# Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.8, RG-14, §6.3, §7, §8 « Jalon 5 »)
#
# Sur une base jetable, deux sessions simultanées ; la première garde son verrou 2 secondes :
#   1. deux saisies du même produit, le même jour : la seconde attend son tour, puis répond « déjà saisi »,
#      jamais une erreur de doublon ;
#   2. un envoi jumeau (même identifiant) : la seconde rejoue la première, rien n'est compté deux fois.
# Ne touche jamais au vrai projet Supabase. À lancer avec un compte qui peut créer des bases (run-local.sh le lance) :
#   su postgres -c "bash supabase/tests/sales-race.test.sh"
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

DB=scandrinks_race
PRODUCT=00000000-0000-4000-8000-00000000c0ca
TODAY="(now() at time zone 'Europe/Paris')::date"
scandrinks "$DB"
"${PSQL[@]}" -d "$DB" <<SQL
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a1', 'tabac@test.invalid');
insert into auth.sessions (id, user_id) values ('00000000-0000-4000-8000-00000000a1a1', '00000000-0000-4000-8000-0000000000a1');
insert into public.allowed_users (user_id) values ('00000000-0000-4000-8000-0000000000a1');
insert into public.products (id, name, pack_size, alert_threshold, target_stock) values ('$PRODUCT', 'Course Coca', 24, 24, 48);
insert into public.movements (id, product_id, kind, delta, employee)
  values ('00000000-0000-4000-8000-0000000000e0', '$PRODUCT', 'in', 12, 'Testeur');
SQL

# Le compte du tabac, connecté : rien ne s'affiche avant la réponse de record_sales.
SESSION="set role authenticated; set request.jwt.claims = '{\"sub\":\"00000000-0000-4000-8000-0000000000a1\",\"role\":\"authenticated\",\"session_id\":\"00000000-0000-4000-8000-00000000a1a1\"}';"

# La fin de journée d'une ligne : sale <jour, en SQL> <identifiant> <quantité>.
sale() {
  echo "select public.record_sales($1, '[{\"id\":\"$2\",\"product_id\":\"$PRODUCT\",\"quantity\":$3}]', 'Testeur');"
}

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

# race <jour> <id 1> <quantité 1> <id 2> <quantité 2> : la session 1 enregistre et garde son verrou 2 s ; la session 2
# arrive 0,5 s après elle. Laisse la réponse de la session 1 dans FIRST, celle de la session 2 dans SECOND.
race() {
  psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "begin; $SESSION $(sale "$1" "$2" "$3") select pg_sleep(2); commit;" >"$OUT" &
  local first_pid=$!
  sleep 0.5
  SECOND="$(psql -X -q -At -v ON_ERROR_STOP=1 -d "$DB" -c "$SESSION $(sale "$1" "$4" "$5")")"
  wait "$first_pid" || fail "la session 1 a échoué : $(cat "$OUT")"
  FIRST="$(grep -m1 '^{' "$OUT" || true)"
}

# 1. Deux saisies du même produit, le même jour.
race "$TODAY" 00000000-0000-4000-8000-0000000000f1 2 00000000-0000-4000-8000-0000000000f2 3
expect_equal '{"units": 2, "status": "recorded", "duplicate": false}' "$FIRST" "session 1"
expect_equal '{"status": "already_recorded", "products": ["Course Coca"]}' "$SECOND" "session 2, même produit"
expect_equal "1" "$(value "$DB" "select count(*) from public.movements where sale_day = $TODAY and cancelled_at is null")" "ventes actives du jour"
expect_equal "10" "$(value "$DB" "select stock from public.product_stock where id = '$PRODUCT'")" "stock après la course"

# 2. Un envoi jumeau, pour la veille : le même identifiant dans les deux sessions.
race "$TODAY - 1" 00000000-0000-4000-8000-0000000000f3 1 00000000-0000-4000-8000-0000000000f3 1
expect_equal '{"units": 1, "status": "recorded", "duplicate": false}' "$FIRST" "envoi jumeau, session 1"
expect_equal '{"units": 1, "status": "recorded", "duplicate": true}' "$SECOND" "envoi jumeau, session 2"
expect_equal "1" "$(value "$DB" "select count(*) from public.movements where id = '00000000-0000-4000-8000-0000000000f3'")" "lignes de l'envoi jumeau"
expect_equal "9" "$(value "$DB" "select stock from public.product_stock where id = '$PRODUCT'")" "stock après l'envoi jumeau"

"${PSQL[@]}" -d postgres -c "drop database $DB"
echo "Course OK"
