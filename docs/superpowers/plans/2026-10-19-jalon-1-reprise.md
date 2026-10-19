# ScanDrinks — Jalon 1 — Note de reprise (19/10/2026)

Cette note permet à une nouvelle session de reprendre le jalon 1 exactement où il s'est arrêté.

**Pourquoi une nouvelle session :** le connecteur Supabase de la session précédente ne voyait que l'organisation « Webia ». Le porteur du projet a créé une organisation « Scandrinks » et reconnecte le connecteur pour y donner accès. Les connecteurs sont lus au démarrage d'une session.

## Où en est le jalon 1

- **Branche :** `jalon-1`, envoyée sur GitHub. Dernier commit de code : `1c4d0d6` (corrections de la relecture finale).
- **Plan :** [2026-10-19-jalon-1-coeur.md](2026-10-19-jalon-1-coeur.md). **Spec :** [../specs/2026-10-19-scandrinks-design.md](../specs/2026-10-19-scandrinks-design.md).
- **Méthode :** exécution en ligne (superpowers:executing-plans), choisie par le porteur du projet.
- **Journal d'exécution :** `.superpowers/sdd/2026-10-19-jalon-1-coeur/progress.md`, versionné exprès pour la reprise (`git add -f`). Il contient toutes les lignes `Ruling:` et `minor (deferred)`. À la fin, il faut les recopier dans le message final, puis retirer ce dossier du dépôt.
- **Fait :**
  - Tâches 1, 2, 3, 5, 6, 7, 8 et 9 terminées (lignes `complete` dans le journal).
  - Relecture finale par un relecteur neuf : faite. Les 5 défauts retenus sont corrigés en TDD.
  - Protocole [docs/jalon-1-test.md](../../jalon-1-test.md) et README à jour.
- **Contrôles au dernier commit :**
  - `npm test` → 199/199 ;
  - `npm run e2e` → 7 scénarios OK ;
  - tests SQL en local → OK.

## Ce qui reste

### Tâche 4 — la base sur le vrai projet

1. **Créer le projet**, avec l'accord déjà donné par le porteur du projet.
   - Organisation « Scandrinks » : son identifiant se trouve avec `list_organizations`.
   - Appeler `create_project` avec `name: 'scandrinks'` et `region: 'eu-west-3'` (Paris), sur l'offre gratuite.
   - Attendre l'état `ACTIVE_HEALTHY` avec `get_project`.
   - **Ne jamais toucher à l'organisation ni au projet « Webia »**, que le porteur du projet a mis en pause.
2. **Appliquer la migration** : `apply_migration`, avec `name: 'initial_schema'` et le contenu de `supabase/migrations/20261019130000_initial_schema.sql`.
3. **Lancer les tests SQL** : `execute_sql` avec `supabase/tests/database.test.sql`.
   - Attendu : `OK`.
   - Le test insère deux comptes factices dans `auth.users` avec seulement `id` et `email`. Si le vrai Supabase exige d'autres colonnes, ajuster l'insertion, et seulement elle.
   - Vérifier ensuite que `select count(*) from public.products` vaut 0.
4. **Contrôler les conseils de Supabase** : `get_advisors`, une fois avec `security` et une fois avec `performance`.
   - Attendu : aucune alerte ERROR.
   - Noter les alertes WARN dans le journal.
5. **Clore la tâche** : écrire la ligne `Task 4: complete` du journal.

### Tâche 10 — mise en service

1. **Actions du porteur du projet**, dans Supabase, projet `scandrinks`, avec un guidage pas à pas :
   - **Inscriptions :** Authentication → Sign In / Providers : désactiver « Allow new users to sign up ».
   - **Compte du tabac :** Authentication → Users → Add user → Create new user.
     - Adresse : `Tabvapshoplongecourt@gmail.com`, la Gmail dédiée au tabac.
     - Mot de passe : choisi par le porteur du projet, et jamais communiqué à Claude.
     - Cocher « Auto Confirm User ».
2. **Autoriser le compte :** `insert into public.allowed_users (user_id) select id from auth.users where lower(email) = 'tabvapshoplongecourt@gmail.com' returning user_id;`
   - Attendu : 1 ligne.
3. **Écrire `.env.production`**, avec des valeurs publiques :
   - `VITE_SUPABASE_URL`, donné par `get_project_url` ;
   - `VITE_SUPABASE_PUBLISHABLE_KEY`, la clé `sb_publishable_…` active donnée par `get_publishable_keys` ;
   - `VITE_SHOP_EMAIL=tabvapshoplongecourt@gmail.com`.

   Puis lancer `npm test && npm run e2e && npm run build`.
4. **Commit et envoi :** commit `docs(jalon-1): mise en service, protocole de test`, puis `git push -u origin jalon-1`. Cloudflare construit alors la préversion https://jalon-1.scandrinks.pages.dev.
5. **Contrôles :** ceux de la Tâche 10, Step 6 du plan.
   - Préversion en 200, et wasm servi par l'app.
   - `product_stock` et `lookup_barcode` refusés sans connexion.
   - Inscription refusée.
   - Script Playwright jetable : un mauvais mot de passe sur la préversion affiche « Mot de passe incorrect. ».
6. **Test du porteur du projet sur iPhone**, d'après `docs/jalon-1-test.md`. Les défauts trouvés sont corrigés en TDD.
7. **Fin du jalon :** fusion dans `main` avec son accord (`git merge --ff-only jalon-1`). Ensuite, appliquer superpowers:finishing-a-development-branch.

## Décision prise par le porteur du projet

**Libellé après une coupure réseau, validé le 19/10/2026.**
- Après un enregistrement qui échoue : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ».
- Ailleurs (recherche, listes, formulaires) : « Pas de connexion. Réessaie quand le réseau revient. ».

Ces libellés sont appliqués dans `apiErrors.ts` (`saveErrorMessage`), les tests, le protocole et la spec (§7 et journal des décisions).

## Règles de travail

- Tout en français : interface, documentation, messages. Le porteur du projet n'est pas développeur : expliquer simplement, pas à pas.
- Ne jamais demander de mot de passe, de jeton ni de clé secrète. Seule la clé publique `sb_publishable_…` va dans le dépôt.
- Chaque commit se termine par les lignes d'attribution de la session.
- La fusion dans `main` et toute action irréversible demandent l'accord du porteur du projet.
- **Tests SQL en local :**
  1. démarrer PostgreSQL 16 avec `pg_ctlcluster 16 main start` ;
  2. lancer `su postgres -c "bash supabase/tests/run-local.sh"`.
- **Test de bout en bout :** `npm run e2e`. Chromium est fourni par l'environnement, et `E2E_ONLY=A,G` limite les scénarios lancés.
