# ScanDrinks

Gestion du stock de boissons d'un bureau de tabac par scan de code-barres, depuis un iPhone (app web installable, sans App Store).

- **Cahier des charges** : [docs/superpowers/specs/2026-10-19-scandrinks-design.md](docs/superpowers/specs/2026-10-19-scandrinks-design.md)
- **Statut** : jalon 0 en cours, la page de test du scan. Le plan est dans [docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md](docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md).

## Jalon 0 — test du scan

Une page unique ouvre la caméra arrière, lit les codes-barres et affiche le nom donné par Open Food Facts. Le protocole de test en boutique et la règle de décision (GO ou plan B) sont dans [docs/jalon-0-test-scan.md](docs/jalon-0-test-scan.md).

## Développement

Il faut Node 22 (voir `.node-version`). Le fichier `.npmrc` active `legacy-peer-deps` pour contourner un plantage de npm 10.9 avec vitest 5.

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances (versions exactes) |
| `npm run dev` | serveur de développement |
| `npm test` | tests unitaires (Vitest) |
| `npm run typecheck` | vérification TypeScript (mode strict) |
| `npm run build` | vérification des types puis construction de production (`dist/`) |
| `npm run e2e` | construction puis test de bout en bout avec une fausse caméra |

`npm run e2e` a besoin de Chromium, déjà présent dans l'environnement Claude Code (`PLAYWRIGHT_BROWSERS_PATH`).

Organisation du code :
- `src/scan/` : lecture des codes-barres (caméra, moteur natif ou ZXing, anti-doublon). Réutilisé au jalon 1.
- `src/off/` : client Open Food Facts. Réutilisé au jalon 1.
- `src/scanTest/` : page de test du jalon 0, jetable.

Hébergement : Cloudflare Pages (commande de build `npm run build`, dossier de sortie `dist`, branche de production `main`).
