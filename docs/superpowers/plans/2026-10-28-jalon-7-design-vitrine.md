# ScanDrinks — Jalon 7 (le design « Vitrine ») — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** donner à tous les écrans le design « Vitrine » validé le 28/10/2026 (spec §6.7), de jour et de nuit, sans changer les fonctions, les règles, la base ni les textes, hors des cinq changements visibles de la spec.

Validation (spec §9) : sur l'iPhone, dans la préversion `https://jalon-7.scandrinks.pages.dev`, le porteur du projet regarde chaque écran, de jour et de nuit, puis fait une journée type (scans, fin de journée). L'app en service ne change qu'après son « go ».

**Architecture :**
- **La charte d'abord.** `src/theme/tokens.css` prend les valeurs du tableau du §6.7, et la police Plus Jakarta Sans arrive avec l'app (un fichier WOFF2 de 27 Ko). Les autres feuilles ne changent que leurs règles, jamais en écrivant une couleur.
- **Les composants communs** (`AppShell.css`, `Thumb`, les icônes) passent au nouveau style. Tous les écrans en profitent avant même leur tâche.
- **Puis un écran par tâche :** Stock et fiche produit, Scanner, À racheter, Ventes, Historique, puis connexion, prénom et Réglages. Chaque tâche garde les rôles, les noms et les classes dont se servent les tests de bout en bout et le script de la vidéo.
- **Deux petites règles pures :**
  - `tileState`, l'état d'une tuile du Stock ;
  - `initialOf` et `nameTone`, l'initiale et la couleur d'un prénom.
- **Aucune migration** : la base ne change pas.

**Tech Stack :** celle du jalon 6 (Vite 8, React 19, TypeScript 7 strict, Vitest, Playwright 1.56.1, supabase-js 2.117.2), sans nouvelle dépendance. La police est copiée depuis le paquet npm `@fontsource-variable/plus-jakarta-sans@5.3.0`, sans l'installer.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, surtout :
- §6.7 (la charte « Vitrine » : couleurs, typographie, formes, photos, composants, écrans, ce qui ne change pas) ;
- §4.2 à §4.7 (passages « jalon 7 ») et §6.2 (« Police ») ;
- §8 « Jalon 7 », §9 « Mise en service (jalon 7) » et §10 ;
- §11, décisions du 28/10/2026.

Maquettes : `docs/maquettes/vitrine/` (C1 à C4). Elles font foi pour la mise en page. Les dessins de canettes y tiennent la place des vraies photos.

**Ordre :**
1. Les Tâches 1 à 8 sur la branche `jalon-7`.
2. La relecture finale de toute la branche, et ses corrections.
3. La Tâche 9.

Le porteur du projet veut le design au plus vite. La préversion se met à jour à chaque envoi de la branche, sans toucher l'app en service.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Apostrophe droite `'` dans les textes de l'interface. Guillemets « » avec une espace simple à l'intérieur.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit.
- **iPhone.**
  - iOS 16.4 au minimum.
  - Champs de saisie en 17 px (jamais moins de 16 px : sinon iOS zoome).
  - Rien ne dépasse en largeur à 320 px.
  - Zones tactiles de 44 px au moins.
- **Charte (spec §6.7).**
  - Les couleurs ne s'écrivent que dans `src/theme/tokens.css`, y compris les `rgba` et les ombres ; `charte.test.ts` le vérifie.
  - Contrastes : 4,5:1 pour un texte, 3:1 pour un élément d'interface, jour et nuit.
  - Les maquettes se lisent avec les valeurs du §6.7 : `#8F3F00` et `#B3261E` des maquettes s'écrivent `orange-text` et `red`.
- **Rien d'autre ne change.**
  - Les fonctions, les règles, la base, l'ordre des onglets, la place de « Valider » (large, à gauche), les couleurs des modes.
  - Les textes de l'interface. Seuls changements visibles (§6.7) :
    1. le bouton « Archivés » ;
    2. « N packs à racheter » et « Pas de photo » ;
    3. la photo dans l'Historique ;
    4. la mosaïque de la connexion ;
    5. les prénoms en cartes.
  - « Code inconnu : 2000000000091 » garde son texte.
  - Le nom accessible de chaque bouton et de chaque champ reste le même, car les tests le cherchent par son nom. Une décoration (initiale, pastille posée sur une photo, icône) porte `aria-hidden="true"`.
- **Classes utilisées par les tests et la vidéo** : elles restent sur l'élément équivalent, même si sa forme change.
  - `img.thumb`, `.thumb-empty`, `.product-row`, `.stock-low`, `.product-name`, `.product-state`, `.product-stock`, `.stock-list` ;
  - `.sheet-head`, `.sheet-stock-value`, `.sheet-stock-packs`, `.sheet-figures`, `.code-row`, `.code-value`, `.code-meta` ;
  - `.movement-line`, `.movement-title`, `.history-line`, `.history-title`, `.history-amount`, `.history-meta` ;
  - `.confirm-delta`, `.confirm-what`, `.notice-title`, `.notice-detail`, `.count-total`, `.count-gap`, `.aim-hint`, `.viewfinder` ;
  - `.buy-amount`, `.buy-note`, `.sales-total`, `.sales-meta`, `.sales-amount`, `.sales-line`, `.sales-day` ;
  - `.tab-bar`, `main.settings`, `main.tutorial`.
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées.
- **Supabase.** Aucune migration, aucun appel au vrai projet. Ne jamais toucher à l'organisation ni au projet « Webia ».
- **Mise en service.**
  - `main` ne bouge qu'après le « go » du porteur du projet (Tâche 9).
  - Jamais de mot de passe, de jeton ni de clé secrète demandé ou écrit.
- **Vidéo tuto.**
  - Données fictives seulement : jamais la vraie base, le vrai mot de passe ni l'adresse du compte du tabac.
  - `public/tutoriel/video/` reste sous 20 Mo, et aucun fichier n'y dépasse 25 Mo.
  - Le MP4 n'est pas versionné.

## Review Focus

1. **Un nom de produit très long** sur une tuile à 320 px (option `longNames` de la base simulée : « Coca-Cola 33 cl — édition limitée, format familial »). Il tient en deux lignes, coupé par « … », sans élargir la page. Test : Tâche 3, étape 1 (scénario K, étape 7).
2. **La caméra refusée ou en panne** avec la nouvelle mise en page. « Démarrer la caméra » et son message restent visibles, dans le panneau, et rien ne les recouvre. Test : Tâche 4, étape 1 (scénario F).
3. **Un prénom qui commence par une lettre accentuée ou une minuscule** (« élodie »), avec l'accent composé ou décomposé. L'initiale est « É », et sa couleur ne change pas d'une fois à l'autre. Test : Tâche 6, étape 1.
4. **Un produit au seuil, mais déjà au stock idéal** (rien à acheter). La tuile dit « À racheter », jamais « 0 pack à racheter ». Test : Tâche 3, étape 1 (`tileState`).
5. **L'en-tête posé sur la caméra devant une scène claire** (un frigo blanc), et **la nuit sur chaque écran**. Les textes restent lisibles, et rien ne déborde à 320 px. Tests : Tâche 1, étape 1 (le voile sur une scène blanche) ; Tâche 7 (scénario W et captures de nuit).

---

### Task 1: La charte — couleurs, police et base

**Files:**
- Modify: `src/theme/tokens.css` (les trois blocs), `src/theme/charte.test.ts`, `src/theme/appearance.ts` (`STATUS_BAR`), `src/styles.css`, `src/main.tsx`, `index.html` (`theme-color`), `public/manifest.webmanifest`, `e2e/app-smoke.mjs` (scénario R)
- Create: `src/theme/fonts.css`, `src/theme/fonts/plus-jakarta-sans-latin-wght-normal.woff2`, `src/theme/fonts/OFL.txt`

**Interfaces:**
- Produces : les variables CSS du §6.7, que toutes les tâches suivantes utilisent :
  - existantes : `bg`, `card`, `field`, `track`, `separator`, `text`, `text-2`, `text-3`, `green`, `green-text`, `green-pale`, `orange`, `orange-text`, `orange-pale`, `blue`, `blue-text`, `blue-pale`, `red-text`, `red-pale`, `badge`, `tab-bar`, `bar-border`, `tile-indigo`, `tile-gray`, `on-color`, `camera`, `overlay`, `shadow` ;
  - nouvelles : `field-border`, `chip`, `on-chip`, `red`, `plate`, `plate-text`, `photo-badge`, `photo-badge-text`, `stock-chip` ;
  - retirées : `segment`, `pill`, `thumb`. Leurs usages passent à `chip`, à `green-pale` (pastille du prénom) et à `plate`.
- Produces : la famille `'Plus Jakarta Sans'`, déclarée dans `src/theme/fonts.css`.

- [ ] **Step 1: Write the failing tests** in `src/theme/charte.test.ts`
  - Remplacer le `test.each` des « couleurs de la spec » : une ligne par variable du tableau du §6.7, avec ses valeurs exactes de jour et de nuit. Par exemple `['bg', '#F7F7F5', '#0F1110']`, `['plate', '#F1F2EE', '#DCDDD8']`, `['chip', '#171A18', '#F2F3F1']`, `['photo-badge-text', '#A34A07', '#A34A07']`. `overlay` vaut `rgba(0, 0, 0, 0.6)` dans les deux thèmes.
  - `TEXT_PAIRS` garde ses paires, avec `track` à la place de `segment`, et sans `pill`. Il ajoute :
    `['on-chip', 'chip']`, `['plate-text', 'plate']`, `['photo-badge-text', 'photo-badge']`, `['on-color', 'red']`, `['on-color', 'stock-chip']`, `['orange-text', 'bg']`.
  - `INTERFACE_PAIRS` remplace `['text-2', 'thumb']` par `['stock-chip', 'plate']`, et ajoute `['chip', 'track']`, `['chip', 'bg']`, `['red', 'card']`.
  - Toutes ces paires passent avec les valeurs du §6.7 (calcul du 28/10/2026). Une paire qui échoue vient d'une valeur mal recopiée.
  - Le test « le segment choisi est plus clair que sa piste » devient « le choix rempli ressort de sa piste (%s) » : `contrast(chip, track) >= 3`.
  - Nouveau test « le texte posé sur la caméra reste lisible devant une scène blanche » : `--overlay` (`rgba(0, 0, 0, 0.6)`) composé sur `#FFFFFF` donne `#666666`, où `on-color` atteint 4,5:1 (5,74:1).
  - Scénario R (`e2e/app-smoke.mjs`) :
    - le fond et la barre d'état deviennent `rgb(247, 247, 245)` et `#F7F7F5` de jour, `rgb(15, 17, 16)` et `#0F1110` de nuit (`DAY` et les appels de `look()` et `expectLook()`) ;
    - de jour, la pastille du prénom (`.employee`) a pour fond `rgb(221, 240, 228)` (`green-pale`).
  - Nouveau test « la police est livrée avec l'app » :
    - `fonts.css` (`?raw`) contient `font-family: 'Plus Jakarta Sans'`, `font-display: swap`, `font-weight: 200 800` et `url('./fonts/plus-jakarta-sans-latin-wght-normal.woff2') format('woff2')` ;
    - le fichier existe (`import.meta.glob('./fonts/*.woff2')` en compte un).
  - Le test de `STATUS_BAR` reste : il suivra `bg`.

- [ ] **Step 2: Run to verify it fails**
  Run : `npx vitest run src/theme/charte.test.ts`, puis `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=R node e2e/app-smoke.mjs`
  Expected : FAIL (valeurs du jalon 4, variables absentes, `fonts.css` introuvable ; le scénario R lit encore `rgb(242, 242, 247)`).

- [ ] **Step 3: Implement**
  - `tokens.css` : les valeurs du §6.7 dans les trois blocs, la nuit écrite deux fois à l'identique.
    - `--shadow` de jour : `0 1px 2px rgba(23, 26, 24, 0.06), 0 6px 16px rgba(23, 26, 24, 0.06)` ; de nuit : `0 0 0 1px #2B2F2C`, le bord fin du §6.7.
    - `--overlay` : `rgba(0, 0, 0, 0.6)`.
    - Mettre à jour le commentaire d'en-tête (spec §6.7, design « Vitrine »).
  - La police :
    - Run : `npm pack @fontsource-variable/plus-jakarta-sans@5.3.0`. Copier `package/files/plus-jakarta-sans-latin-wght-normal.woff2` (27 348 octets) vers `src/theme/fonts/`, et `package/LICENSE` vers `src/theme/fonts/OFL.txt`. Ne rien installer.
    - `fonts.css` : un seul `@font-face`, avec la famille, `font-style: normal`, `font-weight: 200 800`, `font-display: swap` et `src: url('./fonts/plus-jakarta-sans-latin-wght-normal.woff2') format('woff2')`. Le commentaire donne la licence (SIL OFL 1.1, `OFL.txt`) et la source (le paquet et sa version).
    - L'importer dans `main.tsx`, avant `tokens.css`.
  - `styles.css` : `font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` ; `font-weight: 600` pour le texte courant (§6.7).
  - `STATUS_BAR` : `{ light: '#F7F7F5', dark: '#0F1110' }`. `theme-color` et `background_color` / `theme_color` du manifeste : `#F7F7F5`.
  - Remplacer `var(--segment)`, `var(--pill)` et `var(--thumb)` dans les feuilles :
    - le segment choisi : `chip`, avec `on-chip` pour son texte ;
    - la pastille du prénom : `green-pale`, avec `green-text` pour son texte ;
    - le fond des vignettes : `plate`.

- [ ] **Step 4: Run to verify it passes**
  Run : `npx vitest run src/theme && npm run build && npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=R node e2e/app-smoke.mjs`
  Expected : PASS, puis construction sans erreur. `dist/assets/` contient le WOFF2 avec une empreinte dans son nom.

- [ ] **Step 5: Commit**
  ```bash
  git add src/theme src/styles.css src/main.tsx index.html public/manifest.webmanifest e2e/app-smoke.mjs
  git commit -m "feat(charte): couleurs du design « Vitrine », jour et nuit, et police Plus Jakarta Sans livrée avec l'app"
  ```

### Task 2: Les composants communs

**Files:**
- Modify: `src/app/AppShell.css`, `src/app/AppShell.tsx` (en-tête), `src/app/TabBar.tsx`, `src/photos/Thumb.tsx`, `src/photos/Photos.css`, `src/ui/icons.tsx`
- Test: `e2e/app-smoke.mjs` (scénarios R et S)

**Interfaces:**
- Consumes : les variables de la Tâche 1.
- Produces :
  - `Thumb({ path?, src?, size?, fill?: boolean, emptyLabel?: boolean, onError? })` :
    - `size` donne un carré, comme aujourd'hui ;
    - `fill` remplit son parent, qui fixe la taille (une plaque) ;
    - `emptyLabel` ajoute « Pas de photo » sous l'icône.

    L'image est toujours entière (`object-fit: contain`) sur `var(--plate)`. Elle garde `img.thumb` et `loading="lazy"` ; le repli garde `span.thumb.thumb-empty`.
  - Les icônes Lucide `IconCupSoda`, `IconArchive`, `IconKeyboard` et `IconCheck`, comme les autres (`size`, `strokeWidth`).
  - Classes communes :
    - `.tile-plate` (plaque arrondie, `position: relative`) ;
    - `.photo-badge` (pastille blanche « À racheter », point `orange`) ;
    - `.stock-chip` (pastille du stock, `data-negative` en `red`) ;
    - `.section-title` (titre de section, 20 px, 800) ;
    - `.danger-group` (carte des actions rares) ;
    - `.toggle` (bouton à bascule, `aria-pressed`) ;
    - `.app[data-tab]` (l'onglet ouvert, pour la Tâche 4).

- [ ] **Step 1: Write the failing tests**
  - Scénario S, étape 2 : dans la liste du Stock, l'image de Coca reste un `img.thumb`, et `getComputedStyle(img).objectFit` vaut `contain`.
  - Scénario R, de jour à 390 px : le nom de l'onglet « Stock » mesure 11 px.

- [ ] **Step 2: Run to verify they fail**
  Run : `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=R,S node e2e/app-smoke.mjs`
  Expected : FAIL (`objectFit` vaut `cover` ; l'onglet mesure 12 px).

- [ ] **Step 3: Implement**
  - `Thumb` et `Photos.css` comme le dit l'Interface. Le repli prend `IconCupSoda` à la place de `IconPackage`.
  - `AppShell.css`, d'après le §6.7 « Formes » et « Composants » :
    - `h1` en 32 px (800, interlettrage −0,9 px) ; `.section-label` reste, comme alias de `.section-title` ;
    - boutons en 16 px d'arrondi ; `.plain` devient le bouton secondaire (fond `card`, bord `separator`) ;
    - `.card` en 22 px, `.group` en 20 px, avec `var(--shadow)` ;
    - `.segmented` : piste `track`, bord `separator` ; le choix est rempli en `chip`, texte `on-chip` ;
    - champs : fond `field`, bord 1 px `field-border`, 14 px d'arrondi, bord 2 px `accent` au focus ; `.search` en 46 px, fond `track`, bord `separator` ;
    - `.message` en 16 px d'arrondi ;
    - barre d'onglets : fond `tab-bar` ; l'icône de l'onglet actif dans une pastille de 56 × 30 px `green-pale` ; nom en 11 px partout, 700, 800 pour l'onglet actif. La règle `@media (max-width: 359px)` disparaît.
  - En-tête (`AppShell.tsx` et CSS) : le logo de 30 px, « ScanDrinks » (17 px, 800), le prénom (`.employee`, pastille `green-pale` et `green-text`, 15 px, 700), puis la roue (carré de 44 px arrondi à 14 px, fond `card`, bord `separator`).
  - `.app` reçoit `data-tab={tab}`.

- [ ] **Step 4: Run to verify it passes**
  Run : `npm test && npm run e2e`
  Expected : tout passe : les scénarios A à V, et le scénario S avec ses deux nouvelles assertions.

- [ ] **Step 5: Commit**
  ```bash
  git add src/app src/photos src/ui e2e/app-smoke.mjs
  git commit -m "feat(charte): composants communs du design « Vitrine » (en-tête, onglets, boutons, cartes, champs, photos sur plaque)"
  ```

### Task 3: Le Stock en grille et la fiche produit

**Files:**
- Modify: `src/domain/restock.ts` (`tileState`, retrait de `listState`), `src/domain/restock.test.ts`, `src/stock/StockScreen.tsx`, `src/stock/ProductSheet.tsx`, `src/stock/CodeList.tsx`, `src/stock/MovementList.tsx`, `src/stock/Stock.css`, `e2e/app-smoke.mjs` (scénarios K, S et U)
- Test: `src/domain/restock.test.ts`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `restockLine(product: Product): RestockLine`, `isLow`, `formatPacks` ; `Thumb` avec `fill` et `emptyLabel`, et les classes de la Tâche 2.
- Produces : `tileState(product: Product): { text: string; tone: 'restock' | 'check' | 'neutral' } | null`, dans `src/domain/restock.ts`. L'ordre des règles :
  1. produit archivé : ses packs (`formatPacks`), en `neutral`, ou `null` ;
  2. stock négatif : `Stock à vérifier`, en `check` ;
  3. au seuil ou en dessous : `${quantité} à racheter`, en `restock`. La quantité s'écrit comme dans À racheter : « 2 packs », « 1 pack », « 8 unités », « 1 unité ». S'il n'y a rien à acheter (`toBuy <= 0`) : `À racheter` ;
  4. sinon : ses packs, en `neutral`, ou `null`.

- [ ] **Step 1: Write the failing tests**
  - `restock.test.ts`, `describe('tileState')`, avec la fabrique de produits du fichier :

    | Produit (stock, pack, seuil, idéal) | Résultat |
    |---|---|
    | 10, 24, 24, 48 | `{ text: '2 packs à racheter', tone: 'restock' }` |
    | 4, 1, 6, 12 | `{ text: '8 unités à racheter', tone: 'restock' }` |
    | 30, 24, 30, 48 | `{ text: '1 pack à racheter', tone: 'restock' }` |
    | 5, 1, 5, 6 | `{ text: '1 unité à racheter', tone: 'restock' }` |
    | 24, 24, 24, 24 (rien à acheter) | `{ text: 'À racheter', tone: 'restock' }` |
    | −3, 24, 24, 24 | `{ text: 'Stock à vérifier', tone: 'check' }` |
    | 36, 12, 12, 24 | `{ text: '3 packs', tone: 'neutral' }` |
    | 5, 24, 0, 48 (au-dessus du seuil, moins d'un pack) | `null` |
    | archivé, 52, 24 | `{ text: '2 packs + 4', tone: 'neutral' }` |
    | archivé, −2, 24 | `null` |

    Les tests de `listState` sont retirés avec la fonction.
  - Scénario K, étape 1 (catalogue `pilotage`) :
    - `.product-state` lit `['2 packs à racheter', '8 unités à racheter', '3 packs', 'Stock à vérifier']` ;
    - son attribut `data-tone` vaut `['restock', 'restock', 'neutral', 'check']` ;
    - `.product-stock` reste `['10', '4', '36', '−3']`, avec `data-negative` sur le dernier seulement ;
    - `stock-low` reste `[true, true, false, true]` ;
    - quatre « Pas de photo » (aucun produit n'a d'image) ;
    - trois `.photo-badge` « À racheter » (Coca, Évian, Red Bull).

    Les tuiles s'ouvrent toujours par `getByRole('button', { name: /^Coca-Cola 33 cl/ })` : le nom accessible commence par le nom.
  - Scénario K, étape 5, le bouton « Archivés » : `aria-pressed="false"` au départ, `true` après un toucher, puis les assertions d'aujourd'hui (Coca et Oasis). Le toucher sur « Actifs » devient un second toucher sur « Archivés » (`aria-pressed="false"`), ici et dans le scénario U.
  - Scénario K, étape 7 (option `longNames`, à 320 px), Review Focus 1 :
    - le contrôle `overflows()` vérifie aussi `.product-row` ;
    - sur le Stock, chaque `.product-name` tient en deux lignes (`scrollHeight` au plus `2 × line-height + 1`).
  - Scénario S, étape 2 : la tuile d'Évian 50 cl (sans image) montre « Pas de photo ».
  - Scénario K, étape 3, la fiche de Coca :
    - `.sheet-head img.thumb` ou `.sheet-head .thumb-empty` avec « Pas de photo » ;
    - la pastille `.sheet-restock` « 2 packs à racheter » ;
    - `.sheet-stock-value` « 10 » ;
    - `.sheet-figures` avec Pack Metro 24, Seuil 24, Stock idéal 48.

- [ ] **Step 2: Run to verify they fail**
  Run : `npx vitest run src/domain/restock.test.ts` puis `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=K,S,U node e2e/app-smoke.mjs`
  Expected : FAIL (`tileState` absent ; textes de `listState` ; pas de bouton « Archivés » à bascule).

- [ ] **Step 3: Implement `tileState`** in `src/domain/restock.ts`, en réutilisant `buyAmount`.

- [ ] **Step 4: Implement the Stock grid** (`StockScreen.tsx`, `Stock.css`, maquette C1-Stock)
  - Titre « Stock » et `.pill-button` « Nouveau produit » (plein, vert, icône +).
  - Une rangée : la recherche, puis le bouton à bascule `.toggle` « Archivés » (`IconArchive`, `aria-pressed`). Il remplace le `.segmented` « Actifs / Archivés ».
  - `ul.stock-list.stock-grid` (`aria-label="Produits"`) : 2 colonnes, 12 px d'écart.
  - Chaque `button.product-row` (+ `stock-low` comme aujourd'hui), dans cet ordre :
    1. `.tile-text` : `.product-name` (15 px, 700, deux lignes au plus, puis « … ») et `.product-state[data-tone]` (13 px ; `orange-text`, `red-text` ou `text-2`) ;
    2. `.product-stock.stock-chip` (`data-negative` si le stock est négatif), posé sur la photo en bas à droite ;
    3. `.tile-photo.tile-plate` (`aria-hidden`), 104 px de haut, avec `<Thumb fill emptyLabel>` et `.photo-badge` « À racheter » pour un produit actif au seuil.

    La grille met la photo en haut (`grid-template-areas`), sans changer l'ordre du DOM. Le nom accessible commence donc par le nom.
  - Tuile : 20 px d'arrondi, fond `card`, `var(--shadow)`. Sur un iPhone de 390 × 844, six tuiles entières sous la recherche.
  - « Mis à jour à » reste en bas.

- [ ] **Step 5: Implement the product sheet** (`ProductSheet.tsx`, `CodeList.tsx`, `MovementList.tsx`, `Stock.css`, maquette C1-Fiche)
  - « Retour » ; `.sheet-head` : une plaque de 220 px avec `<Thumb fill emptyLabel>` et `.photo-badge` s'il y a lieu ; puis le `h1` du nom (27 px).
  - `.sheet-stock`, une carte :
    - « Stock » ;
    - `.sheet-restock` (le `text` de `tileState` quand `tone` vaut `restock` ; fond `orange-pale`, texte `orange-text`) ;
    - `.check-badge` « Stock à vérifier » (fond `red`, texte `on-color`) ;
    - `.sheet-stock-value` en 48 px (800), « unités », puis `.sheet-stock-packs` ;
    - `.sheet-figures` en trois cases (fond `bg`, 14 px d'arrondi).
  - `.sheet-actions` : « Corriger le stock » et « Modifier » côte à côte (teintés).
  - Codes :
    - le `.section-title` « Codes » ;
    - une carte de `.code-row` : `Thumb` de 68 px (le bouton de photo garde son nom), `.code-value` (16 px, 700, chiffres tabulaires), `.code-meta`, puis « Modifier » et « Retirer » en liens dessous ;
    - « Ajouter un code » teinté, sur toute la largeur.
  - Mouvements :
    - le `.section-title` « Derniers mouvements » ;
    - pour chaque ligne, une pastille de 36 px (`+` sur `green-pale`, `−` sur `orange-pale`, `=` sur `blue-pale`, `aria-hidden`), puis `.movement-title` en couleur et `.movement-meta`.
  - `.danger-group` : « Archiver le produit » (ou « Réactiver », plein, hors du groupe) et « Supprimer le produit », en lignes rouges dans une carte.
  - Les formulaires ouverts depuis le Stock (`ProductCreateForm`, `ProductEditForm`, `AddCodeForm`, `CorrectStockForm`) gardent leur structure et prennent le style commun de la Tâche 2. Leurs nombres passent en ligne à la Tâche 4.

- [ ] **Step 6: Run to verify they pass**
  Run : `npm test && npm run e2e`
  Expected : PASS, A à V.

- [ ] **Step 7: Commit**
  ```bash
  git add src/domain/restock.ts src/domain/restock.test.ts src/stock e2e
  git commit -m "feat(stock): grille de photos, état des tuiles (tileState), bouton « Archivés » et fiche produit du design « Vitrine »"
  ```

### Task 4: Le Scanner — la caméra en haut, le panneau en bas

**Files:**
- Modify: `src/scanner/ScannerScreen.tsx`, `src/scanner/ConfirmCard.tsx`, `src/scanner/CountCard.tsx`, `src/scanner/ArchivedCard.tsx`, `src/scanner/Notice.tsx`, `src/scanner/Scanner.css`, `src/inventory/CountFields.tsx`, `src/inventory/Inventory.css`, `src/products/HelpField.tsx`, `src/products/NewProductForm.tsx`, `src/products/AttachForm.tsx`, `src/products/ManualEntry.tsx`, `src/products/Products.css`, `src/stock/ProductFieldInputs.tsx`, `src/photos/CodePhotoPicker.tsx`, `src/photos/Photos.css`, `src/app/AppShell.css`
- Test: `e2e/app-smoke.mjs` (scénarios A, D, F, I et L)

**Interfaces:**
- Consumes : `.app[data-tab]`, `Thumb` avec `fill`, `IconKeyboard`, `IconCheck`, `IconPlus`.
- Produces :
  - `.viewfinder[data-size]`, qui vaut :
    - `full` : rien d'ouvert ;
    - `half` : `looking_up`, `confirm` en Entrée ou en Sortie, `unknown`, `archived` ;
    - `small` : `new_product`, `attach`, `manual`, et `confirm` en Inventaire.

    Il remplace `data-compact`.
  - `HelpField` reçoit `inline?: boolean` : le libellé et l'aide à gauche, la case de 84 px à droite, et la classe `field-inline`. Les nombres d'une fiche passent en ligne partout où on la crée ou la modifie : `NewProductForm` (Scanner) et `ProductFieldInputs` (Stock).

- [ ] **Step 1: Write the failing tests**
  - Scénario A (Entrée) :
    - `.viewfinder` a `data-size="full"`, puis `half` quand la fiche de confirmation s'ouvre ;
    - le groupe « Mode » est dans `.viewfinder` ;
    - l'en-tête (`.app-header`) est posé sur la caméra : son `getBoundingClientRect().top` est au-dessus du `bottom` de `.viewfinder` ;
    - « Valider » est à gauche d'« Annuler » (`x` plus petit), et plus large.
  - Scénario I (inventaire) : `data-size="small"` avec les deux cases du comptage.
  - Scénario F (caméra en panne, Review Focus 2) :
    - « Démarrer la caméra » est dans `.panel` ;
    - `elementFromPoint` au centre du bouton renvoie le bouton ou un de ses enfants.
  - Scénarios D (« Nouveau produit » au Scanner) et L (« Nouveau produit » et « Modifier » depuis le Stock) : chaque champ de nombre a la classe `field-inline`. Leurs noms (« Ce code vaut (unités) », etc.) ne changent pas.

- [ ] **Step 2: Run to verify they fail**
  Run : `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=A,D,F,I,L node e2e/app-smoke.mjs`
  Expected : FAIL (`data-size` absent, modes hors du viseur).

- [ ] **Step 3: Implement the layout** (`ScannerScreen.tsx`, `Scanner.css`, `AppShell.css`, maquettes C2)
  - Le viseur occupe toute la largeur, haut de l'écran compris : marges négatives égales au rembourrage du `body`, zone sûre comprise. Hauteurs : `full` 64dvh, `half` 46dvh, `small` 30dvh, 220 px au moins.
  - `.app[data-tab='scanner'] .app-header` est posé sur la caméra, en position absolue, sous la zone sûre, sur le voile sombre du §6.7 :
    - derrière l'en-tête, zone sûre comprise, un voile `var(--overlay)`, qui s'efface en dégradé vers `transparent` juste dessous. « ScanDrinks » reste ainsi lisible devant une scène claire (test de la Tâche 1) ;
    - « ScanDrinks » en `on-color` ; le prénom et la roue sur `var(--overlay)`, texte `on-color`.
  - Les modes, dans le viseur sous l'en-tête (ils gardent les classes `.modes` et `.mode`, que vérifie le scénario K) :
    - la piste sur `var(--overlay)` (et un flou de 12 px) ;
    - le mode choisi rempli de sa couleur (`green`, `orange` ou `blue`), texte `on-color` ;
    - les autres en `on-color`, à 50 % quand ils sont désactivés.
  - `.aim-hint` : une pastille `var(--overlay)`, texte `on-color`, 15 px, 700, centrée en bas du viseur.
  - `.panel` :
    - remonte de 28 px sur le viseur ;
    - fond `card`, arrondi de 28 px en haut, sur toute la largeur ;
    - il contient aussi `.camera-problem` (déplacé dedans, en tête).

    Les `.card` du panneau perdent leur fond, leur ombre et leur rembourrage.

- [ ] **Step 4: Implement the panel's contents**
  - `ConfirmCard` (maquette C2-Sortie) :
    - `.confirm-head` devient une plaque de 124 px, en rangée : la photo à gauche (`<Thumb fill emptyLabel>`), puis à droite une carte (`card`, `var(--shadow)`, 18 px d'arrondi) qui porte `.confirm-delta` (40 px, 800, `accent-text`) et « unités » (`text-3`). De nuit, cette carte suit le thème : sombre sur la plaque claire ;
    - puis le `.card-title` et `.confirm-what` ;
    - le sélecteur de quantité : une piste bordée de 48 px, « + » sur `accent-pale` ;
    - « Valider » plein `accent` avec `IconCheck` ; l'ordre de `.card-actions` ne change pas.
  - `CountCard` et `CountFields` (maquette C2-Inventaire) :
    - une plaque de 72 px et le nom ;
    - « Stock connu » ;
    - deux cases de 62 px (28 px, 800, centrées) sur deux colonnes ; `.count-total` et `.count-gap` restent.
  - Code inconnu (`ScannerScreen`, maquette C2-Inconnu) :
    - le `h2` garde « Code inconnu : {code} » et peut passer à la ligne ;
    - « Open Food Facts : … » dans un encadré `.off-name` (fond `bg`) ;
    - « Nouveau produit » (plein, `IconPlus`), « Ajouter à un produit existant » (`plain`), « Annuler » (lien).
  - `NewProductForm` et `CodePhotoPicker` (maquette C2-Nouveau) :
    - l'aperçu devient une plaque de 176 px (`<Thumb fill>`) ;
    - le titre, l'aide et les liens restent dessous, avec leurs textes ;
    - les quatre nombres en `HelpField inline` ;
    - « Créer le produit » plein, puis « Annuler » (`plain`).
  - `AttachForm`, `ManualEntry` et `ArchivedCard` : le même style de panneau.
  - `Notice` :
    - la bande `green-pale`, avec une pastille ronde `green` et `IconCheck` ;
    - `.notice-title` (15 px, 800) et `.notice-detail` ;
    - « Annuler » en lien.

    Puis « Saisie manuelle » en `plain` avec `IconKeyboard`.

- [ ] **Step 5: Run to verify they pass**
  Run : `npm test && npm run e2e`
  Expected : PASS, A à V.

- [ ] **Step 6: Commit**
  ```bash
  git add src/scanner src/inventory src/products src/stock/ProductFieldInputs.tsx src/photos src/app/AppShell.css e2e/app-smoke.mjs
  git commit -m "feat(scanner): caméra en haut, en-tête et modes posés dessus, panneau du bas (design « Vitrine »)"
  ```

### Task 5: À racheter, Ventes et Historique

**Files:**
- Modify: `src/shopping/ShoppingScreen.tsx`, `src/shopping/Shopping.css`, `src/sales/SalesScreen.tsx`, `src/sales/SalesRecap.tsx`, `src/sales/Sales.css`, `src/history/HistoryScreen.tsx`, `src/history/History.css`, `src/app/AppShell.tsx` (le catalogue passé à l'Historique)
- Test: `e2e/app-smoke.mjs` (scénarios M et S)

**Interfaces:**
- Consumes : `Thumb`, `Catalog` (`useCatalog`).
- Produces : `HistoryScreen` reçoit `catalog: Catalog`. La photo de chaque ligne vient de `photoOf = new Map(products.map((p) => [p.id, p.photoPath]))`, comme dans `SalesScreen`. Un produit absent du catalogue (supprimé, ou catalogue pas encore lu) donne l'icône de repli.

- [ ] **Step 1: Write the failing tests**
  - Scénario S (catalogue `images`) : dans l'Historique, la ligne de Coca contient un `img.thumb`, et celle d'Évian 50 cl un `.thumb-empty`.
  - Scénario M : une ligne annulée garde sa photo. Son titre est barré (`text-decoration-line` contient `line-through`).

- [ ] **Step 2: Run to verify they fail**
  Run : `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=S node e2e/app-smoke.mjs`
  Expected : FAIL (pas de photo dans l'Historique).

- [ ] **Step 3: Implement** (maquettes C3)
  - À racheter :
    - une carte par produit (bouton), avec `Thumb` de 76 px, `.row-title` et `.row-sub` (« Reste 10 », et « · stock à vérifier » en `red-text`) ;
    - à droite, `.buy-amount` (22 px, 800, `orange-text`) et `.buy-note` ;
    - 10 px entre les cartes. L'ordre et les textes ne changent pas.
  - Ventes :
    - « Jour des ventes » en grand champ (52 px, flèche) ;
    - « Déjà saisi » et « À saisir » en `.section-title`, leurs lignes en cartes avec `Thumb` de 52 px ;
    - `.sales-input` de 92 × 48 px (20 px, 800, centré) ;
    - `.sales-total` dans un encadré (fond `card`, 18 px d'arrondi), même texte ;
    - « Valider » plein. Le récapitulatif prend les mêmes styles.
  - Historique :
    - `Thumb` de 50 px en tête de ligne ;
    - `.history-title` (16 px, 700) et `.history-amount` (17 px, 800, couleur du type) sur une ligne, puis `.history-meta` ;
    - « Annuler » en lien sous la ligne ;
    - une ligne annulée barrée et à 60 % ;
    - « Voir plus » en `plain`.
  - `AppShell.tsx` passe `catalog` à `HistoryScreen`.

- [ ] **Step 4: Run to verify they pass**
  Run : `npm test && npm run e2e`
  Expected : PASS, A à V.

- [ ] **Step 5: Commit**
  ```bash
  git add src/shopping src/sales src/history src/app/AppShell.tsx e2e/app-smoke.mjs
  git commit -m "feat(listes): À racheter, Ventes et Historique en cartes avec les photos (design « Vitrine »)"
  ```

### Task 6: Connexion, prénom, Réglages, tutoriel et mot de passe

**Files:**
- Create: `src/auth/nameTone.ts`, `src/auth/nameTone.test.ts`, `src/auth/drinks/` (six dessins SVG)
- Modify: `src/auth/LoginScreen.tsx`, `src/auth/NameScreen.tsx`, `src/settings/SettingsScreen.tsx`, `src/settings/Settings.css`, `src/settings/Tutorial.css`, `src/settings/ChangePasswordScreen.tsx`, `src/app/AppShell.css` (`.login`), `e2e/app-smoke.mjs`, `e2e/fakeSupabase.mjs` (option `employees`)
- Test: `src/auth/nameTone.test.ts`, `e2e/app-smoke.mjs` (scénario A)

**Interfaces:**
- Produces :
  - `initialOf(name: string): string` : le premier caractère de `name.trim().normalize('NFC')` (lu avec `Array.from`), en majuscule (`toLocaleUpperCase('fr-FR')`) ; `''` pour un nom vide ;
  - `nameTone(name: string): 'green' | 'orange' | 'blue' | 'red'` : la somme des `codePointAt` des caractères de `name.trim().normalize('NFC')`, modulo 4, dans l'ordre vert, orange, bleu, rouge ;
  - base simulée : `installFakeSupabase(page, { employees: string[] })`. `list_employees` renvoie alors cette liste, triée à la française ; sans elle, rien ne change (la liste du catalogue `tutoriel`, vide ailleurs).

- [ ] **Step 1: Write the failing tests**
  - `nameTone.test.ts` :
    - `initialOf('Sam')` → `'S'` ; `initialOf('élodie')` et `initialOf('élodie')` (accent décomposé) → `'É'` ; `initialOf('  Léa')` → `'L'` ; `initialOf('')` → `''` ;
    - `nameTone` : `'Karim'` → `'green'`, `'Sam'` → `'orange'`, `'Léa'` → `'blue'`, `'Hugo'` → `'red'` (les quatre teintes, calculées le 28/10/2026) ;
    - `nameTone('élodie')` vaut `nameTone('élodie')`, `nameTone(' Sam ')` vaut `nameTone('Sam')`, et `nameTone('')` vaut `'green'`.
  - Scénario A, avant la connexion : `.login-mosaic` a `aria-hidden="true"` et six images. Le formulaire garde « Mot de passe » et « Se connecter ».
  - Scénario A, étapes 1-2, avec `employees: ['Léa', 'Sam']` pour la base simulée :
    - après la connexion, « Qui es-tu ? » montre deux cartes ;
    - `getByRole('button', { name: 'Sam', exact: true })` existe, et contient un `.name-initial` « S » avec `aria-hidden="true"` ;
    - le scénario touche cette carte, au lieu d'appeler `signIn`.

- [ ] **Step 2: Run to verify they fail**
  Run : `npx vitest run src/auth/nameTone.test.ts`, puis `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=A node e2e/app-smoke.mjs`
  Expected : FAIL (module absent ; ni mosaïque ni initiale).

- [ ] **Step 3: Implement** (maquettes C4)
  - `nameTone.ts`.
  - `NameScreen` :
    - `.choices` en grille de deux colonnes ;
    - chaque prénom est une carte de 112 px de haut, avec `.name-initial` (rond de 48 px, `aria-hidden`, fond `{tone}-pale` et texte `{tone}-text` : vert, orange, bleu, ou `red-pale` et `red-text`) et le prénom en 18 px (800) ;
    - puis la carte « Nouveau prénom » et « C'est moi » plein.
  - `LoginScreen` :
    - `.login-mosaic` (`aria-hidden`) : 3 × 2 plaques (`plate`, 22 px d'arrondi), chacune avec un dessin de `src/auth/drinks/` importé comme adresse (`import cola from './drinks/cola.svg'`) ;
    - un fondu vers `bg` en bas (`linear-gradient` sur des variables) ;
    - le logo de 72 px, « ScanDrinks » en 34 px, le sous-titre ;
    - le formulaire en carte : le compte en lecture seule sur fond `plate`, puis « Se connecter » plein. La note reste centrée.

    Les SVG reprennent les dessins des maquettes. Ce sont des fichiers `.svg`, que `charte.test.ts` ne lit pas, et des décorations qui ne changent pas de nuit.
  - `SettingsScreen` :
    - lignes en cartes (`.group` de 20 px), tuiles d'icônes de 36 px arrondies à 11 px ;
    - Apparence : le `.segmented` de la Tâche 2 ;
    - « Se déconnecter » dans un `.danger-group` à part.
  - `Tutorial.css` : le lecteur dans une carte arrondie à 22 px.
  - `ChangePasswordScreen` : le formulaire en carte, déjà couvert par les classes communes. Vérifier seulement à la capture.

- [ ] **Step 4: Run to verify they pass**
  Run : `npm test && npm run e2e`
  Expected : PASS, A à V.

- [ ] **Step 5: Commit**
  ```bash
  git add src/auth src/settings src/app/AppShell.css e2e/app-smoke.mjs e2e/fakeSupabase.mjs
  git commit -m "feat(design): connexion avec mosaïque, prénoms en cartes, Réglages et tutoriel du design « Vitrine »"
  ```

### Task 7: Les contrôles du design — nuit, 320 px, police, captures

**Files:**
- Modify: `e2e/app-smoke.mjs` (nouveau scénario W), `e2e/screens.mjs`
- Test: `e2e/app-smoke.mjs`

- [ ] **Step 1: Write the scenario** `W (design)`, ajouté à la table des scénarios (`['W', scenarioDesign]`).
  - Le contrôle `overflows()` du scénario K (étape 7) devient une fonction du fichier, que K et W partagent. Elle reçoit la largeur de la fenêtre.
  - Pour `colorScheme` `light` puis `dark`, et pour les fenêtres 390 × 844 et 320 × 640, en catalogue `pilotage` avec `longNames` : le Scanner, À racheter, le Stock, la fiche de Coca, les Ventes, l'Historique et les Réglages. Sur chacun, `overflows()` renvoie `[]`.
  - La police :
    - la réponse de l'adresse du WOFF2 est 200 ;
    - `document.fonts.check('600 17px "Plus Jakarta Sans"')` est vrai après `document.fonts.ready` ;
    - `getComputedStyle(document.body).fontFamily` commence par `"Plus Jakarta Sans"`.

- [ ] **Step 2: Run** `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=K,W node e2e/app-smoke.mjs`
  Expected : PASS. Un débordement trouvé ici se corrige dans la feuille de l'écran (une tâche précédente), avant de continuer.

- [ ] **Step 3: Captures.**
  - `screens.mjs` capture aussi en 320 × 640 (dossiers `jour-320` et `nuit-320`), en plus des captures actuelles.
  - La capture `prenom` passe `employees: ['Hugo', 'Karim', 'Léa', 'Sam']` à la base simulée : les quatre teintes.
  - Ajouter la capture `historique-images` (catalogue `images`).
  - Run : `npm run screens`.
  - Relire chaque image à côté de sa maquette (`docs/maquettes/vitrine/`). Le Stock montre six tuiles entières sous la recherche à 390 × 844 (§6.7). Noter dans le registre chaque écart gardé, avec sa raison.

- [ ] **Step 4: Commit**
  ```bash
  git add e2e
  git commit -m "test(design): scénario W (débordement à 320 px, nuit, police) et captures en 320 px"
  ```

### Task 8: La vidéo tuto refaite, et la documentation

**Files:**
- Modify: `scripts/tutorial/*.mjs` (seulement si le script ne trouve plus un écran), `public/tutoriel/video/` (HLS refait), `README.md`, `docs/superpowers/specs/2026-10-19-scandrinks-design.md` (statut seulement)
- Create: `docs/jalon-7-test.md`

La feuille A4 ne change pas (§9) : elle ne montre aucun écran, et ses mots restent justes.

- [ ] **Step 1: Refaire la vidéo**
  Run : `npm run tutorial`
  Expected : les trois contrôles passent, `check.mjs --raw` puis le final. `public/tutoriel/video/` reste sous 20 Mo, et aucun fichier n'y dépasse 25 Mo. Le MP4 n'est pas versionné.

  Si le script s'arrête sur un écran qui a changé, adapter son attente (le sélecteur), jamais son texte ni sa durée.

- [ ] **Step 2: `docs/jalon-7-test.md`**, le guide d'essai du porteur du projet, sur le modèle de `docs/jalon-6-test.md` :
  - la préversion `https://jalon-7.scandrinks.pages.dev`, ouverte dans Safari sans l'installer, sur la vraie base ;
  - chaque écran de jour puis de nuit (Réglages › Apparence), en suivant l'ordre des onglets ;
  - une journée type : une entrée et une sortie (annulées ensuite dans l'Historique), une fin de journée laissée au récapitulatif sans « Enregistrer » ;
  - « Si quelque chose cloche » ;
  - « Ce que tu me renvoies : « OK », ou l'écran et une capture ».
- [ ] **Step 3: README**
  - Une section « Jalon 7 — le design « Vitrine » » (charte, police, tests, guide) ;
  - le lien du plan dans le statut.
- [ ] **Step 4: Run** `npm test && npm run build && npm run e2e`
  Expected : PASS.
- [ ] **Step 5: Commit**
  ```bash
  git add public/tutoriel README.md docs scripts
  git commit -m "docs(jalon-7): vidéo tuto refaite au nouveau design, guide d'essai et README"
  ```

### Task 9: Mise en service

- [ ] **Step 1:** Pousser `jalon-7`. Vérifier que la préversion sert la nouvelle version : le fichier de la police et la dernière empreinte d'`App-*.js`.
- [ ] **Step 2:** Le porteur du projet suit `docs/jalon-7-test.md` sur son iPhone, puis renvoie « OK », ou l'écran et une capture. Chaque retour se corrige avec un test qui échoue d'abord, quand c'est un comportement.
- [ ] **Step 3:** Sur son « go » :
  ```bash
  npm test && npm run build && npm run e2e
  git checkout main && git merge --ff-only jalon-7 && git push origin main
  ```
  Puis vérifier que `https://scandrinks.pages.dev` sert la même empreinte d'`App-*.js` que la construction locale.
- [ ] **Step 4:** Mettre le statut du README à « jalon 7 en ligne » sur `main`, et le pousser.
