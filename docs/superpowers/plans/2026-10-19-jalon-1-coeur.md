# ScanDrinks — Jalon 1 (le cœur de l'app) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la première version utilisable de ScanDrinks. Elle comprend :
- une base partagée et sécurisée ;
- la connexion avec le compte du tabac et le prénom ;
- le scan en Entrée et en Sortie, avec la quantité et l'annulation immédiate ;
- la création d'une fiche au premier scan d'un pack ;
- l'ajout d'un code à un produit existant, et la saisie manuelle.

Le porteur du projet doit pouvoir valider l'ensemble sur iPhone.

**Architecture :**
- L'app web React du jalon 0 garde son module `src/scan/`, corrigé et réutilisé. La page de test est supprimée.
- Les données vivent dans un projet Supabase (PostgreSQL, Paris). Toutes les écritures passent par des fonctions SQL idempotentes, protégées par Row Level Security.
- La logique est en fonctions pures testées : normalisation des codes, règles de gestion, automate de l'écran Scanner. L'interface n'en est qu'une enveloppe, vérifiée par un test de bout en bout avec un backend simulé.

**Tech Stack:** celle du jalon 0 (Vite 8.3.2, React 19.3.0, TypeScript 7.0.2, Vitest 5.0.3, barcode-detector 3.2.2 avec zxing-wasm 3.1.3, Playwright 1.56.1), plus @supabase/supabase-js 2.117.2, Supabase (projet `scandrinks`, eu-west-3) et Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, sections :
- §4.1 ;
- §4.2, sans le mode Inventaire ni les produits archivés ;
- §4.6, sans le changement de mot de passe ;
- §5 : RG-1 à RG-3, RG-7 à RG-10, RG-12 et RG-13 ;
- §6.2 à §6.4, §7, §8 ;
- §9, pour le jalon 1.

Les points reportés par la relecture finale du jalon 0 sont listés à la fin de `docs/superpowers/plans/2026-10-19-jalon-0-test-scan.md`.

**Périmètre :**
- **Hors jalon 1, pour le jalon 2 :** l'inventaire, la liste du stock, la fiche produit modifiable, l'archivage (RG-11), la liste À racheter (RG-5 et RG-6) et la barre d'onglets. Au jalon 1, l'écran Scanner est seul, avec le bouton Réglages en haut.
- **Hors jalon 1, pour le jalon 3 :** l'historique, le changement de mot de passe, les icônes et le service worker.
- **Avancé depuis le jalon 3 :** l'annulation immédiate (le bouton « Annuler » pendant 5 s, §4.2), parce qu'elle fait partie de l'écran Scanner.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Les textes de l'interface utilisent l'apostrophe droite `'`.
  - Dans les nombres, le séparateur de milliers est une espace insécable : `9 999`.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit la version de production.
- **Navigation.** Une seule page, sans changement d'URL : ni routeur, ni `#hash`, ni `history.pushState` (spec §6.2).
- **iPhone.**
  - iOS 16 au minimum, la cible par défaut de Vite 8.
  - Les champs de saisie sont en 16 px au moins, sinon iOS zoome sur le champ.
  - Les champs numériques ont `inputMode="numeric"`. Leur contenu est sélectionné au toucher, pour être remplacé d'un coup.
- **Versions.** Toutes exactes : celles du jalon 0, plus `@supabase/supabase-js@2.117.2`, publiée le 25/09/2026. `.npmrc` contient `legacy-peer-deps=true` et `.node-version` contient `22`.
- **Supabase.**
  - Projet `scandrinks`, organisation `gcyzekmpjvhvascsudie` (« Webia », offre gratuite), région `eu-west-3`. Sa création demande l'accord du porteur du projet.
  - Row Level Security active sur toutes les tables. Seuls les comptes listés dans `allowed_users` lisent et écrivent, et le rôle `anon` n'a aucun droit.
  - Inscriptions désactivées.
  - Les fonctions de l'app sont en `security invoker`, avec `set search_path = ''`. `execute` est retiré à `public` et `anon`, et accordé à `authenticated`.
  - La seule fonction `security definer`, `private.is_allowed()`, vit dans un schéma que l'API n'expose pas.
  - La vue `product_stock` est créée `with (security_invoker = true)`.
- **Secrets.** Aucun secret dans le dépôt. Seuls l'URL du projet, la clé publique (`sb_publishable_…`) et l'adresse du compte du tabac (une Gmail dédiée, publique) vont dans `.env.production`.
- **Règles de gestion (spec §5).**
  - Le stock est en unités. C'est la somme des `delta` des mouvements non annulés.
  - Valeurs autorisées : quantité de 1 à 99, unités d'un code de 1 à 999, pack Metro de 1 à 999, seuil de 0 à 9 999, stock idéal strictement supérieur au seuil, nom de 1 à 80 caractères, prénom de 1 à 30 caractères.
  - À la création d'une fiche, le seuil vaut 1 pack Metro et le stock idéal 2 packs Metro.
- **Idempotence.** Chaque mouvement porte un `uuid` généré par le téléphone. Un second envoi avec le même identifiant ne crée pas de doublon (spec §7).
- **Lecture.**
  - Un code n'est pas relu tant qu'une fiche est affichée, ni pendant 2 s après la validation (spec §7).
  - Chaque code lu passe par `normalizeScannedCode` (RG-13).
- **Open Food Facts.** Le client existant `lookupProduct` est interrogé avec le code normalisé. Son délai est de 3 s et il ne bloque jamais l'app.
- **Git.**
  - Le travail se fait sur la branche `jalon-1`. La fusion dans `main` demande l'accord du porteur du projet.
  - Chaque commit se termine par les lignes d'attribution de la session.
  - Avant toute attente d'une action du porteur du projet, la branche est envoyée sur GitHub, car le conteneur de travail peut être recyclé pendant l'attente.

## Review Focus

1. **Canette scannée puis créée comme un produit à part**, au lieu d'être ajoutée au produit du pack. Cela crée des fiches « Coca » en double.
   - Comportement attendu :
     - la carte « Code inconnu » montre le nom donné par Open Food Facts, et « Ajouter à un produit existant » ouvre la liste filtrée sur le premier mot de ce nom ;
     - dans « Nouveau produit », une canette déjà connue propose « Ajouter ce pack à « {nom} » », au lieu de créer une seconde fiche.
   - Tests : `suggestSearchTerm` et `filterProducts` (Tâche 8), `choose_attach` depuis `new_product` (Tâche 7), scénario e2e E (Tâche 9).
2. **Mauvais mode** (Sortie au lieu d'Entrée).
   - Comportement attendu : la fiche montre le signe et la couleur du mode. Elle suit un changement de mode fait pendant qu'elle est affichée.
   - Test : scénario e2e A (Tâche 9).
3. **Session expirée pendant le scan.**
   - Comportement attendu : retour à l'écran de connexion, avec « Ta session a expiré : reconnecte-toi. ».
   - Tests : `classifyApiError` donne `session` (Tâche 5) ; scénario e2e C (Tâche 9).
4. **Double appui sur « Valider » ou réseau instable.**
   - Comportement attendu : un seul mouvement est enregistré, avec la quantité affichée.
   - Tests :
     - l'automate ignore « Valider » pendant l'enregistrement, garde le même identifiant pour « Réessayer » et verrouille la quantité après un échec (Tâche 7) ;
     - le test SQL d'idempotence (Tâche 4) ;
     - le scénario e2e B (Tâche 9).
5. **Navigation privée ou stockage local bloqué.**
   - Comportement attendu : l'app fonctionne, mais redemande le prénom et oublie le mode.
   - Tests : `loadEmployeeName` et `loadMode` avec un stockage qui lève une exception (Tâches 6 et 7).

---

## Structure des fichiers

```
supabase/migrations/20261019130000_initial_schema.sql  schéma privé, tables, vue, droits, RLS, fonctions
supabase/tests/database.test.sql          tests SQL (transaction annulée)
.env.production                           URL, clé publique, adresse du compte (Tâche 10)
.env.e2e                                  valeurs factices du test de bout en bout
src/vite-env.d.ts                         types des variables VITE_*
src/scan/…                                corrigé (Tâche 1)
src/codes/normalize.ts                    RG-13
src/domain/stock.ts                       RG-1, RG-3 : affichage du stock, variations
src/domain/productDraft.ts                RG-7 : brouillon de fiche, valeurs par défaut, validation
src/data/api.ts                           appels typés vers la base (createApi, sans accès réseau direct)
src/data/apiErrors.ts                     classement des erreurs et messages
src/data/supabaseClient.ts                client Supabase et instance `api` de l'app
src/auth/employee.ts                      prénom (validation, stockage local)
src/auth/loginError.ts                    messages d'échec de connexion
src/auth/LoginScreen.tsx, NameScreen.tsx  connexion, choix du prénom
src/settings/SettingsScreen.tsx           réglages (prénom, déconnexion)
src/app/AppShell.tsx, AppShell.css        enchaînement connexion → prénom → app
src/scanner/scanFlow.ts                   automate de l'écran Scanner (pur)
src/scanner/mode.ts                       mode Entrée/Sortie mémorisé
src/scanner/ScannerScreen.tsx, ConfirmCard.tsx, Notice.tsx, Scanner.css
src/products/search.ts                    filtrage et suggestion de recherche
src/products/ProductPicker.tsx, NewProductForm.tsx, AttachForm.tsx, ManualEntry.tsx, Products.css
src/App.tsx                               rend AppShell
e2e/fakeSupabase.mjs                      backend simulé (Playwright)
e2e/app-smoke.mjs                         test de bout en bout de l'app
docs/jalon-1-test.md                      protocole de test en boutique
```

Supprimés : `src/scanTest/` et `e2e/scan-smoke.mjs`. Les vérifications de lecture de ce dernier passent dans `e2e/app-smoke.mjs`.

---

### Task 1: Corrections du module de scan (relecture du jalon 0)

**Files:**
- Modify: `src/scan/camera.ts`, `src/scan/scannerController.ts`, `src/scan/detector.ts`
- Test: `src/scan/camera.test.ts`, `src/scan/scannerController.test.ts`, `src/scan/detector.test.ts`

**Interfaces:**
- Produces :
  - `openCamera(): Promise<MediaStream>`. Elle garde le contrôle https et les contraintes `CAMERA_CONSTRAINTS` de `startCamera`. Elle rejette avec `name === 'InsecureContextError'` hors https, ou sans `navigator.mediaDevices`.
  - `attachCamera(video: HTMLVideoElement, stream: MediaStream): Promise<{ width: number; height: number }>`. Elle branche le flux et lance la lecture. Si `play()` échoue, elle arrête le flux, vide `srcObject`, puis relance l'erreur.
  - `detachVideo(video: HTMLVideoElement): void`, qui vide `srcObject`.
  - `stopCamera(stream)` est inchangée.
  - `startCamera` est supprimée.
  - `ScannerDeps` remplace `startCamera` par `openCamera` et `attachCamera`. `createScannerController` ne change pas d'interface.

- [ ] **Step 1: Écrire les tests qui échouent**

D'abord, adapter les tests existants :
- passer de `startCamera` à `openCamera` et `attachCamera` ;
- le `setup` du contrôleur accepte `openCamera`, `attachCamera` et `onDetect` ;
- sa fausse vidéo porte `srcObject`, et la fausse `attachCamera` par défaut fait `video.srcObject = stream`.

Ensuite, ajouter les cas suivants.

`camera.test.ts` :

```ts
test("attachCamera : si play() échoue, le flux est arrêté, la vidéo détachée et l'erreur relancée", async () => {
  const track = new FakeTrack({})
  const video = fakeVideo()
  video.play = async () => { throw Object.assign(new Error('refus'), { name: 'NotAllowedError' }) }
  await expect(attachCamera(asVideo(video), fakeStream([track]))).rejects.toMatchObject({ name: 'NotAllowedError' })
  expect(track.stopped).toBe(true)
  expect(video.srcObject).toBeNull()
})
```

`scannerController.test.ts` :

```ts
const streamOf = (track: FakeTrack) => ({ getTracks: () => [track], getVideoTracks: () => [track] }) as unknown as MediaStream

test('un démarrage périmé ne branche jamais son flux sur la vidéo', async () => {
  const [late, fresh] = [streamOf(new FakeTrack()), streamOf(new FakeTrack())]
  let openLate: (stream: MediaStream) => void = () => {}
  let calls = 0
  const s = setup({ openCamera: () => (calls++ === 0 ? new Promise<MediaStream>((resolve) => { openLate = resolve }) : Promise.resolve(fresh)) })
  const first = s.controller.start()
  await vi.advanceTimersByTimeAsync(0)
  s.controller.stop()
  await s.controller.start()
  openLate(late)
  await first
  expect(s.deps.attachCamera).toHaveBeenCalledTimes(1)
  expect(s.deps.attachCamera).toHaveBeenCalledWith(s.video, fresh)
  expect(s.deps.stopCamera).toHaveBeenCalledWith(late)
})
test('arrêt pendant le branchement de la vidéo : le flux est refermé et la vidéo détachée', async () => {
  let finishAttach: () => void = () => {}
  const s = setup({ attachCamera: (video, stream) => new Promise((resolve) => {
    video.srcObject = stream
    finishAttach = () => resolve({ width: 1280, height: 720 })
  }) })
  const pending = s.controller.start()
  await vi.advanceTimersByTimeAsync(0)
  s.controller.stop()
  finishAttach()
  await pending
  expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream)
  expect(s.video.srcObject).toBeNull()
})
test("à l'arrêt, la vidéo est détachée", async () => {
  const s = setup()
  await s.controller.start()
  s.controller.stop()
  expect(s.video.srcObject).toBeNull()
})
test("une erreur dans onDetect n'arrête pas la lecture", async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let n = 0
  const s = setup({ detect: async () => [{ rawValue: `CODE-${n++}`, format: 'ean_13' }], onDetect: () => { throw new Error('boom') } })
  await s.controller.start()
  await vi.advanceTimersByTimeAsync(1500)
  expect(s.detect.mock.calls.length).toBeGreaterThan(5)
  expect(s.last().status).toBe('running')
})
```

`detector.test.ts`. Ajouter `vi.doUnmock('barcode-detector/ponyfill')` dans `afterEach`, puis le cas suivant :

```ts
test('après un échec de ZXing, le module est purgé, et le nouvel essai le recharge', async () => {
  const purge = vi.fn()
  let attempt = 0
  vi.doMock('barcode-detector/ponyfill', () => ({
    BarcodeDetector: class { async detect() { return [] } },
    prepareZXingModule: async () => { if (attempt++ === 0) throw new Error('wasm') },
    purgeZXingModule: purge,
  }))
  const { createBarcodeDetector } = await import('./detector')
  await expect(createBarcodeDetector()).rejects.toMatchObject({ name: 'ScannerEngineError' })
  expect(purge).toHaveBeenCalledTimes(1)
  await expect(createBarcodeDetector()).resolves.toMatchObject({ engine: 'zxing' })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/scan`
Expected: FAIL, avec `openCamera` et `attachCamera` introuvables et les nouveaux cas en échec.

- [ ] **Step 3: Implémenter**

- `camera.ts` : `openCamera`, `attachCamera` (avec un `try/catch` autour du branchement et de `play()`), `detachVideo` et `stopCamera`.
- `scannerController.ts` :
  - le flux renvoyé par `openCamera` est retenu tout de suite si la session est encore valable, pour qu'un arrêt pendant `attachCamera` le referme aussitôt ;
  - si la session est périmée à ce moment-là, appeler `stopCamera` et sortir, sans jamais appeler `attachCamera` ;
  - après `attachCamera`, une session périmée referme le flux et détache la vidéo ;
  - `release()` appelle `detachVideo(video)` ;
  - l'appel à `onDetect` est entouré d'un `try/catch` (`console.error`), et le passage suivant est toujours planifié.
- `detector.ts` : dans le `catch`, appeler `purgeZXingModule()` (exporté par `barcode-detector/ponyfill`) avant de lever `ScannerEngineError`.

- [ ] **Step 4: Vérifier**

Run: `npm test && npm run typecheck`
Expected : tout passe, sans erreur TypeScript.

- [ ] **Step 5: Commit**

Message : `fix(scan): caméra jamais laissée allumée, vidéo détachée, lecture protégée, nouvel essai ZXing fiable`.

---

### Task 2: Normalisation des codes lus (RG-13)

**Files:**
- Create: `src/codes/normalize.ts`
- Test: `src/codes/normalize.test.ts`

**Interfaces:**
- Produces :
  - `type NormalizedCode = { kind: 'product'; code: string } | { kind: 'ignored'; reason: 'not_a_product' | 'invalid_check_digit' }` ;
  - `normalizeScannedCode(rawValue: string, format: string): NormalizedCode` ;
  - `isValidGtin(digits: string): boolean`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
import { describe, expect, test } from 'vitest'
import { isValidGtin, normalizeScannedCode } from './normalize'

const product = (code: string) => ({ kind: 'product', code })
const ignored = (reason: string) => ({ kind: 'ignored', reason })

describe('normalizeScannedCode', () => {
  test.each([
    ['ean_13', '3502110123091', product('3502110123091')],                       // pack Lipton (code court)
    ['ean_13', '9002490274658', product('9002490274658')],                       // pack Red Bull
    ['upc_a', '049000028911', product('0049000028911')],                         // UPC-A → EAN-13
    ['ean_8', '96385074', product('96385074')],
    ['upc_e', '01234565', product('01234565')],
    ['code_128', '0103502110123091152706202000100000208663', product('3502110123091')], // code long Lipton, tel que l'app le lit
    ['code_128', '(01)03502110123091(15)270620(20)00(10)0000208663', product('3502110123091')],
    ['code_128', ']C10103502110123091', product('3502110123091')],
    ['code_128', '\u001d0103502110123091\u001d10ABC', product('3502110123091')],
    ['code_128', '902602365', ignored('not_a_product')],                         // lot Red Bull « (90)2602365 »
    ['code_128', 'ABC-123', ignored('not_a_product')],
    ['code_128', '0103502110123092', ignored('invalid_check_digit')],
    ['itf', '05449000000996', product('5449000000996')],                         // GTIN-14 commençant par 0 → 13 chiffres
    ['itf', '15449000000993', product('15449000000993')],                        // carton : GTIN-14 gardé
    ['itf', '15449000000994', ignored('invalid_check_digit')],
    ['itf', '1234567890', ignored('not_a_product')],
    ['ean_13', '3502110123092', ignored('invalid_check_digit')],
    ['qr_code', 'https://example.org', ignored('not_a_product')],
  ])('%s %s', (format, raw, expected) => {
    expect(normalizeScannedCode(raw, format)).toEqual(expected)
  })
})

test.each([['3502110123091', true], ['3502110123092', false], ['96385074', true], ['03502110123091', true], ['12a4', false]])(
  'isValidGtin(%s) = %s', (digits, valid) => { expect(isValidGtin(digits)).toBe(valid) })
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/codes`
Expected: FAIL, import `./normalize` introuvable.

- [ ] **Step 3: Implémenter `src/codes/normalize.ts`**

- `isValidGtin` accepte 8, 12, 13 ou 14 chiffres. On pondère les chiffres par 3 puis 1, en partant du chiffre le plus à droite avant la clé. La clé vaut `(10 − somme mod 10) mod 10`.
- Nettoyage commun, avant tout traitement : `trim`, puis retrait d'un préfixe d'identifiant de symbologie (`/^\][A-Za-z]\d/`), puis retrait des caractères GS (`\u001d`) en tête et en fin.
- Traitement par format :
  - `ean_13` et `ean_8` : contrôler la clé, puis garder le code tel quel ;
  - `upc_a` : contrôler la clé, puis renvoyer `'0' + code` ;
  - `upc_e` : garder les 8 chiffres tels quels, car ZXing contrôle déjà la clé ;
  - `itf` : accepter seulement 14 chiffres avec une clé valide, et retirer le `0` de tête s'il y en a un ;
  - `code_128` : chercher en tête l'identifiant 01, sous la forme `(01)` ou `01`, suivi de 14 chiffres. Clé fausse : `invalid_check_digit`. Identifiant 01 absent : `not_a_product`. Sinon, retirer le `0` de tête s'il y en a un ;
  - tout autre format : `not_a_product`.

- [ ] **Step 4: Vérifier**

Run: `npm test`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(codes): normalisation des codes lus (RG-13)`.

---

### Task 3: Règles de gestion pures (RG-1, RG-3, RG-7)

**Files:**
- Create: `src/domain/stock.ts`, `src/domain/productDraft.ts`
- Test: `src/domain/stock.test.ts`, `src/domain/productDraft.test.ts`

**Interfaces:**
- Produces, dans `stock.ts` :
  - `type ScanMode = 'in' | 'out'` ;
  - `QUANTITY_MIN = 1`, `QUANTITY_MAX = 99` ;
  - `clampQuantity(q: number): number` ;
  - `movementDelta(mode: ScanMode, units: number, quantity: number): number` ;
  - `formatStock(stock: number, packSize: number): string` ;
  - `formatDelta(delta: number): string`, qui donne `+24` ou `−24`, avec le signe moins U+2212 ;
  - `describeConfirm(units: number, quantity: number, mode: ScanMode): string`.
- Produces, dans `productDraft.ts` :
  - `parseIntInRange(raw: string, min: number, max: number): number | null` ;
  - `type DraftField = 'name' | 'codeUnits' | 'packSize' | 'alertThreshold' | 'targetStock'` ;
  - `interface ProductDraft { name: string; codeUnits: string; packSize: string; alertThreshold: string; targetStock: string; packSizeEdited: boolean; thresholdsEdited: boolean }` ;
  - `newDraft(name: string): ProductDraft` ;
  - `updateDraft(draft: ProductDraft, field: DraftField, value: string): ProductDraft` ;
  - `interface NewProductInput { name: string; packSize: number; alertThreshold: number; targetStock: number; barcodes: Array<{ code: string; units: number }> }` ;
  - `validateDraft(draft: ProductDraft): { ok: true; codeUnits: number; product: Omit<NewProductInput, 'barcodes'> } | { ok: false; errors: Partial<Record<DraftField, string>> }`.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// stock.test.ts (signe moins U+2212)
test.each([
  [53, 24, '53 (2 packs + 5)'], [48, 24, '48 (2 packs)'], [24, 24, '24 (1 pack)'], [30, 24, '30 (1 pack + 6)'],
  [5, 24, '5'], [0, 24, '0'], [-6, 24, '−6'], [53, 1, '53'],
])('formatStock(%i, %i) = %s', (stock, pack, text) => { expect(formatStock(stock, pack)).toBe(text) })
test('movementDelta', () => {
  expect(movementDelta('in', 24, 3)).toBe(72)
  expect(movementDelta('out', 1, 6)).toBe(-6)
})
test('clampQuantity borne entre 1 et 99, et tronque', () => {
  expect([clampQuantity(0), clampQuantity(5), clampQuantity(150), clampQuantity(Number.NaN), clampQuantity(2.7)]).toEqual([1, 5, 99, 1, 2])
})
test.each([
  [24, 1, 'in', 'Pack de 24 → +24'], [24, 3, 'in', 'Pack de 24 × 3 → +72'], [1, 1, 'out', "À l'unité → −1"], [1, 6, 'out', "À l'unité × 6 → −6"],
])('describeConfirm(%i, %i, %s)', (units, q, mode, text) => { expect(describeConfirm(units, q, mode as ScanMode)).toBe(text) })

// productDraft.test.ts
test.each([[' 24 ', 1, 999, 24], ['0', 1, 999, null], ['1000', 1, 999, null], ['12.5', 1, 999, null], ['', 0, 9999, null], ['abc', 1, 999, null]])(
  'parseIntInRange(%j, %i, %i) = %j', (raw, min, max, expected) => { expect(parseIntInRange(raw, min, max)).toBe(expected) })
test('un code de 24 unités pré-remplit pack Metro 24, seuil 24 et stock idéal 48', () => {
  const d = updateDraft(newDraft('Lipton Pêche 50 cl'), 'codeUnits', '24')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['24', '24', '48'])
})
test("un code d'une unité laisse le pack Metro à saisir", () => {
  const d = updateDraft(newDraft('Coca-Cola 33 cl'), 'codeUnits', '1')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['', '', ''])
  const d2 = updateDraft(d, 'packSize', '12')
  expect([d2.alertThreshold, d2.targetStock]).toEqual(['12', '24'])
})
test('unités corrigées de 24 à 1 : le pack Metro pré-rempli se vide', () => {
  const d = updateDraft(updateDraft(newDraft('X'), 'codeUnits', '24'), 'codeUnits', '1')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['', '', ''])
})
test('seuil modifié à la main : il ne suit plus le pack Metro', () => {
  let d = updateDraft(newDraft('X'), 'codeUnits', '24')
  d = updateDraft(d, 'alertThreshold', '10')
  d = updateDraft(d, 'packSize', '12')
  expect([d.alertThreshold, d.targetStock]).toEqual(['10', '48'])
})
test('pack Metro modifié à la main : il ne suit plus les unités du code', () => {
  let d = updateDraft(newDraft('X'), 'packSize', '6')
  d = updateDraft(d, 'codeUnits', '24')
  expect(d.packSize).toBe('6')
})
test('validation : fiche correcte', () => {
  const d = updateDraft(newDraft('  Lipton Pêche 50 cl  '), 'codeUnits', '12')
  expect(validateDraft(d)).toEqual({ ok: true, codeUnits: 12, product: { name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24 } })
})
test.each([
  ['name', '', 'Le nom est obligatoire (80 caractères au plus).'],
  ['name', 'x'.repeat(81), 'Le nom est obligatoire (80 caractères au plus).'],
  ['codeUnits', '0', 'Entre 1 et 999.'],
  ['packSize', '1000', 'Entre 1 et 999.'],
  ['alertThreshold', '10000', 'Entre 0 et 9 999.'],
  ['targetStock', '100000', 'Entre 1 et 99 999.'],
  ['targetStock', '24', 'Le stock idéal doit être supérieur au seuil.'],
])('validation : %s = %s refusé', (field, value, message) => {
  const base = updateDraft(newDraft('Coca-Cola 33 cl'), 'codeUnits', '24')
  const result = validateDraft(updateDraft(base, field as DraftField, value))
  expect(result).toMatchObject({ ok: false, errors: { [field]: message } })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Implémenter `stock.ts` et `productDraft.ts`**

- `parseIntInRange` n'accepte que des chiffres, après `trim` (`^\d+$`), et dans les bornes. Sinon, elle renvoie `null`.
- Les champs du brouillon restent des chaînes, puisque ce sont des champs de formulaire.
- `updateDraft` :
  - tant que `packSizeEdited` est faux, `packSize` suit `codeUnits` quand celui-ci vaut plus de 1, et se vide sinon ;
  - tant que `thresholdsEdited` est faux, le seuil et le stock idéal valent 1 et 2 fois `packSize`, ou restent vides ;
  - saisir `packSize` met `packSizeEdited` à vrai ; saisir le seuil ou le stock idéal met `thresholdsEdited` à vrai.
- `validateDraft` :
  - le nom est nettoyé (`trim`) ;
  - bornes : `codeUnits` et `packSize` de 1 à 999, `alertThreshold` de 0 à 9 999, `targetStock` de 1 à 99 999 et strictement supérieur au seuil.

- [ ] **Step 4: Vérifier**

Run: `npm test`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(domain): affichage du stock, variations, brouillon de fiche et validation (RG-1, RG-3, RG-7)`.

---

### Task 4: Base de données Supabase (projet, schéma, sécurité, fonctions, tests SQL)

**Files:**
- Create: `supabase/migrations/20261019130000_initial_schema.sql`, `supabase/tests/database.test.sql`

**Interfaces:**
- Produces, consommé par la Tâche 5 via PostgREST :
  - **Schéma `private`**, non exposé par l'API. Il contient `private.is_allowed() returns boolean`, en `language sql stable security definer set search_path = ''`. La fonction est vraie si `(select auth.uid())` figure dans `public.allowed_users`. Seul `authenticated` reçoit `usage` sur le schéma et `execute` sur la fonction.
  - **Tables :**
    - `allowed_users(user_id uuid primary key references auth.users on delete cascade, created_at timestamptz not null default now())`.
    - `products(id uuid pk default gen_random_uuid(), name text not null check (char_length(name) between 1 and 80), pack_size int not null check (pack_size between 1 and 999), alert_threshold int not null check (alert_threshold between 0 and 9999), target_stock int not null check (target_stock between 1 and 99999 and target_stock > alert_threshold), archived boolean not null default false, created_at, updated_at timestamptz not null default now())`.
    - `barcodes(code text pk check (code ~ '^[0-9]{8,14}$'), product_id uuid not null references products, units int not null check (units between 1 and 999), created_at timestamptz not null default now())`, avec un index sur `product_id`.
    - `movements(id uuid pk, product_id uuid not null references products, kind text not null check (kind in ('in','out','inventory')), delta int not null, barcode text, counted int check (counted between 0 and 9999), employee text not null check (char_length(employee) between 1 and 30), created_at timestamptz not null default now(), cancelled_at timestamptz, cancelled_by text)`, avec des index sur `product_id` et sur `created_at desc`.
  - **Vue :** `product_stock`, en `security_invoker`. Elle contient toutes les colonnes de `products`, plus `stock int`, qui vaut la somme des `delta` des mouvements non annulés, ou 0.
  - **Droits :**
    - `revoke all` sur les quatre tables et sur la vue, pour `anon` et `public` ;
    - `grant select, insert, update` sur `products`, `barcodes` et `movements` pour `authenticated`, et `grant select` sur `product_stock` ;
    - aucun droit sur `allowed_users` : RLS active et aucune politique.
  - **Politiques :** sur `products`, `barcodes` et `movements`, des politiques `select`, `insert` et `update` pour `authenticated`, avec `using ((select private.is_allowed())) with check ((select private.is_allowed()))`. Aucune politique `delete`.
  - **Fonctions de l'app.** Elles sont en `security invoker` et renvoient toutes du `jsonb`. Chacune valide ses paramètres avant toute écriture. Une valeur refusée lève `invalid_input:<champ>`, avec le code `P0001`. Les contraintes des tables restent un filet de sécurité.
    - `lookup_barcode(p_code text)` → `null`, ou `{"code","units","product":{…colonnes de product_stock…}}`. Les produits archivés sont renvoyés eux aussi, pour la réactivation du jalon 2.
    - `create_product(p_name text, p_pack_size int, p_alert_threshold int, p_target_stock int, p_barcodes jsonb)` :
      - `p_barcodes` est un tableau non vide de `{"code","units"}`, sans doublon ;
      - `p_name` est nettoyé (`btrim`) ;
      - la fonction renvoie le produit au format de `product_stock` ;
      - si l'un des codes existe déjà, elle lève l'exception `barcode_taken:<code>`.
    - `attach_barcode(p_code text, p_product_id uuid, p_units int, p_move boolean)` renvoie :
      - `{"status":"attached"}` si le code est nouveau, s'il appartient déjà à ce produit (ses unités sont alors mises à jour), ou si `p_move` est vrai ;
      - sinon `{"status":"already_attached","product_id","product_name"}`, qui désigne l'autre produit, sans rien changer.
    - `record_movement(p_id uuid, p_product_id uuid, p_code text, p_kind text, p_units int, p_quantity int, p_employee text)` → `{"movement_id","delta","stock","duplicate"}`. Dans l'ordre :
      1. Si un mouvement `p_id` existe déjà, le renvoyer (son `delta`, le stock actuel et `duplicate` vrai), sans autre contrôle.
      2. Verrouiller la ligne du produit (`for update`).
      3. Contrôler les valeurs :
         - `kind` vaut `in` ou `out` ;
         - la quantité est entre 1 et 99, et le prénom fait de 1 à 30 caractères ;
         - avec un code : le code appartient au produit et vaut exactement `p_units`, sinon `invalid_input:code` ou `invalid_input:units` ;
         - sans code (saisie manuelle) : `p_units` vaut 1 ou le pack Metro du produit.
      4. Calculer `delta = ± p_units × p_quantity`, puis insérer avec `on conflict (id) do nothing`.
    - `cancel_movement(p_movement_id uuid, p_employee text)` → `{"stock","product_id"}`. Elle est idempotente : une seconde annulation ne change rien. Un mouvement inconnu lève `invalid_input:movement`.
    - `list_employees()` → le tableau JSON des prénoms distincts, triés, ou `[]`.

- [ ] **Step 1: Créer le projet Supabase**, avec l'accord donné par le porteur du projet à la validation du plan

1. Appeler `mcp__Supabase__create_project` avec `name: 'scandrinks'`, `organization_id: 'gcyzekmpjvhvascsudie'` et `region: 'eu-west-3'`.
2. Interroger `mcp__Supabase__get_project` jusqu'à l'état `ACTIVE_HEALTHY`.
3. Noter l'`id` du projet dans le journal.
4. Dès que le projet est actif, demander au porteur du projet les réglages de la Tâche 10 (Step 1). Ils se font en parallèle de la suite.

Expected : le projet existe et tourne sur l'offre gratuite, pour un coût de 0 $.

- [ ] **Step 2: Écrire `supabase/tests/database.test.sql`**

Le test est écrit avant la migration, pour le voir d'abord échouer.

Principes :
- Tout tourne dans une seule transaction, terminée par `rollback;` puis `select 'OK' as resultat;`.
- Chaque vérification est un bloc `do $$ … $$` qui lève `ÉCHEC : <cas>`.
- Les refus attendus se vérifient avec `exception when insufficient_privilege` ou `when raise_exception`, pour ne pas interrompre la transaction.

Mise en place, en tant que `postgres` :
- deux comptes factices dans `auth.users` : `A`, autorisé et inscrit dans `allowed_users`, et `B`, non autorisé ;
- le produit « Coca-Cola 33 cl » (pack Metro 24, seuil 24, stock idéal 48), avec le code `5449000000996` (1 unité) et une entrée de 24 au nom de « Sam ».

Le rôle est ensuite simulé :
- un compte connecté : `set local role authenticated`, puis `select set_config('request.jwt.claims', '{"sub":"<id>","role":"authenticated"}', true)` ;
- un visiteur sans connexion : `set local role anon`.

Cas vérifiés :
1. **`anon` :** lire `products` ou `product_stock`, et appeler `lookup_barcode`, sont refusés (permission refusée).
2. **`B` :** `lookup_barcode('5449000000996')` renvoie `null`, `product_stock` est vide et `record_movement` est refusé.
3. **`A`, création :** `create_product('Lipton Pêche 50 cl', 12, 12, 24, '[{"code":"3502110123091","units":12},{"code":"3228886043714","units":1}]')` réussit. `lookup_barcode('3502110123091')` donne `units` 12 et `stock` 0.
4. **Entrée :** `record_movement(id1, lipton, '3502110123091', 'in', 12, 2, 'Sam')` donne `delta` 24 et `stock` 24. Le même appel avec `id1` donne `duplicate` vrai, et le stock reste 24.
5. **Sortie :** `record_movement(id2, lipton, '3228886043714', 'out', 1, 6, 'Sam')` donne `stock` 18.
6. **Annulation :** `cancel_movement(id1, 'Sam')` donne `stock` −6 : le stock négatif est autorisé (RG-8). Un second appel donne encore −6.
7. **Contrôle des unités :**
   - `p_units` 24 avec le code du pack Lipton, qui vaut 12 → `invalid_input:units` ;
   - le code d'un autre produit → `invalid_input:code` ;
   - saisie manuelle (`p_code` null) avec `p_units` 12 → acceptée ; avec 5 → `invalid_input:units`.
8. **Code d'un autre produit :** `attach_barcode('5449000000996', lipton, 1, false)` donne `already_attached`, avec `product_name` « Coca-Cola 33 cl ». Avec `p_move` vrai, il donne `attached`. `lookup_barcode` désigne alors Lipton, et le stock des deux produits n'a pas changé (RG-12).
9. **Code déjà pris :** `create_product` avec un code existant lève `barcode_taken:3502110123091`.
10. **Valeurs refusées**, chacune avec `invalid_input:…` : quantité 0 ou 100, `kind` `inventory`, unités 0 dans `attach_barcode`, stock idéal égal au seuil, nom de 81 caractères, prénom de 31 caractères.
11. **Prénoms :** `list_employees()` renvoie `["Sam"]`.

- [ ] **Step 3: Lancer les tests SQL pour vérifier qu'ils échouent**

Exécuter le fichier avec `mcp__Supabase__execute_sql`.
Expected : erreur, la relation `products` n'existe pas.

- [ ] **Step 4: Écrire la migration et l'appliquer**

Écrire `supabase/migrations/20261019130000_initial_schema.sql`, qui contient exactement le schéma de la partie Interfaces. L'appliquer avec `mcp__Supabase__apply_migration`, `name: 'initial_schema'`.

- [ ] **Step 5: Lancer les tests SQL**

Exécuter `database.test.sql` avec `mcp__Supabase__execute_sql`.
Expected : aucune exception, et le résultat affiche `OK`.

Vérifier ensuite que tout a été annulé : `select count(*) from products` vaut 0.

- [ ] **Step 6: Contrôle des conseils de Supabase**

Appeler `mcp__Supabase__get_advisors`, une fois avec `type: 'security'` et une fois avec `type: 'performance'`.
Expected : aucune alerte de niveau ERROR. Les alertes WARN, s'il y en a, sont notées dans le journal avec leur lien de correction.

- [ ] **Step 7: Commit**

Message : `feat(db): schéma, sécurité (RLS + allowed_users) et fonctions idempotentes`.

---

### Task 5: Accès aux données (client Supabase, API typée, erreurs)

**Files:**
- Create: `src/vite-env.d.ts`, `src/data/api.ts`, `src/data/apiErrors.ts`, `src/data/supabaseClient.ts`, `.env.e2e`
- Modify: `package.json`, pour ajouter `@supabase/supabase-js@2.117.2`
- Test: `src/data/apiErrors.test.ts`, `src/data/api.test.ts`

**Interfaces:**
- Consumes : les fonctions SQL de la Tâche 4, avec leurs noms et paramètres exacts ; `ScanMode` et `NewProductInput` (Tâche 3).
- Produces :
  - **Variables d'environnement :**
    - `import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` et `VITE_SHOP_EMAIL`, typées dans `vite-env.d.ts` ;
    - `.env.e2e` contient `VITE_SUPABASE_URL=https://e2e-scandrinks.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_e2e` et `VITE_SHOP_EMAIL=tabac.e2e@example.com`.
  - **`supabaseClient.ts`, client :**
    - `supabase` = `createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })`. Avec `detectSessionInUrl: false`, l'app ne lit jamais de jeton dans l'URL et ne la modifie pas ;
    - une erreur claire est levée si une variable manque.
  - **`supabaseClient.ts`, instance des écrans :** le fichier exporte aussi `api = createApi(supabase)`, utilisée par les écrans. Les tests unitaires n'importent jamais ce fichier.
  - **`apiErrors.ts`, types :**
    - `type ApiErrorKind = 'network' | 'session' | 'forbidden' | 'barcode_taken' | 'invalid' | 'unknown'` ;
    - `class ApiError extends Error { kind: ApiErrorKind; detail: string | null }`.
  - **`apiErrors.ts`, `classifyApiError(error: unknown): ApiError`.** La première règle qui s'applique donne le type :
    1. `network` : un `TypeError`, une `AuthRetryableFetchError`, un `status` 0, ou un message qui contient « Failed to fetch », « Load failed » ou « NetworkError » ;
    2. `session` : un `status` 401, un code `PGRST301`, `PGRST302` ou `PGRST303`, ou un message qui contient « JWT » ;
    3. `forbidden` : le code `42501`, ou un `status` 403 ;
    4. `barcode_taken` : le code `P0001` avec un message `barcode_taken:<code>` (`detail` = ce code), ou le code `23505` (`detail` vide) ;
    5. `invalid` : le code `P0001` avec un message `invalid_input:<champ>` (`detail` = ce champ), ou l'un des codes `23514`, `22003`, `23502` ou `22P02` ;
    6. `unknown` : tout le reste.
  - **`apiErrors.ts`, `apiErrorMessage(kind: ApiErrorKind): string`**, voir les messages dans le test.
  - **Types :**
    - `interface Product { id: string; name: string; packSize: number; alertThreshold: number; targetStock: number; archived: boolean; stock: number }` ;
    - `type LookupResult = { found: true; product: Product; units: number } | { found: false }`.
  - **API (`api.ts`) :** `createApi(client: Pick<SupabaseClient, 'rpc' | 'from'>)` renvoie un objet avec les méthodes suivantes :
    - `lookupBarcode(code: string): Promise<LookupResult>` ;
    - `listProducts(): Promise<Product[]>`, qui lit `product_stock` avec `.select('*').eq('archived', false).order('name')` ;
    - `createProduct(input: NewProductInput): Promise<Product>` ;
    - `attachBarcode(input: { code: string; productId: string; units: number; move: boolean }): Promise<{ status: 'attached' } | { status: 'already_attached'; productId: string; productName: string }>` ;
    - `recordMovement(input: { id: string; productId: string; code: string | null; mode: ScanMode; units: number; quantity: number; employee: string }): Promise<{ delta: number; stock: number; duplicate: boolean }>` ;
    - `cancelMovement(movementId: string, employee: string): Promise<{ stock: number }>` ;
    - `listEmployees(): Promise<string[]>`.
  - **Erreurs de l'API :** en cas d'échec, chaque méthode lève l'`ApiError` donnée par `classifyApiError`. Elle lui passe l'`error` renvoyée par supabase-js, complétée du `status` HTTP de la réponse, ou bien l'exception levée.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// apiErrors.test.ts
test.each([
  [new TypeError('Failed to fetch'), 'network'], [{ message: 'TypeError: Load failed', code: '', status: 0 }, 'network'],
  [{ name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 }, 'network'],
  [{ message: 'JWT expired', code: 'PGRST303', status: 401 }, 'session'], [{ message: 'Invalid Refresh Token', status: 401 }, 'session'],
  [{ message: 'permission denied for function lookup_barcode', code: '42501', status: 401 }, 'session'],
  [{ message: 'new row violates row-level security policy', code: '42501', status: 403 }, 'forbidden'],
  [{ message: 'barcode_taken:3502110123091', code: 'P0001', status: 400 }, 'barcode_taken'],
  [{ message: 'duplicate key value violates unique constraint "barcodes_pkey"', code: '23505', status: 409 }, 'barcode_taken'],
  [{ message: 'invalid_input:quantity', code: 'P0001', status: 400 }, 'invalid'],
  [{ message: 'new row for relation "products" violates check constraint', code: '23514', status: 400 }, 'invalid'],
  [{ message: 'boom', status: 500 }, 'unknown'],
])('%o → %s', (raw, kind) => { expect(classifyApiError(raw).kind).toBe(kind) })
test('detail porte le code pris ou le champ refusé', () => {
  expect(classifyApiError({ message: 'barcode_taken:3502110123091', code: 'P0001' }).detail).toBe('3502110123091')
  expect(classifyApiError({ message: 'invalid_input:units', code: 'P0001' }).detail).toBe('units')
})
test.each([
  ['network', "Pas de connexion, rien n'a été enregistré."],
  ['session', 'Ta session a expiré : reconnecte-toi.'],
  ['forbidden', "Ce compte n'a pas accès au stock."],
  ['barcode_taken', 'Ce code appartient déjà à un autre produit.'],
  ['invalid', 'Enregistrement refusé : vérifie la saisie ou scanne de nouveau.'],
  ['unknown', 'Base injoignable. Réessaie dans un instant.'],
])('message %s', (kind, message) => { expect(apiErrorMessage(kind as ApiErrorKind)).toBe(message) })

// api.test.ts : faux client qui enregistre les appels
test('recordMovement appelle record_movement avec les paramètres SQL exacts', async () => {
  const rpc = vi.fn(async () => ({ data: { movement_id: 'm1', delta: 48, stock: 48, duplicate: false }, error: null, status: 200 }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  await expect(api.recordMovement({ id: 'm1', productId: 'p1', code: '3502110123091', mode: 'in', units: 24, quantity: 2, employee: 'Sam' }))
    .resolves.toEqual({ delta: 48, stock: 48, duplicate: false })
  expect(rpc).toHaveBeenCalledWith('record_movement', { p_id: 'm1', p_product_id: 'p1', p_code: '3502110123091', p_kind: 'in', p_units: 24, p_quantity: 2, p_employee: 'Sam' })
})
test('lookupBarcode transforme le JSON SQL en Product', async () => {
  const rpc = vi.fn(async () => ({ data: { code: '3502110123091', units: 12, product: { id: 'p1', name: 'Lipton Pêche 50 cl', pack_size: 12, alert_threshold: 12, target_stock: 24, archived: false, stock: 0 } }, error: null, status: 200 }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  expect(await api.lookupBarcode('3502110123091')).toEqual({ found: true, units: 12, product: { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0 } })
  expect(rpc).toHaveBeenCalledWith('lookup_barcode', { p_code: '3502110123091' })
})
test('lookupBarcode : null → found false', async () => {
  const api = createApi({ rpc: vi.fn(async () => ({ data: null, error: null, status: 200 })), from: vi.fn() } as never)
  expect(await api.lookupBarcode('1')).toEqual({ found: false })
})
test('une coupure réseau (erreur renvoyée par supabase-js) devient ApiError network', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 }))
  await expect(createApi({ rpc, from: vi.fn() } as never).cancelMovement('m1', 'Sam')).rejects.toMatchObject({ kind: 'network' })
})
```

Ajouter un test du même genre pour chacun des appels suivants, en vérifiant le nom de la fonction et les paramètres `p_…` exacts de la Tâche 4 :
- `createProduct`, avec `p_barcodes` sous forme de tableau d'objets `{ code, units }` ;
- `attachBarcode`, avec ses deux réponses ;
- `cancelMovement` ;
- `listEmployees`.

Pour `listProducts`, un faux constructeur de requête enchaîne `select('*')`, `eq('archived', false)` et `order('name')`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/data`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Implémenter**

1. `npm install --save-exact @supabase/supabase-js@2.117.2`.
2. Écrire `vite-env.d.ts`, `.env.e2e`, `apiErrors.ts`, `api.ts` et `supabaseClient.ts`.

- [ ] **Step 4: Vérifier**

Run: `npm test && npm run typecheck`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(data): client Supabase, API typée et erreurs expliquées`.

---

### Task 6: Connexion, prénom et coquille de l'app

**Files:**
- Create: `src/auth/employee.ts`, `src/auth/loginError.ts`, `src/auth/LoginScreen.tsx`, `src/auth/NameScreen.tsx`, `src/settings/SettingsScreen.tsx`, `src/app/AppShell.tsx`, `src/app/AppShell.css`
- Modify: `src/App.tsx`, qui rend `<AppShell />`
- Delete: `src/scanTest/` (les 4 fichiers)
- Test: `src/auth/employee.test.ts`, `src/auth/loginError.test.ts`

**Interfaces:**
- Consumes : `supabase` et `api` (`supabaseClient.ts`), `classifyApiError` (Tâche 5).
- Produces :
  - **`employee.ts` :**
    - `validateEmployeeName(raw: string): { ok: true; name: string } | { ok: false; message: string }`. Le prénom est nettoyé (`trim`) et doit faire de 1 à 30 caractères.
    - `loadEmployeeName(storage?: Storage): string | null` et `saveEmployeeName(name: string, storage?: Storage): void`, sur la clé `scandrinks.employee`. Ces deux fonctions ne lèvent jamais d'exception.
  - **`loginError.ts` :** `loginErrorMessage(error: unknown): string`, avec trois cas :
    - un `status` 400 avec le code `invalid_credentials` ou le message « Invalid login credentials » → « Mot de passe incorrect. » ;
    - une `AuthRetryableFetchError`, un `TypeError` ou un `status` 0 → « Pas de connexion. Réessaie quand le réseau revient. » ;
    - autre → « Connexion impossible. Réessaie. ».
  - **Textes exacts**, utilisés par la Tâche 9 :
    - connexion : « Compte du tabac », un champ « Mot de passe » et le bouton « Se connecter » ;
    - prénom : le titre « Qui es-tu ? », un bouton par prénom existant, le champ « Nouveau prénom » et le bouton « C'est moi » ;
    - en-tête : « ScanDrinks », le prénom en cours, et un bouton ⚙ nommé « Réglages » (`aria-label`) ;
    - réglages : « Changer de prénom », « Se déconnecter » et « Retour » ;
    - session expirée : « Ta session a expiré : reconnecte-toi. », affiché sur l'écran de connexion.
  - **`AppShell` :**
    - **Écrans :** chargement → connexion (pas de session) → prénom (pas de prénom mémorisé) → Scanner. Les Réglages remplacent le Scanner, ce qui arrête la caméra ; « Retour » le rouvre.
    - **Événements de connexion :** il suit `supabase.auth.onAuthStateChange` (`INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`). Le rappel se contente de mettre à jour l'état React, sans aucun autre appel Supabase : sinon, supabase-js peut se bloquer.
    - **Session expirée :** un `SIGNED_OUT` reçu sans appui sur « Se déconnecter », par exemple après le refus du jeton de rafraîchissement, ramène à la connexion avec le message de session expirée.
    - **`onSessionExpired(): void`**, transmis aux écrans avec `employee: string`. Il appelle `supabase.auth.signOut({ scope: 'local' })`, puis affiche la connexion avec ce même message.
    - **« Se déconnecter » :**
      - d'abord la confirmation « Se déconnecter ? Il faudra retaper le mot de passe du tabac. » ;
      - puis `signOut({ scope: 'local' })`. Ne jamais garder la portée par défaut (`global`) : elle déconnecterait tous les téléphones de l'équipe ;
      - le prénom reste mémorisé.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// employee.test.ts
const brokenStorage = { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('SecurityError') } } as unknown as Storage
test.each([['  Sam  ', { ok: true, name: 'Sam' }], ['', { ok: false, message: 'Le prénom doit faire entre 1 et 30 caractères.' }],
  ['x'.repeat(31), { ok: false, message: 'Le prénom doit faire entre 1 et 30 caractères.' }]])('validateEmployeeName(%j)', (raw, expected) => {
  expect(validateEmployeeName(raw)).toEqual(expected)
})
test('stockage bloqué (navigation privée) : rien ne plante, pas de prénom mémorisé', () => {
  expect(() => saveEmployeeName('Sam', brokenStorage)).not.toThrow()
  expect(loadEmployeeName(brokenStorage)).toBeNull()
})
test('prénom mémorisé puis relu', () => {
  const memory = new Map<string, string>()
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v) } } as unknown as Storage
  saveEmployeeName('Sam', storage)
  expect(loadEmployeeName(storage)).toBe('Sam')
})

// loginError.test.ts
test.each([
  [{ name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' }, 'Mot de passe incorrect.'],
  [{ name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 }, 'Pas de connexion. Réessaie quand le réseau revient.'],
  [new TypeError('Failed to fetch'), 'Pas de connexion. Réessaie quand le réseau revient.'],
  [{ message: '???', status: 500 }, 'Connexion impossible. Réessaie.'],
])('loginErrorMessage(%o)', (error, message) => { expect(loginErrorMessage(error)).toBe(message) })
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/auth`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Implémenter `employee.ts`, `loginError.ts`, les écrans et `AppShell`, puis supprimer `src/scanTest/`**

- **Connexion :**
  - un formulaire avec un champ e-mail en lecture seule (`autoComplete="username"`, valeur `VITE_SHOP_EMAIL`) et le champ mot de passe (`autoComplete="current-password"`). Ainsi, le trousseau iCloud propose d'enregistrer le mot de passe ;
  - envoi par `supabase.auth.signInWithPassword` ;
  - en cas d'échec, le message de `loginErrorMessage`.
- **Prénom :** l'écran charge `api.listEmployees()`. Une erreur `session` appelle `onSessionExpired()`. Toute autre erreur laisse seulement le champ « Nouveau prénom ».
- L'écran Scanner de la Tâche 7 est d'abord un simple emplacement.

- [ ] **Step 4: Vérifier**

Run: `npm test && npm run build`
Expected : tout passe, `✓ built`.

- [ ] **Step 5: Commit**

Message : `feat(app): connexion au compte du tabac, prénom et réglages`.

---

### Task 7: Écran Scanner — modes, code connu, validation et annulation

**Files:**
- Create: `src/scanner/mode.ts`, `src/scanner/scanFlow.ts`, `src/scanner/ScannerScreen.tsx`, `src/scanner/ConfirmCard.tsx`, `src/scanner/Notice.tsx`, `src/scanner/Scanner.css`
- Modify: `src/app/AppShell.tsx`, qui rend `ScannerScreen` ; `src/scan/useBarcodeScanner.ts`, qui relance la caméra au retour au premier plan
- Test: `src/scanner/mode.test.ts`, `src/scanner/scanFlow.test.ts`

**Interfaces:**
- Consumes :
  - `normalizeScannedCode` (Tâche 2) ;
  - `ScanMode`, `clampQuantity`, `describeConfirm`, `formatStock` et `formatDelta` (Tâche 3) ;
  - `api`, `Product`, `LookupResult`, `ApiErrorKind` et `apiErrorMessage` (Tâche 5) ;
  - `SCAN_COOLDOWN_MS`, `scannerErrorMessage` et `lookupProduct` (jalon 0), `useBarcodeScanner` (corrigé à la Tâche 1) ;
  - `employee` et `onSessionExpired` (Tâche 6).
- Produces :
  - `loadMode(storage?: Storage): ScanMode`, qui vaut `'in'` par défaut et ne lève jamais d'exception, et `saveMode(mode: ScanMode, storage?: Storage): void`, sur la clé `scandrinks.mode`.
  - `NOT_A_PRODUCT_MESSAGE` = « Ce code n'identifie pas un produit (lot, date…). » et `UNDO_FAILED_MESSAGE` = « L'annulation n'a pas pu être faite. Pour corriger, scanne le produit dans l'autre mode. ».
  - Les types et la fonction de l'automate. Les événements reçoivent `movementId` et `at` de l'écran : l'automate reste pur.

```ts
export interface ConfirmTarget { product: Product; units: number; code: string | null } // code null : saisie manuelle
export type Notice =
  | { kind: 'saved'; movementId: string; delta: number; productName: string; stock: number; packSize: number }
  | { kind: 'cancelled'; productName: string; stock: number; packSize: number }
  | { kind: 'not_a_product' }
  | { kind: 'error'; message: string }
export type FlowState =
  | { step: 'scanning'; notice: Notice | null; cooldown: { code: string; until: number } | null }
  | { step: 'looking_up'; code: string }
  | { step: 'confirm'; target: ConfirmTarget; quantity: number; movementId: string; status: 'idle' | 'saving' | 'failed'; errorKind: ApiErrorKind | null }
  | { step: 'unknown'; code: string }
  | { step: 'new_product'; code: string }
  | { step: 'attach'; code: string; product: Product | null } // product : choisi d'avance (pack ajouté depuis sa canette)
  | { step: 'manual' }
export type FlowEvent =
  | { type: 'code_read'; rawValue: string; format: string; at: number }
  | { type: 'lookup_done'; code: string; result: LookupResult; movementId: string }
  | { type: 'lookup_failed'; code: string; kind: ApiErrorKind }
  | { type: 'set_quantity'; quantity: number }
  | { type: 'validate' }
  | { type: 'save_done'; delta: number; stock: number; at: number }
  | { type: 'save_failed'; kind: ApiErrorKind }
  | { type: 'close' }
  | { type: 'choose_new_product' }
  | { type: 'choose_attach'; product?: Product }
  | { type: 'open_manual' }
  | { type: 'product_ready'; target: ConfirmTarget; movementId: string }
  | { type: 'undo_done'; productName: string; stock: number; packSize: number }
  | { type: 'undo_failed'; kind: ApiErrorKind }
  | { type: 'notice_expired' }
export const initialFlow: FlowState // { step: 'scanning', notice: null, cooldown: null }
export function flowReducer(state: FlowState, event: FlowEvent): FlowState
```

  - Les transitions. Dans tous les autres cas, l'état est renvoyé tel quel, c'est-à-dire le même objet.

| Événement | Accepté dans | Résultat |
|---|---|---|
| `code_read` | `scanning` | Un code `not_a_product` donne la notice du même nom. Un code `invalid_check_digit` ne change rien. Le code de `cooldown`, avant `until`, ne change rien. Sinon : `looking_up` |
| `lookup_done` | `looking_up` du même code | Trouvé : `confirm`, quantité 1, `idle`. Sinon : `unknown` |
| `lookup_failed` | `looking_up` du même code | `scanning`, notice `error` (`apiErrorMessage`) |
| `set_quantity` | `confirm` en `idle` | Quantité bornée par `clampQuantity` |
| `validate` | `confirm` en `idle` ou `failed` | `saving`, avec le même `movementId` |
| `save_done` | `confirm` en `saving` | `scanning`, notice `saved`. `cooldown` = code de la fiche jusqu'à `at + SCAN_COOLDOWN_MS`, ou `null` en saisie manuelle |
| `save_failed` | `confirm` en `saving` | `failed`, avec `errorKind` |
| `close` | `confirm` hors `saving`, `unknown`, `new_product`, `attach`, `manual` | `scanning`, sans notice ni `cooldown` |
| `choose_new_product` | `unknown` | `new_product` |
| `choose_attach` | `unknown`, `new_product` | `attach`, avec le produit transmis ou `null` |
| `open_manual` | `scanning` | `manual` |
| `product_ready` | `new_product`, `attach`, `manual` | `confirm`, quantité 1, `idle` |
| `undo_done` | `scanning` | Notice `cancelled` |
| `undo_failed` | `scanning` | Notice `error` (`UNDO_FAILED_MESSAGE`) |
| `notice_expired` | `scanning` | Notice effacée |

  - **Textes et rendus exacts**, utilisés par la Tâche 9 :
    - **Modes :** les boutons « Entrée + » et « Sortie − » (signe U+2212), avec `aria-pressed`. Couleurs : `--mode-in: #1f6f3f` (vert) et `--mode-out: #b45309` (orange). La fiche porte `data-mode="in"` ou `data-mode="out"`.
    - **Fiche :**
      - le nom du produit, puis la ligne `describeConfirm`, dans la couleur du mode ;
      - le champ « Quantité », avec les boutons « Moins » et « Plus » ;
      - les boutons « Valider » et « Annuler ». Pendant l'envoi, « Valider » devient « Enregistrement… » et se désactive ;
      - en `failed` : le message `apiErrorMessage(errorKind)`, et « Réessayer » à la place de « Valider ».
    - **Notices :**
      - `saved` : « ✓ {formatDelta(delta)} {nom} — stock : {formatStock(stock, packSize)} », avec un bouton « Annuler », qui affiche « Annulation… » pendant l'appel ;
      - `cancelled` : « Annulé — stock : {formatStock} ».
    - **Saisie manuelle :** le bouton « Saisie manuelle », visible pendant la lecture, même quand la caméra est en erreur.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// scanFlow.test.ts
const lipton: Product = { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0 }
const PACK = '3502110123091'
const scanning = (cooldown: { code: string; until: number } | null = null): FlowState => ({ step: 'scanning', notice: null, cooldown })
const confirmed = () => flowReducer({ step: 'looking_up', code: PACK },
  { type: 'lookup_done', code: PACK, result: { found: true, product: lipton, units: 12 }, movementId: 'm1' })
const saving = () => flowReducer(confirmed(), { type: 'validate' })

test('code long GS1 du pack Lipton → recherche du code normalisé', () => {
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '0103502110123091152706202000100000208663', format: 'code_128', at: 0 }))
    .toEqual({ step: 'looking_up', code: PACK })
})
test('code de lot → notice not_a_product ; clé de contrôle fausse → ignoré sans message', () => {
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '902602365', format: 'code_128', at: 0 }))
    .toEqual({ step: 'scanning', notice: { kind: 'not_a_product' }, cooldown: null })
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '3502110123092', format: 'ean_13', at: 0 })).toBe(initialFlow)
})
test('code connu → fiche de confirmation, quantité 1', () => {
  expect(confirmed()).toEqual({ step: 'confirm', target: { product: lipton, units: 12, code: PACK }, quantity: 1, movementId: 'm1', status: 'idle', errorKind: null })
})
test('réponse arrivée pour un autre code : ignorée', () => {
  const s: FlowState = { step: 'looking_up', code: PACK }
  expect(flowReducer(s, { type: 'lookup_done', code: '5449000000996', result: { found: false }, movementId: 'm9' })).toBe(s)
})
test('code inconnu → étape unknown', () => {
  expect(flowReducer({ step: 'looking_up', code: '9002490274658' }, { type: 'lookup_done', code: '9002490274658', result: { found: false }, movementId: 'm9' }))
    .toEqual({ step: 'unknown', code: '9002490274658' })
})
test('fiche affichée : un nouveau code lu est ignoré', () => {
  const s = confirmed()
  expect(flowReducer(s, { type: 'code_read', rawValue: '5449000000996', format: 'ean_13', at: 0 })).toBe(s)
})
test('quantité bornée de 1 à 99', () => {
  expect(flowReducer(confirmed(), { type: 'set_quantity', quantity: 150 })).toMatchObject({ quantity: 99 })
  expect(flowReducer(confirmed(), { type: 'set_quantity', quantity: 0 })).toMatchObject({ quantity: 1 })
})
test("double appui sur Valider : un seul enregistrement, fermeture impossible pendant l'envoi", () => {
  const s = saving()
  expect(s).toMatchObject({ status: 'saving' })
  expect(flowReducer(s, { type: 'validate' })).toBe(s)
  expect(flowReducer(s, { type: 'close' })).toBe(s)
})
test('coupure réseau : Réessayer garde le même identifiant, la quantité est verrouillée', () => {
  const failed = flowReducer(saving(), { type: 'save_failed', kind: 'network' })
  expect(failed).toMatchObject({ status: 'failed', errorKind: 'network', movementId: 'm1' })
  expect(flowReducer(failed, { type: 'set_quantity', quantity: 5 })).toBe(failed)
  expect(flowReducer(failed, { type: 'validate' })).toMatchObject({ status: 'saving', movementId: 'm1', errorKind: null })
})
test('enregistré → lecture avec la notice saved, et le même code ignoré pendant 2 s', () => {
  const done = flowReducer(saving(), { type: 'save_done', delta: 12, stock: 12, at: 10_000 })
  expect(done).toEqual({ step: 'scanning', cooldown: { code: PACK, until: 12_000 },
    notice: { kind: 'saved', movementId: 'm1', delta: 12, productName: 'Lipton Pêche 50 cl', stock: 12, packSize: 12 } })
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 11_999 })).toBe(done)
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 12_000 })).toEqual({ step: 'looking_up', code: PACK })
})
test('recherche impossible (réseau) → lecture, avec une notice error', () => {
  expect(flowReducer({ step: 'looking_up', code: '1' }, { type: 'lookup_failed', code: '1', kind: 'network' }))
    .toEqual({ step: 'scanning', notice: { kind: 'error', message: "Pas de connexion, rien n'a été enregistré." }, cooldown: null })
})
test('étapes intermédiaires', () => {
  const unknown: FlowState = { step: 'unknown', code: '9002490274658' }
  expect(flowReducer(unknown, { type: 'choose_new_product' })).toEqual({ step: 'new_product', code: '9002490274658' })
  expect(flowReducer(unknown, { type: 'choose_attach' })).toEqual({ step: 'attach', code: '9002490274658', product: null })
  expect(flowReducer({ step: 'new_product', code: '9002490274658' }, { type: 'choose_attach', product: lipton }))
    .toEqual({ step: 'attach', code: '9002490274658', product: lipton })
  expect(flowReducer(initialFlow, { type: 'open_manual' })).toEqual({ step: 'manual' })
  const target = { product: lipton, units: 24, code: '9002490274658' }
  expect(flowReducer({ step: 'attach', code: '9002490274658', product: lipton }, { type: 'product_ready', target, movementId: 'm2' }))
    .toEqual({ step: 'confirm', target, quantity: 1, movementId: 'm2', status: 'idle', errorKind: null })
  expect(flowReducer(unknown, { type: 'close' })).toEqual(scanning())
})
test('annulation réussie ou échouée', () => {
  expect(flowReducer(scanning(), { type: 'undo_done', productName: 'Lipton Pêche 50 cl', stock: 0, packSize: 12 }))
    .toMatchObject({ notice: { kind: 'cancelled', stock: 0 } })
  expect(flowReducer(scanning(), { type: 'undo_failed', kind: 'network' }))
    .toMatchObject({ notice: { kind: 'error', message: UNDO_FAILED_MESSAGE } })
})

// mode.test.ts
test('mode par défaut : Entrée ; stockage bloqué → Entrée sans planter', () => {
  const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
  expect(loadMode(broken)).toBe('in')
  expect(() => saveMode('out', broken)).not.toThrow()
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/scanner`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: Implémenter `mode.ts`, `scanFlow.ts`, puis l'écran**

`ScannerScreen` :
- **Disposition :**
  - le viseur reste en `object-fit: contain`, pour que toute l'image analysée soit visible, et occupe au plus 45 % de la hauteur de l'écran ;
  - la fiche et les formulaires s'affichent dessous, dans une zone qui défile ;
  - la caméra continue de tourner pendant qu'ils sont affichés.
- **Caméra :**
  - elle démarre à l'ouverture de l'écran ;
  - en cas d'erreur, l'écran affiche `scannerErrorMessage` et le bouton « Démarrer la caméra » ;
  - `useBarcodeScanner` relance la caméra au retour au premier plan, si elle avait été interrompue.
- **Codes lus :** ils sont transmis par `code_read`, avec `at: Date.now()`. Une seule exception : pendant la capture d'une canette du formulaire « Nouveau produit » (Tâche 8), ils vont au formulaire.
- **Effets selon l'étape :**
  - en `looking_up` : appel à `api.lookupBarcode` ;
  - à l'arrivée en `unknown` : appel à `lookupProduct` (Open Food Facts), une seule fois par code. L'écran garde le résultat et le transmet à la carte et aux formulaires ;
  - en `saving` : appel à `api.recordMovement`, avec le `movementId` de l'état, le mode en cours et `employee` ;
  - sur l'« Annuler » de la notice : appel à `api.cancelMovement`, puis événement `undo_done` ou `undo_failed` ;
  - les identifiants sont créés par `crypto.randomUUID()`, au moment d'envoyer `lookup_done` ou `product_ready`.
- **Session :** toute erreur `session` de l'API appelle `onSessionExpired()`.
- **Notices :**
  - chaque notice disparaît au bout de 5 s (`notice_expired`), sauf pendant une annulation en cours ;
  - les notices ont `role="status"`, et les erreurs `role="alert"`.
- **Étapes à venir :** jusqu'à la Tâche 8, les étapes `new_product`, `attach` et `manual` affichent un emplacement « Bientôt » et un bouton « Annuler ».

- [ ] **Step 4: Vérifier**

Run: `npm test && npm run build`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(scanner): modes Entrée/Sortie, fiche de confirmation, enregistrement idempotent et annulation`.

---

### Task 8: Code inconnu — nouveau produit, ajout à un produit existant, saisie manuelle

**Files:**
- Create: `src/products/search.ts`, `src/products/ProductPicker.tsx`, `src/products/NewProductForm.tsx`, `src/products/AttachForm.tsx`, `src/products/ManualEntry.tsx`, `src/products/Products.css`
- Modify: `src/scanner/ScannerScreen.tsx`, qui rend ces écrans aux étapes `new_product`, `attach` et `manual`
- Test: `src/products/search.test.ts`

**Interfaces:**
- Consumes :
  - `ProductDraft`, `newDraft`, `updateDraft`, `validateDraft` et `parseIntInRange` (Tâche 3) ;
  - `api.lookupBarcode`, `api.createProduct`, `api.attachBarcode` et `api.listProducts` (Tâche 5) ;
  - `lookupProduct` (jalon 0) et `normalizeScannedCode` (Tâche 2) ;
  - les événements `choose_attach`, `product_ready` et `close` (Tâche 7).
- Produces :
  - `suggestSearchTerm(offName: string | null): string`, qui renvoie le premier mot d'au moins 3 lettres, ou `''` ;
  - `filterProducts(products: Product[], query: string): Product[]`, sans tenir compte de la casse ni des accents, avec un ordre stable ;
  - Textes exacts, utilisés par la Tâche 9 :
    - **Carte « Code inconnu » :**
      - « Code inconnu : {code} », puis « Open Food Facts : {nom} » quand le nom arrive. Les boutons sont utilisables sans attendre ;
      - les boutons « Nouveau produit », « Ajouter à un produit existant » et « Annuler ».
    - **Liste de produits :**
      - le champ « Rechercher un produit », puis un bouton au nom de chaque produit ;
      - pendant le chargement : « Chargement… » ;
      - liste vide : « Aucun produit pour l'instant : crée d'abord la fiche avec « Nouveau produit ». ».
    - **Formulaire « Nouveau produit », champs :** « Nom », « Ce code vaut (unités) », « Pack Metro (unités) », « Seuil d'alerte (unités) » et « Stock idéal (unités) ».
    - **Formulaire « Nouveau produit », boutons :** « Scanner une canette du pack », « Créer le produit » et « Annuler ».
    - **Formulaire « Nouveau produit », capture d'une canette :**
      - pendant la capture : « Vise une canette ou une bouteille du pack… » ;
      - canette déjà connue : « Cette canette appartient déjà à « {nom} ». », avec le bouton « Ajouter ce pack à « {nom} » » ;
      - canette inconnue : « Canette : {code} (1 unité) ».
    - **Formulaire d'ajout :** le champ « Ce code vaut (unités) » et le bouton « Ajouter le code ». Si le code est déjà pris : « Ce code appartient déjà à « {nom} ». », avec les boutons « Le laisser » et « Le déplacer ici ».
    - **Saisie manuelle :** la liste de produits, puis les boutons « Par pack de {N} », si le pack Metro vaut plus de 1, et « À l'unité ».

- [ ] **Step 1: Écrire le test qui échoue**

```ts
test.each([['Coca-Cola 330 ml', 'Coca-Cola'], ['Ice tea saveur pêche', 'Ice'], ['33 cl', ''], [null, '']])(
  'suggestSearchTerm(%j) = %j', (name, term) => { expect(suggestSearchTerm(name)).toBe(term) })
test('filterProducts ignore la casse et les accents', () => {
  const p = (name: string) => ({ id: name, name, packSize: 1, alertThreshold: 0, targetStock: 1, archived: false, stock: 0 })
  const list = [p('Coca-Cola 33 cl'), p('Lipton Pêche 50 cl'), p('Coca Zéro 33 cl')]
  expect(filterProducts(list, 'coca').map((x) => x.name)).toEqual(['Coca-Cola 33 cl', 'Coca Zéro 33 cl'])
  expect(filterProducts(list, 'PECHE').map((x) => x.name)).toEqual(['Lipton Pêche 50 cl'])
  expect(filterProducts(list, '')).toHaveLength(3)
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/products`
Expected: FAIL, module introuvable.

- [ ] **Step 3: Implémenter `search.ts` et les écrans**

**`ProductPicker`**, partagé par le formulaire d'ajout et la saisie manuelle :
- il charge `api.listProducts()` à l'ouverture ;
- la recherche démarre avec la valeur donnée par l'écran parent, et filtre la liste avec `filterProducts`.

**Formulaire « Nouveau produit » :**
- **Nom :** pré-rempli avec le `suggestedName` d'Open Food Facts pour le code du pack, s'il y en a un.
- **« Scanner une canette du pack » :** le premier code produit (RG-13) différent du code du pack est traité, puis la capture s'arrête. Trois cas :
  - si `api.lookupBarcode` trouve ce code, le formulaire affiche la canette déjà connue. Le bouton « Ajouter ce pack à « {nom} » » envoie `choose_attach` avec ce produit ;
  - si le code est inconnu, il est retenu comme unité. Open Food Facts est interrogé, et son nom remplit « Nom » si le champ est vide ;
  - en cas d'erreur, le formulaire affiche `apiErrorMessage`.
- **« Créer le produit » :**
  1. `validateDraft`, avec ses messages sous les champs.
  2. `api.createProduct`, avec `[{ code: pack, units: codeUnits }]`, plus `{ code: canette, units: 1 }` s'il y a une canette.
  3. En cas de `barcode_taken`, afficher « Ce code appartient déjà à un autre produit. ». Si `detail` est le code de la canette, retirer celle-ci du formulaire.
  4. En cas de réussite, envoyer `product_ready`, avec `units = codeUnits` et le code du pack.

**Formulaire d'ajout :**
- **Sans produit choisi d'avance :** `ProductPicker`, avec la recherche pré-remplie par `suggestSearchTerm`, à partir du nom donné par Open Food Facts pour le code.
- **Une fois le produit choisi :**
  - « Ce code vaut (unités) » est pré-rempli à 1. Il reste vide quand le produit a été choisi d'avance, c'est-à-dire pour un pack ajouté depuis sa canette ;
  - bornes de 1 à 999, avec `parseIntInRange` et le message « Entre 1 et 999. ».
- **« Ajouter le code »** appelle `api.attachBarcode` avec `move: false` :
  - `attached` : `product_ready` avec ces unités ;
  - `already_attached` : le message du code déjà pris. « Le laisser » envoie `close`, et « Le déplacer ici » refait l'appel avec `move: true`.

**Saisie manuelle :**
- `ProductPicker`, avec une recherche vide ;
- « Par pack de {N} » ou « À l'unité » envoie `product_ready`, avec `units` égal à N ou à 1, et `code: null`.

**Erreurs de l'API :** chaque écran les affiche avec `apiErrorMessage`. Pour `session`, il appelle `onSessionExpired()`.

- [ ] **Step 4: Vérifier**

Run: `npm test && npm run build`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(products): fiche au premier scan, ajout d'un code, saisie manuelle`.

---

### Task 9: Test de bout en bout de l'app (backend simulé)

**Files:**
- Create: `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`
- Modify: `package.json`, avec le script `"e2e": "tsc -p tsconfig.json && vite build --mode e2e --outDir dist-e2e && node e2e/app-smoke.mjs"`
- Modify: `.gitignore`, pour ajouter `dist-e2e/`
- Delete: `e2e/scan-smoke.mjs`, dont les vérifications de lecture sont reprises ici

**Interfaces:**
- Consumes :
  - les textes exacts des Tâches 6, 7 et 8 ;
  - `ean13Y4m` (jalon 0) ;
  - les valeurs de `.env.e2e` (Tâche 5) ;
  - les noms et paramètres des fonctions SQL (Tâche 4).
- Produces : `installFakeSupabase(page, options?: { catalogue?: 'coca_with_code' | 'coca_without_code' | 'empty'; failNextRecord?: boolean; expireSessionOn?: string }): { calls: Array<{ fn: string; body: Record<string, unknown> }> }`.
- **Interceptions** (routes Playwright) de `https://e2e-scandrinks.supabase.co/**` :
  - **Toute réponse** porte `access-control-allow-origin: *`. Une requête `OPTIONS` reçoit 204, avec `access-control-allow-headers: *` et `access-control-allow-methods: *`.
  - **`POST /auth/v1/token?grant_type=password` :**
    - avec le mot de passe `bon-mot-de-passe`, la réponse est 200 avec une session : `access_token` (un JWT non signé dont `exp` est dans un an), `expires_in`, `expires_at`, `refresh_token`, `token_type` et `user` ;
    - sinon, 400 `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`.
  - **`POST /auth/v1/logout`** renvoie 204.
  - **`POST /rest/v1/rpc/<fn>`** répond à partir d'un catalogue en mémoire :
    - `coca_with_code`, par défaut : « Coca-Cola 33 cl » (pack Metro 24, seuil 24, stock idéal 48, stock 24), avec le code `5449000000996` qui vaut 24 unités ;
    - `coca_without_code` : le même produit sans code, plus « Lipton Pêche 50 cl » ;
    - `empty` : aucun produit.
  - **Comportement des fonctions simulées :**
    - `record_movement` et `cancel_movement` recalculent le stock, et `list_employees` renvoie `[]` ;
    - avec `failNextRecord`, le premier `record_movement` est coupé par `route.abort('internetdisconnected')` ;
    - la fonction nommée par `expireSessionOn` renvoie 401 `{"code":"PGRST303","message":"JWT expired"}`.
  - **`GET /rest/v1/product_stock…`** renvoie le catalogue.
- **Open Food Facts** (`https://world.openfoodfacts.org/**`) : pour `5449000000996`, la réponse donne « Coca-Cola » et « 330 ml ».

- [ ] **Step 1: Écrire `e2e/fakeSupabase.mjs` et `e2e/app-smoke.mjs`**

Le lancement reprend celui du jalon 0 :
- une seule trame Y4M du code `5449000000996` ;
- `vite preview --outDir dist-e2e` sur le port 4173 ;
- Chromium avec la fausse caméra.

Chaque scénario s'ouvre dans un nouveau contexte de navigation, donc avec un stockage local vide.

- **A. Parcours principal**, avec le catalogue par défaut.
  1. Un mauvais mot de passe affiche « Mot de passe incorrect. ».
  2. Avec `bon-mot-de-passe`, on arrive à « Qui es-tu ? ». On saisit « Sam » dans « Nouveau prénom », puis on clique sur « C'est moi ».
  3. La fiche « Coca-Cola 33 cl » apparaît, avec « Pack de 24 → +24 » et `data-mode="in"`.
  4. Sur « Sortie − », la même fiche affiche « Pack de 24 → −24 » et `data-mode="out"`, et sa ligne est orange (`rgb(180, 83, 9)`). Sur « Entrée + », elle repasse à « +24 ».
  5. On clique sur « Valider ».
     - `calls` contient exactement 1 `record_movement`, avec `p_kind: 'in'`, `p_code: '5449000000996'`, `p_units: 24`, `p_quantity: 1` et `p_employee: 'Sam'`.
     - La notice « ✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs) » s'affiche.
  6. Sur « Annuler », `cancel_movement` est appelé avec le même identifiant, et « Annulé — stock : 24 (1 pack) » s'affiche.
  7. On enchaîne « Saisie manuelle », « Coca-Cola 33 cl », « Par pack de 24 », puis « Valider ». `record_movement` est appelé avec `p_code: null` et `p_units: 24`.
  8. Après « Réglages » puis « Retour », la caméra redémarre : la fiche du code réapparaît.
  9. Pendant tout le scénario :
     - l'URL ne change jamais ;
     - le wasm vient de l'app (statut 200, type `application/wasm`), et aucune requête ne part vers un CDN ;
     - toute l'image analysée reste visible.
- **B. Coupure réseau** (`failNextRecord`).
  1. Sur « Valider », « Pas de connexion, rien n'a été enregistré. » s'affiche.
  2. Sur « Réessayer », il y a 2 tentatives `record_movement`, avec le **même** `p_id`, puis la notice « ✓ +24 … ».
- **C. Session expirée** (`expireSessionOn: 'lookup_barcode'`). Après la connexion et le prénom, la lecture du code ramène à l'écran de connexion, avec « Ta session a expiré : reconnecte-toi. ».
- **D. Nouveau produit** (`empty`).
  1. « Code inconnu : 5449000000996 » et « Open Food Facts : Coca-Cola 330 ml » s'affichent. On clique sur « Nouveau produit ».
  2. Le champ « Nom » contient « Coca-Cola 330 ml ». On saisit 24 dans « Ce code vaut (unités) ».
  3. Les champs Pack Metro, Seuil d'alerte et Stock idéal affichent 24, 24 et 48. On clique sur « Créer le produit ».
  4. `create_product` reçoit `p_barcodes` égal à `[{"code":"5449000000996","units":24}]`, et la fiche affiche « Pack de 24 → +24 ».
- **E. Ajout à un produit existant** (`coca_without_code`).
  1. On clique sur « Ajouter à un produit existant ». Le champ « Rechercher un produit » contient « Coca-Cola », et la liste ne montre que « Coca-Cola 33 cl ».
  2. On choisit ce produit. « Ce code vaut (unités) » vaut 1. On clique sur « Ajouter le code ».
  3. `attach_barcode` est appelé avec `p_units: 1` et `p_move: false`, puis la fiche affiche « À l'unité → +1 ».
- **F. Lecteur et caméra.**
  - Si le wasm est renvoyé en `text/html` (route), « Le lecteur de codes-barres n'a pas pu se charger » s'affiche.
  - Si `visibilityState` passe à `hidden` et que `visibilitychange` est déclenché, « La caméra s'est arrêtée » s'affiche. Au retour à `visible`, la caméra redémarre et le message disparaît.

- [ ] **Step 2: Lancer le test de bout en bout**

Run: `npm run e2e`
Expected : `E2E OK`, avec le code de sortie 0.

- [ ] **Step 3: Vérifier que le test sait échouer**

1. Changer provisoirement en `'out'` le `p_kind` envoyé par `api.recordMovement`, puis lancer `npm run e2e`. Expected : échec du scénario A, au point 5.
2. Annuler ce changement, puis relancer `npm run e2e`. Expected : `E2E OK`.

- [ ] **Step 4: Commit**

Message : `test(e2e): parcours complet de l'app avec backend simulé`.

---

### Task 10: Mise en service du jalon 1 (base réelle, compte du tabac, déploiement, contrôles)

**Files:**
- Create: `.env.production`, `docs/jalon-1-test.md`
- Modify: `README.md`, pour les commandes, la base, les variables et le protocole

**Interfaces:**
- Consumes : le projet Supabase (Tâche 4), et l'app complète (Tâches 1 à 9).
- Produces : l'app du jalon 1 en ligne. D'abord en préversion sur `https://jalon-1.scandrinks.pages.dev`, puis sur `https://scandrinks.pages.dev` après la fusion.

- [ ] **Step 1: Actions du porteur du projet**, avec un guidage pas à pas

Elles sont demandées dès la validation du plan et la création du projet (Tâche 4).

1. Créer la Gmail dédiée au tabac, puis me donner son adresse. Le mot de passe de cette Gmail reste privé.
2. Dans Supabase, projet `scandrinks` :
   - Authentication → Sign In / Providers : désactiver « Allow new users to sign up » ;
   - Authentication → Users → Add user → Create new user : saisir l'adresse dédiée, choisir le mot de passe du tabac, et cocher « Auto Confirm User ».

- [ ] **Step 2: Autoriser le compte du tabac**

Exécuter avec `mcp__Supabase__execute_sql` : `insert into public.allowed_users (user_id) select id from auth.users where email = '<adresse dédiée>' returning user_id;`
Expected : 1 ligne.

- [ ] **Step 3: Écrire `.env.production`**

Le fichier contient :
- `VITE_SUPABASE_URL`, donné par `get_project_url` ;
- `VITE_SUPABASE_PUBLISHABLE_KEY`, la clé `sb_publishable_…` active, donnée par `get_publishable_keys` ;
- `VITE_SHOP_EMAIL`, l'adresse dédiée.

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 4: Écrire `docs/jalon-1-test.md` et mettre à jour le README**

Le protocole est en français simple.
1. Vérifier la version d'iOS : 16 au minimum (Réglages › Général › Informations).
2. Installer l'app depuis la préversion (Partager → « Sur l'écran d'accueil »), se connecter, puis choisir son prénom.
3. La caméra démarre seule. L'autorisation n'est pas redemandée après un aller-retour dans les Réglages.
4. Créer les fiches de 3 à 5 vrais packs :
   - le Lipton par son code court ; son code long doit ensuite donner la même fiche ;
   - le Red Bull ; son code de lot doit afficher « Ce code n'identifie pas un produit » ;
   - un pack avec « Scanner une canette du pack ».
5. Scanner seule la canette d'un pack créé sans sa canette : « Ajouter à un produit existant » doit proposer le bon produit.
6. Faire une entrée de 2 packs (quantité ×2), puis une sortie de quelques unités, et vérifier le stock affiché. Tester « Annuler ».
7. Utiliser deux iPhone à la suite sur le même produit : le stock suit.
8. Passer en mode avion au moment de valider : le message s'affiche. Une fois le réseau revenu, « Réessayer » : le stock n'augmente qu'une fois.

Règle : le jalon 1 est validé si tout cela fonctionne sans aide.

- [ ] **Step 5: Commit et envoi de la branche**, avec l'accord du porteur du projet

Message : `docs(jalon-1): mise en service, protocole de test`, puis `git push -u origin jalon-1`.
Expected : Cloudflare construit la préversion de la branche.

- [ ] **Step 6: Contrôles de la préversion et de la base**

Run, avec `BASE=https://jalon-1.scandrinks.pages.dev`, `SB=<VITE_SUPABASE_URL>` et `KEY=<clé publique>` :

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/"                                   # 200
# wasm : même contrôle qu'au jalon 0 (signature 00 61 73 6d, 1 093 289 octets)
curl -sS "$SB/rest/v1/product_stock?select=*" -H "apikey: $KEY"                       # refus 42501 : aucune donnée sans connexion
curl -sS -X POST "$SB/rest/v1/rpc/lookup_barcode" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"p_code":"1"}'   # refus 42501
curl -sS -X POST "$SB/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"controle-inscriptions@example.invalid","password":"Ctrl-0000-ScanDrinks"}'   # « Signups not allowed for this instance »
```

Ensuite, un script Playwright jetable, gardé dans le dossier temporaire et non versionné, ouvre la préversion :
- l'écran de connexion affiche l'adresse du compte du tabac ;
- un mauvais mot de passe donne « Mot de passe incorrect. ».

Cela confirme les variables de `.env.production` et le lien avec Supabase Auth.

Si l'inscription a été acceptée :
1. supprimer ce compte avec `delete from auth.users where email = 'controle-inscriptions@example.invalid'` ;
2. demander au porteur du projet de désactiver les inscriptions ;
3. refaire le contrôle.

- [ ] **Step 7: Test du porteur du projet sur iPhone**, d'après `docs/jalon-1-test.md`, sur la préversion

Attendre son retour. Les défauts trouvés sont corrigés en TDD sur la branche `jalon-1`.

- [ ] **Step 8: Fusion dans `main`**, avec l'accord du porteur du projet

Run: `git fetch origin main && git checkout main && git merge --ff-only jalon-1 && git push origin main`
Expected : `scandrinks.pages.dev` sert le jalon 1.

---

## Constats et décisions préalables

- **Code long GS1.**
  - Le lecteur de l'app le renvoie en texte simple, sans parenthèses ni séparateurs : `0103502110123091152706202000100000208663`. Constaté sur la photo du pack Lipton, le 19/10/2026.
  - Par sécurité pour le détecteur natif, `normalizeScannedCode` accepte aussi la forme avec parenthèses et l'identifiant `]C1`.
- **Autorisation caméra.** Dans l'app installée sur l'écran d'accueil, elle n'est demandée qu'une fois (test du porteur du projet, le 19/10/2026). Aucun contournement n'est nécessaire. La caméra s'arrête dans les Réglages et redémarre au retour ; le protocole vérifie qu'iOS ne redemande pas l'autorisation.
- **Version minimale d'iOS :** iOS 16, la cible par défaut de Vite 8.
- **Interruptions de la caméra.** Quand iOS coupe et rend l'image (`mute`, puis `unmute`), il n'y a rien à faire : la lecture reprend seule. Seul `ended` arrête la caméra, et ce cas est déjà géré.
- **Performance.** Aucun réglage de performance : la lecture est rapide (test du 19/10/2026). Le maintien de l'écran allumé (Wake Lock) sera revu au jalon 3, si l'équipe le demande.
- **Réponses de la base.** Toutes les fonctions SQL renvoient du `jsonb`. La forme des réponses est donc uniforme, et le backend simulé du test e2e la reproduit à l'identique.
- **Données de test.** Les données saisies pendant les jalons 1 à 3 servent aux essais. La base sera remise à zéro avant l'inventaire du premier jour (jalon 4).
