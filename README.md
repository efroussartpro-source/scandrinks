# ScanDrinks

Gestion du stock de boissons d'un bureau de tabac par scan de code-barres, depuis un iPhone (app web installable, sans App Store).

- **Cahier des charges** : [docs/superpowers/specs/2026-10-19-scandrinks-design.md](docs/superpowers/specs/2026-10-19-scandrinks-design.md)
- **Statut** : jalons 1 (le cœur de l'app) et 2 (le pilotage) en service ; jalon 3 (le suivi) en test. Plans : [jalon 0](docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md), [jalon 1](docs/superpowers/plans/2026-10-19-jalon-1-coeur.md), [jalon 2](docs/superpowers/plans/2026-10-20-jalon-2-pilotage.md), [jalon 3](docs/superpowers/plans/2026-10-20-jalon-3-suivi.md).
- **Installation** : uniquement depuis https://scandrinks.pages.dev (Safari, Partager → « Sur l'écran d'accueil »). Les préversions des branches servent aux tests, dans Safari, sans les installer.

## Jalon 1 — le cœur

Ce jalon apporte :
- la connexion au compte du tabac, puis le prénom de la personne ;
- le scan en Entrée et en Sortie, avec la quantité et l'annulation pendant 5 secondes ;
- la création d'une fiche au premier scan d'un pack ;
- l'ajout d'un code à un produit existant, et la saisie manuelle.

Le protocole de test sur iPhone est dans [docs/jalon-1-test.md](docs/jalon-1-test.md). Le test du scan du jalon 0 est décrit dans [docs/jalon-0-test-scan.md](docs/jalon-0-test-scan.md).

## Jalon 2 — le pilotage

Ce jalon apporte :
- une barre d'onglets : Scanner, À racheter et Stock. Les Réglages s'ouvrent par-dessus, sans perdre une fiche en cours ;
- la liste « À racheter », en packs Metro, avec un badge sur son onglet ;
- le mode Inventaire du Scanner (« packs + unités », avec l'écart avant de valider) ;
- la liste du stock et la fiche produit : modifier, gérer les codes, corriger le stock, archiver et réactiver ;
- la création d'un produit sans scan, pour un code illisible.

Le protocole de test sur iPhone est dans [docs/jalon-2-test.md](docs/jalon-2-test.md).

## Jalon 3 — le suivi

Ce jalon apporte :
- l'onglet « Historique » : tous les mouvements, du plus récent au plus ancien, par pages de 50 (« Voir plus »), et l'annulation d'une erreur après confirmation ;
- le changement du mot de passe du tabac dans les Réglages : tous les téléphones sont déconnectés tout de suite, celui-ci compris ;
- des finitions : l'icône de l'app, l'écran qui reste allumé au Scanner, un message (et « Recharger ») si l'app ne peut pas démarrer, et les points reportés du jalon 2.

Les anciennes adresses de test du jalon 1 affichent maintenant une page qui renvoie vers l'app. Le protocole de test sur iPhone est dans [docs/jalon-3-test.md](docs/jalon-3-test.md).

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
| `node scripts/render-icons.mjs` | refait les icônes PNG à partir de `public/icon.svg` |

`npm run e2e` a besoin de Chromium, déjà présent dans l'environnement Claude Code (`PLAYWRIGHT_BROWSERS_PATH`).

### Configuration

Ces fichiers ne contiennent que des valeurs publiques :
- `.env.production` : adresse du projet Supabase, clé publique (`sb_publishable_…`) et adresse du compte du tabac. La sécurité vient de la Row Level Security et de la table `allowed_users`, pas du secret de la clé.
- `.env.e2e` : valeurs factices du test de bout en bout.

### Base de données (Supabase, Paris)

- `supabase/migrations/` : schéma, droits, Row Level Security et fonctions de l'app.
  - Jalon 1 : `lookup_barcode`, `create_product`, `attach_barcode`, `record_movement`, `cancel_movement`, `list_employees`.
  - Jalon 2 (`20261020100000_pilotage.sql`) : `record_inventory`, `update_product`, `set_product_archived` et `detach_barcode` ; `create_product` reçoit l'identifiant de la fiche (`p_id`), pour qu'une création rejouée ne fasse pas de doublon. Les droits de modification sont donnés colonne par colonne.
  - Jalon 3 (`20261020180000_suivi.sql`) : `list_history` (historique par pages) ; `cancel_movement` renvoie aussi qui a annulé et quand ; `create_product` ne peut plus échouer sur un envoi en double. `private.is_allowed()` vérifie que la session du jeton est encore ouverte : après un changement de mot de passe, les autres téléphones sont refusés tout de suite (code `PT401`, rendu en 401).
- `supabase/tests/database.test.sql` : tests de la base, dans une transaction annulée à la fin. On les lance sur le vrai projet avec l'outil `execute_sql`, ou en local avec `run-local.sh`.
- Le compte du tabac est créé dans le tableau de bord Supabase, inscriptions désactivées. Il est ensuite inscrit dans `allowed_users`.

### Organisation du code

- `src/app/` : enchaînement des écrans, onglets, catalogue partagé, stockage local protégé.
- `src/auth/` : connexion, prénom et règles du changement de mot de passe.
- `src/scanner/` : écran Scanner et son automate (`scanFlow.ts`), modes Entrée, Sortie et Inventaire.
- `src/shopping/` : liste « À racheter ».
- `src/stock/` : liste du stock, fiche produit et ses formulaires.
- `src/inventory/` : saisie d'un comptage (packs + unités) et « Corriger le stock ».
- `src/products/` : code inconnu (nouveau produit, ajout d'un code), saisie manuelle, recherche.
- `src/settings/` : réglages et changement du mot de passe du tabac.
- `src/history/` : onglet Historique.
- `src/data/` : client Supabase, appels typés, classement des erreurs.
- `src/domain/` : règles de gestion (stock, fiche produit, À racheter, inventaire, mouvements, tri des noms).
- `src/codes/` : normalisation des codes lus (RG-13).
- `src/scan/` : lecture des codes-barres (caméra, moteur natif ou ZXing, anti-doublon) et écran allumé pendant le scan.
- `src/off/` : client Open Food Facts.

### Hébergement

Cloudflare Pages, avec la commande de build `npm run build`, le dossier de sortie `dist` et la branche de production `main`. Chaque autre branche a sa préversion, par exemple `https://jalon-1.scandrinks.pages.dev`.
