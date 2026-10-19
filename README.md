# ScanDrinks

Gestion du stock de boissons d'un bureau de tabac par scan de code-barres, depuis un iPhone (app web installable, sans App Store).

- **Cahier des charges** : [docs/superpowers/specs/2026-10-19-scandrinks-design.md](docs/superpowers/specs/2026-10-19-scandrinks-design.md)
- **Statut** : jalon 1 (le cœur de l'app) en cours de mise en service. Plans : [jalon 0](docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md), [jalon 1](docs/superpowers/plans/2026-10-19-jalon-1-coeur.md).

## Jalon 1 — le cœur

Ce jalon apporte :
- la connexion au compte du tabac, puis le prénom de la personne ;
- le scan en Entrée et en Sortie, avec la quantité et l'annulation pendant 5 secondes ;
- la création d'une fiche au premier scan d'un pack ;
- l'ajout d'un code à un produit existant, et la saisie manuelle.

Le protocole de test sur iPhone est dans [docs/jalon-1-test.md](docs/jalon-1-test.md). Le test du scan du jalon 0 est décrit dans [docs/jalon-0-test-scan.md](docs/jalon-0-test-scan.md).

## Développement

Il faut Node 22 (voir `.node-version`). Le fichier `.npmrc` active `legacy-peer-deps` pour contourner un plantage de npm 10.9 avec vitest 5.

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances (versions exactes) |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification TypeScript (mode strict) |
| `npm run build` | vérification des types puis construction de production (`dist/`, avec `.env.production`) |
| `npm run e2e` | construction avec `.env.e2e`, puis test de bout en bout : fausse caméra et base simulée |
| `su postgres -c "bash supabase/tests/run-local.sh"` | tests de la base sur un PostgreSQL local, avec une imitation de Supabase |

`npm run e2e` a besoin de Chromium, déjà présent dans l'environnement Claude Code (`PLAYWRIGHT_BROWSERS_PATH`).

### Configuration

Ces fichiers ne contiennent que des valeurs publiques :
- `.env.production` : adresse du projet Supabase, clé publique (`sb_publishable_…`) et adresse du compte du tabac. La sécurité vient de la Row Level Security et de la table `allowed_users`, pas du secret de la clé.
- `.env.e2e` : valeurs factices du test de bout en bout.

### Base de données (Supabase, Paris)

- `supabase/migrations/` : schéma, droits, Row Level Security et fonctions de l'app (`lookup_barcode`, `create_product`, `attach_barcode`, `record_movement`, `cancel_movement`, `list_employees`).
- `supabase/tests/database.test.sql` : tests de la base, dans une transaction annulée à la fin. On les lance sur le vrai projet avec l'outil `execute_sql`, ou en local avec `run-local.sh`.
- Le compte du tabac est créé dans le tableau de bord Supabase, inscriptions désactivées. Il est ensuite inscrit dans `allowed_users`.

### Organisation du code

- `src/app/` : enchaînement des écrans, stockage local protégé.
- `src/auth/` : connexion et prénom.
- `src/scanner/` : écran Scanner et son automate (`scanFlow.ts`).
- `src/products/` : code inconnu (nouveau produit, ajout d'un code), saisie manuelle, recherche.
- `src/settings/` : réglages.
- `src/data/` : client Supabase, appels typés, classement des erreurs.
- `src/domain/` : règles de gestion (stock, fiche produit).
- `src/codes/` : normalisation des codes lus (RG-13).
- `src/scan/` : lecture des codes-barres (caméra, moteur natif ou ZXing, anti-doublon).
- `src/off/` : client Open Food Facts.

### Hébergement

Cloudflare Pages, avec la commande de build `npm run build`, le dossier de sortie `dist` et la branche de production `main`. Chaque autre branche a sa préversion, par exemple `https://jalon-1.scandrinks.pages.dev`.
