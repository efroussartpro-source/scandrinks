# ScanDrinks

Gestion du stock de boissons d'un bureau de tabac par scan de code-barres, depuis un iPhone (app web installable, sans App Store).

- **Cahier des charges** : [docs/superpowers/specs/2026-10-19-scandrinks-design.md](docs/superpowers/specs/2026-10-19-scandrinks-design.md)
- **Statut** : jalons 1 (le cœur de l'app), 2 (le pilotage) et 3 (le suivi) en service ; jalon 4 (la mise en service) en ligne, inventaire de la bascule le 28/10/2026 au soir ; jalon 5 (la fin de journée) en ligne, première fin de journée le 29/10/2026 ; jalon 6 (suppression et photo de la canette) en préparation. Plans : [jalon 0](docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md), [jalon 1](docs/superpowers/plans/2026-10-19-jalon-1-coeur.md), [jalon 2](docs/superpowers/plans/2026-10-20-jalon-2-pilotage.md), [jalon 3](docs/superpowers/plans/2026-10-20-jalon-3-suivi.md), [refonte visuelle et images](docs/superpowers/plans/2026-10-21-refonte-visuelle-et-images.md), [jalon 4](docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md), [jalon 5](docs/superpowers/plans/2026-10-22-jalon-5-fin-de-journee.md), [jalon 6](docs/superpowers/plans/2026-10-27-jalon-6-suppression-et-photo-canette.md).
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

Les anciennes adresses de test des jalons 1 et 2 affichent maintenant une page qui renvoie vers l'app. Le protocole de test sur iPhone est dans [docs/jalon-3-test.md](docs/jalon-3-test.md).

## Jalon 4 — la mise en service

Ce jalon apporte :
- la refonte visuelle : le style d'une app iPhone, de jour et de nuit, avec le choix Réglages › Apparence (« Automatique », « Clair » ou « Sombre », pour chaque téléphone) ;
- les images des codes : celle d'Open Food Facts, recopiée chez nous, ou une photo de l'équipe, prise à la création ou depuis la fiche ;
- la vidéo tuto (3 minutes, sans le son) : l'écran « Tutoriel » des Réglages, la page https://scandrinks.pages.dev/tutoriel/ (ouverte par le QR code de la feuille) et un fichier MP4 pour le groupe de l'équipe ;
- la feuille A4 de la réserve, avec le QR code de la vidéo : [docs/feuille-reserve.pdf](docs/feuille-reserve.pdf) ;
- les corrections d'avant la semaine d'essai : un message et « Recharger » à la place d'une page blanche, l'écran allumé redemandé quand le système le relâche (s7), « Réessayer » gardé sur la fiche produit (s3) ;
- le script de remise à zéro du jour J, lancé par le porteur du projet dans l'éditeur SQL de Supabase.

Le protocole de test sur iPhone est dans [docs/jalon-4-test.md](docs/jalon-4-test.md), le guide du jour J dans [docs/jalon-4-jour-j.md](docs/jalon-4-jour-j.md).

## Jalon 5 — la fin de journée

Le stock couvre maintenant toute la boutique : réserve, frigos et rayons. Les livraisons s'ajoutent par scan ; un pack porté au frigo ne se scanne plus, et « Sortie − » sert à la casse, au périmé et aux boissons offertes.

Ce jalon apporte :
- un cinquième onglet, « Ventes » (Scanner, À racheter, Stock, Ventes, Historique) : chaque soir, on y saisit les ventes du jour lues sur la caisse (« Lecture jour »), puis le récapitulatif, puis « Enregistrer ». Un soir oublié se rattrape dans les 7 jours ;
- les lignes « Vente » dans l'Historique et la fiche produit, annulables comme les autres ;
- la feuille A4 et la vidéo tuto mises à jour (« En fin de journée », chapitre 3).

Le protocole de test sur iPhone est dans [docs/jalon-5-test.md](docs/jalon-5-test.md).

## Jalon 6 — suppression et photo de la canette

Ce jalon apporte :
- « Supprimer le produit », en bas de la fiche de chaque produit, actif ou archivé : après un message de confirmation, le produit, ses codes et tout son historique sont effacés pour de bon. La liste d'où la fiche avait été ouverte (Stock ou À racheter) le dit. « Archiver » reste, pour un produit mis de côté qui garde son historique ;
- la photo de la canette à la création depuis un pack : après « Scanner une canette du pack », un second cadre, « Photo de la canette », et le premier devient « Photo du pack ». Les deux photos partent après la création ;
- une fin de journée qui contient un produit supprimé entre-temps sur un autre téléphone : refusée une fois, puis la liste est relue sans lui.

La mise en place dans la base (un fichier lancé par le porteur du projet dans l'éditeur SQL de Supabase) et le protocole de test sur iPhone sont dans [docs/jalon-6-test.md](docs/jalon-6-test.md).

## Développement

Il faut Node 22 (voir `.node-version`). Le fichier `.npmrc` active `legacy-peer-deps` pour contourner un plantage de npm 10.9 avec vitest 5.

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances (versions exactes) |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification TypeScript (mode strict) |
| `npm run build` | vérification des types puis construction de production (`dist/`, avec `.env.production`) |
| `npm run e2e` | construction avec `.env.e2e`, puis test de bout en bout : fausse caméra et base simulée |
| `npm run screens` | captures des écrans, de jour et de nuit (`dist-screens/`), à comparer aux maquettes de `docs/maquettes/` |
| `su postgres -c "bash supabase/tests/run-local.sh"` | tests de la base sur un PostgreSQL local, avec une imitation de Supabase, puis test de la remise à zéro (`reset.test.sh`) et de deux fins de journée simultanées (`sales-race.test.sh`) |
| `node scripts/render-icons.mjs` | refait les icônes PNG à partir de `public/icon.svg` |
| `npm run tutorial:trial` | vidéo d'essai de 10 secondes, en HLS dans `public/tutoriel/video/`, puis son contrôle. **Elle remplace la vraie vidéo** : la remettre ensuite avec `git checkout -- public/tutoriel/video` (ou `npm run tutorial`). Sinon, `npm test` le signale (`tutorial.test.ts` attend 150 à 240 s) |
| `npm run tutorial:record` | tournage de la vidéo tuto : la version e2e de l'app, filmée sur un iPhone simulé (`dist-tutorial/raw/`), puis son contrôle |
| `npm run tutorial` | tournage, montage (titres, sous-titres, cartes), MP4 (`dist-tutorial/ScanDrinks-tuto.mp4`) et HLS servi avec l'app, puis contrôle |
| `npm run sheet` | impression de la feuille A4 de la réserve (`docs/feuille-reserve.pdf`), puis son contrôle (une page, QR code relu, textes) |

`npm run e2e`, `npm run screens`, `npm run tutorial…` et `npm run sheet` ont besoin de Chromium, déjà présent dans l'environnement Claude Code (`PLAYWRIGHT_BROWSERS_PATH`). La vidéo demande aussi ffmpeg (avec libx264 et libass) et la police Inter ; la feuille, poppler-utils (`pdfinfo`, `pdftoppm`, `pdftotext`) et Inter.

### Configuration

Ces fichiers ne contiennent que des valeurs publiques :
- `.env.production` : adresse du projet Supabase, clé publique (`sb_publishable_…`) et adresse du compte du tabac. La sécurité vient de la Row Level Security et de la table `allowed_users`, pas du secret de la clé. Aussi le premier jour de ventes de la fin de journée (`VITE_FIRST_SALES_DAY`, le 29/10/2026) : l'onglet « Ventes » ne propose pas les jours d'avant, déjà comptés par l'inventaire de la bascule.
- `.env.e2e` : valeurs factices du test de bout en bout (premier jour de ventes : le 17/10/2026).

### Base de données (Supabase, Paris)

- `supabase/migrations/` : schéma, droits, Row Level Security et fonctions de l'app.
  - Jalon 1 : `lookup_barcode`, `create_product`, `attach_barcode`, `record_movement`, `cancel_movement`, `list_employees`.
  - Jalon 2 (`20261020100000_pilotage.sql`) : `record_inventory`, `update_product`, `set_product_archived` et `detach_barcode` ; `create_product` reçoit l'identifiant de la fiche (`p_id`), pour qu'une création rejouée ne fasse pas de doublon. Les droits de modification sont donnés colonne par colonne.
  - Jalon 3 (`20261020180000_suivi.sql`) : `list_history` (historique par pages) ; `cancel_movement` renvoie aussi qui a annulé et quand ; `create_product` ne peut plus échouer sur un envoi en double. `private.is_allowed()` vérifie que la session du jeton est encore ouverte : après un changement de mot de passe, les autres téléphones sont refusés tout de suite (code `PT401`, rendu en 401).
  - Jalon 4 (`20261021120000_images.sql`, refonte) : une image par code (`photo_path`, `photo_source` : Open Food Facts ou l'équipe), enregistrée par `set_barcode_photo` ; compartiment privé « photos » (JPEG, 256 Kio au plus), en lecture et en ajout seulement, pour le compte du tabac ; `lookup_barcode` et la vue `product_stock` donnent aussi l'image.
  - Jalon 5 (`20261022130000_fin_de_journee.sql`) : une vente est une sortie qui porte le jour des ventes (`sale_day`), au plus une active par produit et par jour (index unique) ; `record_sales` enregistre la fin de journée d'un jour en une transaction, rejouable sans doublon, et répond « déjà saisi » si un autre téléphone l'a fait ; `list_history` donne aussi `sale_day`.
  - Jalon 6 (`20261027120000_suppression.sql`) : `delete_product`, qui appelle `private.erase_product` (security definer, dans le schéma non exposé). Elle verrouille ses mouvements puis le produit (l'ordre de `cancel_movement`), puis efface ses mouvements, ses codes et la fiche : c'est la seule porte pour effacer, et le rôle de l'app n'a toujours aucun droit de suppression sur les produits ni sur les mouvements. Ce fichier contient des effacements : le porteur du projet le lance dans l'éditeur SQL.
- `supabase/remise-a-zero.sql` : la remise à zéro du jour J, hors des migrations. Elle efface produits, codes et mouvements, et garde le compte du tabac ; elle vérifie d'abord qu'elle tourne sur le projet ScanDrinks. Le porteur du projet la lance dans l'éditeur SQL ; Claude ne la lance jamais.
- `supabase/tests/database.test.sql` : tests de la base, dans une transaction annulée à la fin. On les lance sur le vrai projet avec l'outil `execute_sql`, ou en local avec `run-local.sh`. `reset.test.sh` essaie la remise à zéro en local, dont ses arrêts sur un autre projet ; `sales-race.test.sh`, deux fins de journée envoyées au même instant par deux sessions ; `delete-race.test.sh`, une suppression en même temps qu'un scan, qu'un code ajouté ou qu'une annulation.
- Le compte du tabac est créé dans le tableau de bord Supabase, inscriptions désactivées. Il est ensuite inscrit dans `allowed_users`.

### Organisation du code

- `src/app/` : enchaînement des écrans, onglets, catalogue partagé, stockage local protégé, filet de sécurité (« Recharger »).
- `src/auth/` : connexion, prénom et règles du changement de mot de passe.
- `src/scanner/` : écran Scanner et son automate (`scanFlow.ts`), modes Entrée, Sortie et Inventaire.
- `src/shopping/` : liste « À racheter ».
- `src/stock/` : liste du stock, fiche produit et ses formulaires.
- `src/inventory/` : saisie d'un comptage (packs + unités) et « Corriger le stock ».
- `src/products/` : code inconnu (nouveau produit, ajout d'un code), saisie manuelle, recherche.
- `src/settings/` : réglages, Apparence, écran « Tutoriel » et changement du mot de passe du tabac.
- `src/history/` : onglet Historique.
- `src/sales/` : onglet « Ventes », la fin de journée.
- `src/data/` : client Supabase, appels typés, classement des erreurs.
- `src/domain/` : règles de gestion (stock, fiche produit, À racheter, inventaire, mouvements, ventes de fin de journée, tri des noms).
- `src/codes/` : normalisation des codes lus (RG-13).
- `src/scan/` : lecture des codes-barres (caméra, moteur natif ou ZXing, anti-doublon) et écran allumé pendant le scan.
- `src/off/` : client Open Food Facts.
- `src/theme/` : la charte (`tokens.css` : couleurs, tailles, jour et nuit, avec leurs contrastes testés) et l'Apparence (`appearance.ts`).
- `src/ui/icons.tsx` : les icônes (dessins de Lucide, recopiés dans le code).
- `src/photos/` : images des codes : prise, envoi, liens signés et vignettes.

### Vidéo tuto et feuille A4

- `public/tutoriel/` : la page de la vidéo (`index.html`) et la vidéo en HLS (`video/` : liste, segments et image d'attente), servies avec l'app.
- `scripts/tutorial/` : la vidéo tuto. `storyboard.mjs` (chapitres et sous-titres), `record.mjs` (tournage), `edit.mjs` (montage), `check.mjs` (contrôle), avec leurs aides. Le MP4 et le tournage brut vont dans `dist-tutorial/`, ignoré par Git : le MP4 est remis au porteur du projet.
- `scripts/sheet/` : la feuille A4. `sheet.html` (le texte), `print.mjs` (QR code et PDF), `check.mjs` (contrôle).
- `docs/maquettes/` : les maquettes de la refonte, validées par le porteur du projet ; `docs/maquettes/vitrine/` : celles du design « Vitrine » (jalon 7), validées le 28/10/2026.

### Hébergement

Cloudflare Pages, avec la commande de build `npm run build`, le dossier de sortie `dist` et la branche de production `main`. Chaque autre branche a sa préversion, par exemple `https://jalon-1.scandrinks.pages.dev`.

Une construction peut rester bloquée chez Cloudflare : état « active » depuis des heures, « Cancel deployment » refusé et pas de « Retry deployment » dans le menu (vu le 28/10/2026 après une panne de Cloudflare). La version en ligne reste alors la précédente. Un nouvel envoi sur la branche lance une autre construction.
