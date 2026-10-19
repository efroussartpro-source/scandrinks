# ScanDrinks — Jalon 0 (test du scan) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en ligne, en https, une page de test qui lit les codes-barres des packs Metro avec la caméra de l'iPhone et affiche le nom donné par Open Food Facts. Le porteur du projet s'en sert pour décider entre l'approche web (GO) et le plan B (app native).

**Architecture:** Une application React + TypeScript (Vite) sur une seule page, sans routeur.
- Le module `src/scan/` (détecteur, anti-doublon, caméra, hook) et le client `src/off/` sont conçus pour être réutilisés tels quels au jalon 1. La page `src/scanTest/` est jetable.
- La lecture passe par l'API BarcodeDetector native si elle couvre les 6 formats. Sinon, elle passe par ZXing-C++ en WebAssembly (`barcode-detector/ponyfill`), dont le fichier `.wasm` est servi par l'app elle-même.
- L'hébergement se fait sur Cloudflare Pages, relié au dépôt GitHub.

**Tech Stack:** Node 22, npm, Vite 8.3.2, React 19.3.0, TypeScript 7.0.2 (strict), Vitest 5.0.3, barcode-detector 3.2.2 avec zxing-wasm 3.1.3, Playwright 1.56.1 (test de bout en bout, Chromium déjà installé dans `/opt/pw-browsers`), Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-19-scandrinks-design.md` : §4.2, §6.2, §6.6, §7, §8, §9 (jalon 0), §10.

**Périmètre :** ce plan couvre uniquement le jalon 0. Le plan des jalons 1 à 3 sera écrit après la décision « GO ou plan B », car son contenu en dépend.

## Global Constraints

- L'interface, les commentaires et la documentation sont en français ; les identifiants en anglais (spec §6.2). Les textes de l'interface utilisent l'apostrophe droite `'`.
- TypeScript en mode `strict`. `npm run build` enchaîne la vérification des types et la construction de production (spec §8).
- Une seule page, **sans aucun changement d'URL** : pas de routeur, pas de `#hash`, pas de `history.pushState`. iOS redemande l'autorisation caméra à chaque changement d'URL (spec §6.2).
- Les formats lus sont exactement `ean_13`, `ean_8`, `upc_a`, `upc_e`, `itf` et `code_128`, soit EAN-13, EAN-8, UPC-A, UPC-E, ITF-14 et Code 128 (spec §6.2).
- Le `.wasm` de ZXing est servi par l'app. Aucune requête vers un CDN tiers à l'exécution (spec §6.2).
- Open Food Facts (spec §6.6) :
  - URL exacte : `https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,product_name_fr,brands,quantity` ;
  - délai maximal de 3 000 ms, sans jamais bloquer ;
  - aucun en-tête ajouté, ce qui évite une requête préalable CORS et n'envoie aucune donnée personnelle.
- Anti-doublon : un code n'est pas relu avant 2 000 ms sans l'avoir vu (spec §7).
- Les versions sont exactes (`--save-exact`) et toutes publiées depuis au moins deux semaines : react 19.3.0, react-dom 19.3.0, barcode-detector 3.2.2, zxing-wasm 3.1.3 (la version embarquée par barcode-detector 3.2.2), vite 8.3.2, @vitejs/plugin-react 6.1.1, vitest 5.0.3, typescript 7.0.2, @types/react 19.3.0, @types/react-dom 19.3.0, playwright 1.56.1.
- `.npmrc` contient `legacy-peer-deps=true`. Sans cette ligne, npm 10.9 plante (`Cannot read properties of null (reading 'edgesOut')`) en résolvant les dépendances pairs optionnelles de vitest 5. Constaté le 19/10/2026.
- `.node-version` contient `22`. Cloudflare Pages lit ce fichier, et Vite 8 exige Node 22.12 ou plus.
- Le coût reste à 0 €, sans outil de mesure d'audience (spec §6.4).
- Le travail se fait sur la branche `jalon-0`. On ne fusionne dans `main` qu'avec l'accord du porteur du projet. Chaque commit se termine par les lignes d'attribution de la session.

## Review Focus

1. **Plusieurs codes visibles dans la même image**, par exemple le code du pack et ceux des canettes à travers le film. Comportement attendu : chaque code n'apparaît qu'une fois tant qu'il reste dans le champ. Test : `deduper.test.ts`, cas « deux codes visibles ensemble » (Tâche 2). Le protocole demande aussi de vérifier que c'est bien le code du pack qui est lu (Tâche 7).
2. **Caméra interrompue** (app en arrière-plan, écran verrouillé, appel). Comportement attendu : la page revient à « Démarrer la caméra » et affiche le message `interrupted`, sans image figée. Test : un scénario de bout en bout déclenche l'événement `ended` sur la piste vidéo (Tâche 6).
3. **`.wasm` absent ou mal servi sur le site en ligne.** Comportement attendu : un message `engine` clair plutôt qu'un écran muet. Tests : `scannerErrors.test.ts` (Tâche 4), requête wasm de même origine avec `application/wasm` dans le scénario de bout en bout (Tâche 6), contrôle `curl` après le déploiement (Tâche 7).
4. **Réponses inattendues d'Open Food Facts** : nom vide ou composé d'espaces, JSON invalide, HTTP 5xx, lenteur. Comportement attendu : jamais de plantage, un résultat `not_found` ou `error` en 3 s au plus. Tests : `openFoodFacts.test.ts` (Tâche 3).
5. **Copie du rapport refusée par l'iPhone.** Comportement attendu : le rapport s'affiche dans une zone de texte qu'on peut sélectionner. Test : un scénario de bout en bout où `clipboard.writeText` échoue (Tâche 6).

---

## Structure des fichiers

```
.gitignore  .npmrc  .node-version  package.json  package-lock.json
tsconfig.json  vite.config.ts  index.html
public/manifest.webmanifest     nom, plein écran (test en mode écran d'accueil)
src/main.tsx                    point d'entrée React
src/App.tsx                     affiche la page de test (remplacée au jalon 1)
src/styles.css                  styles de base, zones sûres de l'iPhone
src/scan/formats.ts             formats lus et libellés                 [réutilisé]
src/scan/engine.ts              choix natif ou ZXing, libellés          [réutilisé]
src/scan/detector.ts            création du détecteur, wasm local       [réutilisé]
src/scan/deduper.ts             anti-doublon de 2 s                     [réutilisé]
src/scan/camera.ts              ouverture et fermeture de la caméra     [réutilisé]
src/scan/scannerErrors.ts       classement des erreurs et messages      [réutilisé]
src/scan/useBarcodeScanner.ts   hook React : caméra + boucle de lecture [réutilisé]
src/off/openFoodFacts.ts        client Open Food Facts                  [réutilisé]
src/scanTest/report.ts          libellés et rapport texte               [jetable]
src/scanTest/ScanTestPage.tsx   page de test                            [jetable]
src/scanTest/ScanTestPage.css
e2e/ean13.mjs                   image Y4M d'un EAN-13 pour la fausse caméra
e2e/scan-smoke.mjs              test de bout en bout (Chromium)
docs/jalon-0-test-scan.md       protocole de test en boutique
```

Les tests unitaires sont placés à côté du code : `src/**/<nom>.test.ts`.

---

### Task 1: Socle du projet et formats lus

**Files:**
- Create: `.gitignore`, `.npmrc`, `.node-version`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `public/manifest.webmanifest`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/scan/formats.ts`
- Test: `src/scan/formats.test.ts`

**Interfaces:**
- Produces:
  - `PRODUCT_BARCODE_FORMATS`, de type `readonly ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128']` ;
  - `type ProductBarcodeFormat = (typeof PRODUCT_BARCODE_FORMATS)[number]` ;
  - `formatLabel(format: string): string` ;
  - les scripts npm `dev`, `build`, `preview`, `test` et `typecheck` (`e2e` arrive à la Tâche 6).

- [ ] **Step 1: Créer la branche**

Run: `git -C /home/user/scandrinks checkout -b jalon-0`
Expected: `Switched to a new branch 'jalon-0'`

- [ ] **Step 2: Écrire la configuration et installer les dépendances**

- `.gitignore` : `node_modules/`, `dist/`, `*.local`, `.DS_Store`.
- `.npmrc` contient `legacy-peer-deps=true`, et `.node-version` contient `22`.
- `package.json` : `"name": "scandrinks"`, `"version": "0.0.0"`, `"private": true`, `"type": "module"`. Scripts :
  - `"dev": "vite"`
  - `"build": "tsc -p tsconfig.json && vite build"`
  - `"preview": "vite preview"`
  - `"test": "vitest run"`
  - `"typecheck": "tsc -p tsconfig.json"`
- Installation :
  - `npm install --save-exact react@19.3.0 react-dom@19.3.0 barcode-detector@3.2.2 zxing-wasm@3.1.3`
  - `npm install --save-exact -D vite@8.3.2 @vitejs/plugin-react@6.1.1 vitest@5.0.3 typescript@7.0.2 @types/react@19.3.0 @types/react-dom@19.3.0`
- `tsconfig.json` :
  - `target` `ES2022`, `lib` `["ES2022", "DOM", "DOM.Iterable"]` ;
  - `module` `ESNext`, `moduleResolution` `bundler`, `resolveJsonModule` `true` ;
  - `jsx` `react-jsx`, `strict` `true`, `noEmit` `true`, `skipLibCheck` `true` ;
  - `types` `["vite/client"]`, `include` `["src", "vite.config.ts"]`.
- `vite.config.ts` : `defineConfig` est importé de **`vitest/config`**, car avec `vite` TypeScript refuse le champ `test`. Contenu : `plugins: [react()]` et `test: { environment: 'node', include: ['src/**/*.test.ts'] }`.
- `index.html` :
  - `<html lang="fr">` ;
  - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` ;
  - `<meta name="theme-color" content="#1f6f3f">` ;
  - `<link rel="manifest" href="/manifest.webmanifest">` ;
  - `<title>ScanDrinks</title>`, `<div id="root"></div>`, et le script module `/src/main.tsx`.
- `public/manifest.webmanifest` : `{"name":"ScanDrinks","short_name":"ScanDrinks","lang":"fr","start_url":"/","display":"standalone","background_color":"#ffffff","theme_color":"#1f6f3f"}`.
- `src/main.tsx` importe `./styles.css`, puis exécute `createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)`.
- `src/App.tsx` affiche provisoirement `<h1>ScanDrinks</h1>`. Il est remplacé à la Tâche 5.
- `src/styles.css` : police système, `padding` basé sur `env(safe-area-inset-*)`, fond `#ffffff`, texte `#1a1a1a`.

- [ ] **Step 3: Écrire le test qui échoue** — `src/scan/formats.test.ts`

```ts
import { describe, expect, test } from 'vitest'
import { PRODUCT_BARCODE_FORMATS, formatLabel } from './formats'

describe('PRODUCT_BARCODE_FORMATS', () => {
  test('contient exactement les 6 formats du cahier des charges', () => {
    expect(PRODUCT_BARCODE_FORMATS).toEqual(['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'])
  })
})

describe('formatLabel', () => {
  test.each([
    ['ean_13', 'EAN-13'], ['ean_8', 'EAN-8'], ['upc_a', 'UPC-A'],
    ['upc_e', 'UPC-E'], ['itf', 'ITF-14'], ['code_128', 'Code 128'],
  ])('%s → %s', (format, label) => {
    expect(formatLabel(format)).toBe(label)
  })
  test('renvoie tel quel un format inconnu', () => {
    expect(formatLabel('qr_code')).toBe('qr_code')
  })
})
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il échoue**

Run: `npm test`
Expected: FAIL avec `Failed to resolve import "./formats"`

- [ ] **Step 5: Implémenter `src/scan/formats.ts`**

Le fichier contient `PRODUCT_BARCODE_FORMATS` (en `as const`), le type `ProductBarcodeFormat` et `formatLabel(format: string): string`. `formatLabel` s'appuie sur une table de correspondance et renvoie la valeur d'origine pour un format absent de la table.

- [ ] **Step 6: Vérifier**

Run: `npm test && npm run build`
Expected : `Tests  8 passed (8)`, puis `✓ built`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(jalon-0): socle Vite + React + TypeScript et formats lus"
```

---

### Task 2: Moteur de lecture (natif ou ZXing) et anti-doublon

**Files:**
- Create: `src/scan/engine.ts`, `src/scan/detector.ts`, `src/scan/deduper.ts`
- Test: `src/scan/engine.test.ts`, `src/scan/deduper.test.ts`

**Interfaces:**
- Consumes: `PRODUCT_BARCODE_FORMATS` (Tâche 1).
- Produces:
  - `type ScanEngine = 'native' | 'zxing'` ; `chooseEngine(nativeFormats: readonly string[] | null): ScanEngine` ; `engineLabel(engine: ScanEngine): string`.
  - `interface DetectedCode { rawValue: string; format: string }` ; `interface CodeDetector { detect(source: HTMLVideoElement): Promise<DetectedCode[]> }`.
  - `createBarcodeDetector(): Promise<{ detector: CodeDetector; engine: ScanEngine }>`. Si le `.wasm` ne se charge pas, la promesse est rejetée avec une erreur dont `name === 'ScannerEngineError'`.
  - `SCAN_COOLDOWN_MS = 2000` ; `createScanDeduper(cooldownMs?: number, now?: () => number): (code: string) => boolean`.

- [ ] **Step 1: Écrire les tests qui échouent**

`src/scan/engine.test.ts` :

```ts
import { describe, expect, test } from 'vitest'
import { ZXING_WASM_VERSION } from 'barcode-detector/ponyfill'
import pkg from '../../package.json'
import { chooseEngine, engineLabel } from './engine'

const ALL = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128']

describe('chooseEngine', () => {
  test("ZXing quand le navigateur n'a pas de détecteur natif (Safari)", () => {
    expect(chooseEngine(null)).toBe('zxing')
  })
  test('natif quand les 6 formats sont pris en charge', () => {
    expect(chooseEngine([...ALL, 'qr_code'])).toBe('native')
  })
  test('ZXing si un seul format manque', () => {
    expect(chooseEngine(ALL.filter((f) => f !== 'itf'))).toBe('zxing')
  })
})

describe('engineLabel', () => {
  test('libellés affichés', () => {
    expect(engineLabel('zxing')).toBe('ZXing (WebAssembly)')
    expect(engineLabel('native')).toBe('natif (navigateur)')
  })
})

test('zxing-wasm installé = version embarquée par barcode-detector', () => {
  expect(pkg.dependencies['zxing-wasm']).toBe(ZXING_WASM_VERSION)
})
```

`src/scan/deduper.test.ts` :

```ts
import { describe, expect, test } from 'vitest'
import { SCAN_COOLDOWN_MS, createScanDeduper } from './deduper'

function clock() {
  let t = 0
  return { now: () => t, set: (v: number) => { t = v } }
}

describe('createScanDeduper', () => {
  test('délai par défaut de 2 000 ms', () => {
    expect(SCAN_COOLDOWN_MS).toBe(2000)
  })
  test("accepte la première apparition d'un code", () => {
    const c = clock()
    expect(createScanDeduper(2000, c.now)('5449000000996')).toBe(true)
  })
  test("ignore le même code tant qu'il reste visible", () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    for (let t = 500; t <= 10_000; t += 500) {
      c.set(t)
      expect(accept('A')).toBe(false)
    }
  })
  test('relit le code après 2 000 ms sans le voir (borne incluse)', () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    c.set(1999); expect(accept('A')).toBe(false)
    c.set(3998); expect(accept('A')).toBe(false)
    c.set(5998); expect(accept('A')).toBe(true)
  })
  test("deux codes visibles ensemble ne sont acceptés qu'une fois chacun", () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    expect([accept('PACK'), accept('CANETTE')]).toEqual([true, true])
    for (let t = 150; t <= 3000; t += 150) {
      c.set(t)
      expect([accept('PACK'), accept('CANETTE')]).toEqual([false, false])
    }
  })
  test('un code ne bloque pas les autres', () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    c.set(100); expect(accept('B')).toBe(true)
    c.set(200); expect(accept('A')).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL, imports `./engine` et `./deduper` introuvables.

- [ ] **Step 3: Implémenter `src/scan/engine.ts` et `src/scan/deduper.ts`**

- `chooseEngine` renvoie `'native'` seulement si tous les `PRODUCT_BARCODE_FORMATS` sont dans `nativeFormats`.
- `createScanDeduper` garde une `Map<string, number>` de la dernière apparition de **chaque** code, mise à jour à chaque appel. Un code est accepté s'il est absent de la table, ou si `now() - dernièreApparition >= cooldownMs`. Les entrées plus vieilles que `cooldownMs` sont purgées à chaque appel. Par défaut, `cooldownMs = SCAN_COOLDOWN_MS` et `now = Date.now`.

- [ ] **Step 4: Implémenter `src/scan/detector.ts`**

- **Choix du moteur :** lire `globalThis.BarcodeDetector`. S'il existe, `nativeFormats = await BarcodeDetector.getSupportedFormats()`, ou `null` en cas d'erreur. On passe ensuite par `chooseEngine`.
- **Moteur natif :** `new BarcodeDetector({ formats: [...PRODUCT_BARCODE_FORMATS] })`.
- **Moteur ZXing :**
  - `import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'` ;
  - `await prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path) }, fireImmediately: true })`, importé de `barcode-detector/ponyfill`. En cas d'échec, lever une `Error` avec `name = 'ScannerEngineError'` ;
  - puis `new BarcodeDetector({ formats: [...PRODUCT_BARCODE_FORMATS] })`, importé de `barcode-detector/ponyfill`.
- **Mémorisation :** la promesse est gardée au niveau du module, pour ne charger le wasm qu'une fois par page. Si elle échoue, on l'oublie, pour qu'un nouvel essai reste possible.

- [ ] **Step 5: Vérifier**

Run: `npm test && npm run typecheck`
Expected : `Tests  19 passed (19)` et aucune erreur TypeScript.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(jalon-0): moteur de lecture natif ou ZXing (wasm local) et anti-doublon"
```

---

### Task 3: Client Open Food Facts

**Files:**
- Create: `src/off/openFoodFacts.ts`
- Test: `src/off/openFoodFacts.test.ts`

**Interfaces:**
- Produces:

```ts
export type OffLookupResult =
  | { status: 'found'; name: string; quantity: string | null; suggestedName: string }
  | { status: 'not_found' }
  | { status: 'error' }
export const OFF_TIMEOUT_MS = 3000
export function offProductUrl(code: string): string
export function formatSuggestedName(name: string, quantity: string | null): string
export function lookupProduct(code: string, options?: { timeoutMs?: number; fetchImpl?: typeof fetch }): Promise<OffLookupResult>
```

- [ ] **Step 1: Écrire les tests qui échouent** — `src/off/openFoodFacts.test.ts`

```ts
import { afterEach, describe, expect, test, vi } from 'vitest'
import { OFF_TIMEOUT_MS, formatSuggestedName, lookupProduct, offProductUrl } from './openFoodFacts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchReturning = (res: Response) => vi.fn<typeof fetch>(() => Promise.resolve(res))
const coca = { product_name_fr: 'Coca-Cola', product_name: 'Coca-Cola Original', quantity: '330 ml', brands: 'COCA-COLA SERVICES SA/NV' }

afterEach(() => { vi.useRealTimers() })

describe('offProductUrl', () => {
  test('URL exacte du cahier des charges', () => {
    expect(offProductUrl('5449000000996')).toBe(
      'https://world.openfoodfacts.org/api/v2/product/5449000000996.json?fields=product_name,product_name_fr,brands,quantity')
  })
})

describe('lookupProduct', () => {
  test('produit trouvé : nom français + contenance', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: coca }))
    expect(await lookupProduct('5449000000996', { fetchImpl })).toEqual(
      { status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' })
    expect(fetchImpl.mock.calls[0][0]).toBe(offProductUrl('5449000000996'))
  })
  test('sans nom français, prend product_name', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '', product_name: 'Coca-Cola Zero Sugar', quantity: '330 ml' } }))
    expect(await lookupProduct('5449000131805', { fetchImpl })).toMatchObject({ status: 'found', name: 'Coca-Cola Zero Sugar' })
  })
  test('supprime les espaces autour du nom et de la contenance', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '  Cristaline  ', quantity: ' 1500 ml ' } }))
    expect(await lookupProduct('3274080005003', { fetchImpl })).toEqual(
      { status: 'found', name: 'Cristaline', quantity: '1500 ml', suggestedName: 'Cristaline 1500 ml' })
  })
  test('HTTP 404 (produit inconnu) → not_found', async () => {
    const fetchImpl = fetchReturning(json(404, { status: 0, status_verbose: 'product not found' }))
    expect(await lookupProduct('3000000000017', { fetchImpl })).toEqual({ status: 'not_found' })
  })
  test("noms vides ou composés d'espaces → not_found", async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '   ', product_name: '' } }))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'not_found' })
  })
  test('HTTP 200 avec status 0 → not_found', async () => {
    expect(await lookupProduct('1', { fetchImpl: fetchReturning(json(200, { status: 0 })) })).toEqual({ status: 'not_found' })
  })
  test('HTTP 503 → error', async () => {
    expect(await lookupProduct('1', { fetchImpl: fetchReturning(json(503, {})) })).toEqual({ status: 'error' })
  })
  test('JSON invalide → error', async () => {
    const fetchImpl = fetchReturning(new Response('<html>maintenance</html>', { status: 200 }))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'error' })
  })
  test('réseau coupé → error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Load failed')))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'error' })
  })
  test('abandon au bout de 3 000 ms exactement → error', async () => {
    vi.useFakeTimers()
    expect(OFF_TIMEOUT_MS).toBe(3000)
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    let settled = false
    const pending = lookupProduct('1', { fetchImpl }).finally(() => { settled = true })
    await vi.advanceTimersByTimeAsync(2999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ status: 'error' })
  })
})

describe('formatSuggestedName', () => {
  test.each([
    ['Coca-Cola', '330 ml', 'Coca-Cola 330 ml'],
    ['Coca-Cola 330 ml', '330 ml', 'Coca-Cola 330 ml'],
    ['Coca-Cola', null, 'Coca-Cola'],
  ])('%s + %s → %s', (name, quantity, expected) => {
    expect(formatSuggestedName(name, quantity)).toBe(expected)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/off`
Expected: FAIL, import `./openFoodFacts` introuvable.

- [ ] **Step 3: Implémenter `src/off/openFoodFacts.ts`**

- Par défaut, `fetchImpl` vaut `globalThis.fetch.bind(globalThis)`. Le `bind` évite l'erreur « Illegal invocation » de certains navigateurs.
- Un `AbortController` est abandonné au bout de `timeoutMs`, qui vaut `OFF_TIMEOUT_MS` par défaut. Le minuteur est nettoyé dans un `finally`. La requête part sans en-tête ajouté.
- Traitement de la réponse :
  - HTTP 404 → `not_found` ;
  - autre réponse non `ok` → `error` ;
  - JSON illisible → `error` ;
  - sinon, `name = product_name_fr.trim() || product_name.trim()` lorsque `status === 1`. Si le nom est vide → `not_found` ;
  - `quantity` vaut `quantity.trim()`, ou `null` si la chaîne est vide.
- Toute exception, abandon compris → `error`.
- `formatSuggestedName` renvoie `name` si `quantity` est nul ou si `name` contient déjà `quantity` (sans tenir compte de la casse). Sinon, il renvoie `` `${name} ${quantity}` ``.

- [ ] **Step 4: Vérifier**

Run: `npm test`
Expected: `Tests  33 passed (33)`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(jalon-0): client Open Food Facts (délai 3 s, jamais bloquant)"
```

---

### Task 4: Caméra, erreurs et hook de scan

**Files:**
- Create: `src/scan/camera.ts`, `src/scan/scannerErrors.ts`, `src/scan/useBarcodeScanner.ts`
- Test: `src/scan/scannerErrors.test.ts`

**Interfaces:**
- Consumes: `createBarcodeDetector`, `CodeDetector`, `ScanEngine`, `createScanDeduper` (Tâche 2).
- Produces:
  - `CAMERA_CONSTRAINTS: MediaStreamConstraints = { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }`.
  - `startCamera(video: HTMLVideoElement): Promise<{ stream: MediaStream; width: number; height: number }>`. Rejette avec `name === 'InsecureContextError'` si `window.isSecureContext` est faux ou si `navigator.mediaDevices?.getUserMedia` manque.
  - `stopCamera(stream: MediaStream | null): void`.
  - `type ScannerErrorKind = 'denied' | 'unavailable' | 'insecure' | 'engine' | 'interrupted' | 'unknown'`.
  - `classifyScannerError(error: unknown): ScannerErrorKind` ; `scannerErrorMessage(kind: ScannerErrorKind): string`.
  - `useBarcodeScanner(options: { videoRef: RefObject<HTMLVideoElement | null>; onDetect: (code: string, format: string) => void; intervalMs?: number }): { status: 'idle' | 'starting' | 'running' | 'error'; errorKind: ScannerErrorKind | null; engine: ScanEngine | null; resolution: { width: number; height: number } | null; lastDecodeMs: number | null; start: () => Promise<void>; stop: () => void }`.

- [ ] **Step 1: Écrire le test qui échoue** — `src/scan/scannerErrors.test.ts`

```ts
import { describe, expect, test } from 'vitest'
import { classifyScannerError, scannerErrorMessage } from './scannerErrors'

const named = (name: string) => Object.assign(new Error(name), { name })

describe('classifyScannerError', () => {
  test.each([
    ['NotAllowedError', 'denied'], ['SecurityError', 'denied'],
    ['NotFoundError', 'unavailable'], ['NotReadableError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'], ['AbortError', 'unavailable'],
    ['InsecureContextError', 'insecure'], ['ScannerEngineError', 'engine'],
    ['TypeError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(classifyScannerError(named(name))).toBe(kind)
  })
  test("une valeur qui n'est pas une erreur → unknown", () => {
    expect(classifyScannerError('oups')).toBe('unknown')
  })
  test('un objet { name } (DOMException) est classé', () => {
    expect(classifyScannerError({ name: 'NotAllowedError' })).toBe('denied')
  })
})

describe('scannerErrorMessage', () => {
  test.each([
    ['denied', "L'accès à la caméra a été refusé. Sur iPhone : Réglages › Apps › Safari › Caméra › Autoriser, puis recharge la page."],
    ['unavailable', 'Aucune caméra disponible. Elle est peut-être utilisée par une autre app : ferme-la puis réessaie.'],
    ['insecure', 'La caméra ne fonctionne que sur une adresse sécurisée (https).'],
    ['engine', "Le lecteur de codes-barres n'a pas pu se charger. Vérifie la connexion puis réessaie."],
    ['interrupted', "La caméra s'est arrêtée (app en arrière-plan ou écran verrouillé). Touche « Démarrer la caméra » pour reprendre."],
    ['unknown', 'Impossible de démarrer la caméra. Réessaie.'],
  ] as const)('%s', (kind, message) => {
    expect(scannerErrorMessage(kind)).toBe(message)
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run src/scan/scannerErrors.test.ts`
Expected: FAIL, import `./scannerErrors` introuvable.

- [ ] **Step 3: Implémenter `src/scan/scannerErrors.ts`**

Le classement se fait sur la propriété `name` de toute valeur objet qui en possède une. La correspondance est celle du test.

- [ ] **Step 4: Implémenter `src/scan/camera.ts`**

`startCamera` fait dans l'ordre :
1. `getUserMedia(CAMERA_CONSTRAINTS)` ;
2. `video.srcObject = stream`, puis `await video.play()` ;
3. lecture de la largeur et de la hauteur dans `getSettings()` de la piste vidéo, avec repli sur `video.videoWidth` et `video.videoHeight`.

`stopCamera` arrête toutes les pistes.

- [ ] **Step 5: Implémenter `src/scan/useBarcodeScanner.ts`**

- **`start()`** : ne fait rien si la lecture tourne déjà. Sinon, dans l'ordre :
  1. `status 'starting'` ;
  2. `await createBarcodeDetector()` puis `await startCamera(video)` ;
  3. écoute de l'événement `ended` de la piste vidéo, qui déclenche `halt('interrupted')` ;
  4. création d'un `createScanDeduper()` neuf ;
  5. `status 'running'` et lancement de la boucle.

  En cas d'échec : `stopCamera`, `status 'error'`, `errorKind = classifyScannerError(e)`.
- **Boucle** (`setTimeout` de `intervalMs`, 150 ms par défaut) :
  - si `video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA` : `detect(video)`, avec la durée mesurée par `performance.now()`. Chaque `rawValue` accepté par l'anti-doublon est transmis à `onDetect`, qui est lu dans une ref pour toujours utiliser le dernier rappel ;
  - `lastDecodeMs` est mis à jour au plus une fois par seconde ;
  - une exception dans `detect` déclenche `halt('engine')`.
- **`halt(kind)`** : arrête la boucle et la caméra, puis `status 'error'` et `errorKind = kind`.
- **`stop()`** : arrête la boucle et la caméra, puis `status 'idle'` et `errorKind = null`.
- **`visibilitychange`** : si la page passe en `hidden` pendant la lecture → `halt('interrupted')`. Au démontage → `stop()`.
- **URL** : jamais modifiée.

- [ ] **Step 6: Vérifier**

Run: `npm test && npm run typecheck`
Expected : `Tests  50 passed (50)` et aucune erreur TypeScript.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(jalon-0): caméra arrière, erreurs expliquées et hook de lecture"
```

---

### Task 5: Page de test et rapport

**Files:**
- Create: `src/scanTest/report.ts`, `src/scanTest/ScanTestPage.tsx`, `src/scanTest/ScanTestPage.css`
- Modify: `src/App.tsx`, qui rend `<ScanTestPage />`
- Test: `src/scanTest/report.test.ts`

**Interfaces:**
- Consumes: `useBarcodeScanner`, `scannerErrorMessage` (Tâche 4) ; `lookupProduct`, `OffLookupResult` (Tâche 3) ; `formatLabel` (Tâche 1) ; `engineLabel`, `ScanEngine` (Tâche 2).
- Produces (jetable) :
  - `interface ScanEntry { id: number; code: string; format: string; at: Date; lookup: OffLookupResult | 'pending' }` ;
  - `interface ReportMeta { now: Date; engine: ScanEngine | null; width: number | null; height: number | null; decodeMs: number | null; standalone: boolean; userAgent: string }` ;
  - `lookupLabel(lookup: OffLookupResult | 'pending'): string` ;
  - `codesCountLabel(count: number): string` ;
  - `formatScanReport(entries: readonly ScanEntry[], meta: ReportMeta): string`. Les `entries` sont reçues dans l'ordre d'affichage, la plus récente d'abord. Le rapport les liste dans l'ordre chronologique.
  - Textes exacts dont dépend la Tâche 6 :
    - les boutons « Démarrer la caméra », « Arrêter la caméra », « Démarrage… », « Copier le rapport » et « Effacer la liste » ;
    - la liste `<ol aria-label="Codes lus">` ;
    - la zone de secours `<textarea aria-label="Rapport à copier" readOnly>` ;
    - la ligne d'état `role="status"`, qui commence par `Lecteur : ` ;
    - les messages d'erreur, affichés en `role="alert"`.

- [ ] **Step 1: Écrire les tests qui échouent** — `src/scanTest/report.test.ts`

```ts
import { describe, expect, test } from 'vitest'
import { codesCountLabel, formatScanReport, lookupLabel, type ScanEntry } from './report'

describe('lookupLabel', () => {
  test.each([
    ['pending', 'recherche…'],
    [{ status: 'not_found' }, "inconnu d'Open Food Facts"],
    [{ status: 'error' }, 'Open Food Facts injoignable'],
    [{ status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' }, 'Coca-Cola 330 ml'],
  ] as const)('%o', (lookup, label) => {
    expect(lookupLabel(lookup)).toBe(label)
  })
})

describe('codesCountLabel', () => {
  test.each([[0, '0 code lu'], [1, '1 code lu'], [2, '2 codes lus']])('%i → %s', (n, label) => {
    expect(codesCountLabel(n)).toBe(label)
  })
})

describe('formatScanReport', () => {
  const entries: ScanEntry[] = [
    { id: 2, code: '15449000000993', format: 'itf', at: new Date('2026-10-19T12:33:10Z'), lookup: { status: 'not_found' } },
    { id: 1, code: '5449000000996', format: 'ean_13', at: new Date('2026-10-19T12:32:05Z'),
      lookup: { status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' } },
  ]
  test('rapport complet : ordre chronologique, heure de Paris', () => {
    expect(formatScanReport(entries, { now: new Date('2026-10-19T12:40:00Z'), engine: 'zxing', width: 1280, height: 720,
      decodeMs: 48, standalone: false, userAgent: 'TestAgent/1.0' })).toBe([
      'ScanDrinks — test du scan (jalon 0)',
      'Date : 19/10/2026 14:40',
      'Lecteur : ZXing (WebAssembly) — caméra 1280×720 — analyse 48 ms/image',
      'Mode : Safari',
      'Appareil : TestAgent/1.0',
      'Codes lus : 2',
      '1. 14:32:05 — 5449000000996 (EAN-13) — Coca-Cola 330 ml',
      "2. 14:33:10 — 15449000000993 (ITF-14) — inconnu d'Open Food Facts",
    ].join('\n'))
  })
  test("avant démarrage, en mode écran d'accueil", () => {
    expect(formatScanReport([], { now: new Date('2026-10-19T12:40:00Z'), engine: null, width: null, height: null,
      decodeMs: null, standalone: true, userAgent: 'TestAgent/1.0' })).toBe([
      'ScanDrinks — test du scan (jalon 0)',
      'Date : 19/10/2026 14:40',
      'Lecteur : non démarré',
      "Mode : écran d'accueil",
      'Appareil : TestAgent/1.0',
      'Codes lus : 0',
    ].join('\n'))
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/scanTest`
Expected: FAIL, import `./report` introuvable.

- [ ] **Step 3: Implémenter `src/scanTest/report.ts`**

- Les dates et heures sont assemblées à partir de `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', … }).formatToParts()`, avec les parties `day`, `month`, `year`, `hour`, `minute` et `second`. On ne se fie pas aux séparateurs propres à chaque moteur.
- La partie « caméra L×H » n'apparaît que si `width` et `height` sont renseignés, et la partie « analyse N ms/image » que si `decodeMs` n'est pas nul.

- [ ] **Step 4: Implémenter `ScanTestPage.tsx` et `ScanTestPage.css`, puis brancher `App.tsx`**

**Contenu de la page, de haut en bas :**
1. `<h1>ScanDrinks</h1>` et le sous-titre « Test du scan (jalon 0) ».
2. La zone vidéo `<video playsInline muted autoPlay aria-label="Image de la caméra">`, avec une bande de visée au centre. Elle s'entoure de vert pendant 300 ms à chaque code lu.
3. La ligne d'état : `Lecteur : {engineLabel} · caméra {L}×{H} · analyse {n} ms/image` pendant la lecture, sinon `Lecteur : non démarré`.
4. Le bouton principal : « Démarrer la caméra », « Démarrage… » (désactivé) ou « Arrêter la caméra ».
5. Le conseil « Tiens le téléphone à 20-30 cm du code-barres, avec un bon éclairage. »
6. Le message d'erreur s'il y en a un.
7. `codesCountLabel`.
8. La liste : un `<li>` par lecture, le plus récent en haut, au format `code · formatLabel · hh:mm:ss`, avec en dessous `lookupLabel`.
9. Les boutons « Copier le rapport » et « Effacer la liste ».

**Comportement :**
- Les résultats d'Open Food Facts sont mis en cache dans une `Map` par code. Chaque nouvelle lecture d'un code inconnu de ce cache est d'abord `'pending'`. Quand la réponse arrive, toutes les lignes `'pending'` de ce code sont mises à jour.
- **Copier le rapport :**
  - si `navigator.clipboard.writeText` réussit → afficher « Rapport copié. Colle-le dans la conversation avec Claude. » ;
  - si l'appel échoue → afficher « Copie automatique impossible : sélectionne le texte ci-dessous et copie-le. » et la `textarea` du rapport.
- **Mode écran d'accueil :** `matchMedia('(display-mode: standalone)').matches`, ou `navigator.standalone === true`.

- [ ] **Step 5: Vérifier**

Run: `npm test && npm run build && ls dist/assets/ | grep -E '^zxing_reader-.*\.wasm$'`
Expected : `Tests  59 passed (59)`, puis `✓ built`, puis une ligne `zxing_reader-<hash>.wasm`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(jalon-0): page de test du scan et rapport à copier"
```

---

### Task 6: Test de bout en bout avec caméra simulée

**Files:**
- Create: `e2e/ean13.mjs`, `e2e/scan-smoke.mjs`
- Modify: `package.json` : script `"e2e": "npm run build && node e2e/scan-smoke.mjs"` et devDependency `playwright@1.56.1`

**Interfaces:**
- Consumes : les textes exacts de la Tâche 5, et `vite preview` sur le port 4173.
- Produces :
  - `ean13Modules(code: string): string`, qui renvoie 95 caractères `0` ou `1` ;
  - `ean13Y4m(code: string, width?: number, height?: number, moduleWidth?: number): Buffer`.

- [ ] **Step 1: Installer Playwright**

Run: `npm install --save-exact -D playwright@1.56.1`
Expected : installation sans téléchargement de navigateur. Grâce à `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`, la version 1.56.1 utilise `chromium-1194`, déjà présent dans `/opt/pw-browsers`.

- [ ] **Step 2: Écrire `e2e/ean13.mjs`**

Encodage EAN-13 (données de la norme GS1) :

```js
const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
const R = L.map((c) => [...c].map((b) => (b === '0' ? '1' : '0')).join(''))
const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLG','LGLGGL','LGLGLG','LGGLGL']
// modules = '101' + chiffres 2 à 7 codés L ou G selon PARITY[premier chiffre] + '01010' + chiffres 8 à 13 codés R + '101'
```

`ean13Y4m` produit **une seule trame** YUV 4:2:0 :
- en-tête exact `YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\nFRAME\n` ;
- luminance 235 pour le fond et 16 pour les barres, avec des modules de `moduleWidth` pixels ;
- barres centrées horizontalement, de 30 % à 70 % de la hauteur ;
- plans de chrominance à 128.

Valeurs par défaut : 1280, 720 et 6.

Run: `node -e "import('./e2e/ean13.mjs').then((m) => { const s = m.ean13Modules('5449000000996'); console.log(s.length, s.slice(0, 3), s.slice(45, 50), s.slice(-3)) })"`
Expected: `95 101 01010 101`

- [ ] **Step 3: Écrire `e2e/scan-smoke.mjs`**

**Mise en place :**
- écrire `ean13Y4m('5449000000996')` dans un dossier temporaire (`mkdtemp`) ;
- lancer `npx vite preview --port 4173 --strictPort`, puis attendre une réponse de `http://localhost:4173/` (essai toutes les 250 ms, 15 s au maximum) ;
- lancer `chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`] })` ;
- arrêter le serveur dans un `finally` ;
- vérifier avec `node:assert/strict` et terminer par `console.log('E2E OK')`.

**Scénario A, lecture complète :**

```js
await context.addInitScript(() => {
  navigator.clipboard.writeText = async (text) => { window.__copied = text }
})
await page.route('https://world.openfoodfacts.org/**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
  body: JSON.stringify({ status: 1, product: { product_name_fr: 'Coca-Cola', product_name: 'Coca-Cola Original', quantity: '330 ml' } }) }))
// enregistrer toutes les requêtes (page.on('request')) et les réponses wasm (page.on('response'))
await page.goto('http://localhost:4173/'); const firstUrl = page.url()
await page.getByRole('button', { name: 'Démarrer la caméra' }).click()
const items = page.getByRole('list', { name: 'Codes lus' }).getByRole('listitem').filter({ hasText: '5449000000996' })
await items.first().waitFor({ timeout: 20_000 })
await page.getByText('Coca-Cola 330 ml').waitFor({ timeout: 5_000 })
assert.match(await items.first().innerText(), /EAN-13/)
assert.match(await page.getByRole('status').first().innerText(), /ZXing \(WebAssembly\)/)
await page.waitForTimeout(3_000)
assert.equal(await items.count(), 1)                         // le même pack reste dans le champ : une seule ligne
assert.ok(wasmResponses.some((r) => r.url.startsWith('http://localhost:4173/assets/zxing_reader-') && r.status === 200
  && r.contentType.startsWith('application/wasm')))
assert.ok(!requests.some((u) => /(^https?:\/\/)(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\//.test(u)))
await page.getByRole('button', { name: 'Copier le rapport' }).click()
const copied = await page.evaluate(() => window.__copied)
assert.ok(copied.startsWith('ScanDrinks — test du scan (jalon 0)'))
assert.ok(copied.includes('5449000000996 (EAN-13) — Coca-Cola 330 ml'))
await page.evaluate(() => document.querySelector('video').srcObject.getVideoTracks()[0].dispatchEvent(new Event('ended')))
await page.getByRole('alert').filter({ hasText: "La caméra s'est arrêtée" }).waitFor({ timeout: 5_000 })
await page.getByRole('button', { name: 'Démarrer la caméra' }).waitFor()
assert.equal(page.url(), firstUrl)                           // aucune modification d'URL
```

**Scénario B, copie refusée** (nouveau contexte) :

```js
await context.addInitScript(() => {
  navigator.clipboard.writeText = () => Promise.reject(new DOMException('refusé', 'NotAllowedError'))
})
await page.goto('http://localhost:4173/')
await page.getByRole('button', { name: 'Copier le rapport' }).click()
const box = page.getByRole('textbox', { name: 'Rapport à copier' })
await box.waitFor({ timeout: 5_000 })
assert.ok((await box.inputValue()).startsWith('ScanDrinks — test du scan (jalon 0)'))
```

- [ ] **Step 4: Lancer le test de bout en bout**

Run: `npm run e2e`
Expected: dernière ligne `E2E OK`, code de sortie 0.

- [ ] **Step 5: Vérifier que le test sait échouer**

Run: `mv dist/assets/zxing_reader-*.wasm dist/ && node e2e/scan-smoke.mjs; echo "code=$?"`
Expected : échec du scénario A, puis `code=1`. Ce test a été vérifié le 19/10/2026 : sans le fichier, `vite preview` renvoie `index.html` en `text/html`, ZXing ne se charge pas et l'attente de `5449000000996` dépasse son délai. Ensuite, `npm run build` remet le fichier en place.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(jalon-0): test de bout en bout avec fausse caméra (EAN-13 réel)"
```

---

### Task 7: Documentation, mise en ligne et protocole de test

**Files:**
- Create: `docs/jalon-0-test-scan.md`
- Modify: `README.md`
- Create si nécessaire (Step 7) : `public/_headers`

**Interfaces:**
- Consumes: l'app construite (Tâches 1 à 6).
- Produces: l'adresse publique `https://scandrinks.pages.dev` (ou celle que donne Cloudflare) et le protocole de test.

- [ ] **Step 1: Écrire `docs/jalon-0-test-scan.md`**

Ce document est destiné au porteur du projet, en français simple.

- **Matériel :**
  - l'iPhone chargé, dans la réserve, avec l'éclairage habituel ;
  - 5 à 10 packs différents, sous film plastique et en carton ;
  - 2 ou 3 canettes ou bouteilles seules ;
  - des produits importés s'il y en a.
- **Étapes :**
  1. Ouvrir le lien dans Safari, toucher « Démarrer la caméra » et autoriser l'accès.
  2. Pour chaque pack, viser **le code-barres du pack** à 20-30 cm. Noter si la lecture prend 3 secondes ou moins. Vérifier que les chiffres affichés sont bien ceux imprimés sous le code du pack, et non ceux d'une canette vue à travers le film.
  3. Refaire l'essai avec quelques unités seules.
  4. Faire Partager → « Sur l'écran d'accueil », ouvrir l'app depuis l'icône et démarrer. Noter si l'autorisation caméra est redemandée. Fermer l'app, la rouvrir, et noter de nouveau.
  5. Toucher « Copier le rapport », puis coller le rapport dans la conversation avec Claude, avec les remarques.
- **Règle de décision :**
  - **GO** si au moins 8 packs sur 10 sont lus en 3 s ou moins, sans manipulation compliquée, et que c'est bien le code du pack qui est lu ;
  - sinon, une série de réglages (résolution 1920×1080, zone de lecture centrale), suivie d'un nouveau test ;
  - si c'est encore insuffisant, **plan B** : une app native, avec un compte Apple à 99 €/an.

- [ ] **Step 2: Mettre à jour `README.md`**

Ajouter :
- une section « Développement » : `npm install`, `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run e2e`. Préciser que `npm run e2e` demande Chromium, déjà présent dans l'environnement Claude Code ;
- une section « Jalon 0 », qui renvoie vers le protocole.

- [ ] **Step 3: Vérification complète**

Run: `npm test && npm run e2e`
Expected : `Tests  59 passed (59)`, puis `E2E OK`.

- [ ] **Step 4: Commit et envoi de la branche**

```bash
git add -A
git commit -m "docs(jalon-0): protocole de test en boutique et mode d'emploi"
git push -u origin jalon-0
```

- [ ] **Step 5: Fusion dans `main`, avec l'accord du porteur du projet**

Run: `git fetch origin main && git checkout main && git merge --ff-only jalon-0 && git push origin main`
Expected : `Fast-forward`, puis l'envoi de `main` accepté.

- [ ] **Step 6: Guider le porteur du projet pour relier Cloudflare Pages**

1. Sur dash.cloudflare.com, créer un compte gratuit.
2. Aller dans Workers & Pages → Créer → Pages → « Importer un dépôt Git existant » → GitHub, et autoriser l'accès au dépôt `scandrinks`.
3. Régler le projet :
   - nom : `scandrinks` ;
   - branche de production : `main` ;
   - préréglage : « React (Vite) » ou aucun ;
   - commande de build : `npm run build` ;
   - dossier de sortie : `dist` ;
   - aucune variable d'environnement.
4. Cliquer sur « Enregistrer et déployer », puis attendre que le déploiement passe au vert.

- [ ] **Step 7: Contrôler le site en ligne**

Run :
```bash
BASE=https://scandrinks.pages.dev   # adresse donnée par Cloudflare
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/"
JS=$(curl -sS "$BASE/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
WASM=$(curl -sS "$BASE/$JS" | grep -o 'assets/zxing_reader-[A-Za-z0-9_-]*\.wasm' | head -1)
curl -sSI "$BASE/$WASM" | grep -iE '^(HTTP|content-type)'
```

Expected : `200`, puis `HTTP/2 200` et `content-type: application/wasm`.

Si le `content-type` est différent, créer `public/_headers` avec les deux lignes ci-dessous, puis faire un commit, envoyer sur `main` et contrôler de nouveau :

```
/assets/zxing_reader-*
  Content-Type: application/wasm
```

- [ ] **Step 8: Envoyer l'adresse et le protocole au porteur du projet**

Envoyer `docs/jalon-0-test-scan.md` et l'adresse du site, puis attendre le rapport de test. La décision (GO ou plan B) est inscrite dans le journal des décisions du cahier des charges, puis on écrit le plan des jalons 1 à 3.

---

## Constats utiles pour le jalon 1 (hors périmètre)

- Open Food Facts accepte un UPC-A à 12 chiffres et renvoie le code sur 13 chiffres (`049000028911` → `0049000028911`). Dans la table `barcodes`, il faudra stocker les UPC-A sous leur forme EAN-13 (avec un `0` devant). Sinon, un même produit lu par deux moteurs différents risque d'apparaître en double.
- Le `.wasm` pèse 1,1 Mo, soit 464 Ko compressé. Le service worker du jalon 1 devra le mettre en cache pour que l'app s'ouvre vite.
- La lecture d'une trame 1280×720 prend environ 130 ms dans Chromium sans écran, pour la première lecture.
