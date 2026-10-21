# ScanDrinks — Refonte visuelle et images des codes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Donner à ScanDrinks l'allure d'une app iPhone, de jour comme de nuit, avec le choix de l'Apparence dans les Réglages. Donner aussi une image à chaque code-barres : celle d'Open Food Facts, recopiée, ou une photo de l'équipe. C'est la première partie du jalon 4 : la vidéo et la feuille A4 montreront l'app finale (spec §9).

**Architecture :**
- **Charte.** Toutes les couleurs sont des variables CSS, définies une seule fois dans `src/theme/tokens.css`.
  - Le jour est dans `:root`.
  - La nuit apparaît deux fois, à l'identique : en « Automatique » (`@media (prefers-color-scheme: dark)` sur `:root:not([data-theme='light'])`) et en « Sombre » (`:root[data-theme='dark']`).
  - Un test lit ce fichier. Il vérifie les valeurs de la spec, les mêmes variables dans les trois blocs et les contrastes. Il vérifie aussi qu'aucune autre feuille ni aucun composant n'écrit une couleur en dur.
- **Apparence.** `src/theme/appearance.ts` garde le choix de chaque téléphone, comme le mode du Scanner. Il le pose sur `<html data-theme>` avant le premier rendu ; en « Automatique », l'attribut est absent et le CSS suit l'iPhone. La couleur de la barre d'état (`theme-color`) suit le fond.
- **Composants.** Les styles communs vivent dans `src/app/AppShell.css` : boutons, champs, cartes, listes groupées, sélecteurs, bandes de message, en-tête et onglets. Chaque écran garde sa feuille. Les icônes Lucide sont des composants React, dans `src/ui/icons.tsx`.
- **Textes et tests.**
  - Les textes de l'interface ne changent pas, sauf ceux que la spec ou ce plan ajoutent.
  - Quand une phrase se découpe à l'écran, les morceaux viennent de fonctions pures testées. C'est le cas de la fiche de confirmation, du message, des listes et de l'Historique.
  - La phrase entière reste lue par VoiceOver. Sur un bouton, elle va dans son `aria-label`. Sur une ligne d'Historique ou de mouvements, elle est en texte masqué à l'écran, et la mise en page visible est `aria-hidden`.
- **Images, la base.** Une migration ajoute :
  - les colonnes `photo_path` et `photo_source` aux codes ;
  - l'image du produit dans `product_stock`, et celle du code dans `lookup_barcode` ;
  - la fonction `set_barcode_photo` ;
  - le compartiment privé `photos` et ses deux règles d'accès.
- **Images, l'app.**
  - Chaque image est réduite en JPEG (480 px de côté au plus, qualité 0,8), envoyée au stockage sous un nom neuf, puis reliée au code.
  - Elle s'affiche par des liens signés d'une heure, demandés par lots et gardés 50 minutes.
  - À la création, la fiche est enregistrée d'abord, l'image ensuite : un échec ne bloque rien.
  - Depuis la fiche produit, toucher l'image d'un code ouvre l'appareil photo de l'iPhone (`<input type="file" accept="image/*" capture="environment">`).

**Tech Stack :** celle des jalons 1 à 3, sans nouvelle dépendance : React 19, TypeScript 7 strict, Vite 8, Vitest 5, Playwright 1.56.1, supabase-js 2.117.2 (dont son module de stockage). Pour les tests, ffmpeg, déjà sur le poste, fabrique une image JPEG.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, surtout :
- §3, §4.1 à §4.7 (les écrans et les images) ;
- §6.3 à §6.7 (données, sécurité, Open Food Facts, charte) ;
- les lignes « images » du §7 et du §8 ;
- §9 (« Déroulé »), §10, et §11 (décisions du 21/10/2026).

**Maquettes :** `docs/maquettes/`, copie de la page « Style A — tous les écrans » du canevas validé, avec un README qui associe chaque fichier à son écran. Les tailles, les marges et les rayons se lisent dans leur code. En cas d'écart, la charte (§6.7) et ce plan l'emportent, et les textes restent ceux de l'app.

**Place dans le jalon 4 :**
- Ce plan s'exécute en premier, sur la branche `jalon-4`.
- Le plan du jalon 4 (`2026-10-21-jalon-4-mise-en-service.md`, amendé le même jour) reprend ensuite à sa Tâche 1.
- Son essai sur iPhone (sa Tâche 4) porte aussi sur la refonte : le look, le mode nuit et les photos.

**Périmètre :**
- **Traité ici :** tous les écrans du §4 à la charte ; l'Apparence (§4.6) ; les images (§4.7, §6.3 à §6.6) ; les lignes « images » du §7 et du §8.
- **Pas ici :** la vidéo, la feuille, la remise à zéro et les corrections s3, s7 et s8 (plan du jalon 4). La ligne « Tutoriel » des Réglages arrive avec la Tâche 1 du jalon 4.

**Relecture finale :** la relecture de tout ce plan (executing-plans) a lieu après la Tâche 6. La Tâche 7, sur le vrai projet, ne change pas de code : elle vient ensuite.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français. Identifiants et noms de fichiers en anglais.
  - Apostrophe droite `'` dans les textes de l'interface. Le signe moins affiché est U+2212 (`−`).
  - Espace insécable (U+00A0) avant « : » seulement dans les textes d'aide de `fieldHelp.ts`, comme aux jalons précédents.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit la version de production.
- **Navigation.** Une seule page, sans changement d'URL (spec §6.2). Le Scanner reste monté ; sa caméra s'arrête hors du Scanner.
- **iPhone.**
  - iOS 16.4 au minimum : aucune fonction CSS plus récente que Safari 16.4 (pas de `light-dark()`, par exemple).
  - Champs de saisie en 17 px (16 px au moins). Zones tactiles de 44 px au moins.
  - Rien ne dépasse en largeur à 320 px, ni ne passe sous la barre d'onglets.
- **Charte (spec §6.7).**
  - Couleurs : seulement les variables de `tokens.css`.
  - Contrastes : 4,5:1 pour un texte, 3:1 pour un élément d'interface, de jour comme de nuit.
  - Police du système. Tailles 32, 20, 17, 15, 13 et 12 px ; grands nombres de 34 à 40 px en 800.
  - Rayons de 14 à 18 px pour les cartes et les listes, de 12 à 14 px pour les boutons et les champs ; pastilles rondes.
  - Icônes au trait de Lucide (licence ISC, mentionnée dans le code), en SVG dans le code.
- **Textes.** Ceux de l'app restent tels quels, sauf ceux que la spec change ou que ce plan donne. Les textes des maquettes ne s'imposent pas.
- **Images (spec §4.7, §6.3, §6.4, §6.6).**
  - Compartiment privé `photos`, chemin `codes/<code>/<uuid>.jpg`, JPEG de 480 px de côté au plus, en qualité 0,8.
  - Liens signés d'une heure. Une nouvelle image a un nouveau nom ; l'ancienne n'est jamais supprimée.
  - Les images montrent les produits, jamais les personnes.
  - Une image d'Open Food Facts porte la mention « Image : Open Food Facts » (spec §6.6). L'app ne télécharge que des adresses `https://images.openfoodfacts.org/`.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`), organisation « ScanDrinks ». Ne jamais toucher à l'organisation ni au projet « Webia ».
  - La nouvelle migration ne contient aucune instruction destructive : ni `drop`, ni `delete`, ni `truncate`, même dans un corps de fonction. Les migrations existantes ne sont jamais modifiées.
  - La migration reste compatible avec l'app en service sur `main` (jalons 1 à 3) : colonnes ajoutées à la fin, mêmes signatures.
- **Mots de passe.** Jamais demandés, affichés, écrits ni journalisés.
- **Tests de bout en bout.** Données fictives seulement, avec la base et le stockage simulés. Aucune requête ne sort vers Internet.
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées.
- **Fusion** dans `main` : pas dans ce plan (Tâche 9 du jalon 4, avec l'accord du porteur du projet).

## Review Focus

1. **Une vraie photo d'iPhone** depuis la fiche : grande (12 Mpx), convertie depuis le HEIC, prise en portrait (orientation EXIF).
   - Attendu : une image droite, de 480 px au plus, d'environ 30 à 60 Ko, sans bloquer l'écran.
   - Tests : étape EXIF du scénario e2e S (Tâche 6) ; essai sur iPhone (Tâche 4 du jalon 4).
2. **Un envoi de photo qui ne répond jamais** (réseau bloqué dans la réserve).
   - Attendu : au bout de 15 s au plus, la fiche est là, avec « Photo non enregistrée : réessaie depuis la fiche du produit. ». Aucun doublon.
   - Test : étape « envoi bloqué » du scénario S (Tâche 6).
3. **Des noms très longs à 320 px de large.**
   - Attendu : aucune barre de défilement horizontale. Le nom passe à la ligne, le nombre et le chevron restent visibles.
   - Test : étape « noms longs » du scénario K (Tâche 3).
4. **Une couleur écrite en dur oubliée** dans un composant.
   - Attendu : aucune. Sinon, un écran devient illisible de nuit.
   - Test : `charte.test.ts`, « aucune couleur écrite en dur » (Tâche 1).
5. **Une image qui ne s'affiche pas** : fichier absent, lien expiré, réseau coupé.
   - Attendu : l'icône grise, jamais l'image cassée du navigateur. Un lien n'est pas réutilisé au-delà de 50 minutes.
   - Tests : étape « image absente » du scénario S (Tâche 5) ; `photoUrls.test.ts` (Tâche 5).

---

### Task 1: Charte, Apparence et coquille

**Files:**
- Create:
  - `src/theme/tokens.css`, `src/theme/charte.test.ts`, `src/theme/appearance.ts`, `src/theme/appearance.test.ts` ;
  - `src/ui/icons.tsx`, `src/settings/Settings.css` ;
  - `e2e/helpers.mjs`, `e2e/screens.mjs`.
- Modify:
  - `index.html`, `public/manifest.webmanifest`, `src/main.tsx`, `src/styles.css` ;
  - `src/app/AppShell.css`, `src/app/AppShell.tsx`, `src/app/TabBar.tsx` ;
  - `src/auth/LoginScreen.tsx`, `src/auth/NameScreen.tsx`, `src/settings/SettingsScreen.tsx`, `src/settings/ChangePasswordScreen.tsx` ;
  - les autres feuilles de `src/` (`Scanner.css`, `Products.css`, `Inventory.css`, `Stock.css`, `Shopping.css`, `History.css`) : leurs couleurs seulement ;
  - `e2e/app-smoke.mjs`, `package.json`, `.gitignore`.

**Interfaces:**
- Produces :
  - **`src/theme/tokens.css`**, la seule source des couleurs. Les deux blocs de nuit ont `color-scheme: dark`, le jour `color-scheme: light`.

    | Variable | Jour | Nuit | Rôle |
    |---|---|---|---|
    | `--bg` | `#F2F2F7` | `#000000` | fond |
    | `--card` | `#FFFFFF` | `#1C1C1E` | cartes et listes |
    | `--field` | `#F2F2F7` | `#2C2C2E` | champs |
    | `--track` | `#E3E3E8` | `#2C2C2E` | pistes des sélecteurs et de la recherche |
    | `--separator` | `#E5E5EA` | `#38383A` | séparateurs |
    | `--text` | `#1C1C1E` | `#FFFFFF` | texte |
    | `--text-2` | `#6C6C70` | `#98989F` | texte secondaire |
    | `--text-3` | `#3A3A3C` | `#EBEBF0` | texte sur une piste ou une pastille |
    | `--pill` | `#E5E5EA` | `#2C2C2E` | pastille du prénom |
    | `--green` | `#1F6F3F` | `#26804A` | vert des boutons pleins |
    | `--green-text` | `#1F6F3F` | `#4CD07D` | vert des textes et des icônes |
    | `--green-pale` | `#E7F1EB` | `#1E3326` | boutons teintés, pastilles, message réussi |
    | `--orange` | `#B45309` | `#A9520B` | Sortie, bouton plein |
    | `--orange-text` | `#A34A07` | `#FFA94D` | Sortie, texte |
    | `--orange-pale` | `#FCF0E6` | `#3A2614` | Sortie, bouton teinté ; avertissement |
    | `--blue` | `#1D4ED8` | `#2F5FE0` | Inventaire, bouton plein |
    | `--blue-text` | `#1D4ED8` | `#7FB2FF` | Inventaire, texte |
    | `--blue-pale` | `#EEF2FD` | `#17233D` | Inventaire, bouton teinté et total |
    | `--red-text` | `#C0392B` | `#FF6961` | rouge des textes |
    | `--red-pale` | `#FDECEA` | `#3A1D1B` | fond d'une erreur |
    | `--badge` | `#D70015` | `#D70015` | pastille de l'onglet À racheter |
    | `--tab-bar` | `#F9F9F9` | `#121214` | barre d'onglets |
    | `--bar-border` | `#D1D1D6` | `#2C2C2E` | bord de la barre d'onglets |
    | `--thumb` | `#ECECF0` | `#2C2C2E` | vignette sans image |
    | `--tile-indigo` | `#5856D6` | `#5E5CE6` | tuile d'icône (prénom) |
    | `--tile-gray` | `#6C6C70` | `#636366` | tuile d'icône (mot de passe) |
    | `--on-color` | `#FFFFFF` | `#FFFFFF` | texte et icône sur un fond plein |
    | `--camera` | `#000000` | `#000000` | fond du viseur |
    | `--overlay` | `rgba(0, 0, 0, 0.55)` | `rgba(0, 0, 0, 0.55)` | consigne posée sur la caméra |
    | `--shadow` | `0 1px 2px rgba(0, 0, 0, 0.05)` | `none` | ombre des cartes |

  - **`src/theme/appearance.ts`** :
    - `type Appearance = 'auto' | 'light' | 'dark'` et `APPEARANCE_KEY = 'scandrinks.appearance'` ;
    - `APPEARANCE_CHOICES` : `[{ value: 'auto', label: 'Automatique' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]` ;
    - `STATUS_BAR = { light: '#F2F2F7', dark: '#000000' }`, la couleur de la barre d'état (le fond) ;
    - `loadAppearance(storage?: Storage | null): Appearance` vaut `'auto'` sans valeur gardée ou avec une valeur inconnue. `saveAppearance(value, storage?)` écrit la valeur. Toutes deux passent par `readStored` et `writeStored` (`app/storage.ts`) ;
    - `resolveAppearance(value: Appearance, systemDark: boolean): 'light' | 'dark'` ;
    - `applyAppearance(value: Appearance, systemDark: boolean): void` : `data-theme` sur `<html>` pour `light` et `dark`, retiré pour `auto` ; puis `content` de `meta[name="theme-color"]` = `STATUS_BAR[resolveAppearance(…)]` ;
    - `startAppearance(): void` applique le choix gardé, puis suit `matchMedia('(prefers-color-scheme: dark)')` (`addEventListener('change', …)`) pour la barre d'état en « Automatique » ;
    - `chooseAppearance(value: Appearance): void` enregistre, puis applique.
  - **`index.html`** : `<meta name="theme-color" content="#F2F2F7" />` à la place du vert, et `<meta name="color-scheme" content="light dark" />`. **`manifest.webmanifest`** : `background_color` et `theme_color` à `#F2F2F7`.
  - **`main.tsx`** importe `./theme/tokens.css` avant `./styles.css`, et appelle `startAppearance()` avant de charger l'app.
  - **`src/ui/icons.tsx`** : un composant par icône, `({ size = 24, strokeWidth = 2 }: IconProps) => <svg …>`.
    - Les SVG portent `aria-hidden="true"`, `focusable="false"`, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, et des bouts et jointures arrondis.
    - Icônes : `IconBarcode`, `IconScanBarcode`, `IconShoppingCart`, `IconPackage`, `IconHistory`, `IconSettings`, `IconChevronLeft`, `IconChevronRight`, `IconPlus`, `IconSearch`, `IconUser`, `IconLock`, `IconImage`, `IconCamera`, `IconCircleCheck`, `IconCircleAlert`, `IconTriangleAlert`, `IconInfo`.
    - Les tracés viennent de `lucide-static` 0.468.0 (`https://unpkg.com/lucide-static@0.468.0/icons/<nom>.svg`). L'en-tête du fichier reproduit la licence ISC de Lucide.
  - **Composants communs** (`AppShell.css` ; le fond et le texte de base dans `styles.css`). `:root` y définit l'accent, que les fiches du Scanner changent : `--accent: var(--green)`, `--accent-text: var(--green-text)`, `--accent-pale: var(--green-pale)`.

    | Classe | Allure |
    |---|---|
    | `.screen` | écran par-dessus l'app (Connexion, Prénom, Réglages, Mot de passe) : une colonne de 560 px au plus |
    | `h1` | grand titre : 32 px, 800 |
    | `.subtitle`, `.note`, `.muted` | texte secondaire en `--text-2` : 15 px, 13 px, et la taille courante |
    | `.section-label` | titre de section : 13 px, 600, majuscules, `--text-2`, marge gauche de 16 px |
    | `.card` | fond `--card`, rayon 18 px, marge intérieure 16 px, `--shadow` ; `.card-title` en 20 px, 700 |
    | `.group` | liste groupée : fond `--card`, rayon 14 px, séparateur `--separator` entre deux lignes |
    | `.row` | ligne de liste de 54 px au moins : vignette ou tuile, puis `.row-text` (`.row-title` en 17 px 600, `.row-sub` en 15 px `--text-2`), puis un chevron `--text-2` |
    | `.segmented` | sélecteur : piste `--track`, segments égaux de 36 px au moins en `--text-3` ; le segment `[aria-pressed='true']` sur fond `--card`, avec une ombre |
    | `button` | bouton teinté : fond `--accent-pale`, texte `--accent-text`, 48 px au moins, rayon 14 px, 17 px, 600, sans bord |
    | `button.primary` | bouton plein : fond `--accent`, texte `--on-color`, 700 |
    | `button.plain` | bouton sur fond de carte : fond `--card`, texte `--accent-text` |
    | `button.link` | lien : sans fond, texte `--accent-text`, 44 px de haut |
    | `button.danger` | action rare : texte `--red-text` ; fond `--card` quand il est seul |
    | `.block` | bouton pleine largeur |
    | `.back` | « Retour » en haut d'un écran secondaire : un `.link` avec `IconChevronLeft`, aligné à gauche |
    | `.pill-button` | bouton teinté arrondi, en 15 px 700 (« Nouveau produit » du Stock) |
    | `.field` | libellé (15 px, 600) au-dessus d'un champ de 50 px : rayon 12 px, fond `--field`, 17 px, bord `--accent` de 2 px au focus |
    | `.field-help`, `.field-error` | aide en 13 px `--text-2`, erreur en 13 px `--red-text`, sous le champ |
    | `.search` | recherche : fond `--track`, `IconSearch` à gauche, libellé en `.visually-hidden` |
    | `.message` | bande teintée de rayon 14 px, avec une icône à gauche : neutre (`--card`, icône info), `.message-ok` (`--green-pale`, coche), `.message-error` (`--red-pale`, texte `--red-text`, alerte), `.message-warning` (`--orange-pale`, texte `--orange-text`, triangle) |
    | `.choices` | boutons alignés, qui passent à la ligne |
    | `.tile` | tuile d'icône de 30 px, rayon 8 px, icône `--on-color` : `.tile-green`, `.tile-indigo`, `.tile-gray` |

    L'icône des bandes est posée par le CSS : `::before`, avec le tracé Lucide en `data:` URI dans `-webkit-mask` et `mask`, et `background: currentColor`. Les écrans n'ont rien à changer.
  - **En-tête** (`AppShell.tsx`) : `.brand-tile` (30 px, rayon 8, fond `--green`, `IconBarcode` de 18 px), `.brand` « ScanDrinks » (17 px, 700), `.employee` (pastille `--pill`, texte `--text-3`, 15 px), puis le bouton « Réglages » (`IconSettings` de 24 px, `--text-3`, 44 × 44).
  - **Onglets** (`TabBar.tsx`).
    - Chaque onglet montre son icône de 26 px (`IconScanBarcode`, `IconShoppingCart`, `IconPackage`, `IconHistory`) au-dessus de `.tab-label` : 12 px, 500, et 600 pour l'onglet actif.
    - Couleurs : `--text-2`, et `--green-text` pour l'onglet actif. La `.badge` se pose sur le coin de l'icône : 18 px, fond `--badge`, texte `--on-color`, 12 px, 700.
    - La barre a le fond `--tab-bar` et un bord haut `--bar-border`.
    - Sa hauteur ne change pas : 57 px plus le bas de la zone sûre (8 px au moins). `scroll-padding-bottom` et la marge basse de `.app` restent donc les mêmes.
    - Les attributs ne changent pas (`aria-current`, `aria-label` avec le nombre).
  - **Connexion** (maquette `J-connexion`) : `main.screen.login`, centré dans la hauteur.
    - En haut : `.brand-tile.large` (76 px, rayon 20, icône de 40 px), `h1` « ScanDrinks », puis `p.subtitle` « Le stock de la réserve, sur ton iPhone. ».
    - Ensuite : les messages, puis `form.card.form` (« Compte du tabac » en lecture seule, « Mot de passe », « Se connecter » en `.primary`).
    - En bas : `p.note` « Un souci ? Préviens la personne qui gère ScanDrinks. ».
  - **Prénom** : `.back` « Retour » en haut quand `onCancel` existe ; `h1` « Qui es-tu ? » ; les prénoms en `.choices` ; `form.card.form` avec « Nouveau prénom » et « C'est moi » (`.primary`).
  - **Réglages** (maquette `J-reglages`, `Settings.css`), de haut en bas :
    - `.back` « Retour », puis `h1` « Réglages » ;
    - un `.group` avec la ligne « Changer de prénom » : `.tile-indigo` avec `IconUser`, le prénom à droite en `--text-2`, et un chevron. Elle remplace la phrase « Prénom sur ce téléphone » ;
    - `h2.section-label` « Apparence », puis une `.card` avec un `.segmented` `role="group"` `aria-label="Apparence"` et ses trois boutons `aria-pressed`. Dessous, `p.note` « « Automatique » suit le réglage de l'iPhone. Ce choix ne vaut que pour ce téléphone. ». L'écran lit `loadAppearance()` et appelle `chooseAppearance` ;
    - un `.group` avec « Changer le mot de passe du tabac » (`.tile-gray`, `IconLock`, chevron) ;
    - à part, `button.danger.block` « Se déconnecter », avec la même confirmation qu'aujourd'hui.
  - **Mot de passe** : la même structure, avec le formulaire dans une `.card`.
  - **`e2e/helpers.mjs`** : `signIn(page)`, déplacée sans changement depuis `app-smoke.mjs`, qui l'importe.
  - **`e2e/screens.mjs [dossier]`** : un outil de mise au point, sans assertion.
    - Il lance `vite preview --outDir dist-e2e --port 4175 --strictPort`, puis Chromium avec la même fausse caméra que l'e2e.
    - Il prend chaque capture de `SHOTS` (`{ name, fake, go(page) }`) en 390 × 844, de jour puis de nuit (`page.emulateMedia({ colorScheme })`).
    - Sorties : `<dossier>/<jour|nuit>/<name>.png`, dans `dist-screens/` par défaut.
    - Captures de cette tâche : `connexion`, `prenom`, `scanner`, `reglages`.
  - **`package.json`** : `"screens": "vite build --mode e2e --outDir dist-e2e && node e2e/screens.mjs"`. **`.gitignore`** : `dist-screens/`.

- [ ] **Step 1: Écrire les tests**

`src/theme/charte.test.ts`, qui lit `./tokens.css?raw` avec une petite fonction d'analyse locale (`{ light, autoDark, dark }`, chacun un objet variable → valeur) :
- « les trois blocs ont les mêmes variables » ;
- « la nuit est la même en Automatique et en Sombre » ;
- « les couleurs de la spec » : les valeurs exactes du tableau ci-dessus, jour et nuit, pour `--bg`, `--card`, `--field`, `--track`, `--separator`, `--text`, `--text-2`, `--green`, `--green-text`, `--green-pale`, `--orange`, `--orange-text`, `--blue`, `--blue-text`, `--red-text`, `--red-pale`, `--badge` et `--tab-bar` ;
- « textes : 4,5:1 au moins », de jour et de nuit, avec la formule de luminance relative du WCAG, pour ces paires (texte / fond) :
  - `text` sur `bg`, `card`, `field` et `green-pale` ;
  - `text-2` sur `card`, `bg`, `green-pale` et `tab-bar` ;
  - `text-3` sur `track` et `pill` ;
  - `green-text` sur `card`, `bg`, `green-pale`, `track` et `tab-bar` ;
  - `orange-text` sur `card`, `track` et `orange-pale` ;
  - `blue-text` sur `card`, `track` et `blue-pale` ;
  - `red-text` sur `card`, `bg` et `red-pale` ;
  - `on-color` sur `green`, `orange`, `blue` et `badge` ;
- « éléments d'interface : 3:1 au moins » :
  - `text-2` sur `thumb` (l'icône d'une vignette vide) ;
  - `on-color` sur `tile-indigo`, `tile-gray` et `camera` ;
  - `green`, `orange` et `blue` sur `bg` et sur `card` (un bouton plein) ;
- « aucune couleur écrite en dur hors de tokens.css ».
  - Les fichiers : `import.meta.glob(['../**/*.css', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true })`, sans `tokens.css`.
  - Aucun ne contient `/#[0-9a-f]{3,8}\b/i`, ni `rgb(`, `rgba(`, `hsl(` ou `hsla(`.
  - Les masques des icônes utilisent `stroke='black'`.

`src/theme/appearance.test.ts` (faux `Storage`, comme `mode.test.ts`) :
- sans valeur, ou avec `'violet'`, `loadAppearance` vaut `'auto'` ; `'light'` et `'dark'` sont relus après `saveAppearance` ;
- `resolveAppearance` : `('auto', true)` → `'dark'`, `('auto', false)` → `'light'`, `('light', true)` → `'light'`, `('dark', false)` → `'dark'`.

Scénario e2e R (Apparence), nouvelle fonction `scenarioAppearance`, ajoutée à la liste :
1. **Le jour par défaut.** Après la connexion :
   - `<html>` n'a pas de `data-theme`, et le fond de `body` vaut `rgb(242, 242, 247)` ;
   - `meta[name="theme-color"]` vaut `#F2F2F7` ;
   - l'onglet « Scanner » est en `rgb(31, 111, 63)`.
2. **« Sombre ».**
   - Dans les Réglages, le groupe « Apparence » a trois boutons, et « Automatique » est pressé.
   - « Sombre » devient pressé : `data-theme="dark"`, fond `rgb(0, 0, 0)`, barre d'état `#000000`.
   - « Se déconnecter » est en `rgb(255, 105, 97)`.
3. **Le choix est gardé.** `page.reload()` : l'app revient en nuit (`data-theme="dark"`, fond noir).
4. **« Automatique » suit l'iPhone.**
   - Réglages › « Automatique » : `<html>` n'a plus de `data-theme`.
   - `page.emulateMedia({ colorScheme: 'dark' })` : fond noir, barre d'état `#000000`.
   - `{ colorScheme: 'light' }` : fond `rgb(242, 242, 247)`, barre d'état `#F2F2F7`.
5. **« Clair » l'emporte.** `emulateMedia({ colorScheme: 'dark' })`, puis « Clair » : `data-theme="light"`, fond clair.
6. **À 320 px** (320 × 640), au Scanner puis dans les Réglages :
   - `document.documentElement.scrollWidth <= 320` ;
   - le logo, le nom, le prénom et la roue dentée sont sur une même ligne (même `offsetTop` à 4 px près).

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/theme; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=R node e2e/app-smoke.mjs`
Expected: FAIL. `tokens.css` et `appearance.ts` manquent, et il n'y a pas de groupe « Apparence ».

- [ ] **Step 3: Écrire le code de la partie Interfaces**

Les couleurs des autres feuilles deviennent des variables, sans changer leur mise en page : les Tâches 2 et 3 la refont.

- [ ] **Step 4: Lancer tous les tests, puis regarder**

Run: `npm test && npm run e2e && npm run build && npm run screens`
Expected: tout passe, « E2E OK ».

Puis regarder les captures `connexion`, `prenom`, `scanner` et `reglages`, de jour et de nuit, à côté des maquettes `J-connexion`, `J-reglages`, `N-scanner` et `N-reglages` :
- mêmes places, mêmes couleurs ;
- aucun texte coupé ni collé au bord.

Un écart visible se corrige avant le commit.

- [ ] **Step 5: Commit**

Message : `feat(charte): couleurs jour et nuit, Apparence, icônes, coquille, connexion et Réglages`.

---

### Task 2: Le Scanner

**Files:**
- Modify:
  - `src/domain/stock.ts`, `src/domain/stock.test.ts`, `src/products/fieldHelp.ts` ;
  - `src/scanner/ScannerScreen.tsx`, `src/scanner/Scanner.css`, `src/scanner/ConfirmCard.tsx`, `src/scanner/CountCard.tsx`, `src/scanner/Notice.tsx`, `src/scanner/ArchivedCard.tsx` ;
  - `src/inventory/CountFields.tsx`, `src/inventory/Inventory.css`, `src/inventory/CorrectStockForm.tsx` ;
  - `src/products/NewProductForm.tsx`, `src/products/AttachForm.tsx`, `src/products/ManualEntry.tsx`, `src/products/ProductPicker.tsx`, `src/products/Products.css` ;
  - `e2e/app-smoke.mjs`, `e2e/screens.mjs`.

**Interfaces:**
- Consumes : les classes et les variables de la Tâche 1.
- Produces :
  - **`stock.ts`** : `confirmParts(units: number, quantity: number, mode: MoveMode): { what: string; delta: string }`. Il remplace `describeConfirm`, qui est retiré.
    - `what` vaut « Pack de 24 », « Pack de 24 × 3 », « À l'unité » ou « À l'unité × 6 ».
    - `delta` vaut `formatDelta(movementDelta(mode, units, quantity))`.
  - **`fieldHelp.ts`** : `countBoth: 'Packs entiers trouvés en réserve, puis les canettes ou bouteilles en plus.'` remplace `countPacks` et `countUnits`, retirés. `countUnitsOnly` reste.
  - **`ScannerScreen`** (maquettes `Main`, `J-message`, `J-inventaire`), de haut en bas :
    - le sélecteur de mode, désormais au-dessus de la caméra : un `.segmented.modes` (`role="group"`, `aria-label="Mode"`), avec ses boutons `mode-in`, `mode-out` et `mode-inv`. Le segment pressé est plein de la couleur du mode (`--green`, `--orange`, `--blue`) avec `--on-color` ; les autres sont transparents, avec le texte du mode (`--green-text`, `--orange-text`, `--blue-text`) ;
    - `.viewfinder` : rayon 18 px, fond `--camera`, `object-fit: contain` inchangé. Hauteur `min(300px, 38vh)`, ou `min(150px, 20vh)` avec `data-compact`. `data-compact` est posé aux étapes `new_product`, `attach` et `manual`, et sur la fiche d'Inventaire ;
    - dans le viseur : quatre `.corner` `aria-hidden` (34 px, bord blanc de 4 px, rayon 12 px, à 24 px des bords) ;
    - à l'étape `scanning`, `p.aim-hint` « Vise le code-barres du pack ou de la bouteille. », posée en bas du viseur : pastille `--overlay`, texte `--on-color` de 15 px, 600. Elle remplace le paragraphe `muted` ;
    - « Saisie manuelle » en `button.plain.block`.
  - **`ConfirmCard`** (`section.card.confirm[data-mode]`, maquette `I-confirm`) :
    - `.confirm-head` : `.confirm-text` (`h2.card-title` avec le nom, puis `.confirm-what` en 15 px `--text-2`), puis `.confirm-delta` en 34 px, 800, `--accent-text`. La Tâche 5 y ajoute la vignette, au début ;
    - `.quantity` : « Quantité », puis `.stepper`, une pastille `--field` avec « Moins », le champ `#confirm-quantity` (centré, 19 px, 600, sans fond) et « Plus » en `--accent-text` ;
    - la bande d'erreur, puis `.card-actions` : « Valider » en `.primary`, qui prend toute la largeur restante, et « Annuler » teinté.
    - `.confirm[data-mode='out']` passe l'accent en orange (`--accent: var(--orange)`, `--accent-text: var(--orange-text)`, `--accent-pale: var(--orange-pale)`), et `[data-mode='inventory']` en bleu, comme `.correct-stock` (Corriger le stock).
  - **`CountFields`** (`CountCard`, `CorrectStockForm`, maquette `J-inventaire`) :
    - `p.muted` « Stock connu : … », inchangé ;
    - `.count-inputs` : « Packs de N » et « Unités en plus » côte à côte (ou « Unités » seul si le pack vaut 1). Champs de 50 px, en 22 px, 700 ;
    - un seul `p.field-help`, lié aux deux champs par `aria-describedby` : `countBoth`, ou `countUnitsOnly` ;
    - `p.count-result`, une bande `--blue-pale` avec `.count-total` « = 53 (2 packs + 5) » (en `--blue-text`, 22 px, 800) et `.count-gap` « écart : +29 ». L'erreur reste en `p.field-error`.
  - **`Notice`** :
    - après un enregistrement : `div.message.message-ok.notice[role=status]`, avec `.notice-text`, qui contient `.notice-title` (« +24 Coca-Cola 33 cl », ou « Inventaire : 53 comptés (+29) Coca-Cola 33 cl », 17 px 700) et `.notice-detail` (« Stock : 48 (2 packs) », 15 px `--text-2`). Puis « Annuler » en `button.link` ;
    - « Annulé — stock : … » reste une ligne, dans `.notice-title`. Les deux autres messages ne changent pas de texte.
  - **Les autres fiches du Scanner** (maquette `J-nouveau`) passent à la `.card`, sans changer de texte.
    - « Code inconnu » : « Nouveau produit » en `.primary`, « Ajouter à un produit existant » teinté, « Annuler » en `.link`.
    - « Nouveau produit », « Ajouter à un produit existant », « Saisie manuelle » et « Produit archivé » : les champs en pleine largeur. « Scanner une canette du pack » est un bouton teinté `.block`, avec son aide dessous. `.card-actions` contient le bouton `.primary`, puis « Annuler » teinté.
    - `ProductPicker` : la recherche en `.search`, et les produits en `ul.group.product-list` de `button.row` (le nom, puis un chevron).
  - **`e2e/app-smoke.mjs`**, trois aides, pour les tâches suivantes :
    - `waitForConfirmLine(card, line, options?)` : `line` s'écrit comme avant la refonte (« Pack de 24 → +24 ») et se coupe sur « → ». L'aide attend `.confirm-what` et `.confirm-delta` avec exactement ces textes, avec `options.timeout` ;
    - `waitForSaved(page, title, detail)` attend le message `role=status` avec exactement ces `.notice-title` et `.notice-detail` ;
    - `waitForCount(scope, total, gap)` attend exactement ces `.count-total` et `.count-gap`.

- [ ] **Step 1: Écrire les tests**

`stock.test.ts` : le tableau de `describeConfirm` devient celui de `confirmParts`, avec les mêmes cas :
- `(24, 1, 'in')` → `{ what: 'Pack de 24', delta: '+24' }` ;
- `(24, 3, 'in')` → `{ what: 'Pack de 24 × 3', delta: '+72' }` ;
- `(1, 1, 'out')` → `{ what: "À l'unité", delta: '−1' }` ;
- `(1, 6, 'out')` → `{ what: "À l'unité × 6", delta: '−6' }`.

`e2e/app-smoke.mjs` :
- les trois aides ci-dessus ;
- chaque `X.getByText('<quoi> → <variation>').waitFor(options)` devient `waitForConfirmLine(X, '<quoi> → <variation>', options)`, soit 19 endroits ;
- chaque `page.getByText('✓ <titre> — stock : <stock>').waitFor()` devient `waitForSaved(page, '<titre>', 'Stock : <stock>')`, soit 7 endroits. Les textes « Annulé — stock : … » ne changent pas ;
- les deux `getByText('= … — écart : …')` deviennent `waitForCount(…)` ;
- scénario A, étape 4 : la couleur de `.confirm-line` est remplacée par celle de `.confirm-delta`, `rgb(163, 74, 7)` en Sortie, et par le fond de « Valider », `rgb(180, 83, 9)`. Revenu en Entrée : `rgb(31, 111, 63)` pour les deux ;
- scénario A, étape 3 : le groupe « Mode » précède le viseur dans la page (`compareDocumentPosition`) ;
- scénario F, étape 1 (lecteur indisponible, le Scanner reste à l'étape `scanning`) : `.aim-hint` affiche « Vise le code-barres du pack ou de la bouteille. », et son rectangle est dans celui de `.viewfinder` ;
- scénario I : en Inventaire, « Valider » a le fond `rgb(29, 78, 216)`. Le viseur mesure 150 px de haut au plus pendant la saisie du comptage. Juste après « Valider », de retour au scan, il mesure plus de 150 px et 300 px au plus.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain/stock.test.ts; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=A,F,I node e2e/app-smoke.mjs`
Expected: FAIL. `confirmParts` n'existe pas, et `.confirm-what` est absent.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

`e2e/screens.mjs` reçoit les captures `scanner-entree`, `scanner-sortie`, `scanner-message`, `scanner-inventaire` et `nouveau-produit`.

- [ ] **Step 4: Lancer tous les tests, puis regarder**

Run: `npm test && npm run e2e && npm run build && npm run screens`
Expected: tout passe.

Regarder les nouvelles captures, de jour et de nuit, à côté des maquettes `Main`, `J-message`, `J-inventaire`, `J-nouveau` et `N-scanner`. Un écart visible se corrige avant le commit.

- [ ] **Step 5: Commit**

Message : `feat(scanner): refonte du Scanner (modes, viseur, fiche, inventaire, messages)`.

---

### Task 3: Listes, fiche produit et Historique

**Files:**
- Modify:
  - `src/domain/stock.ts`, `src/domain/restock.ts`, `src/domain/movements.ts`, avec leurs tests ;
  - `src/shopping/ShoppingScreen.tsx`, `src/shopping/Shopping.css` ;
  - `src/stock/StockScreen.tsx`, `src/stock/Stock.css`, `src/stock/ProductSheet.tsx`, `src/stock/CodeList.tsx`, `src/stock/MovementList.tsx` ;
  - `src/stock/AddCodeForm.tsx`, `src/stock/ProductCreateForm.tsx`, `src/stock/ProductEditForm.tsx` ;
  - `src/history/HistoryScreen.tsx`, `src/history/History.css` ;
  - `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`, `e2e/screens.mjs`.

**Interfaces:**
- Consumes : la Tâche 1 ; `waitForCount` (Tâche 2).
- Produces :
  - **`stock.ts`** :
    - `formatUnits(stock: number): string` : « 48 », « −3 » ;
    - `formatPacks(stock: number, packSize: number): string | null` : « 1 pack », « 2 packs », « 1 pack + 1 », « 2 packs + 5 ». Il vaut `null` si le pack vaut 1, si le stock est négatif ou s'il fait moins d'un pack (RG-1) ;
    - `formatStock` s'écrit avec ces deux fonctions. Ses sorties ne changent pas.
  - **`restock.ts`** :
    - `listState(product: Product): string | null`. Un produit actif à racheter donne « À racheter », suivi de « · stock à vérifier » si son stock est négatif. Sinon, `formatPacks(stock, packSize)`. Un produit archivé n'est jamais « À racheter » ;
    - `shoppingParts(line: RestockLine): { rest: string; amount: string; note: string }`.
      - `rest` : « Reste 10 », ou « Reste −3 · stock à vérifier ».
      - `amount` : « 1 pack », « 2 packs », « 1 unité » ou « 8 unités ».
      - `note` : « de 24 », ou « à l'unité ».
    - `shoppingSummary(count: number, clock: string): string` : « 3 produits · mis à jour à 12:03 », « 1 produit · mis à jour à 12:03 », et « Mis à jour à 12:03 » pour 0.
  - **`movements.ts`** :
    - `movementParts(m: Movement, now: Date): { title: string; meta: string }` :
      - `title` = `describeMovement(m)` (« Entrée +24 », « Inventaire : 53 comptés (−3) ») ;
      - `meta` = « lun. 14:32 · Sam », suivi de « — annulé par Léa » (ou « — annulé ») pour une ligne annulée ;
    - `historyParts(m: HistoryMovement, now: Date): { title: string; amount: string; meta: string }` (maquette `J-historique`) :
      - `title` : le nom du produit ;
      - `amount` : `formatDelta(delta)` pour une entrée ou une sortie ; « 53 comptés » (« 1 compté », « 0 compté ») pour un inventaire ;
      - `meta` : « Sortie · mer. 12:03 · Sam », « Entrée · … » ou « Inventaire (+29) · dim. 18:20 · Sam », avec l'annulation comme ci-dessus.
  - **À racheter** (maquettes `A-racheter`, `N-racheter`) :
    - `h1`, puis `p.subtitle` avec `shoppingSummary(lignes, formatClock(updatedAt))`. Le paragraphe « Mis à jour à » du bas disparaît ;
    - `ul.group.shopping-list[aria-label="À racheter"]`, dont chaque `li` contient un `button.row`. Il a `.out-of-stock` si le stock est à 0 ou moins, et `aria-label={describeShoppingLine(line)}` : la phrase de toujours ;
    - dans la ligne :
      - `.row-text` : `.row-title` (le nom) et `.row-sub` (`rest`). `.row-sub` passe en `--red-text`, avec `IconCircleAlert`, quand le stock est à 0 ou moins ;
      - `.buy` : `.buy-amount`, une pastille `--green-pale` en `--green-text`, 17 px, 800 ; puis `.buy-note`, 13 px `--text-2` ;
      - le chevron ;
    - `p.note` « Touche un produit pour ouvrir sa fiche. » sous une liste non vide.
  - **Stock** (maquette `J-stock`) :
    - `.title-row` : `h1` « Stock » et `button.pill-button` « Nouveau produit », avec `IconPlus` ;
    - `.search` « Rechercher un produit », puis `.segmented[role=group][aria-label="Filtre"]` « Actifs » | « Archivés » ;
    - `ul.group.stock-list[aria-label="Produits"]`, dont chaque `li` contient un `button.row.product-row`, avec `.stock-low` comme aujourd'hui. Dans la ligne :
      - `.row-text` : `.product-name`, puis `.product-state` (`listState`), absent si `null` ;
      - `.product-stock` (`formatUnits`), en 20 px, 800 ;
      - le chevron ;
    - `.stock-low` met l'état et le nombre en `--red-text` ;
    - `p.note` « Mis à jour à HH:MM » sous la liste quand `updatedAt` existe.
  - **Fiche produit** (`section.product-sheet[aria-label="Fiche produit"]`, maquette `J-fiche`), de haut en bas :
    - `button.link.back` « Retour » ;
    - `.sheet-head` avec `h1.sheet-title` (le nom, 28 px). La Tâche 5 y ajoute l'image ;
    - `section.card.sheet-stock[aria-label="Stock du produit"]` :
      - « Stock », puis `.check-badge` « Stock à vérifier » (pastille `--red-pale`, `--red-text`) si le stock est négatif ;
      - `.sheet-stock-value` (`formatUnits`, 40 px, 800), en `--red-text` avec `.stock-low` ;
      - `.sheet-stock-packs` (`formatPacks`), absent si `null` ;
      - `dl.sheet-figures` : trois paires `dt`/`dd`, « Pack Metro », « Seuil », « Stock idéal » ;
    - le message, l'erreur et « Réessayer », comme aujourd'hui ;
    - `.sheet-actions` : « Corriger le stock » et « Modifier », teintés et côte à côte, pour un produit actif ;
    - `h2.section-label` « Codes », puis `CodeList`. Pendant la lecture, `p.muted` « Chargement… » ;
    - `h2.section-label` « Derniers mouvements », puis `MovementList` ;
    - en bas : pour un produit archivé, la bande « Ce produit est archivé. » et « Réactiver » (`.primary`). Sinon, `button.danger.block` « Archiver le produit » (spec §4.4), avec la même confirmation.
  - **`CodeList`** : nouvelle prop `onAdd?: () => void`. Elle est rendue dès que la fiche est lue, même sans code. Elle contient `ul.group.code-list[aria-label="Codes"]` :
    - chaque code est un `li.code-row` : `.row-text`, avec `.code-value` (le code, 17 px) et `.code-meta` (« 24 unités », 15 px `--text-2`). Puis `.code-actions`, avec « Modifier » en `button.link` et « Retirer » en `button.link.danger`, et leurs `aria-label` d'aujourd'hui. La modification des unités reste dans la ligne ;
    - sans code : un `li` avec `p.muted` « Aucun code : utilise « Saisie manuelle » au Scanner. » ;
    - en dernier, si `onAdd` existe, un `li` avec `button.row.add-row` « Ajouter un code » (`IconPlus`, `--green-text`).
  - **`MovementList`** : `ul.group.movement-list[aria-label="Derniers mouvements"]`. Chaque `li` garde sa classe `cancelled`. Il contient :
    - `span.movement-visual[aria-hidden="true"]`, avec `.movement-title.kind-<kind>` et `.movement-meta` (`movementParts`) ;
    - puis `span.visually-hidden.movement-line` (`movementLine`).
  - **Historique** : `ul.group.history-list[aria-label="Historique"]`. Chaque `li` garde exactement la classe d'aujourd'hui : `cancelled`, ou aucune. Il contient :
    - `span.history-visual[aria-hidden="true"]`, avec `.history-top` (`.history-title`, puis `.history-amount.kind-<kind>`) et `.history-meta` (`historyParts`) ;
    - puis `span.visually-hidden.history-line` (`historyLine`) ;
    - puis, sur une ligne active, « Annuler » en `button.link`, avec le même `aria-label` ;
    - « Voir plus » devient un bouton teinté `.block`, au texte inchangé.
  - **Couleurs des types** : `.kind-in` en `--green-text`, `.kind-out` en `--orange-text`, `.kind-inventory` en `--blue-text`. Une ligne annulée passe en `--text-2`, avec le titre et la quantité barrés.
  - **Formulaires de la fiche** (« Modifier le produit », « Ajouter un code », « Nouveau produit » du Stock, « Corriger le stock ») : une `.card` ; les actions sont le bouton `.primary`, puis « Annuler » teinté.
  - **`fakeSupabase.mjs`** : option `longNames: boolean`. Chaque nom de produit reçoit alors la suite « — édition limitée, format familial ».
  - **`e2e/app-smoke.mjs`**, trois aides :
    - `accessibleNames(locator)` : les `aria-label` des éléments trouvés ;
    - `codeRow(codes, code)` : le `li` dont le `.code-value` vaut exactement `code` ;
    - `sheetFigures(sheet)` : les textes des `dt` et des `dd` de `.sheet-figures`, sous la forme `[['Pack Metro', '24'], …]`.

- [ ] **Step 1: Écrire les tests**

Tests unitaires (textes exacts) :
- `stock.test.ts` :
  - `formatUnits(48)` → '48', `formatUnits(-3)` → '−3' ;
  - `formatPacks` : (48, 24) → '2 packs', (53, 24) → '2 packs + 5', (25, 24) → '1 pack + 1', (24, 24) → '1 pack', (10, 24) → null, (36, 1) → null, (−3, 24) → null.
- `restock.test.ts` :
  - `listState` :
    - Coca à 10 (pack 24, seuil 24) → 'À racheter' ;
    - Red Bull à −3 → 'À racheter · stock à vérifier' ;
    - Lipton à 36 (pack 12, seuil 12) → '3 packs' ;
    - Évian à 4 (pack 1, seuil 6) → 'À racheter' ;
    - Évian à 20 (pack 1, seuil 6) → null ;
    - un produit archivé à 10, pack 24, seuil 24 → null ;
  - `shoppingParts`, sur les lignes de `describeShoppingLine` :
    - Coca → { rest: 'Reste 10', amount: '2 packs', note: 'de 24' } ;
    - Red Bull → { rest: 'Reste −3 · stock à vérifier', amount: '2 packs', note: 'de 24' } ;
    - Évian → { rest: 'Reste 4', amount: '8 unités', note: "à l'unité" } ;
    - '1 pack' et '1 unité' au singulier ;
  - `shoppingSummary(3, '12:03')`, `(1, '12:03')` et `(0, '12:03')`.
- `movements.test.ts` :
  - `movementParts` : Entrée +24 → { title: 'Entrée +24', meta: 'lun. 14:32 · Sam' } ; annulée par Léa → meta 'lun. 14:32 · Sam — annulé par Léa' ; inventaire → title 'Inventaire : 53 comptés (−3)' ;
  - `historyParts` :
    - sortie de −24 → { title: 'Coca-Cola 33 cl', amount: '−24', meta: 'Sortie · lun. 14:32 · Sam' } ;
    - inventaire de 53 (+29) → { amount: '53 comptés', meta: 'Inventaire (+29) · lun. 14:32 · Sam' } ;
    - 1 compté ;
    - annulé sans auteur → '… — annulé'.

`e2e/app-smoke.mjs`, les trois aides, puis :
- **Scénario H.**
  - La liste est lue par `accessibleNames(shopping.getByRole('button'))`, avec les mêmes phrases qu'aujourd'hui.
  - Le sous-titre suit `/^3 produits · mis à jour à \d{2}:\d{2}$/`, puis `/^2 produits · …$/` après l'entrée faite ailleurs.
  - `.buy-amount` vaut ['2 packs', '2 packs', '8 unités'] et `.buy-note` ['de 24', 'de 24', "à l'unité"].
- **Scénario K.**
  - `.product-stock` vaut ['10', '4', '36', '−3'], et `.product-state` ['À racheter', 'À racheter', '3 packs', 'À racheter · stock à vérifier']. « Mis à jour à » s'affiche sous la liste.
  - La fiche du Coca : `.sheet-stock-value` vaut '10', sans `.sheet-stock-packs`. `sheetFigures` vaut [['Pack Metro', '24'], ['Seuil', '24'], ['Stock idéal', '48']], et le `.code-meta` de `codeRow(codes, '5449000000996')` vaut '24 unités'.
  - Les lignes de mouvements sont lues sur `.movement-line`, avec les mêmes motifs.
  - Les deux clics sur « Archiver » visent `{ name: 'Archiver le produit' }`.
- **Scénario K, nouvelle étape « noms longs ».**
  - `openApp(browser, { catalogue: 'pilotage', longNames: true })`, en 320 × 640.
  - Sur la fiche de confirmation du Scanner, À racheter, Stock, la fiche du Coca et l'Historique : `document.documentElement.scrollWidth <= 320`, et chaque `.row` a `scrollWidth <= clientWidth`.
- **Scénario L.**
  - Après la modification, `sheetFigures` vaut [['Pack Metro', '24'], ['Seuil', '30'], ['Stock idéal', '48']].
  - Les codes se lisent avec `codeRow` et `.code-meta` : '12 unités', puis '1 unité'. Le retrait attend que la ligne disparaisse.
  - Après la correction, `.sheet-stock-value` vaut '26' et `.sheet-stock-packs` '1 pack + 2'. « Stock corrigé : … » ne change pas.
- **Scénario M.**
  - La première ligne : `.history-title` vaut 'Red Bull 25 cl', `.history-amount` '−3' en `rgb(163, 74, 7)`, et `.history-meta` suit `/^Sortie · \S+ \d{2}:\d{2} · Sam$/`.
  - La ligne annulée par Sam : `.history-meta` finit par « — annulé par Sam », et `.history-title` est barré (`text-decoration-line` vaut `line-through`).
  - Le reste du scénario ne change pas : `.history-line` garde la phrase entière.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=H,K,L,M node e2e/app-smoke.mjs`
Expected: FAIL. `formatPacks` n'existe pas, et `.product-state` est absent.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

`e2e/screens.mjs` reçoit les captures `racheter`, `stock`, `fiche` et `historique`.

- [ ] **Step 4: Lancer tous les tests, puis regarder**

Run: `npm test && npm run e2e && npm run build && npm run screens`
Expected: tout passe.

Regarder les captures, de jour et de nuit, à côté des maquettes `A-racheter`, `N-racheter`, `J-stock`, `J-fiche` et `J-historique`. Un écart visible se corrige avant le commit.

- [ ] **Step 5: Commit**

Message : `feat(listes): refonte d'À racheter, du Stock, de la fiche produit et de l'Historique`.

---

### Task 4: Images — la base

**Files:**
- Create: `supabase/migrations/20261021120000_images.sql`
- Modify: `supabase/tests/supabase-stub.sql`, `supabase/tests/database.test.sql`

**Interfaces:**
- Consumes : les migrations des jalons 1 à 3 (`private.is_allowed()`, `product_stock`, `lookup_barcode`).
- Produces :
  - **`public.barcodes`** reçoit deux colonnes, `photo_path text` et `photo_source text`, toutes deux vides par défaut.
    - La contrainte `barcodes_photo_check` vaut : `(photo_path is null and photo_source is null) or (photo_source in ('off', 'equipe') and photo_path ~ ('^codes/' || code || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'))`.
    - `grant update (photo_path, photo_source) on table public.barcodes to authenticated` : la règle `barcodes_update` existe déjà.
  - **`public.product_stock`** : `create or replace view … with (security_invoker = true)`. Les colonnes d'aujourd'hui restent, dans le même ordre, et `photo_path` s'ajoute à la fin.
    - C'est l'image du produit : celle du code dont les unités valent le pack Metro, sinon la première par `created_at` puis `code`, sinon vide.
    - Une sous-requête corrélée dans le `select` la calcule.
  - **`public.lookup_barcode(p_code)`** : `create or replace`, même signature et mêmes contrôles. La réponse ajoute `photo_path` et `photo_source`, ceux du code. `product` contient aussi `photo_path`, puisqu'il vient de la vue.
  - **`public.set_barcode_photo(p_code text, p_path text, p_source text) returns jsonb`** : `security invoker`, `set search_path = ''`, accès vérifié (`not_allowed`, `42501`).
    - Elle verrouille la ligne du code (`for update`).
    - Erreurs, dans cet ordre :
      - `invalid_input:code` si le code n'existe pas ;
      - `invalid_input:source` si la provenance n'est ni `off` ni `equipe` ;
      - `invalid_input:path` si le chemin n'a pas la forme `codes/<p_code>/<uuid>.jpg` ;
      - `invalid_input:photo` si aucun objet `photos/<p_path>` n'est visible dans `storage.objects`.
    - Sinon, elle enregistre l'image et renvoie `{ code, photo_path, photo_source }`. Rejouée, elle renvoie la même chose.
    - Droits : `revoke` à `public` et `anon`, `grant` à `authenticated`.
  - **Stockage.**
    - `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('photos', 'photos', false, 262144, array['image/jpeg']) on conflict (id) do nothing`.
    - Règle `photos_select` sur `storage.objects`, pour la lecture par `authenticated` : `bucket_id = 'photos' and (select private.is_allowed())`.
    - Règle `photos_insert`, pour l'ajout par `authenticated` : la même condition, et `name ~ '^codes/[0-9]{8,14}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'`.
    - Aucune règle de modification ni de suppression : personne ne modifie ni ne supprime une image depuis l'app.
  - **`supabase-stub.sql`** imite le stockage de Supabase :
    - le schéma `storage`, avec `storage.buckets (id text primary key, name text not null, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[])` ;
    - et `storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid, created_at timestamptz not null default now(), unique (bucket_id, name))`, avec la RLS active ;
    - les droits de Supabase : `usage` sur le schéma, `all` sur `objects` et `select` sur `buckets`, pour `anon`, `authenticated` et `service_role`.

- [ ] **Step 1: Compléter `database.test.sql`**

Mise en place, en tant que `postgres` :
- le produit « Test images » (pack 6, seuil 6, stock idéal 12) ;
- ses codes `2000000000046` (6 unités, créé en premier) et `2000000000053` (1 unité) ;
- les noms des objets sont tirés au hasard (`gen_random_uuid()`).

Nouveaux cas :
- **25. Le compartiment `photos`** est privé, accepte 262 144 octets au plus, et seulement `image/jpeg`.
- **26. Le stockage.**
  - A ajoute (`insert into storage.objects (bucket_id, name)`) un objet `codes/2000000000053/<uuid>.jpg` et un objet `codes/2000000000046/<uuid>.jpg`, puis les lit.
  - `anon`, puis B : en ajouter un autre échoue (`42501`) ; B ne lit aucun objet de `photos`.
  - A est refusé (`42501`) pour `autre/<uuid>.jpg`, `codes/abc/<uuid>.jpg` et `codes/2000000000053/<uuid>.png`.
  - A tente de modifier, puis de supprimer l'objet, par une nouvelle aide `pg_temp.attempt(text)`, qui lance la requête et ignore une erreur. Ensuite, en tant que `postgres`, l'objet est toujours là, sous son nom. Toute suppression reste dans une chaîne de texte.
- **27. `set_barcode_photo`**, en tant que A, avec les objets du cas 26.
  - L'image du code de 1 unité (`off`) devient celle du produit dans `product_stock`, faute d'image pour le code du pack.
  - Puis l'image du code du pack (`equipe`) prend la place : `product_stock.photo_path` vaut celle du pack.
  - `lookup_barcode('2000000000053')` renvoie son propre `photo_path`, `photo_source = 'off'`, et `product ->> 'photo_path'` égal à l'image du pack.
  - Rejouée avec les mêmes valeurs, la fonction renvoie le même résultat.
  - Erreurs : un code inconnu (`invalid_input:code`), la provenance `'autre'` (`invalid_input:source`), le chemin d'un autre code (`invalid_input:path`), un chemin jamais envoyé (`invalid_input:photo`). B et `anon` sont refusés (`42501`).
- **28. Les contraintes.**
  - En tant que `postgres`, `23514` pour un chemin d'un autre code, puis pour une provenance sans chemin.
  - En tant que A, une écriture directe (`update public.barcodes set photo_path = …`) avec un mauvais chemin échoue aussi (`23514`).
- **29. Sans image.** `lookup_barcode('2000000000015')` donne `photo_path` vide, et le produit « Coca-Cola 33 cl » du test aussi, dans `product_stock`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `pg_ctlcluster 16 main start; su postgres -c "bash supabase/tests/run-local.sh"`
Expected: FAIL. La colonne `photo_path` et le schéma `storage` n'existent pas.

- [ ] **Step 3: Écrire la migration et compléter `supabase-stub.sql`**

- [ ] **Step 4: Lancer les tests, puis les mutations**

Run: `su postgres -c "bash supabase/tests/run-local.sh"`
Expected: `OK`.

Puis trois mutations, chacune lancée puis annulée. Chacune doit faire échouer un cas :
- sans le contrôle du chemin dans `set_barcode_photo` ;
- sans le motif du nom dans `photos_insert` ;
- avec la préférence du pack inversée dans la vue.

- [ ] **Step 5: Commit**

Message : `feat(base): images des codes (colonnes, image du produit, set_barcode_photo, stockage privé)`.

---

### Task 5: Images — l'affichage

**Files:**
- Create:
  - `src/photos/photos.ts`, `src/photos/photos.test.ts`, `src/photos/photoUrls.ts`, `src/photos/photoUrls.test.ts` ;
  - `src/photos/storage.ts`, `src/photos/usePhotoUrl.ts`, `src/photos/Thumb.tsx`, `src/photos/Photos.css` ;
  - `e2e/jpeg.mjs`.
- Modify:
  - `src/data/api.ts`, `src/data/api.test.ts`, `src/off/openFoodFacts.ts`, `src/off/openFoodFacts.test.ts` ;
  - `src/scanner/scanFlow.ts`, `src/scanner/scanFlow.test.ts`, `src/scanner/ConfirmCard.tsx`, `src/products/ManualEntry.tsx`, `src/products/NewProductForm.tsx`, `src/products/AttachForm.tsx` ;
  - `src/shopping/ShoppingScreen.tsx`, `src/stock/StockScreen.tsx`, `src/stock/ProductSheet.tsx`, `src/stock/CodeList.tsx` ;
  - `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`, `e2e/screens.mjs`.

**Interfaces:**
- Consumes : la base de la Tâche 4 ; les écrans des Tâches 2 et 3.
- Produces :
  - **`photos.ts`** :
    - constantes : `PHOTO_BUCKET = 'photos'`, `PHOTO_MAX_SIDE = 480`, `PHOTO_QUALITY = 0.8`, `PHOTO_URL_SECONDS = 3600`, `PHOTO_URL_REUSE_MS = 50 * 60_000`, `PHOTO_TIMEOUT_MS = 15_000` ;
    - messages : `PHOTO_NOT_SAVED_MESSAGE = 'Photo non enregistrée : réessaie depuis la fiche du produit.'` (spec §7) et `PHOTO_RETRY_MESSAGE = 'Photo non enregistrée : réessaie.'` ;
    - `type PhotoSource = 'off' | 'equipe'` ;
    - `photoPath(code: string, id: string): string` vaut `codes/<code>/<id>.jpg` ;
    - `fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number }` : réduit sans jamais agrandir, en gardant les proportions. Les côtés sont arrondis, et valent 1 au moins ;
    - `isOffImageUrl(url: unknown): url is string` : vrai pour une chaîne qui commence par `https://images.openfoodfacts.org/` ;
    - `photoSourceLabel(source: PhotoSource): string` : « Image : Open Food Facts », « photo de l'équipe ».
  - **`photoUrls.ts`** : `createPhotoUrls(sign: (paths: string[]) => Promise<Array<{ path: string; signedUrl: string | null }>>, now: () => number = Date.now)` renvoie `{ get(path: string): Promise<string | null>; remember(path: string, url: string): void }`.
    - Un lien de moins de `PHOTO_URL_REUSE_MS` est réutilisé ; un lien retenu par `remember` aussi.
    - Les `get` faits dans le même tour (`setTimeout` 0) partent en un seul appel `sign`, sans chemin en double. Deux `get` du même chemin attendent la même réponse.
    - Un échec, ou un `signedUrl` vide, donne `null`, et n'est pas gardé.
  - **`storage.ts`**, les instances de l'app :
    - `photoUrls` : `sign` appelle `supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS)` ;
    - `uploadPhoto(path: string, jpeg: Blob): Promise<void>` envoie les octets bruts (`await jpeg.arrayBuffer()`), avec `{ contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' }`. Une erreur devient une `ApiError` (`classifyApiError`).
  - **`usePhotoUrl(path: string | null): string | null`** : le lien de `photoUrls.get`, ou `null` sans chemin ou pendant le chargement.
  - **`Thumb({ path, src, size }: { path?: string | null; src?: string | null; size: number })`** :
    - `img.thumb`, `alt=""`, de `size` px, rayon 10 à 12 px, `object-fit: cover`, `loading="lazy"`. Son adresse est `src`, sinon le lien de `path` ;
    - sans adresse, ou après l'événement `error` : `span.thumb.thumb-empty[aria-hidden="true"]`, fond `--thumb`, `IconImage` en `--text-2`.
  - **`api.ts`** :
    - `Product.photoPath: string | null` (`photo_path` de `product_stock`) ;
    - `LookupResult` trouvé : `photoPath: string | null`, celui du code ;
    - `BarcodeEntry` : `photoPath: string | null` et `photoSource: PhotoSource | null`, lus par `select('code, units, photo_path, photo_source')` ;
    - `setBarcodePhoto(input: { code: string; path: string; source: PhotoSource }): Promise<void>` appelle `set_barcode_photo` (`p_code`, `p_path`, `p_source`).
  - **`openFoodFacts.ts`** : `image_front_url` s'ajoute aux champs demandés. Un résultat `found` reçoit `imageUrl: string | null` : l'adresse si `isOffImageUrl`, sinon `null`.
  - **`scanFlow.ts`** : `ConfirmTarget.photoPath: string | null`.
    - Après `lookup_done`, c'est celui du code scanné.
    - En saisie manuelle, c'est `product.photoPath`.
    - Après une création ou un ajout de code, il vaut `null` dans cette tâche (la Tâche 6 le remplit).
  - **Affichage** (maquettes `I-confirm`, `I-stock`, `I-fiche`) :
    - fiche de confirmation : `Thumb` de 64 px, au début de `.confirm-head` ;
    - À racheter et Stock : `Thumb` de 44 px, au début de chaque ligne, avec l'image du produit ;
    - fiche produit : `Thumb` de 76 px dans `.sheet-head`, avec l'image du produit ; dans chaque ligne de code, `Thumb` de 48 px, avec l'image du code ;
    - `.code-meta` d'un code avec image : « 24 unités · photo de l'équipe », ou « 1 unité · Image : Open Food Facts ».
  - **`e2e/jpeg.mjs`** :
    - `PHOTO_JPEG` : un `Buffer`, JPEG de 600 × 400. Il est fabriqué une fois par `ffmpeg -f lavfi -i color=c=0xC8102E:s=600x400 -frames:v 1 -q:v 5 -f image2 -c:v mjpeg - | base64 -w0`, puis collé en base64 ;
    - `jpegSize(buffer: Buffer): { width: number; height: number }`, lu dans le segment SOF0 ou SOF2 ;
    - `withExifOrientation(jpeg: Buffer, orientation: number): Buffer` : insère après SOI un segment APP1 Exif, avec une seule entrée Orientation (0x0112). Il sert à la Tâche 6.
  - **`fakeSupabase.mjs`** :
    - les codes gardent `photo_path` et `photo_source`. `product_stock` les calcule comme la vue, et `lookup_barcode` et la lecture des codes les renvoient ;
    - `set_barcode_photo` fait les mêmes contrôles que la base ;
    - option `photos: Record<string, Buffer>`, des images à mettre d'avance dans le stockage simulé (la vidéo du jalon 4 s'en sert) ;
    - stockage simulé, sous `${SUPABASE_URL}/storage/v1/` :
      - `POST object/photos/<chemin>` enregistre les octets. Il faut une session ouverte (sinon 400 `{ statusCode: '403', error: 'Unauthorized' }`), le type `image/jpeg` et un chemin valide. Un chemin déjà pris donne 409. La réponse est `{ Id, Key: 'photos/<chemin>' }` ;
      - `POST object/sign/photos`, avec `{ expiresIn, paths }`, répond pour chaque chemin `{ path, signedURL: '/object/sign/photos/<chemin>?token=e2e', error: null }`, ou `signedURL: null` si l'objet manque ;
      - `GET object/sign/photos/<chemin>` sert l'image (`image/jpeg`), ou 400 si elle manque ;
    - Open Food Facts : le Coca reçoit `image_front_url` (`https://images.openfoodfacts.org/images/products/544/900/000/0996/front_fr.4.400.jpg`), sauf avec l'option `offImage: false`. Les adresses `https://images.openfoodfacts.org/**` servent `PHOTO_JPEG`, avec `access-control-allow-origin: *` ;
    - le retour d'`installFakeSupabase` ajoute `photos` (la `Map` chemin → octets) et `storageCalls` : `{ kind: 'upload' | 'sign' | 'get', paths, contentType? }`, dans l'ordre ;
    - un catalogue `'images'` :

      | id | Nom | Pack | Seuil | Stock idéal | Code (unités, image) | Stock |
      |---|---|---|---|---|---|---|
      | p-coca | Coca-Cola 33 cl | 24 | 24 | 48 | `COCA_CODE` (24, `codes/5449000000996/11111111-1111-4111-8111-111111111111.jpg`, `equipe`, présente dans le stockage) | 10 |
      | p-lipton | Lipton Pêche 50 cl | 12 | 12 | 24 | `3502110123091` (12, `codes/3502110123091/22222222-2222-4222-8222-222222222222.jpg`, `off`, absente du stockage) | 6 |
      | p-evian | Évian 50 cl | 24 | 24 | 48 | aucun | 30 |

- [ ] **Step 1: Écrire les tests**

Tests unitaires :
- `photos.test.ts` :
  - `photoPath('5449000000996', 'abc')` vaut `codes/5449000000996/abc.jpg` ;
  - `fitWithin` : (1280, 720) → 480 × 270, (600, 400) → 480 × 320, (400, 600) → 320 × 480, (16, 16) → 16 × 16, (4000, 1) → 480 × 1 ;
  - `isOffImageUrl` : vrai pour une adresse `https://images.openfoodfacts.org/…` ; faux pour `http://images.openfoodfacts.org/…`, `https://images.openfoodfacts.org.evil.example/…`, `https://example.org/x.jpg` et `42` ;
  - les deux libellés de `photoSourceLabel`.
- `photoUrls.test.ts` (horloge et minuteries simulées) :
  - trois `get` du même tour donnent un seul appel `sign`, avec deux chemins distincts ;
  - un lien est réutilisé à 49 minutes, et redemandé à 51 ;
  - un échec de `sign` donne `null`, et l'appel suivant redemande ;
  - `remember` sert sans appel.
- `api.test.ts` : `photoPath` dans `listCatalog` et `lookupBarcode` ; `photoPath` et `photoSource` dans `getProductDetail` ; `setBarcodePhoto` envoie `{ p_code, p_path, p_source }`.
- `openFoodFacts.test.ts` : `image_front_url` est dans les champs demandés ; une adresse d'Open Food Facts donne `imageUrl` ; une autre adresse donne `null` ; l'absence aussi.
- `scanFlow.test.ts` : `photoPath` suit le résultat de `lookup_done`.

Scénario e2e S (images), nouvelle fonction `scenarioImages`, ajoutée à la liste, avec le catalogue `'images'` :
1. **La fiche de confirmation.**
   - Après le scan, l'`img.thumb` de la fiche a une adresse qui contient `/storage/v1/object/sign/photos/codes/5449000000996/11111111-`.
   - Elle est chargée : `complete` et `naturalWidth > 0`.
2. **Le Stock.**
   - La ligne du Coca a son image chargée. Celle de l'Évian, sans image, a une `.thumb-empty`, comme celle du Lipton, dont le fichier manque au stockage (le lien signé est vide).
   - Un seul appel `sign` part pour la liste (`storageCalls`) : le lien du Coca est déjà gardé depuis l'étape 1.
3. **La fiche du Coca.**
   - L'image de l'en-tête est chargée.
   - La ligne du code a son image, et son `.code-meta` vaut « 24 unités · photo de l'équipe ».
4. **À racheter (2)** : la ligne du Coca a son image, celle du Lipton une `.thumb-empty`.
5. **Aucune requête vers `world.openfoodfacts.org`** dans ce contexte, puisque tous les codes scannés sont connus.
6. **Image coupée** (étape « image absente »), dans un nouveau contexte avec le catalogue `'images'`.
   - Avant la connexion : `page.route('**/object/sign/photos/codes/5449000000996/**', (route) => route.abort('internetdisconnected'))`.
   - Onglet Stock : la ligne du Coca montre une `.thumb-empty`, et la page ne contient aucune `img.thumb` dont `naturalWidth` vaut 0.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/photos src/data src/off src/scanner; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=S node e2e/app-smoke.mjs`
Expected: FAIL. `src/photos/` n'existe pas, et le catalogue `'images'` non plus.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

`e2e/screens.mjs` reçoit les captures `images-scanner`, `images-stock` et `images-fiche`, avec le catalogue `'images'`.

- [ ] **Step 4: Lancer tous les tests, puis regarder**

Run: `npm test && npm run e2e && npm run build && npm run screens`
Expected: tout passe. Les scénarios A à R ne changent pas, puisque leurs catalogues n'ont pas d'image.

Regarder les captures à côté des maquettes `I-confirm`, `I-stock` et `I-fiche`.

- [ ] **Step 5: Commit**

Message : `feat(images): affichage des images des codes (liens signés, vignettes)`.

---

### Task 6: Images — la prise et l'envoi

**Files:**
- Create: `src/photos/jpeg.ts`, `src/photos/savePhoto.ts`, `src/photos/savePhoto.test.ts`, `src/photos/CodePhotoPicker.tsx`
- Modify:
  - `src/photos/Photos.css`, `src/scanner/ScannerScreen.tsx`, `src/scanner/scanFlow.ts`, `src/scanner/scanFlow.test.ts`, `src/scanner/ConfirmCard.tsx` ;
  - `src/products/NewProductForm.tsx`, `src/products/AttachForm.tsx`, `src/stock/CodeList.tsx`, `src/stock/ProductSheet.tsx` ;
  - `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`, `e2e/screens.mjs`.

**Interfaces:**
- Consumes : `photos.ts`, `photoUrls`, `uploadPhoto` et `Thumb` (Tâche 5) ; `api.setBarcodePhoto` ; `PHOTO_JPEG`, `jpegSize` et `withExifOrientation` (`e2e/jpeg.mjs`).
- Produces :
  - **`jpeg.ts`**, qui a besoin du navigateur et que l'e2e teste :
    - `toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob>` dessine la source dans un canvas aux dimensions de `fitWithin`, puis appelle `toBlob(…, 'image/jpeg', PHOTO_QUALITY)`. Il échoue si `toBlob` ne donne rien ;
    - `blobToJpeg(blob: Blob): Promise<Blob>` charge l'image dans un `<img>` (adresse `URL.createObjectURL`, puis `decode()`). Ainsi, l'orientation EXIF d'une photo d'iPhone est respectée. Il convertit avec `naturalWidth` et `naturalHeight`, puis libère l'adresse ;
    - `frameToJpeg(video: HTMLVideoElement | null): Promise<Blob | null>` vaut `null` si la vidéo n'a pas d'image (`readyState < 2` ou `videoWidth === 0`). Sinon, c'est `toJpeg` de l'image en cours.
  - **`savePhoto.ts`** :
    - `type PhotoChoice = { source: 'off'; url: string } | { source: 'equipe'; jpeg: Blob }` ;
    - `interface PhotoDeps { fetchImage(url: string): Promise<Blob>; toJpeg(blob: Blob): Promise<Blob>; upload(path: string, jpeg: Blob): Promise<void>; link(input: { code: string; path: string; source: PhotoSource }): Promise<void>; remember(path: string, jpeg: Blob): void; newId(): string; timeoutMs: number }` ;
    - `savePhoto(code: string, choice: PhotoChoice, deps: PhotoDeps = appPhotoDeps): Promise<string | null>` renvoie le chemin enregistré, ou `null`. Les étapes :
      1. le JPEG : pour Open Food Facts, `toJpeg(await fetchImage(url))` ; pour l'équipe, `choice.jpeg` tel quel ;
      2. `path = photoPath(code, newId())`, puis `upload`, puis `link` ;
      3. `remember(path, jpeg)`, qui retient une adresse `blob:` pour ce chemin.
    - Tout échec, ou le délai de `timeoutMs` dépassé, donne `null`.
    - `appPhotoDeps` :
      - `fetchImage` : `fetch` en mode `cors`, dont le statut doit être OK ;
      - `toJpeg` : `blobToJpeg` ;
      - `upload` : `uploadPhoto` ; `link` : `api.setBarcodePhoto` ;
      - `remember` : `photoUrls.remember(path, URL.createObjectURL(jpeg))` ;
      - `newId` : `crypto.randomUUID()` ; `timeoutMs` : `PHOTO_TIMEOUT_MS`.
  - **`CodePhotoPicker`**, en `div.photo-picker[role="group"][aria-label="Photo du code"]` (maquettes `I-photo` et `I-off`) :
    - props : `{ offImageUrl: string | null; teamPhoto: Blob | null; onTeamPhoto: (jpeg: Blob | null) => void; takeFrame: () => Promise<Blob | null>; disabled: boolean }` ;
    - photo de l'équipe : son aperçu, 72 px, « Photo prise », « Elle sera gardée avec ce code. », puis « Reprendre » et « Retirer » en `.link`. « Retirer » revient à l'image d'Open Food Facts s'il y en a une, sinon à rien ;
    - sinon, avec une image d'Open Food Facts qui se charge : son aperçu, « Image trouvée », « Image : Open Food Facts. Elle sera gardée avec ce code. », puis « Prendre ma photo à la place » en `.link` ;
    - sinon : la vignette vide, « Photo », « Facultatif : vise le pack ou la canette, sans personne dans l'image, puis touche le bouton. », puis « Prendre la photo », teinté, avec `IconCamera` ;
    - une image d'Open Food Facts qui ne se charge pas (`error`) compte comme absente ;
    - `takeFrame` qui renvoie `null` donne `p.field-error` « La caméra n'est pas prête : réessaie dans un instant. ».
  - **`ScannerScreen`** passe `takeFrame = () => frameToJpeg(videoRef.current)`, et l'`imageUrl` d'Open Food Facts du code, à `NewProductForm` et à `AttachForm`.
  - **`NewProductForm`** : le sélecteur en premier, sous « Code : … ». Le choix vaut la photo de l'équipe s'il y en a une, sinon l'image d'Open Food Facts, sinon rien.
    - Après `createProduct` : sans choix, `onReady` comme aujourd'hui. Avec un choix, le bouton affiche « Envoi de la photo… », puis `onReady({ product, units, code, photoPath, photoWarning })`. `photoPath` est le résultat de `savePhoto`, et `photoWarning` vaut `true` quand il est `null`.
    - Rien d'autre ne change : identifiant tiré à l'ouverture, champs figés après une réponse perdue, « Réessayer ».
    - La canette scannée pour le nom n'a pas d'image à la création. On l'ajoute ensuite depuis la fiche.
  - **`AttachForm`** : nouvelle prop facultative `photo?: { offImageUrl: string | null; takeFrame: () => Promise<Blob | null> }`. Le Scanner la passe ; l'ajout d'un code tapé depuis la fiche, non. Avec `photo`, le sélecteur s'affiche sous « Ce code vaut », et l'envoi suit la même règle après `attached`.
  - **`ConfirmTarget.photoWarning?: true`** : `ConfirmCard` affiche alors `p.message.message-warning` avec `PHOTO_NOT_SAVED_MESSAGE`, sous `.confirm-head`. « Valider » marche comme d'habitude.
  - **`CodeList`** reçoit la prop `onPhotoChanged: () => void`. Pour un produit actif :
    - l'image de chaque code est dans `button.thumb-button[aria-label="Changer la photo du code <code>"]` ;
    - un seul `input[type=file][accept="image/*"][capture="environment"]`, masqué, sert à tous les codes ;
    - au choix d'un fichier : `blobToJpeg`, puis `savePhoto(code, { source: 'equipe', jpeg })`. Pendant ce temps, `p.muted` « Envoi de la photo… » s'affiche et les boutons sont grisés ;
    - réussi : `onPhotoChanged()` ; raté : la bande d'erreur `PHOTO_RETRY_MESSAGE` ;
    - pour un produit archivé, l'image reste une simple `Thumb`.
  - **`ProductSheet`** : `onPhotoChanged` relit les codes, puis appelle `onCatalogChanged()` (l'image du produit peut changer).
  - **`fakeSupabase.mjs`** : option `failPhotoUpload` (le premier envoi est coupé, `internetdisconnected`), et option `hangPhotoUpload` (le premier envoi ne reçoit jamais de réponse).

- [ ] **Step 1: Écrire les tests**

`savePhoto.test.ts` (dépendances simulées, minuteries simulées) :
- Open Food Facts : `fetchImage`, puis `toJpeg`, `upload` et `link`, dans cet ordre. Le chemin vaut `codes/<code>/<id>.jpg`, `link` reçoit `source: 'off'`, et le résultat est ce chemin ;
- photo de l'équipe : ni `fetchImage` ni `toJpeg` ; `link` reçoit `'equipe'` ;
- échec d'`upload` : `null`, sans `link` ni `remember` ;
- échec de `link` : `null` ;
- un `upload` qui ne répond pas donne `null` après `timeoutMs`.

`scanFlow.test.ts` : `product_ready` garde `photoPath` et `photoWarning`.

Scénario S, étapes ajoutées, chacune dans un nouveau contexte :
7. **Copie depuis Open Food Facts** (catalogue `'empty'`).
   - « Nouveau produit » : le sélecteur affiche « Image trouvée », avec l'adresse d'Open Food Facts, et « Prendre ma photo à la place ».
   - « Ce code vaut » à 24, puis « Créer le produit ».
   - Un envoi : un chemin qui suit `/^codes\/5449000000996\/[0-9a-f-]{36}\.jpg$/`, le type `image/jpeg`, des octets qui commencent par `FF D8`, et `jpegSize` de 480 × 320.
   - `set_barcode_photo` reçoit ce chemin avec `p_source: 'off'`.
   - La vignette de la fiche de confirmation a une adresse `blob:`.
8. **Photo de l'équipe** (`'empty'`, `offImage: false`).
   - Le sélecteur affiche « Prendre la photo ». Au toucher, « Photo prise » s'affiche, avec son aperçu.
   - « Créer le produit » : `jpegSize` de 480 × 270 (la fausse caméra fait 1280 × 720), et `p_source: 'equipe'`.
9. **Envoi raté** (`'empty'`, `failPhotoUpload: true`).
   - Après « Créer le produit », la fiche de confirmation s'affiche avec `PHOTO_NOT_SAVED_MESSAGE`.
   - Un seul `create_product`, aucun `set_barcode_photo`.
   - « Valider » enregistre l'entrée.
10. **Envoi bloqué** (`'empty'`, `hangPhotoUpload: true`) : la fiche de confirmation et le message arrivent en moins de 20 s, avec un seul `create_product`.
11. **Ajout à un produit existant, depuis le Scanner** (`'coca_without_code'`).
    - « Ajouter à un produit existant », le Coca, puis le sélecteur avec l'image d'Open Food Facts.
    - « Ajouter le code » : un envoi, puis `set_barcode_photo` avec `'off'`.
12. **Depuis la fiche** (`'images'`).
    - Stock › Coca › « Changer la photo du code 5449000000996 » : l'événement `filechooser` arrive. On lui donne `withExifOrientation(PHOTO_JPEG, 6)`, nommé `photo.jpg`.
    - L'envoi fait 320 × 480 : la photo est redressée.
    - `set_barcode_photo` reçoit `'equipe'`, et la vignette du code prend l'adresse `blob:` du nouveau chemin.
    - L'ajout d'un code tapé (« Ajouter un code ») n'affiche pas de sélecteur de photo.
13. **La caméra du Scanner repart** : onglet Scanner, puis `srcObject instanceof MediaStream`, puis la fiche de confirmation du Coca.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/photos src/scanner; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=S node e2e/app-smoke.mjs`
Expected: FAIL. `savePhoto` n'existe pas, et le formulaire n'a pas de sélecteur de photo.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

`e2e/screens.mjs` reçoit les captures `photo-off` et `photo-prise`.

- [ ] **Step 4: Lancer tous les tests, puis regarder**

Run: `npm test && npm run e2e && npm run build && npm run screens`
Expected: tout passe.

Regarder les captures à côté des maquettes `I-photo` et `I-off`.

- [ ] **Step 5: Commit**

Message : `feat(images): photo à la création (Open Food Facts ou caméra du Scanner) et depuis la fiche`.

---

### Task 7: Mise en place sur le vrai projet

Après la relecture finale de tout ce plan et ses corrections. Aucune instruction destructive ; la remise à zéro n'est pas concernée.

**Files:** aucun.

- [ ] **Step 1: Contrôles avant migration**, en lecture seule, avec `execute_sql` sur le projet `scandrinks` :
- `select count(*) from storage.buckets where id = 'photos'` → 0 ;
- `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'barcodes' order by ordinal_position` → `code`, `product_id`, `units`, `created_at` ;
- `list_migrations` donne les trois migrations des jalons 1 à 3.

- [ ] **Step 2: Migration**

`apply_migration`, avec `name: 'images'` et le contenu exact de `supabase/migrations/20261021120000_images.sql`. Elle ne contient aucune instruction destructive : pas de confirmation attendue.

- [ ] **Step 3: Tests de la base sur le vrai projet**

`execute_sql` avec `supabase/tests/database.test.sql`. Expected : `OK`. Tout est annulé à la fin, objets du stockage compris.

- [ ] **Step 4: Contrôles après migration**
- `get_advisors`, avec `security` puis `performance` : aucune alerte ERROR. Les alertes WARN sont notées dans le journal.
- `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photos'` → `photos`, `false`, `262144`, `{image/jpeg}`.
- `select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'photos_%' order by 1` → `photos_insert` (INSERT), `photos_select` (SELECT).
- Les colonnes de `product_stock`, dans l'ordre : `id`, `name`, `pack_size`, `alert_threshold`, `target_stock`, `archived`, `created_at`, `updated_at`, `stock`, `photo_path`. L'app en service sur `main` lit toujours les mêmes colonnes.

La suite : le plan du jalon 4, à sa Tâche 1.

---

## Décisions prises dans ce plan (la spec ne les fixe pas)

- **Couleurs en plus de celles de la spec**, avec leurs contrastes vérifiés :
  - texte sur une piste ou une pastille ;
  - pastille du prénom ;
  - orange pâle et bleu pâle (bouton teinté des modes Sortie et Inventaire) ;
  - bord de la barre d'onglets ;
  - vignette vide ;
  - tuiles d'icône des Réglages ;
  - texte sur un fond plein ;
  - fond du viseur, voile de la consigne, ombre des cartes.
- **Une ligne annulée** est en texte secondaire (`#6C6C70` de jour), et non dans le gris de la maquette (`#8E8E93`), qui n'atteint que 3,3:1.
- **Thème :**
  - « Automatique » est fait par le CSS (`prefers-color-scheme`), « Clair » et « Sombre » par `data-theme` ;
  - la barre d'état suit le fond ;
  - le choix est gardé sous `scandrinks.appearance`.
- **Scanner :**
  - le sélecteur de mode est au-dessus de la caméra ;
  - la caméra se réduit à 150 px pour une fiche longue (nouveau produit, ajout, saisie manuelle, inventaire) ;
  - la consigne se pose sur la caméra ;
  - toute la fiche de confirmation prend la couleur du mode : « Valider » plein, « Annuler » teinté, les boutons + et −.
- **Textes nouveaux :**
  - sur l'écran de connexion : « Le stock de la réserve, sur ton iPhone. » et « Un souci ? Préviens la personne qui gère ScanDrinks. » ;
  - la note de l'Apparence ;
  - le sous-titre d'À racheter, et « Mis à jour à » sous le Stock ;
  - « Touche un produit pour ouvrir sa fiche. » ;
  - l'aide commune du comptage (`countBoth`) ;
  - les textes du sélecteur de photo et les deux messages de photo.
- **Textes des maquettes non repris :** les aides des champs restent celles de l'app, validées après le jalon 1.
- **VoiceOver :** la phrase entière reste lue, en `aria-label` sur les lignes d'À racheter, et en texte masqué sur les lignes de l'Historique et des mouvements.
- **Stockage :**
  - au plus 256 Kio par image, et `image/jpeg` seulement ;
  - le nom de l'objet est contrôlé à l'ajout ;
  - aucune modification ni suppression ;
  - `set_barcode_photo` vérifie que l'objet existe.
- **Image du produit :** celle du code du pack, sinon la première par date de création.
- **Liens signés :** demandés par lots, gardés 50 minutes.
- **Envoi :**
  - des octets bruts, avec un cache d'un an : un nom ne change jamais d'image ;
  - délai de 15 s ;
  - la fiche est enregistrée d'abord.
- **Open Food Facts :** seules les adresses `https://images.openfoodfacts.org/` sont téléchargées.
- **Canette scannée pour le nom :** pas d'image à la création ; on l'ajoute depuis la fiche.
- **Les maquettes sont copiées dans le dépôt** (`docs/maquettes/`) : le canevas reste en ligne, mais le plan ne dépend pas de lui.
- **Outil de captures** (`npm run screens`) : chaque tâche compare ses écrans aux maquettes, de jour et de nuit.
