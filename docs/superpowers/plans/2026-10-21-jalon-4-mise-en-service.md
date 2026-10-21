# ScanDrinks — Jalon 4 (la mise en service) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Mettre ScanDrinks en service auprès de l'équipe :
- la **vidéo tuto** : l'écran « Tutoriel » des Réglages, la page `/tutoriel/` du QR code, la vidéo fabriquée par un script, et son fichier MP4 ;
- la **feuille A4** de la réserve ;
- **quatre corrections** avant la semaine d'essai ;
- la **remise à zéro** de la base, le **jour J** et la **semaine d'essai**.

Validation (spec §9) : une semaine d'utilisation par l'équipe.

**Architecture :**
- **Lecture.** La vidéo est servie avec l'app au format HLS, dans `public/tutoriel/video/` :
  - la liste `tutoriel.m3u8` ;
  - le segment d'initialisation `init.mp4` et des segments fMP4 de 6 s, `seg-NNN.m4s` ;
  - l'image d'attente `poster.jpg`.

  Cloudflare Pages ne répond pas aux demandes partielles, dont un iPhone a besoin pour lire un MP4. Avec HLS, chaque segment est un petit fichier lu en entier. L'écran « Tutoriel », par-dessus l'app comme les autres Réglages, et la page statique `public/tutoriel/index.html` utilisent le lecteur natif.
- **L'essai d'abord.** Une vidéo de 10 s, encodée par le même outil, permet de vérifier la lecture sur l'iPhone du porteur du projet (Tâche 4), avant de tourner la vraie.
- **Tournage.** `scripts/tutorial/record.mjs` lance la version e2e (`dist-e2e`, base simulée `e2e/fakeSupabase.mjs`) dans Chromium, sur un iPhone simulé : 390 × 844, échelle 2, écran tactile.
  - Une fausse caméra (un canvas branché sur `getUserMedia`) montre le code-barres voulu au moment voulu.
  - Un rond marque chaque toucher. La confirmation de l'Historique est dessinée dans la page.
  - Playwright enregistre la vidéo, et le script note l'heure de chaque chapitre et de chaque sous-titre.
  - Chaque geste attend l'écran prévu : si l'app a changé, le tournage s'arrête au lieu de filmer un écran faux.
- **Montage.** `scripts/tutorial/edit.mjs` compose avec ffmpeg une vidéo verticale de 1080 × 1920 :
  - une carte de titre ;
  - l'écran de l'app dans un cadre, le titre du chapitre en haut et le sous-titre en bas (ASS, police Inter) ;
  - une carte de fin.

  Il en tire le MP4 pour le porteur du projet, puis le HLS et l'image d'attente.
- **Feuille A4.**
  - `scripts/sheet/sheet.html` : le contenu, en HTML et CSS d'impression.
  - `scripts/sheet/print.mjs` y place le QR code, écrit par `zxing-wasm/writer` (déjà installé), puis l'imprime en PDF avec Chromium : `docs/feuille-reserve.pdf`.
  - `scripts/sheet/check.mjs` vérifie le PDF : une seule page A4, le QR code relu par `zxing-wasm/reader`, les textes clés.
- **Remise à zéro.** `supabase/remise-a-zero.sql`, hors des migrations, testée en local par `supabase/tests/reset.test.sh`. Le porteur du projet la lance le jour J dans l'éditeur SQL ; Claude ne la lance jamais.
- **Corrections.**
  - Un filet de sécurité React (`src/app/ErrorBoundary.tsx`) autour de l'app.
  - L'écran allumé, redemandé après un relâchement par le système (s7).
  - « Réessayer » gardé sur la fiche produit (s3).
  - Le commentaire de `AppShell.tsx` (s8).

**Tech Stack :** celle des jalons 1 à 3, sans nouvelle dépendance. Les scripts de la vidéo et de la feuille utilisent en plus des outils du poste, présents dans l'environnement Claude Code :
- ffmpeg, avec libx264 et libass ;
- poppler-utils : `pdfinfo`, `pdftoppm` et `pdftotext` ;
- la police Inter.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, surtout :
- §2 (iOS 16.4), §4.6 (Tutoriel), §6.2 (HLS, filet de sécurité), §6.5, §7, §8 (tests du jalon 4, recette) ;
- §9, « Mise en service (jalon 4) » : vidéo, écran, page, feuille, remise à zéro, jour J, semaine d'essai, corrections, reports, déroulé ;
- §10 et §11 (décisions du 21/10/2026).

Les points s3, s7 et s8 sont décrits dans la section « Bilan » de `docs/superpowers/plans/2026-10-20-jalon-3-suivi.md`.

**Périmètre :**
- **Traité ici :** tout le §9 « Mise en service ».
- **Reporté** (spec §9) :
  - les points s1, s2, s4, s5 et s6 ;
  - le message dédié après un changement de mot de passe ;
  - la protection contre les mots de passe divulgués ;
  - les noms de l'historique des migrations.
- **Pas de migration :** la base ne change pas de forme. La seule action sur ses données est la remise à zéro, lancée par le porteur du projet.

**Relecture finale :** la relecture de toute la branche (executing-plans) a lieu après la Tâche 8, avant la mise en service (Tâche 9).

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français. Identifiants et noms des scripts en anglais.
  - Adresses et documents destinés à l'équipe en français : `/tutoriel/`, `feuille-reserve.pdf`, `remise-a-zero.sql`.
  - Apostrophe droite `'` dans les textes de l'interface. Le signe moins affiché est U+2212 (`−`).
  - Espace insécable (U+00A0) avant « : » seulement dans les textes d'aide de `fieldHelp.ts`, comme aux jalons précédents.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit la version de production.
- **Navigation.** Une seule page, sans changement d'URL (spec §6.2) :
  - le Tutoriel est un écran par-dessus l'app ;
  - l'app ne contient aucun lien vers `/tutoriel/`, car un lien ferait sortir l'app installée sans moyen d'y revenir.
- **iPhone.**
  - iOS 16.4 au minimum : c'est la version que vise Vite 8 (`safari16.4`, `ios16.4`).
  - Champs de saisie en 16 px au moins. Rien ne dépasse en largeur à 320 px, ni ne passe sous la barre d'onglets.
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées.
  - Le QR code passe par `zxing-wasm/writer` et `zxing-wasm/reader`.
  - Les fichiers `.wasm` viennent de `node_modules`, jamais du CDN que zxing-wasm utilise par défaut.
- **Vidéo.**
  - **Données fictives seulement :** la version e2e, sa base simulée, ses prénoms (Sam, Léa) et son mot de passe factice. Jamais la vraie base, ni le vrai mot de passe, ni l'adresse du compte du tabac.
  - **`public/tutoriel/` est en ligne pour tous.** Aucun fichier de plus de 25 Mo (limite de Cloudflare Pages), et le dossier `public/tutoriel/video/` reste sous 20 Mo.
  - **Le MP4 n'est pas versionné :** `dist-tutorial/` est ignoré par Git.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`), organisation « ScanDrinks ». Ne jamais toucher à l'organisation ni au projet « Webia ».
  - Aucune migration au jalon 4, et les migrations existantes ne sont jamais modifiées.
  - **La remise à zéro n'est jamais lancée par Claude**, ni par le connecteur, ni autrement. Sur le vrai projet, Claude ne fait que des lectures (`select`), après que le porteur du projet l'a lancée.
- **Mots de passe.** Jamais demandés, affichés, écrits ni journalisés. Le guide du jour J dit de donner le mot de passe à voix haute.
- **Adresses de test.**
  - La préversion `https://jalon-4.scandrinks.pages.dev` s'ouvre dans Safari, sans être installée.
  - Elle utilise la vraie base : ses essais n'écrivent rien, car le Tutoriel ne fait que lire des fichiers.
  - L'icône de l'écran d'accueil vient toujours de `https://scandrinks.pages.dev`.
- **Fusion** dans `main` : avec l'accord du porteur du projet.

## Review Focus

1. **Lecture HLS sur un vrai iPhone**, dans Safari et dans l'app installée.
   - Attendu : la vidéo démarre au toucher et se lit jusqu'au bout. « Retour » revient aux Réglages.
   - Tests : aucun test automatique ne lit le HLS d'un iPhone. Essai de la Tâche 4, puis protocole `docs/jalon-4-test.md` (Tâche 9).
2. **Vidéo injoignable** : réseau coupé, ou fichier manquant.
   - Attendu : « La vidéo ne se charge pas. Vérifie la connexion, puis réessaie. » sous le lecteur, et le reste de l'app utilisable.
   - Test : scénario e2e P, étape 3 (Tâche 1).
3. **Erreur imprévue à l'écran.**
   - Attendu : le message du §7 et « Recharger », qui relance l'app sans boucler.
   - Test : scénario e2e Q (Tâche 2).
4. **Écran allumé relâché par le système à répétition** (mode économie d'énergie).
   - Attendu : une seule nouvelle demande, jamais de boucle. Une demande refusée n'est retentée qu'à la prochaine activation.
   - Tests : `wakeLock.test.ts` (Tâche 2).
5. **Remise à zéro mal lancée** : sur un autre projet, deux fois de suite, ou interrompue.
   - Attendu : sur un autre projet, elle s'arrête sans rien toucher. Relancée, elle ne change rien. Tout ou rien, en une transaction.
   - Tests : `reset.test.sh` (Tâche 3).

---

### Task 1: Lecteur de la vidéo et essai de lecture

**Files:**
- Create:
  - `src/settings/tutorial.ts`, `src/settings/TutorialScreen.tsx`, `src/settings/Tutorial.css`, `src/settings/tutorial.test.ts` ;
  - `public/tutoriel/index.html` ;
  - `scripts/tutorial/hls.mjs`, `scripts/tutorial/trial.mjs`, `scripts/tutorial/check.mjs` ;
  - `public/tutoriel/video/*`, produits par `trial.mjs`.
- Modify: `src/settings/SettingsScreen.tsx`, `src/app/AppShell.tsx`, `e2e/app-smoke.mjs`, `package.json`, `.gitignore`

**Interfaces:**
- Produces :
  - **`tutorial.ts`** :
    - `TUTORIAL_PLAYLIST = '/tutoriel/video/tutoriel.m3u8'` ;
    - `TUTORIAL_POSTER = '/tutoriel/video/poster.jpg'` ;
    - `TUTORIAL_LENGTH_NOTE = 'Environ 3 minutes, sans le son : tout est écrit.'` ;
    - `TUTORIAL_LOAD_ERROR = 'La vidéo ne se charge pas. Vérifie la connexion, puis réessaie.'`.
  - **`TutorialScreen({ onBack }: { onBack: () => void })`**, avec ce contenu :
    - `main.screen.tutorial`, `h1` « Tutoriel », puis un paragraphe `TUTORIAL_LENGTH_NOTE` ;
    - `<video controls playsInline preload="none" poster={TUTORIAL_POSTER} src={TUTORIAL_PLAYLIST} aria-label="Vidéo tuto">` ;
    - sur l'événement `error` de la vidéo : `p[role=alert].message.message-error` avec `TUTORIAL_LOAD_ERROR` ;
    - `button.primary` « Retour ».
    - `Tutorial.css` : vidéo pleine largeur, `max-height: 70vh`, fond noir, coins arrondis.
  - **`SettingsScreen`** :
    - nouvelle prop `onTutorial: () => void` ;
    - un bouton « Tutoriel », le premier, avant « Changer de prénom » ;
    - le commentaire d'en-tête est mis à jour.
  - **`AppShell`** :
    - `Overlay` reçoit `'tutorial'` ;
    - les Réglages ouvrent le Tutoriel, et « Retour » ramène aux Réglages (`setOverlay('settings')`).
  - **`public/tutoriel/index.html`**, page statique (Vite la copie telle quelle) :
    - `lang="fr"`, viewport, `theme-color` `#1f6f3f`, titre « ScanDrinks — Tutoriel » ;
    - CSS en ligne : police système, marges des zones sûres, vidéo comme dans l'app ;
    - `h1` « Tutoriel ScanDrinks », puis le texte de `TUTORIAL_LENGTH_NOTE` ;
    - la même vidéo, avec les mêmes chemins et attributs (`playsinline`) ;
    - `p#unsupported hidden` : « Ouvre cette page sur un iPhone pour voir la vidéo. » ;
    - `p#failed hidden role="alert"` : le texte de `TUTORIAL_LOAD_ERROR` ;
    - `<a href="/">Ouvrir ScanDrinks</a>`.
    - Script en ligne : `#unsupported` s'affiche si `video.canPlayType('application/vnd.apple.mpegurl') === ''`, et `#failed` sur l'erreur de la vidéo.
  - **`scripts/tutorial/hls.mjs`** :
    - `ENCODE_ARGS` : `-c:v libx264 -profile:v high -pix_fmt yuv420p -r 30 -g 60 -keyint_min 60 -sc_threshold 0 -crf 22 -preset slow -movflags +faststart -an`, soit une image clé toutes les 2 s et pas de son ;
    - `encodeHls(mp4Path: string, outDir: string): void` : retire de `outDir` les anciens `.m3u8`, `.m4s` et `init.mp4`, puis `ffmpeg -i <mp4> -c copy -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 -hls_segment_filename <outDir>/seg-%03d.m4s <outDir>/tutoriel.m3u8` ;
    - `extractPoster(mp4Path: string, atSeconds: number, outFile: string): void` ;
    - `interFont(weight: 'regular' | 'bold'): string` : chemin du fichier de la police, donné par `fc-match`.
  - **`scripts/tutorial/trial.mjs`** : 10 s en 1080 × 1920, fond `#1f6f3f`, « ScanDrinks — essai de lecture » et un compteur de secondes (`drawtext`, texte lu dans un fichier pour éviter l'échappement).
    - Sorties : `dist-tutorial/essai.mp4`, puis `encodeHls` vers `public/tutoriel/video` et `extractPoster` à 1 s.
  - **`scripts/tutorial/check.mjs [--trial | --raw]`**. Sans option, le contrôle de la vraie vidéo (complété à la Tâche 6) :
    - la liste contient `#EXT-X-PLAYLIST-TYPE:VOD`, `#EXT-X-MAP:URI="init.mp4"` et `#EXT-X-ENDLIST` ;
    - chaque segment cité existe, et aucun segment n'est orphelin ;
    - `poster.jpg` existe ;
    - chaque fichier fait moins de 25 Mo, et le dossier moins de 20 Mo ;
    - `ffprobe` donne du H.264 en 1080 × 1920. Durée : de 9,5 à 10,5 s avec `--trial`, de 150 à 240 s sans option.
    - Il affiche « Vidéo OK : <durée> s, <taille> Mo ».
  - **`package.json`** : `"tutorial:trial": "node scripts/tutorial/trial.mjs && node scripts/tutorial/check.mjs --trial"`.
  - **`.gitignore`** : `dist-tutorial/`.

- [ ] **Step 1: Écrire les tests**

`src/settings/tutorial.test.ts` :
- **La page** (`public/tutoriel/index.html?raw`) contient :
  - `lang="fr"` ;
  - `src="${TUTORIAL_PLAYLIST}"`, `poster="${TUTORIAL_POSTER}"`, `preload="none"` et `playsinline` ;
  - `href="/"` avec « Ouvrir ScanDrinks » ;
  - « Ouvre cette page sur un iPhone pour voir la vidéo. » et `TUTORIAL_LOAD_ERROR`.
- **La liste** (`public/tutoriel/video/tutoriel.m3u8?raw`) :
  - elle contient VOD, `EXT-X-MAP` et `EXT-X-ENDLIST` ;
  - ses lignes `seg-NNN.m4s` sont exactement les fichiers trouvés par `import.meta.glob('../../public/tutoriel/video/*.m4s')`.

Scénario e2e P (Tutoriel), nouvelle fonction `scenarioTutorial` ajoutée à la liste :
1. **Ouverture.**
   - Après la connexion, ⚙. L'ordre des boutons est : « Tutoriel », « Changer de prénom », « Changer le mot de passe du tabac », « Se déconnecter », « Retour ».
   - « Tutoriel » : le titre « Tutoriel » et `TUTORIAL_LENGTH_NOTE` s'affichent.
   - La vidéo porte `controls`, `playsInline`, `preload === 'none'`, un `src` qui finit par `/tutoriel/video/tutoriel.m3u8` et un `poster` qui finit par `/tutoriel/video/poster.jpg`.
   - Aucune requête `.m3u8` ni `.m4s` n'est encore partie.
   - La caméra du Scanner est arrêtée : sa vidéo n'a plus de flux (`srcObject === null`), comme au scénario H.
2. **« Retour »** ramène aux Réglages (titre « Réglages »), puis « Retour » ramène à l'app.
3. **Vidéo injoignable.**
   - `page.route('**/tutoriel/video/**', (route) => route.abort('internetdisconnected'))`, puis le Tutoriel, puis `video.play()` par `evaluate`, avec le refus de la promesse attrapé.
   - `TUTORIAL_LOAD_ERROR` s'affiche (`role="alert"`). Dans Chromium, qui ne lit peut-être pas le HLS, le message est le même.
4. **La page `/tutoriel/`.**
   - Elle affiche le titre « Tutoriel ScanDrinks ».
   - Le lien « Ouvrir ScanDrinks » mène à `/`.
   - « Ouvre cette page sur un iPhone… » est visible si et seulement si `canPlayType('application/vnd.apple.mpegurl')` vaut `''` dans ce navigateur.
   - Le lien ouvre l'app (bouton « Se connecter »).

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/settings/tutorial.test.ts; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=P node e2e/app-smoke.mjs`
Expected: FAIL. Les fichiers de `public/tutoriel/` manquent, et il n'y a pas de bouton « Tutoriel ».

- [ ] **Step 3: Écrire le code de la partie Interfaces, puis produire l'essai**

Run: `npm run tutorial:trial`
Expected: « Vidéo OK : 10.0 s, … Mo ». `public/tutoriel/video/` contient `tutoriel.m3u8`, `init.mp4`, `seg-000.m4s`, `seg-001.m4s` et `poster.jpg`.

- [ ] **Step 4: Lancer tous les tests**

Run: `npm test && npm run e2e && npm run build && ls dist/tutoriel/video`
Expected: tout passe, « E2E OK », et `dist/tutoriel/video` contient les fichiers de l'essai.

- [ ] **Step 5: Commit**

Message : `feat(tutoriel): écran « Tutoriel », page de la vidéo et essai de lecture HLS`.

---

### Task 2: Filet de sécurité et corrections (s3, s7, s8)

**Files:**
- Create: `src/app/ErrorBoundary.tsx`
- Modify: `src/App.tsx`, `src/startup.ts`, `src/startup.test.ts`, `src/scan/wakeLock.ts`, `src/scan/wakeLock.test.ts`, `src/scan/useScreenWakeLock.ts`, `src/stock/ProductSheet.tsx`, `src/app/AppShell.tsx` (commentaire), `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`

**Interfaces:**
- Produces :
  - **`startup.ts`** : `RENDER_ERROR_MESSAGE = "L'app a rencontré un problème. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks."` (spec §7).
  - **`ErrorBoundary`**, classe `Component<{ children: ReactNode }, { failed: boolean }>` :
    - `getDerivedStateFromError` passe `failed` à vrai, et `componentDidCatch` journalise l'erreur avec `console.error` ;
    - une fois en échec, l'écran a l'allure de l'écran de démarrage impossible de `main.tsx` : `main.screen` > `p[role=alert].message.message-error` avec `RENDER_ERROR_MESSAGE`, puis `button.primary` « Recharger », qui appelle `window.location.reload()`.
  - **`App.tsx`** : `<ErrorBoundary><AppShell /></ErrorBoundary>`.
  - **`wakeLock.ts`** :
    - `WakeLockHandle` reçoit `onRelease?(listener: () => void): void`, appelé quand le système rend l'écran de lui-même ;
    - si ce relâchement arrive alors que c'est actif, visible et non `dispose`, une nouvelle demande part ;
    - un second relâchement par le système ne déclenche plus de demande avant la prochaine activation (`setActive(true)`) ou le prochain retour au premier plan : jamais de boucle ;
    - un rendu demandé par l'app (`letGo`) n'est pas un relâchement par le système ;
    - le commentaire d'en-tête dit cette règle.
  - **`useScreenWakeLock.ts`** : le `WakeLockSentinel` devient `{ release: () => sentinel.release(), onRelease: (listener) => sentinel.addEventListener('release', listener, { once: true }) }`.
  - **`ProductSheet.tsx` (s3)** :
    - l'échec de lecture a son propre état, `loadError: string | null`, qui remplace `loadFailed` ;
    - il est rempli par l'échec (hors session expirée), et vidé par une lecture réussie ou par « Réessayer » ;
    - `open()` ne vide plus que l'erreur des actions ;
    - le message et « Réessayer » restent affichés tant que `loadError !== null`.
  - **`AppShell.tsx` (s8)** : à la fin du commentaire d'en-tête, « Se déconnecter ne ferme que la session de ce téléphone ; seul un changement de mot de passe ferme celles de toute l'équipe. »
  - **`fakeSupabase.mjs`** : option `corruptHistory: boolean`. `list_history` renvoie alors en premier un mouvement dont `created_at` vaut `'pas une date'` : une réponse abîmée, que l'Historique ne sait pas afficher (`formatWhen` lève `RangeError`).

- [ ] **Step 1: Écrire les tests**

`startup.test.ts` : `RENDER_ERROR_MESSAGE` a exactement le texte ci-dessus.

`wakeLock.test.ts` : `fakeEnv()` reçoit `systemRelease()`, qui appelle l'écouteur `onRelease` du dernier verrou. Quatre cas :
- « relâché par le système, page visible : redemandé une fois » : `['request', 'request']` ;
- « relâché deux fois de suite par le système : pas de boucle » : toujours deux demandes ;
- « rendu par l'app (plus actif) : rien n'est redemandé » ;
- « après un retour au premier plan, un nouveau relâchement est suivi d'une demande ».

Scénario e2e O :
- **Étape 1 complétée.**
  - `fakeWakeLock()` garde les écouteurs `release` du verrou et expose `window.wakeLockSystemRelease()`, qui les appelle et note `'system-release'`.
  - Après la première demande, un relâchement par le système donne `['request:screen', 'system-release', 'request:screen']`.
  - Un second relâchement n'ajoute que `'system-release'`.
- **Étape 2 complétée (s3).** Après le message de lecture coupée, « Modifier » puis « Annuler » : le message et « Réessayer » sont toujours là. Puis `restoreReads()`, « Réessayer », et « Derniers mouvements » s'affiche.

Scénario e2e Q (filet de sécurité), nouvelle fonction `scenarioRenderError` ajoutée à la liste :
- avec `corruptHistory: true`, la connexion, puis l'onglet « Historique » : `RENDER_ERROR_MESSAGE` et « Recharger » s'affichent, au lieu d'une page blanche ;
- « Recharger » : l'app repart sur le Scanner, et le bouton « Entrée + » est visible.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/scan/wakeLock.test.ts src/startup.test.ts; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=O,Q node e2e/app-smoke.mjs`
Expected: FAIL. Rien n'est redemandé après un relâchement, « Réessayer » disparaît, et la page reste blanche.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

- [ ] **Step 4: Lancer tous les tests**

Run: `npm test && npm run e2e && npm run build`
Expected: tout passe.

- [ ] **Step 5: Commit**

Message : `fix(app): filet de sécurité, écran allumé redemandé (s7), « Réessayer » gardé sur la fiche (s3), commentaire (s8)`.

---

### Task 3: Remise à zéro

**Files:**
- Create: `supabase/remise-a-zero.sql`, `supabase/tests/reset.test.sh`
- Modify: `supabase/tests/run-local.sh`, qui lance `reset.test.sh` à la fin

**Interfaces:**
- Produces :
  - **`supabase/remise-a-zero.sql`.**
    - **En-tête en français :** ce que fait le script, quand le lancer (le matin du jour J), où (éditeur SQL, projet « scandrinks »), ce qu'il garde, et qu'il s'arrête de lui-même sur un autre projet.
    - **Déroulé**, en une seule transaction :
      1. `begin;` puis `create temporary table reset_report (products bigint, barcodes bigint, movements bigint, accounts bigint);`.
      2. Un bloc `do` :
         - **Garde 1.** Si l'une des tables `public.products`, `public.barcodes`, `public.movements` ou `public.allowed_users` manque, ou si les trois fonctions `public.record_movement`, `public.record_inventory` et `public.list_history` ne sont pas toutes là, il s'arrête : `raise exception 'Arrêt : ce projet n''est pas ScanDrinks. Rien n''a été effacé. Choisis le projet « scandrinks », puis relance.'`.
         - **Garde 2.** Sans aucune ligne dans `allowed_users`, il s'arrête aussi : « Arrêt : aucun compte du tabac dans allowed_users. Rien n'a été effacé. ».
         - **Effacement :** `delete` sur `movements`, puis `barcodes`, puis `products`, en comptant les lignes effacées.
         - **Vérification :** les trois tables sont vides, et le nombre de comptes n'a pas changé. Sinon : « Arrêt : vérification ratée. Rien n'a été effacé. ».
         - Le bilan est écrit dans `reset_report`.
      3. `commit;`.
      4. `select format('Remise à zéro faite : %s produit(s), %s code(s) et %s mouvement(s) effacés. Compte du tabac gardé (%s).', …) as resultat from reset_report;`.
    - Une erreur arrête tout : la transaction est annulée et l'éditeur affiche le message.
  - **`supabase/tests/reset.test.sh`**, en local seulement (lancé comme `run-local.sh`, par `su postgres`). Il crée des bases jetables et vérifie trois cas :
    1. **Une base ScanDrinks avec des données.**
       - La base : l'imitation de Supabase, les migrations, un compte autorisé, 2 produits, 3 codes et 4 mouvements, dont un annulé.
       - La sortie est exactement « Remise à zéro faite : 2 produit(s), 3 code(s) et 4 mouvement(s) effacés. Compte du tabac gardé (1). ».
       - Ensuite : 0 produit, 0 code, 0 mouvement ; 1 ligne dans `allowed_users` et dans `auth.users`.
    2. **Relancée :** « … 0 produit(s), 0 code(s) et 0 mouvement(s) effacés. Compte du tabac gardé (1). ».
    3. **Un autre projet.**
       - La base : une table `public.products (id int)` avec une ligne, sans les fonctions de ScanDrinks.
       - `psql` sort en erreur avec « Arrêt : ce projet n'est pas ScanDrinks » ; la ligne est toujours là.
    4. **ScanDrinks sans compte autorisé** (migrations et 1 produit) : erreur « Arrêt : aucun compte du tabac », et le produit est toujours là.

    À la fin, il affiche « Remise à zéro : OK ».

- [ ] **Step 1: Écrire le test** (`reset.test.sh`, les quatre cas)

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `pg_ctlcluster 16 main start; su postgres -c "bash supabase/tests/reset.test.sh"`
Expected: FAIL, car `supabase/remise-a-zero.sql` n'existe pas.

- [ ] **Step 3: Écrire `supabase/remise-a-zero.sql`**

- [ ] **Step 4: Lancer tous les tests SQL**

Run: `su postgres -c "bash supabase/tests/run-local.sh"`
Expected: la dernière ligne des tests de la base est `OK`, puis « Remise à zéro : OK ».

- [ ] **Step 5: Commit**

Message : `feat(base): script de remise à zéro du jour J, testé en local`.

---

### Task 4: Essai de lecture sur iPhone (point d'arrêt)

**Files:** aucun, sauf `public/_headers` si l'étape 1 le demande.

- [ ] **Step 1: Envoi de la branche et contrôles de la préversion**

Run: `git push -u origin jalon-4`. Puis, une fois la préversion construite (environ une minute), `curl -sI` sur `https://jalon-4.scandrinks.pages.dev` :
- `/tutoriel/` : 200, `text/html` ;
- `/tutoriel/video/tutoriel.m3u8`, `init.mp4`, `seg-000.m4s` et `poster.jpg` : 200, avec leur `content-type` noté dans le journal.

Le paquet JavaScript de la préversion contient « Tutoriel ». Si la liste n'est pas servie avec un type HLS (`application/vnd.apple.mpegurl`, `application/x-mpegurl` ou `audio/mpegurl`), une règle `public/_headers` fixe son `Content-Type`, puis la branche est renvoyée. Cette décision est notée au journal.

- [ ] **Step 2: Essai du porteur du projet**, environ 5 minutes, dans Safari, sans installer :
1. Ouvrir https://jalon-4.scandrinks.pages.dev/tutoriel/, puis toucher la lecture : la vidéo verte et son compteur défilent pendant 10 s.
2. Ouvrir https://jalon-4.scandrinks.pages.dev et se connecter. Puis Réglages › « Tutoriel » : la lecture marche aussi, et « Retour » ramène aux Réglages.

- [ ] **Step 3: Décision**

- **La vidéo se lit aux deux endroits :** on continue avec la Tâche 5.
- **Elle ne se lit pas :** pas de tournage. Claude propose le repli prévu par la spec (§10) : héberger un MP4 sur Supabase Storage, qui sait répondre aux demandes partielles. C'est un changement de conception : il demande l'accord du porteur du projet et une mise à jour de la spec avant tout code.

---

### Task 5: Tournage de la vidéo

**Files:**
- Create: `scripts/tutorial/storyboard.mjs`, `scripts/tutorial/page-helpers.js`, `scripts/tutorial/record.mjs`
- Modify: `e2e/fakeSupabase.mjs`, `scripts/tutorial/check.mjs` (mode `--raw`), `package.json`

**Interfaces:**
- Consumes : `ean13Modules` (`e2e/ean13.mjs`), `installFakeSupabase` et `GOOD_PASSWORD` (`e2e/fakeSupabase.mjs`).
- Produces :
  - **`fakeSupabase.mjs`** :
    - option `now: () => Date`, l'horloge des `created_at` et `cancelled_at` (par défaut, l'heure réelle) ;
    - export `TUTORIAL_CODES = { coca: COCA_CODE, lipton: '3502110123091', oasisPack: '3124480191182', oasisCan: '3124480191014', redbull: '9002490100070', evian: '3068320114491' }` : des EAN-13 à clé valide (vérifié le 21/10/2026) ;
    - Open Food Facts simulé : `oasisCan` → `{ product_name_fr: 'Oasis Tropical', quantity: '33 cl' }`. Le Coca ne change pas, les autres codes restent inconnus.
    - Un catalogue `'tutoriel'`. Heures de Paris : UTC+2 jusqu'au 25/10/2026, UTC+1 ensuite. « L'erreur » est la ligne que le chapitre 8 annule.

      | id | Nom | Pack | Seuil | Stock idéal | Code (unités) | Mouvements | Stock |
      |---|---|---|---|---|---|---|---|
      | p-coca | Coca-Cola 33 cl | 24 | 24 | 48 | coca (24) | ven. 23/10 09:05 Léa +48 ; sam. 24/10 17:40 Sam −24 | 24 |
      | p-lipton | Lipton Pêche 50 cl | 12 | 12 | 24 | lipton (12) | ven. 09:10 Léa +24 ; sam. 18:05 Léa −14 | 10 |
      | p-redbull | Red Bull 25 cl | 24 | 24 | 48 | redbull (24) | ven. 09:15 Léa +48 ; sam. 18:30 Léa +24 (l'erreur) | 72 |
      | p-evian | Évian 50 cl | 24 | 24 | 48 | evian (24) | ven. 09:20 Léa +24 ; sam. 16:00 Sam −18 | 6 |
  - **`storyboard.mjs`** :
    - `TITLE_CARD`, `END_CARD`, et `CHAPTERS` : la liste des neuf `{ key, title, captions: Record<string, string> }`, dans l'ordre ci-dessous ;
    - `readingTime(text: string): number`, qui vaut `max(2800, 65 × longueur)` en ms.
  - **`page-helpers.js`** : des fonctions autonomes, passées à `page.addInitScript`.
    - `installCamera()` :
      - remplace `navigator.mediaDevices.getUserMedia` par le flux (`captureStream(30)`) d'un canvas de 1280 × 720, redessiné à chaque image : un fond gris uni ;
      - `window.__tutorialCamera.show(modules, digits)` dessine une étiquette blanche avec les barres EAN-13 (modules de 6 px, 40 % de la hauteur) et les chiffres dessous ;
      - `window.__tutorialCamera.hide()` retire l'étiquette.
    - `installTouchMarker()` : à chaque `touchstart` ou `mousedown`, en phase de capture, un rond de 46 px (jaune translucide, bord orange) au point touché, qui s'efface en 600 ms (`pointer-events: none`).
    - `installConfirmDialog()` : `window.confirm` dessine pendant 1,8 s une alerte façon iOS (message, « Annuler », « OK » marqué d'un rond), puis renvoie `true`.
  - **`record.mjs`** :
    - Il lance `vite preview --outDir dist-e2e --port 4174 --strictPort`, puis Chromium.
    - Contexte : viewport 390 × 844, `deviceScaleFactor: 2`, `isMobile`, `hasTouch`, `locale: 'fr-FR'`, `timezoneId: 'Europe/Paris'`, `recordVideo: { dir: 'dist-tutorial/raw', size: { width: 780, height: 1688 } }`.
    - Horloge fixée :
      - `page.clock.install({ time: new Date('2026-10-26T08:30:00Z') })` puis `page.clock.resume()` : lundi 26/10/2026 à 09:30, heure de Paris, et le temps s'écoule normalement ;
      - la base simulée reçoit `now` sur la même origine.
    - Les trois aides de page sont installées, et `installFakeSupabase(page, { catalogue: 'tutoriel', now })`.
    - Aides :
      - `chapter(key)` et `caption(chapterKey, captionKey)` notent `{ kind, key, text, t }` (`t` en ms depuis la création de la page), puis attendent `readingTime(text)` ;
      - `tap(locator)` appelle `locator.tap()`, puis attend 400 ms ;
      - `typeSlowly(locator, text)` appelle `pressSequentially` avec 110 ms entre deux touches ;
      - `showCode(code)` et `hideCode()` pilotent la caméra.
    - **Les gestes.** Chacun attend l'écran prévu, comme les scénarios e2e A, D, I, H et M.
    - **Sorties :**
      - `dist-tutorial/raw/app.webm`, enregistré par `page.video().saveAs` après `context.close()` ;
      - `dist-tutorial/raw/timeline.json`, sous la forme `{ start, end, events }`, où `start` et `end` encadrent les chapitres 1 à 9.
  - **`check.mjs --raw`** vérifie :
    - la timeline a les neuf titres de `CHAPTERS`, dans l'ordre ;
    - chaque sous-titre du storyboard y figure une seule fois ;
    - `app.webm` dure de 140 à 240 s.

    Il affiche « Tournage OK : 9 chapitres, N sous-titres, X s ».
  - **`package.json`** :
    - `"tutorial:record": "vite build --mode e2e --outDir dist-e2e && node scripts/tutorial/record.mjs && node scripts/tutorial/check.mjs --raw"` ;
    - `"tutorial": "npm run tutorial:record && node scripts/tutorial/edit.mjs && node scripts/tutorial/check.mjs"`.

**Le storyboard.** Chaque chapitre donne son titre, puis ses gestes et sous-titres dans l'ordre. Les textes des sous-titres sont exacts.

1. **« Se connecter »**
   - Écran de connexion : « Ouvre ScanDrinks depuis son icône sur l'écran d'accueil. »
   - Le mot de passe factice est tapé, puis « Se connecter » : « Tape le mot de passe du tabac, puis « Se connecter ». »
   - « Qui es-tu ? », puis « Sam » touché parmi les prénoms déjà utilisés : « Choisis ton prénom, ou tape-le la première fois : il signe chacun de tes gestes. »
   - Le Scanner : « Le Scanner s'ouvre, caméra prête. Le téléphone reste connecté. »
2. **« Une livraison Metro : Entrée + »**
   - « Entrée + » : « Retour de Metro : touche « Entrée + », en vert. »
   - Le code du Coca, puis « Pack de 24 → +24 » : « Vise le code-barres du pack : sa fiche s'affiche, avec +24. »
   - « Plus », puis « Pack de 24 × 2 → +48 » : « Plusieurs packs identiques ? Règle la quantité avec + et −. »
   - « Valider » et le message du nouveau stock (72) : « Touche « Valider » : le message donne le nouveau stock. »
   - La caméra vide : « Éloigne le pack : sinon, sa fiche revient 2 secondes plus tard. »
3. **« Un pack vers le frigo : Sortie − »**
   - « Sortie − » : « Tu sors un pack de la réserve : touche « Sortie − », en orange. »
   - Le code du Coca, « Pack de 24 → −24 », puis « Valider » (stock 48) : « Scanne le pack, vérifie −24, puis « Valider ». »
   - Le message affiché : « Une erreur juste après ? « Annuler » dans le message, pendant 5 secondes. »
4. **« Un produit inconnu : créer sa fiche »**
   - « Entrée + », le code du pack Oasis, puis « Code inconnu : 3124480191182 » : « Code inconnu ? L'app propose de créer sa fiche. »
   - « Nouveau produit » : « Touche « Nouveau produit ». »
   - « Scanner une canette du pack », puis le code de la canette : « Pour le nom, touche « Scanner une canette du pack » et vise une canette. »
   - Le nom « Oasis Tropical 33 cl » rempli : « Le nom s'écrit tout seul. Sinon, tape-le. »
   - « 24 » tapé dans « Ce code vaut (unités) » : « Indique combien d'unités vaut le code du pack : ici 24. »
   - 24, 24 et 48 pré-remplis : « Pack Metro, seuil et stock idéal se remplissent seuls ; tu pourras les changer. »
   - « Créer le produit », « Pack de 24 → +24 », « Valider » (stock 24) : « « Créer le produit », puis « Valider » : le pack entre en stock. »
5. **« Compter : Inventaire »**
   - « Inventaire = » : « Pour compter, touche « Inventaire = », en bleu. »
   - Le code du Lipton, puis « Stock connu : 10 » : « Scanne le produit : l'app montre le stock qu'elle connaît. »
   - « 9 » dans « Unités en plus » : « Tape ce que tu comptes : les packs, puis les unités en plus. »
   - La ligne de l'écart (−1), puis « Valider » : « L'écart s'affiche. « Valider » : le stock prend la valeur comptée. »
   - Le message affiché : « Le premier jour, on compte tout : un produit = une seule personne. »
6. **« Avant Metro : À racheter »**
   - L'onglet « À racheter (3) » et sa liste, dans l'ordre Évian, Lipton, Oasis : « Avant Metro, ouvre « À racheter » : le chiffre dit combien de produits manquent. »
   - Puis : « Chaque ligne donne le nombre de packs à prendre. »
   - Puis : « Une ligne disparaît dès que l'entrée du produit est scannée. »
7. **« Le stock et la fiche d'un produit »**
   - L'onglet « Stock » : « « Stock » : tous les produits. En rouge, ceux à racheter. »
   - « Évian 50 cl », puis sa fiche avec « Derniers mouvements » : « Touche un produit : sa fiche, ses codes et ses derniers mouvements. »
   - Puis : « « Corriger le stock » pour recompter, « Modifier » pour changer les seuils. »
   - « Retour ».
8. **« Corriger une erreur : Historique »**
   - L'onglet « Historique » : « « Historique » : tous les gestes, du plus récent au plus ancien. »
   - La ligne « sam. 18:30 — Léa — Entrée +24 — Red Bull 25 cl » : « Ici, une sortie de Red Bull scannée par erreur en « Entrée + ». »
   - Son « Annuler », puis l'alerte dessinée : « Touche « Annuler » sur la ligne, puis « OK ». »
   - La ligne barrée, « annulé par Sam » : « La ligne est barrée, le stock recalculé. Refais ensuite le bon geste. »
9. **« Les Réglages et la suite »**
   - ⚙, puis les Réglages avec « Tutoriel » : « La roue dentée ouvre les Réglages : revoir ce tuto, changer de prénom. »

Les cartes :
- `TITLE_CARD` : « ScanDrinks », « Le tuto en 3 minutes », « Sans le son : tout est écrit. » ;
- `END_CARD` : « Installer l'app sur un autre iPhone : la feuille de la réserve explique tout. » et « Un souci ? Préviens la personne qui gère ScanDrinks. ».

- [ ] **Step 1: Écrire le contrôle** (`check.mjs --raw`)

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `npm run tutorial:record`
Expected: FAIL, car `record.mjs` et le catalogue `'tutoriel'` n'existent pas.

- [ ] **Step 3: Écrire la partie Interfaces** : base simulée, aides de page, storyboard et tournage.

- [ ] **Step 4: Tourner et regarder**

Run: `npm run tutorial:record`
Expected: « Tournage OK : 9 chapitres, 35 sous-titres, … s ».

Puis extraire 4 images de `app.webm` (`ffmpeg -ss <t>`), aux heures des chapitres 2, 4, 6 et 8 de la timeline, et les regarder. On attend :
- un texte net ;
- le rond du toucher visible ;
- l'étiquette du code-barres dans l'image de la caméra.

Si le texte est flou, l'enregistrement de Playwright (VP8, 1 Mbit/s) est remplacé par une capture CDP (`Page.startScreencast`, JPEG qualité 95) envoyée à ffmpeg avec l'heure de chaque image. Cette décision est notée au journal.

- [ ] **Step 5: La base simulée ne casse rien**

Run: `npm run e2e`
Expected: « E2E OK ».

- [ ] **Step 6: Commit**

Message : `feat(tutoriel): tournage de la vidéo sur un iPhone simulé`.

---

### Task 6: Montage de la vidéo

**Files:**
- Create: `scripts/tutorial/edit.mjs`, `scripts/tutorial/cards.html`
- Modify: `scripts/tutorial/check.mjs` (contrôle complet), `public/tutoriel/video/*` (l'essai est remplacé)

**Interfaces:**
- Consumes : `ENCODE_ARGS`, `encodeHls`, `extractPoster` et `interFont` (Tâche 1) ; `timeline.json` et `app.webm` (Tâche 5) ; `TITLE_CARD`, `END_CARD` et `CHAPTERS` (Tâche 5).
- Produces :
  - **`cards.html`** : trois images de 1080 × 1920, choisies par `?card=title|end|frame` et rendues en PNG par Chromium.
    - `title` : fond `#1f6f3f`, l'icône de l'app (`public/icon.svg`), puis les trois lignes de `TITLE_CARD`.
    - `end` : le même fond et les deux lignes de `END_CARD`.
    - `frame` : un fond `#14301f`, opaque partout sauf la fenêtre de l'écran, transparente, à coins arrondis de 36 px : x = 208, y = 210, 664 × 1437.
  - **`edit.mjs`** :
    1. rend les trois cartes dans `dist-tutorial/cards/` ;
    2. écrit `dist-tutorial/subtitles.ass` en 1080 × 1920, avec deux styles :
       - `Chapitre` : Inter Bold 54 px, blanc, en haut au centre, marge 70 ;
       - `Texte` : Inter 42 px, blanc, en bas au centre, marge 60, retour à la ligne automatique.

       Un titre de chapitre dure jusqu'au chapitre suivant ; un sous-titre, jusqu'au suivant ou jusqu'à la fin de son chapitre. Les heures sont décalées de `−start + 3 s` pour faire place à la carte de titre.
    3. compose avec ffmpeg :
       - carte de titre (3 s) ;
       - `app.webm` coupé de `start` à `end`, mis à 664 × 1437 sur fond `#14301f` en (208, 210), sous `frame.png` ;
       - carte de fin (6 s) ;
       - puis `ass=subtitles.ass` et `ENCODE_ARGS`.

       Sortie : `dist-tutorial/ScanDrinks-tuto.mp4`.
    4. appelle `encodeHls(mp4, 'public/tutoriel/video')`, puis `extractPoster(mp4, 1.5, 'public/tutoriel/video/poster.jpg')`.
  - **`check.mjs`, sans option** : les contrôles de la Tâche 1, avec une durée de 150 à 240 s. En plus, `dist-tutorial/ScanDrinks-tuto.mp4` :
    - existe et fait moins de 25 Mo ;
    - est en H.264, 1080 × 1920, 30 images/s ;
    - a la même durée que le HLS, à 0,5 s près.

- [ ] **Step 1: Compléter `check.mjs`** avec les contrôles ci-dessus.

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `node scripts/tutorial/check.mjs`
Expected: FAIL, car la durée est de 10 s (c'est encore l'essai) et le MP4 manque.

- [ ] **Step 3: Écrire `cards.html` et `edit.mjs`, puis monter**

Run: `node scripts/tutorial/edit.mjs && node scripts/tutorial/check.mjs`
Expected: « Vidéo OK : … s, … Mo », avec une durée de 150 à 240 s.

- [ ] **Step 4: Regarder, puis lancer les tests**

Extraire et regarder des images : à 1 s (carte de titre), 2 s après le début de chaque chapitre, et sur la carte de fin. On attend :
- les titres et les sous-titres lisibles, sans débordement ;
- l'écran de l'app entier dans sa fenêtre.

Run: `npm test && npm run build`
Expected: tout passe. `tutorial.test.ts` trouve une liste et des segments cohérents.

- [ ] **Step 5: Commit**

Message : `feat(tutoriel): montage de la vidéo (MP4 et HLS)`. Commande : `git add -A public/tutoriel/video scripts/tutorial`, pour que les segments de l'essai retirés le soient aussi dans Git.

---

### Task 7: Feuille A4 de la réserve

**Files:**
- Create: `scripts/sheet/sheet.html`, `scripts/sheet/print.mjs`, `scripts/sheet/check.mjs`, `docs/feuille-reserve.pdf`
- Modify: `package.json`, avec `"sheet": "node scripts/sheet/print.mjs && node scripts/sheet/check.mjs"`

**Interfaces:**
- Produces :
  - **`sheet.html`** :
    - mise en page : A4 portrait (`@page { size: A4; margin: 12mm }`), Inter puis police système, noir sur blanc ;
    - texte courant de 10,5 pt au moins, titres de 15 pt ;
    - un emplacement `<!--QR-->`, et le texte exact ci-dessous.
  - **`print.mjs`** :
    - écrit le QR code de `https://scandrinks.pages.dev/tutoriel/` : `writeBarcode(url, { format: 'QRCode', ecLevel: 'M', scale: 0 })`, avec `prepareZXingModule` et le `.wasm` local ;
    - le place en carré de 40 mm ;
    - imprime avec `page.pdf({ path: 'docs/feuille-reserve.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true })`.
  - **`check.mjs`** vérifie :
    - `pdfinfo` : `Pages: 1` et une page A4 (595 × 842 pts, à 1 pt près) ;
    - `pdftoppm -r 150` : un seul QR code, relu par `zxing-wasm/reader`, dont le texte est exactement `https://scandrinks.pages.dev/tutoriel/` ;
    - `pdftotext`, espaces ramenés à un seul : on y trouve « mémo de la réserve », « Entrée + », « Sortie − », « Inventaire = », « À racheter », « Historique », « Installer l'app sur un iPhone », « iOS 16.4 », « scandrinks.pages.dev » et « Un souci ? Préviens la personne qui gère ScanDrinks. ».

    Il affiche « Feuille OK ».

**Le texte de la feuille** (exact) :

- **Titre :** « ScanDrinks — mémo de la réserve ».
- **À côté du QR code :** « La vidéo tuto (3 minutes) : vise ce code avec l'appareil photo de l'iPhone. », et dessous, en petit, « scandrinks.pages.dev/tutoriel ».
- **« Chaque fois que… »**, en tableau :

  | Situation | Dans ScanDrinks |
  |---|---|
  | Une livraison Metro arrive | « Scanner » › « Entrée + », un scan par pack, puis « Valider ». |
  | Je sors un pack de la réserve | « Scanner » › « Sortie − », le scan, puis « Valider ». Éloigne ensuite le pack. |
  | L'app ne connaît pas le code | « Nouveau produit » : « Scanner une canette du pack » pour le nom, les unités du pack, puis « Créer le produit ». |
  | Je compte un produit | « Scanner » › « Inventaire = », le scan, les packs et les unités en plus, puis « Valider ». |
  | Un code est illisible | « Saisie manuelle », puis le produit dans la liste. |
  | Je pars chez Metro | Onglet « À racheter » : le nombre de packs à prendre. |
  | Je me suis trompé | Onglet « Historique » › « Annuler » sur la ligne, puis « OK ». |

- **« Installer l'app sur un iPhone »**, avec en sous-titre « iOS 16.4 ou plus : Réglages › Général › Informations » :
  1. Dans Safari, ouvre scandrinks.pages.dev.
  2. Touche Partager, puis « Sur l'écran d'accueil », puis « Ajouter ».
  3. Ouvre ScanDrinks depuis son icône, puis tape le mot de passe du tabac.
  4. Choisis ton prénom, puis autorise la caméra.
- **« Si l'app affiche… »**, en tableau :

  | Message | Que faire |
  |---|---|
  | « Pas de connexion… » | Réessaie quand le réseau revient. « Réessayer » ne compte jamais deux fois. |
  | « Ta session a expiré » | Retape le mot de passe du tabac. |
  | « Base injoignable » | Réessaie dans un instant. Si ça dure, préviens la personne qui gère ScanDrinks. |
  | « L'accès à la caméra a été refusé » | Réglages › Apps › Safari › Caméra › Autoriser (avant iOS 18 : Réglages › Safari › Caméra), puis ferme et rouvre l'app. |
  | « stock à vérifier » | Recompte le produit en « Inventaire = ». |
  | « L'app a rencontré un problème » | Touche « Recharger ». |

- **En bas :** « Un souci ? Préviens la personne qui gère ScanDrinks. »

- [ ] **Step 1: Écrire `check.mjs`**

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `node scripts/sheet/check.mjs`
Expected: FAIL, car `docs/feuille-reserve.pdf` n'existe pas.

- [ ] **Step 3: Écrire `sheet.html` et `print.mjs`**

- [ ] **Step 4: Imprimer, vérifier, regarder**

Run: `npm run sheet`
Expected: « Feuille OK ».

Puis rendre la page en image avec `pdftoppm -r 80 -png`, et la regarder :
- rien n'est coupé ;
- le texte est lisible en noir et blanc ;
- le QR code n'est pas collé au texte.

- [ ] **Step 5: Commit**

Message : `docs(feuille): feuille A4 de la réserve avec le QR code de la vidéo`.

---

### Task 8: Documentation du jalon 4

**Files:**
- Create: `docs/jalon-4-test.md`, `docs/jalon-4-jour-j.md`
- Modify: `README.md`, `docs/superpowers/specs/2026-10-19-scandrinks-design.md` (§11)

**Interfaces:**
- Produces :
  - **`docs/jalon-4-test.md`** : le test de la préversion, environ 15 minutes, dans Safari, sans installer.
    1. Réglages › « Tutoriel » : la vidéo démarre au toucher et se lit jusqu'au bout (on peut avancer). « Retour » ramène aux Réglages.
    2. La page https://jalon-4.scandrinks.pages.dev/tutoriel/ : même chose. Le QR code de la feuille mène à l'adresse définitive : on l'essaie après la fusion.
    3. Mode avion, puis « Tutoriel » et la lecture : « La vidéo ne se charge pas. Vérifie la connexion, puis réessaie. ».
    4. Fiche produit (s3) :
       - en mode avion, ouvrir un produit dans « Stock » : le message s'affiche avec « Réessayer » ;
       - « Modifier », puis « Annuler » : le message et « Réessayer » sont toujours là ;
       - sans mode avion, « Réessayer » : la fiche se charge.
    5. La feuille A4, imprimée : elle est lisible en noir et blanc.
    6. Facultatif : le mode Économie d'énergie pendant un scan. On note si l'écran reste allumé.

    Section « Après la fusion » : le QR code de la feuille imprimée ouvre la vidéo, et « Tutoriel » marche dans l'app installée.
  - **`docs/jalon-4-jour-j.md`** : le guide du porteur du projet, à cocher.
    - **La veille :**
      - la version d'iOS de chaque iPhone (16.4 ou plus) ;
      - la feuille imprimée et affichée ;
      - l'équipe prévenue ;
      - les zones de la réserve, une par personne ;
      - l'app ouverte une fois, pour vérifier que la base n'est pas en pause.
    - **Le matin, la remise à zéro**, pas à pas :
      1. tableau de bord Supabase › organisation « ScanDrinks » › projet « scandrinks », jamais « Webia » ;
      2. « SQL Editor » › nouvelle requête ;
      3. y coller le contenu de `supabase/remise-a-zero.sql`, copié depuis GitHub (bouton « Copy raw file ») ;
      4. « Run », puis confirmer l'avertissement d'opération destructive ;
      5. la ligne attendue est « Remise à zéro faite : … Compte du tabac gardé (1). ». Prévenir Claude, qui vérifie la base en lecture seule.
    - **L'installation**, comme la feuille. Le mot de passe se dit à voix haute, sans être écrit. On supprime les anciennes icônes des préversions.
    - **L'inventaire**, boutique fermée : les zones, et les deux règles du §9 de la spec.
    - **Les contrôles de la recette :**
      - l'écran allumé dans l'app installée, avec la version d'iOS ;
      - la marge du bas : « Stock » › « Nouveau produit » › le champ « Stock idéal (unités) » reste visible au-dessus des onglets, puis « Annuler » ;
      - le mode avion pendant un recomptage à l'identique : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ». Sans mode avion, « Réessayer » : une seule ligne dans l'Historique, avec un écart de 0.
    - **Après l'inventaire :** les seuils (fiche › « Modifier »), puis « À racheter ».
    - **La semaine d'essai :**
      - chaque jour, chaque livraison et chaque pack sorti sont scannés ;
      - avant Metro, comparer « À racheter » avec la réserve ;
      - un carnet de bord : date, iPhone, ce qui s'est passé, une capture si possible ;
      - en fin de semaine, recompter 5 produits et noter les écarts ;
      - puis le bilan avec Claude.
    - **Si la base est en pause :** tableau de bord › projet « scandrinks » › « Restore project ». Les données sont gardées.
    - **En cas de souci :** le tableau des messages de la feuille.
  - **README :**
    - une section « Jalon 4 — la mise en service » ;
    - les commandes `npm run tutorial:trial`, `npm run tutorial:record`, `npm run tutorial` et `npm run sheet`, avec leurs outils (ffmpeg avec libx264 et libass, poppler-utils, police Inter) ;
    - les fichiers `public/tutoriel/`, `scripts/tutorial/`, `scripts/sheet/` et `supabase/remise-a-zero.sql` ;
    - `run-local.sh`, qui lance aussi le test de la remise à zéro.
  - **Spec §11 :** les décisions de la section « Décisions prises dans ce plan », datées du jour.

- [ ] **Step 1: Écrire les documents**

- [ ] **Step 2: Lancer tous les tests**

Run: `npm test && npm run e2e && npm run build && npm run sheet`
Expected: tout passe.

- [ ] **Step 3: Commit**

Message : `docs(jalon-4): protocole de test, guide du jour J, README et décisions`.

---

### Task 9: Mise en service

Après la relecture finale de toute la branche et ses corrections.

**Files:**
- Modify: `README.md` (état : « jalons 1 à 4 en service »), ce plan (« Bilan »)

- [ ] **Step 1: Envoi et contrôles de la préversion**

Run: `git push origin jalon-4`. Puis, sur `https://jalon-4.scandrinks.pages.dev` :
- HTTP 200, avec le même paquet que le build local ;
- `/tutoriel/` et les fichiers de `/tutoriel/video/` en 200, avec les types de la Tâche 4 ;
- la liste de la préversion est identique à `public/tutoriel/video/tutoriel.m3u8`.

- [ ] **Step 2: Test du porteur du projet sur iPhone**, d'après `docs/jalon-4-test.md`

Les défauts trouvés sont corrigés en TDD sur `jalon-4`.

- [ ] **Step 3: Fusion dans `main`**, avec l'accord du porteur du projet

Run: `git fetch origin main && git checkout main && git merge --ff-only jalon-4 && git push origin main`
Expected: `scandrinks.pages.dev` sert le même paquet que la préversion, et `/tutoriel/video/tutoriel.m3u8` répond 200.

- [ ] **Step 4: Remise des supports**

Envoyer au porteur du projet `dist-tutorial/ScanDrinks-tuto.mp4` et `docs/feuille-reserve.pdf`. Lui rappeler les contrôles « Après la fusion » : le QR code de la feuille imprimée, et le Tutoriel dans l'app installée.

- [ ] **Step 5: Jour J**, à la date choisie par le porteur du projet, d'après `docs/jalon-4-jour-j.md`

Après la remise à zéro, lancée par le porteur du projet, Claude vérifie par `execute_sql`, en lecture seule :
`select (select count(*) from public.products) as produits, (select count(*) from public.barcodes) as codes, (select count(*) from public.movements) as mouvements, (select count(*) from public.allowed_users) as comptes;`
Expected: 0, 0, 0, 1.

Après l'inventaire, la même lecture donne un nombre de produits égal au nombre de références comptées.

- [ ] **Step 6: Semaine d'essai, puis bilan**

À partir du carnet de bord et du recomptage de 5 produits :
- le jalon est validé, ou non, selon les critères du §9 ;
- « ## Bilan » est ajouté à ce plan ;
- l'état du README est mis à jour ;
- les points restés ouverts sont listés.

---

## Décisions prises dans ce plan (la spec ne les fixe pas)

- **QR code :** écrit par `zxing-wasm/writer` et relu par `zxing-wasm/reader`, déjà installés. Aucune nouvelle dépendance.
- **Format de la vidéo :**
  - HLS en segments fMP4 de 6 s ;
  - H.264 High, 1080 × 1920, 30 images/s, CRF 22, une image clé toutes les 2 s, sans piste son ;
  - fichiers `tutoriel.m3u8`, `init.mp4`, `seg-NNN.m4s` et `poster.jpg`, dans `/tutoriel/video/`.
- **Écran « Tutoriel » :**
  - premier bouton des Réglages ;
  - « Retour » ramène aux Réglages ;
  - un message si la vidéo ne se charge pas ;
  - aucun lien de l'app vers la page `/tutoriel/`.
- **Le MP4 n'est pas versionné.** Il est remis au porteur du projet.
- **Le tournage :**
  - catalogue `'tutoriel'` de la base simulée ;
  - horloge fixée au lundi 26/10/2026 à 09:30, heure de Paris ;
  - prénoms Sam (le téléphone filmé) et Léa ;
  - l'erreur annulée au chapitre 8 est une ligne de Léa déjà présente, et non une erreur jouée pendant le film.
- **Les trucages du tournage seulement :**
  - la fausse caméra (un canvas à la place de `getUserMedia`) ;
  - le rond des touchers ;
  - l'alerte de confirmation dessinée dans la page.

  L'app n'en contient aucun.
- **Filet de sécurité :** le texte du §7, et « Recharger » relance la page.
- **Écran allumé (s7) :** une seule nouvelle demande automatique par activation, ou par retour au premier plan.
- **« Base injoignable » :** le message de l'app ne change pas. La feuille et le guide du jour J disent quoi faire, ce qui réalise le « renvoi vers la procédure du guide » du §7.
- **Remise à zéro :**
  - deux gardes : les tables et les trois fonctions de ScanDrinks, et au moins un compte autorisé ;
  - une seule transaction, et une ligne de résultat ;
  - le porteur du projet copie le script depuis GitHub.
