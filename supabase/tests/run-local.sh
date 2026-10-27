#!/usr/bin/env bash
# run-local.sh — Lance les tests SQL sur le PostgreSQL local du poste.
#
# Recrée une base jetable, y charge l'imitation de Supabase puis la migration,
# et exécute database.test.sql (tout y est annulé à la fin). Lance ensuite le
# test de la remise à zéro (reset.test.sh), celui de deux fins de journée
# simultanées (sales-race.test.sh), puis celui d'une suppression en même temps
# qu'un autre enregistrement (delete-race.test.sh), chacun sur ses propres bases
# jetables.
# Ne touche jamais au vrai projet Supabase. À lancer avec un compte qui peut
# créer des bases :
#   su postgres -c "bash supabase/tests/run-local.sh"
set -euo pipefail
shopt -s nullglob

DB=scandrinks_local
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/supabase-stub.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$migration"
done
psql -X -v ON_ERROR_STOP=1 -At -d "$DB" -f "$ROOT/supabase/tests/database.test.sql"
bash "$ROOT/supabase/tests/reset.test.sh"
bash "$ROOT/supabase/tests/sales-race.test.sh"
bash "$ROOT/supabase/tests/delete-race.test.sh"
