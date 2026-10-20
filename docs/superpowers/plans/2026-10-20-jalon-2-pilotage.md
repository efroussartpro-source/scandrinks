# ScanDrinks — Jalon 2 (le pilotage) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le pilotage du stock :
- la liste « À racheter », en packs Metro, avec un badge sur son onglet ;
- la liste du stock et la fiche produit (modifier, codes, corriger le stock, archiver) ;
- le mode Inventaire de l'écran Scanner et la réactivation d'un produit archivé.

Le porteur du projet doit obtenir sur iPhone une liste d'achat cohérente après quelques scans.

**Architecture :**
- L'app reste sur une seule page. Une barre d'onglets en bas (Scanner, À racheter, Stock) remplace l'écran unique.
- L'écran Scanner reste monté quand on change d'onglet ou qu'on ouvre les Réglages : la caméra s'arrête puis repart, mais la fiche en cours et son identifiant sont gardés (point m9 du jalon 1).
- Un catalogue unique (les produits et leur stock) est chargé par la coquille. Il est relu à l'ouverture d'un onglet, au retour dans l'app et après chaque action du téléphone. Il alimente le badge, À racheter et Stock.
- Les règles (RG-4 à RG-6, tri, lignes de mouvements) sont des fonctions pures testées. Les nouvelles écritures passent par des fonctions SQL idempotentes, dans une seconde migration compatible avec l'app du jalon 1 en service.

**Tech Stack :** celle du jalon 1, sans nouvelle dépendance.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, sections :
- §4.2 : mode Inventaire, produit archivé, saisie manuelle en Inventaire ;
- §4.3 et §4.4 ;
- §5 : RG-4, RG-5, RG-6, RG-8, RG-10 et RG-11 ;
- §6.3 (`record_inventory`), §7, §8 ;
- §9, pour le jalon 2.

Les points reportés par la relecture finale du jalon 1 sont dans la section « Bilan » de `docs/superpowers/plans/2026-10-19-jalon-1-coeur.md`.

**Périmètre :**
- **Points reportés traités ici :** m5, m6, m8, m9, m10, m11, m12, m15 et m16 ; tri français des noms ; variantes de casse des prénoms.
- **Hors jalon 2, pour le jalon 3 :** l'onglet Historique, le changement de mot de passe, le service worker, les icônes, la page blanche sans configuration (m13) et les finitions.
- **Hors jalon 2, pour le jalon 4 :** le conseil anti-doublon du guide (m14) et le message « Base injoignable » qui renvoie au guide.
- **Reporté sans jalon fixé :** le test e2e de la capture d'une canette avec une vidéo à deux codes.
- **Pas de mise à jour en direct entre téléphones** (Realtime). La relecture du catalogue suffit : moins de 30 produits, et la fiche du Scanner lit toujours le stock du moment.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Apostrophe droite `'` dans les textes de l'interface.
  - Séparateur de milliers : une espace insécable (`9 999`).
  - Le signe moins affiché est U+2212 (`−`).
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit la version de production.
- **Navigation.** Une seule page, sans changement d'URL : ni routeur, ni `#hash`, ni `history.pushState` (spec §6.2).
- **iPhone.**
  - iOS 16 au minimum.
  - Champs de saisie en 16 px au moins.
  - Champs numériques avec `inputMode="numeric"`, contenu sélectionné au toucher (`selectAllSoon`).
  - Chaque champ nouveau d'un formulaire (hors champ de recherche) passe par `HelpField`, avec une aide sous le champ (demande du porteur du projet, 20/10/2026). Les textes d'aide vivent dans `src/products/fieldHelp.ts`.
- **Dépendances.** Aucune nouvelle ; les versions exactes du jalon 1 sont inchangées.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`), organisation « ScanDrinks » (`zifknkzcboqmvxjyuolq`, offre gratuite), région `eu-west-3`. Ne jamais toucher à l'organisation ni au projet « Webia ».
  - Toute modification de la base passe par une nouvelle migration, `supabase/migrations/20261020100000_pilotage.sql`. Celle du jalon 1 n'est jamais modifiée.
  - Fonctions de l'app :
    - `security invoker` et `set search_path = ''` ;
    - accès vérifié en tête (erreur `42501`), puis paramètres validés avant toute écriture (`invalid_input:<champ>`, code `P0001`) ;
    - `execute` retiré à `public` et `anon`, et accordé à `authenticated`.
  - **Compatibilité :** l'app du jalon 1 reste en service sur `scandrinks.pages.dev` jusqu'à la fusion. La migration ne casse aucun de ses appels : mêmes noms et mêmes paramètres, ou paramètre ajouté avec une valeur par défaut.
  - **La vraie base contient des données d'essai** (test du jalon 1). Les tests SQL n'en dépendent pas :
    - ils utilisent des codes fictifs à préfixe `2`, réservé à l'usage interne par GS1 ;
    - ils ne supposent jamais une base vide.
  - L'application de la migration au vrai projet (Tâche 8) est couverte par l'accord donné à la validation de ce plan.
- **Secrets.** Aucun. `.env.production` est inchangé.
- **Règles de gestion (spec §5).**
  - Le stock est en unités. C'est la somme des `delta` des mouvements non annulés (RG-9).
  - **Inventaire (RG-4) :** la valeur comptée va de 0 à 9 999. L'écart, compté − stock connu, est enregistré comme un mouvement `inventory`.
  - **À racheter :**
    - un produit y figure quand son stock est inférieur ou égal au seuil (RG-5) ;
    - quantité = stock idéal − max(stock, 0), arrondie au pack Metro supérieur ;
    - en unités si le pack Metro vaut 1 ;
    - mention « stock à vérifier » si le stock est négatif (RG-6).
  - **Stock négatif :** autorisé (RG-8).
  - **Mouvements passés :** modifier le pack Metro ou les unités d'un code ne les change pas (RG-10).
  - **Produit archivé (RG-11) :** il disparaît des listes et reste visible dans « Archivés ». Scanner un de ses codes propose de le réactiver.
  - **Valeurs autorisées :** celles de RG-7.
- **Idempotence.** Rejouer une écriture avec le même identifiant ne crée pas de doublon :
  - mouvements et inventaires : `uuid` généré par le téléphone ;
  - création d'une fiche : `p_id` généré par le téléphone ;
  - modifier une fiche, l'archiver ou retirer un code : sans effet si l'appel est rejoué.
- **Fraîcheur.** Le catalogue est relu :
  - à l'ouverture d'un onglet ;
  - au retour dans l'app ;
  - après chaque action du téléphone.
- **Caméra.** Elle ne tourne que sur l'onglet Scanner, Réglages fermés. Elle repart au retour sur le Scanner, sans recharger la page.
- **Git.**
  - Branche `jalon-2`. La fusion dans `main` demande l'accord du porteur du projet.
  - Chaque commit se termine par les lignes d'attribution de la session.
  - La branche est envoyée sur GitHub avant toute attente d'une action du porteur du projet.

## Review Focus

1. **Données venues d'un autre téléphone**, par exemple une entrée faite sur un autre iPhone.
   - Comportement attendu : à l'ouverture d'À racheter ou de Stock, et au retour dans l'app, la liste et le badge sont à jour. « Mis à jour à HH:MM » l'indique.
   - Test : scénario e2e H (Tâche 4), avec un mouvement ajouté dans le faux backend avant le changement d'onglet.
2. **Comptage d'inventaire mal saisi** : 53 tapé dans « Packs », champ vide, lettres.
   - Comportement attendu :
     - le total en unités et l'écart s'affichent avant « Valider » ;
     - une saisie vide, non numérique ou au-delà de 9 999 est refusée avec un message.
   - Tests : `parseCount` (Tâche 1) ; scénario e2e I (Tâche 5), avec la ligne « = 53 (2 packs + 5) — écart : +29 ».
3. **Réponse perdue pendant une création de fiche ou un inventaire.**
   - Comportement attendu : « Réessayer », ou un nouvel appui, ne crée ni doublon de fiche ni second inventaire.
   - Tests : cas SQL 13 et 15 (Tâche 2) ; scénario e2e D étendu (Tâche 5).
4. **Changement d'onglet, ou Réglages ouverts, pendant un envoi ou après un échec** (m9).
   - Comportement attendu : au retour sur Scanner, la fiche et son « Réessayer » sont toujours là, avec le même identifiant.
   - Test : scénario e2e H (Tâche 4).
5. **Archivage par erreur.**
   - Comportement attendu :
     - une confirmation est demandée avant d'archiver ;
     - le produit reste dans « Archivés », avec « Réactiver » ;
     - scanner son code propose de le réactiver.
   - Tests : scénarios e2e J (Tâche 5) et K (Tâche 6).

---

## Structure des fichiers

```
supabase/migrations/20261020100000_pilotage.sql   nouvelles fonctions, droits par colonne, contraintes (Tâche 2)
supabase/tests/database.test.sql          codes fictifs, cas du pilotage (Tâche 2)
src/domain/names.ts                       tri français des noms (Tâche 1)
src/domain/restock.ts                     RG-5, RG-6 : liste À racheter (Tâche 1)
src/domain/inventory.ts                   RG-4 : saisie du comptage, écart (Tâche 1)
src/domain/movements.ts                   lignes de mouvements, heure de Paris (Tâche 1)
src/domain/stock.ts                       ScanMode à trois modes, MoveMode (Tâche 5)
src/domain/productDraft.ts                validateProductFields (Tâche 7)
src/codes/normalize.ts                    isUnitFormat (Tâche 5), normalizeTypedCode (Tâche 7)
src/data/api.ts                           catalogue, fiche, nouvelles fonctions (Tâche 3)
src/app/authState.ts                      transitions de session (Tâche 4, m6)
src/app/useCatalog.ts                     catalogue partagé et relectures (Tâche 4)
src/app/TabBar.tsx                        barre d'onglets et badge (Tâche 4)
src/app/AppShell.tsx, AppShell.css        onglets, Réglages par-dessus l'app (Tâche 4)
src/shopping/ShoppingScreen.tsx, Shopping.css   À racheter (Tâche 4, fiche en Tâche 6)
src/scanner/…                             Inventaire, produit archivé (Tâche 5)
src/scanner/CountCard.tsx, ArchivedCard.tsx     (Tâche 5)
src/inventory/CountFields.tsx             saisie « packs + unités » (Tâche 5)
src/inventory/CorrectStockForm.tsx        « Corriger le stock » (Tâche 7)
src/stock/StockScreen.tsx, ProductSheet.tsx, MovementList.tsx, Stock.css   (Tâche 6)
src/stock/ProductEditForm.tsx, CodeList.tsx, AddCodeForm.tsx, ProductCreateForm.tsx   (Tâche 7)
e2e/fakeSupabase.mjs                      nouvelles fonctions et catalogues (Tâche 3, options en Tâches 4 et 5)
e2e/app-smoke.mjs                         scénarios H à L (Tâches 4 à 7)
docs/jalon-2-test.md                      protocole de test en boutique (Tâche 8)
```

---

### Task 1: Règles du pilotage (fonctions pures)

**Files:**
- Create: `src/domain/names.ts`, `src/domain/restock.ts`, `src/domain/inventory.ts`, `src/domain/movements.ts`
- Test: `src/domain/names.test.ts`, `src/domain/restock.test.ts`, `src/domain/inventory.test.ts`, `src/domain/movements.test.ts`

**Interfaces:**
- Consumes : `Product` (`src/data/api.ts`, type seulement) ; `formatDelta` (`src/domain/stock.ts`).
- Produces :
  - `names.ts` :
    - `compareNames(a: string, b: string): number`, avec `Intl.Collator('fr', { sensitivity: 'base', numeric: true })` ;
    - `sortByName<T extends { name: string }>(items: readonly T[]): T[]`, une copie triée.
  - `restock.ts` :
    - `isLow(p: Pick<Product, 'stock' | 'alertThreshold'>): boolean`, vrai si stock ≤ seuil ;
    - `interface RestockLine { product: Product; toBuy: number; unit: 'pack' | 'unit'; checkStock: boolean }` ;
    - `restockLine(product: Product): RestockLine` ;
    - `shoppingList(products: readonly Product[]): RestockLine[]` :
      - seulement les produits actifs, au seuil ou en dessous ;
      - d'abord les ruptures (stock ≤ 0), puis les autres ;
      - chaque groupe trié avec `compareNames`.
    - `describeShoppingLine(line: RestockLine): string`.
  - `inventory.ts` :
    - `COUNT_MAX = 9999` ;
    - `type CountInput = { ok: true; counted: number } | { ok: false; error: string }` ;
    - `parseCount(packsText: string, unitsText: string, packSize: number): CountInput` ;
    - `formatGap(gap: number): string` ;
    - `describeInventory(counted: number, delta: number): string`.
  - `movements.ts` :
    - `type MovementKind = 'in' | 'out' | 'inventory'` ;
    - `interface Movement { id: string; kind: MovementKind; delta: number; counted: number | null; employee: string; createdAt: string; cancelledAt: string | null; cancelledBy: string | null }` ;
    - `formatWhen(iso: string, now: Date): string` ;
    - `formatClock(date: Date): string`, l'heure de Paris au format « 14:05 » ;
    - `describeMovement(m: Movement): string` ;
    - `movementLine(m: Movement, now: Date): string`.

- [ ] **Step 1: Écrire les tests**

Dans `restock.test.ts`, la fabrique de produits est `p(name, packSize, alertThreshold, targetStock, stock, archived = false)`.

```ts
// names.test.ts
test("tri français : accents et casse ignorés, nombres dans l'ordre", () => {
  expect(sortByName([{ name: 'Red Bull 25 cl' }, { name: 'Évian 1,5 L' }, { name: 'coca-Cola 33 cl' }, { name: 'Lipton' }]).map((x) => x.name))
    .toEqual(['coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton', 'Red Bull 25 cl'])
  expect(sortByName([{ name: 'Pack 10' }, { name: 'Pack 9' }]).map((x) => x.name)).toEqual(['Pack 9', 'Pack 10'])
})
test('sortByName ne modifie pas la liste reçue', () => {
  const list = [{ name: 'b' }, { name: 'a' }]
  sortByName(list)
  expect(list.map((x) => x.name)).toEqual(['b', 'a'])
})

// restock.test.ts
test('RG-6 : il manque 38 → 2 packs de 24 (exemple de la spec)', () => {
  expect(describeShoppingLine(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 10)))).toBe('Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24')
})
test('RG-6 : arrondi au pack supérieur, et singulier', () => {
  expect(describeShoppingLine(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 24)))).toBe('Coca-Cola 33 cl — reste 24 — prendre 1 pack de 24')
  expect(describeShoppingLine(restockLine(p('Lipton', 12, 6, 30, 5)))).toBe('Lipton — reste 5 — prendre 3 packs de 12')
})
test('RG-6 : stock négatif compté pour 0, avec « stock à vérifier »', () => {
  const line = restockLine(p('Red Bull 25 cl', 24, 24, 48, -3))
  expect(line).toMatchObject({ toBuy: 2, unit: 'pack', checkStock: true })
  expect(describeShoppingLine(line)).toBe('Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier')
})
test('RG-6 : pack Metro de 1 → quantité en unités', () => {
  expect(describeShoppingLine(restockLine(p('Évian 1,5 L', 1, 6, 12, 4)))).toBe('Évian 1,5 L — reste 4 — prendre 8 unités')
  expect(describeShoppingLine(restockLine(p('Évian 1,5 L', 1, 6, 7, 6)))).toBe('Évian 1,5 L — reste 6 — prendre 1 unité')
})
test('RG-5 : seulement les produits actifs, au seuil ou en dessous', () => {
  expect(shoppingList([p('Coca-Cola 33 cl', 24, 24, 48, 10), p('Lipton', 12, 12, 24, 36), p('Oasis', 24, 24, 48, 0, true)])
    .map((l) => l.product.name)).toEqual(['Coca-Cola 33 cl'])
})
test('ordre : ruptures (stock ≤ 0) en premier, puis ordre alphabétique', () => {
  expect(shoppingList([p('Évian 1,5 L', 1, 6, 12, 4), p('Schweppes 33 cl', 24, 24, 48, 0), p('Coca-Cola 33 cl', 24, 24, 48, 10), p('Red Bull 25 cl', 24, 24, 48, -3)])
    .map((l) => l.product.name)).toEqual(['Red Bull 25 cl', 'Schweppes 33 cl', 'Coca-Cola 33 cl', 'Évian 1,5 L'])
})
test('isLow : stock au seuil ou en dessous, négatif compris', () => {
  expect([isLow({ stock: 24, alertThreshold: 24 }), isLow({ stock: 25, alertThreshold: 24 }), isLow({ stock: -1, alertThreshold: 0 })])
    .toEqual([true, false, true])
})

// inventory.test.ts
test('RG-4 : « 2 packs + 5 » de 24 = 53', () => {
  expect(parseCount('2', '5', 24)).toEqual({ ok: true, counted: 53 })
})
test('un champ vide compte pour 0', () => {
  expect([parseCount('', '53', 24), parseCount('2', '', 24), parseCount('0', '0', 24)])
    .toEqual([{ ok: true, counted: 53 }, { ok: true, counted: 48 }, { ok: true, counted: 0 }])
})
test('pack Metro de 1 : seul le champ des unités compte', () => {
  expect(parseCount('7', '3', 1)).toEqual({ ok: true, counted: 3 })
})
test('saisies refusées', () => {
  expect(parseCount('', ' ', 24)).toEqual({ ok: false, error: 'Saisis ce que tu as compté.' })
  expect(parseCount('2a', '', 24)).toEqual({ ok: false, error: 'Chiffres uniquement.' })
  expect(parseCount('-1', '', 24)).toEqual({ ok: false, error: 'Chiffres uniquement.' })
  expect(parseCount('417', '', 24)).toEqual({ ok: false, error: 'Entre 0 et 9 999 unités.' })
  expect(parseCount('', '10000', 1)).toEqual({ ok: false, error: 'Entre 0 et 9 999 unités.' })
  expect(parseCount('416', '15', 24)).toEqual({ ok: true, counted: 9999 })
})
test('écart et résumé', () => {
  expect([formatGap(29), formatGap(-3), formatGap(0)]).toEqual(['+29', '−3', '0'])
  expect(describeInventory(53, -3)).toBe('Inventaire : 53 comptés (−3)')
  expect(describeInventory(1, 0)).toBe('Inventaire : 1 compté (0)')
  expect(describeInventory(0, -12)).toBe('Inventaire : 0 compté (−12)')
})

// movements.test.ts — now = mardi 20/10/2026, 14:00 à Paris
const now = new Date('2026-10-20T12:00:00Z')
const m = (over: Partial<Movement> = {}): Movement => ({ id: 'm1', kind: 'in', delta: 24, counted: null, employee: 'Sam',
  createdAt: '2026-10-19T12:32:00Z', cancelledAt: null, cancelledBy: null, ...over })
test('heure de Paris : le jour de la semaine pendant 7 jours', () => {
  expect(formatWhen('2026-10-19T12:32:00Z', now)).toBe('lun. 14:32')
  expect(formatWhen('2026-10-19T22:30:00Z', now)).toBe('mar. 00:30')
  expect(formatWhen('2026-10-14T08:05:00Z', now)).toBe('mer. 10:05')
})
test("au-delà : la date, avec l'année si elle diffère", () => {
  expect(formatWhen('2026-10-13T08:05:00Z', now)).toBe('13/10 10:05')
  expect(formatWhen('2025-06-15T10:00:00Z', now)).toBe('15/06/2025 12:00')
  expect(formatClock(new Date('2026-10-20T12:05:00Z'))).toBe('14:05')
})
test('lignes de mouvements (§4.5)', () => {
  expect(movementLine(m(), now)).toBe('lun. 14:32 — Sam — Entrée +24')
  expect(movementLine(m({ kind: 'out', delta: -6 }), now)).toBe('lun. 14:32 — Sam — Sortie −6')
  expect(movementLine(m({ kind: 'inventory', delta: -3, counted: 53 }), now)).toBe('lun. 14:32 — Sam — Inventaire : 53 comptés (−3)')
  expect(movementLine(m({ cancelledAt: '2026-10-19T12:40:00Z', cancelledBy: 'Léa' }), now)).toBe('lun. 14:32 — Sam — Entrée +24 — annulé par Léa')
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain/names.test.ts src/domain/restock.test.ts src/domain/inventory.test.ts src/domain/movements.test.ts`
Expected : FAIL, car les modules n'existent pas encore.

- [ ] **Step 3: Écrire `names.ts`, `restock.ts`, `inventory.ts` et `movements.ts`**

Règles que les signatures ne fixent pas :
- **`parseCount` :**
  - les deux champs sont nettoyés (`trim`) ;
  - un champ non vide doit être fait de chiffres (`/^\d+$/`), sinon « Chiffres uniquement. » ;
  - un champ vide vaut 0, mais les deux vides donnent « Saisis ce que tu as compté. » ;
  - le champ des packs est ignoré quand le pack Metro vaut 1 ;
  - un total au-delà de 9 999 donne « Entre 0 et 9 999 unités. » (espace insécable).
- **`describeInventory` :** « compté » au singulier pour 0 et 1.
- **`formatWhen` :**
  - les jours sont ceux du calendrier de Paris, calculés avec `Intl.DateTimeFormat` et `timeZone: 'Europe/Paris'` ;
  - un écart de 0 à 6 jours donne « lun. 14:32 » ;
  - au-delà, « 13/10 10:05 », avec l'année quand elle diffère de celle de `now` ;
  - un écart négatif (horloge du téléphone en retard) prend aussi le format avec la date.

- [ ] **Step 4: Lancer les tests**

Run: `npx vitest run src/domain && npm test`
Expected : PASS, toute la suite comprise.

- [ ] **Step 5: Commit**

Message : `feat(domain): À racheter, inventaire, tri français et lignes de mouvements (RG-4 à RG-6)`.

---

### Task 2: Base de données — migration du pilotage et tests SQL

**Files:**
- Create: `supabase/migrations/20261020100000_pilotage.sql`
- Modify: `supabase/tests/database.test.sql`

**Interfaces:**
- Consumes : le schéma du jalon 1 (`supabase/migrations/20261019130000_initial_schema.sql`).
- Produces, consommé par la Tâche 3 via PostgREST :
  - `lookup_barcode(p_code text)` : signature inchangée. Pour un compte absent de `allowed_users`, elle lève maintenant `not_allowed` (`42501`) au lieu de renvoyer `null` (m16).
  - `create_product(p_name text, p_pack_size int, p_alert_threshold int, p_target_stock int, p_barcodes jsonb, p_id uuid default null)` → produit au format de `product_stock` :
    - **m10 :** si `p_id` est donné et que ce produit existe déjà, il est renvoyé tel quel, sans autre contrôle. Sinon, le produit est créé avec cet identifiant, ou avec un identifiant généré si `p_id` est nul ;
    - `p_barcodes` peut être `[]`, pour un produit sans code (spec §4.4) ;
    - l'ancienne fonction à 5 paramètres est supprimée. L'app du jalon 1 l'appelle encore avec 5 paramètres nommés : la valeur par défaut de `p_id` garde ces appels valides.
  - `update_product(p_id uuid, p_name text, p_pack_size int, p_alert_threshold int, p_target_stock int)` → produit au format de `product_stock` :
    - les validations sont celles de `create_product` ;
    - un produit inconnu lève `invalid_input:product` ;
    - `updated_at` vaut `now()`.
  - `set_product_archived(p_product_id uuid, p_archived boolean)` → produit au format de `product_stock`. `invalid_input:archived` si `p_archived` est `null`, `invalid_input:product` si le produit est inconnu.
  - `detach_barcode(p_code text)` → `{"status":"detached"}`, même si le code n'existe pas (renvoi sans effet). `invalid_input:code` si le code n'a pas 8 à 14 chiffres.
  - `record_inventory(p_id uuid, p_product_id uuid, p_counted int, p_employee text)` → `{"movement_id","delta","stock","counted","duplicate"}`. Dans l'ordre :
    1. accès vérifié ; `p_id` nul → `invalid_input:id` ;
    2. si un mouvement `p_id` existe, le renvoyer : son `delta`, son `counted`, le stock actuel et `duplicate` vrai ;
    3. verrouiller le produit (`for update`) ; inconnu → `invalid_input:product` ;
    4. `p_counted` de 0 à 9 999, sinon `invalid_input:counted` ; prénom nettoyé de 1 à 30 caractères, sinon `invalid_input:employee` ;
    5. `delta = p_counted − stock actuel` ; insertion `kind = 'inventory'`, `counted = p_counted`, `barcode` nul, avec `on conflict (id) do nothing`, puis renvoi.
  - `list_employees()` : un seul prénom par orthographe sans casse (« Sam » et « sam »).
    - La première orthographe enregistrée est gardée : `distinct on (lower(employee))`, trié par `created_at`, puis par `employee` pour départager deux mouvements de la même seconde.
    - La liste est triée sans tenir compte de la casse.
  - **Droits (m11) :**
    - le droit `update` sur les tables est retiré à `authenticated`, puis rendu par colonne :
      - `products (name, pack_size, alert_threshold, target_stock, archived, updated_at)` ;
      - `barcodes (product_id, units)` ;
      - `movements (cancelled_at, cancelled_by)` ;
    - `grant delete on barcodes` et politique `barcodes_delete` (`using ((select private.is_allowed()))`), pour `detach_barcode` ;
    - contraintes `movements_delta_sign` (`in` → `delta > 0`, `out` → `delta < 0`, `inventory` → tout `delta`) et `movements_counted_inventory` (`counted` rempli si et seulement si `kind = 'inventory'`).

- [ ] **Step 1: Réécrire `database.test.sql`**

Les principes du jalon 1 restent :
- une seule transaction, terminée par `rollback;` puis `select 'OK' as resultat;` ;
- un bloc par vérification, qui lève `ÉCHEC : <cas>` ;
- les refus vérifiés avec `pg_temp.expect_error`.

**Codes fictifs** (préfixe 2, clés de contrôle vérifiées) :

| Ancien code | Nouveau code |
|---|---|
| `5449000000996` (Coca) | `2000000000015` |
| `3502110123091` (pack Lipton) | `2000000000022` |
| `3228886043714` (canette Lipton) | `2000000000039` |
| `96385074` | `20000011` |
| `40170725` | `20000028` |

Codes nouveaux : `2000000000046`, `2000000000053` et `2000000000060`.

**Indépendance des données :** le cas 11 vérifie `list_employees() @> '["Sam"]'`, et plus une égalité.

Cas modifiés :
- **1, `anon` (m12) :** il est aussi refusé (`42501`) sur `create_product`, `attach_barcode`, `record_movement`, `cancel_movement`, `record_inventory`, `update_product`, `set_product_archived` et `detach_barcode`.
- **2, `B` (m12, m16) :**
  - `lookup_barcode('2000000000015')` → `42501` ;
  - `product_stock` vide ;
  - `42501` sur toutes les fonctions d'écriture ;
  - `insert into public.products (name, pack_size, alert_threshold, target_stock) values ('Intrus', 6, 6, 12)` → `42501` ;
  - `select 1 from public.allowed_users` → `42501`.
- **3, `A` (m12) :** `select` et `insert` sur `allowed_users` → `42501`.

Cas ajoutés après le cas 12, en tant que `A` :
- **13. Création rejouée (m10).**
  - `create_product('Schweppes Agrumes 33 cl', 24, 24, 48, '[{"code":"2000000000046","units":24}]', 'c0000000-0000-4000-8000-000000000001')` renvoie cet `id`.
  - Le même appel, répété, renvoie le même `id`, et il n'existe qu'une ligne avec cet `id`.
  - Le même `p_id` avec `[{"code":"2000000000053","units":24}]` renvoie « Schweppes Agrumes 33 cl », et `lookup_barcode('2000000000053')` reste `null`.
- **14. Produit sans code.** `create_product('Sans code', 6, 6, 12, '[]')` réussit, et le produit n'a aucune ligne dans `barcodes`.
- **15. Inventaire (RG-4).** Le stock du Coca vaut 24.
  - `record_inventory('00000000-0000-4000-8000-0000000000e1', coca, 20, 'Sam')` → `delta` −4, `stock` 20, `counted` 20, `duplicate` faux. La ligne est `kind = 'inventory'`, `counted = 20`, `barcode` nul.
  - Le même identifiant avec `p_counted` 99 → `duplicate` vrai, `delta` −4, `counted` 20 ; le stock reste 20.
  - `p_counted` −1 ou 10000 → `invalid_input:counted`.
  - Produit inconnu → `invalid_input:product` ; prénom de 31 caractères → `invalid_input:employee`.
  - `cancel_movement('…e1', 'Sam')` → stock 24.
- **16. Modification de la fiche (RG-10).** Le stock du Lipton vaut 6.
  - `update_product(lipton, '  Lipton Pêche 33 cl ', 24, 10, 40)` → nom « Lipton Pêche 33 cl », `pack_size` 24, `alert_threshold` 10, `target_stock` 40, `stock` toujours 6. Le `delta` du mouvement `d3` reste 12.
  - Stock idéal 10 pour un seuil de 10 → `invalid_input:target_stock` ; pack 0 → `invalid_input:pack_size` ; nom de 81 caractères → `invalid_input:name` ; produit inconnu → `invalid_input:product`.
- **17. Archivage (RG-11).**
  - `attach_barcode('2000000000060', coca, 24, false)`, puis `set_product_archived(coca, true)` → `archived` vrai.
  - `lookup_barcode('2000000000060')` renvoie le Coca avec `archived` vrai.
  - `set_product_archived(coca, false)` → `archived` faux.
  - `p_archived` nul → `invalid_input:archived` ; produit inconnu → `invalid_input:product`.
- **18. Retrait d'un code.**
  - `detach_barcode('2000000000022')` → `{"status":"detached"}`, et `lookup_barcode('2000000000022')` vaut `null`.
  - Le mouvement `d1`, enregistré avec ce code, garde `barcode = '2000000000022'`.
  - Un second appel renvoie encore `detached` ; `detach_barcode('abc')` → `invalid_input:code`.
- **19. Écritures directes (m11).**
  - `update public.movements set delta = 1000 where id = d2` → `42501` ; `update public.products set created_at = now()` → `42501`.
  - Insertion directe d'une entrée `in` avec `delta` −5 → `23514` ; d'un `inventory` sans `counted` → `23514` ; d'une sortie `out` avec `counted` 3 → `23514`.
- **20. Casse des prénoms.**
  - Dans une transaction, `now()` donne la même heure à tous les mouvements. Le mouvement de « sam » est donc inséré directement, une minute plus tard : `insert into public.movements (id, product_id, kind, delta, employee, created_at) values (gen_random_uuid(), lipton, 'in', 1, 'sam', now() + interval '1 minute')`.
  - `list_employees()` contient « Sam » et pas « sam ».

- [ ] **Step 2: Lancer les tests SQL en local pour vérifier qu'ils échouent**

Run: `pg_ctlcluster 16 main start; su postgres -c "bash supabase/tests/run-local.sh"`
Expected : erreur. Par exemple « ÉCHEC » au cas 2 (`lookup_barcode` ne lève pas `42501`) ou « function public.record_inventory … does not exist ».

- [ ] **Step 3: Écrire la migration `20261020100000_pilotage.sql`**

Elle contient exactement la partie Interfaces, avec `revoke all … from public, anon` et `grant execute … to authenticated` pour chaque fonction nouvelle ou recréée. `lookup_barcode` et `list_employees` sont réécrites avec `create or replace` (même signature et même type de retour) : leurs droits sont gardés.

- [ ] **Step 4: Lancer les tests SQL en local**

Run: `su postgres -c "bash supabase/tests/run-local.sh"`
Expected : `OK`.

- [ ] **Step 5: Contrôle par mutations**

Introduire tour à tour trois erreurs dans la migration :
- `delta = stock − compté` dans `record_inventory` ;
- `detach_barcode` qui lève une erreur pour un code inconnu ;
- `update_product` sans le contrôle stock idéal > seuil.

Relancer après chacune. Expected : un « ÉCHEC » à chaque fois. Restaurer ensuite.

- [ ] **Step 6: Commit**

Message : `feat(db): inventaire, fiche modifiable, archivage, retrait d'un code et droits par colonne`.

La migration est appliquée au vrai projet à la Tâche 8.

---

### Task 3: Accès aux données — API et faux backend

**Files:**
- Modify: `src/data/api.ts`, `src/data/api.test.ts`, `e2e/fakeSupabase.mjs`

**Interfaces:**
- Consumes : `sortByName` et `Movement` (Tâche 1) ; les fonctions SQL de la Tâche 2.
- Produces (dans `createApi`), consommé par les Tâches 4 à 7 :
  - `listProducts(): Promise<Product[]>` : produits actifs, triés par `sortByName`. La requête est inchangée.
  - `listCatalog(): Promise<Product[]>` : tous les produits, archivés compris, triés par `sortByName`. Requête : `from('product_stock').select('*').order('name')`.
  - `getProductDetail(productId: string): Promise<ProductDetail>`, avec `interface BarcodeEntry { code: string; units: number }` et `interface ProductDetail { barcodes: BarcodeEntry[]; movements: Movement[] }`. Deux lectures en parallèle :
    - `from('barcodes').select('code, units').eq('product_id', id).order('created_at')` ;
    - `from('movements').select('id, kind, delta, counted, employee, created_at, cancelled_at, cancelled_by').eq('product_id', id).order('created_at', { ascending: false }).limit(20)`.
  - `createProduct(input: NewProductInput & { id: string }): Promise<Product>` : ajoute `p_id`.
  - `updateProduct(input: { id: string; name: string; packSize: number; alertThreshold: number; targetStock: number }): Promise<Product>`.
  - `setArchived(productId: string, archived: boolean): Promise<Product>`.
  - `detachBarcode(code: string): Promise<void>`.
  - `recordInventory(input: { id: string; productId: string; counted: number; employee: string }): Promise<{ delta: number; stock: number; counted: number; duplicate: boolean }>`.
- Faux backend (`installFakeSupabase`) :
  - **Données gardées :** chaque mouvement porte `kind`, `delta`, `counted`, `employee`, `created_at`, `cancelled_at` et `cancelled_by`.
  - **Lectures :**
    - `/rest/v1/product_stock` tient compte de `archived=eq.false` ;
    - `/rest/v1/barcodes` et `/rest/v1/movements` filtrent sur `product_id=eq.…`, et appliquent l'ordre et la limite demandés.
  - **Fonctions :** `update_product`, `set_product_archived`, `detach_barcode` et `record_inventory`, avec les réponses de la Tâche 2. `create_product` gère `p_id` (renvoi du produit existant) et accepte `p_barcodes` vide.
  - **Catalogue `pilotage`** (`created_at` des mouvements entre parenthèses) :

    | id | nom | pack | seuil | idéal | archivé | code (unités) | mouvements | stock |
    |---|---|---|---|---|---|---|---|---|
    | `p-coca` | Coca-Cola 33 cl | 24 | 24 | 48 | non | `5449000000996` (24) | +48 Sam (18/10 08:00Z), −38 Léa (19/10 15:00Z) | 10 |
    | `p-lipton` | Lipton Pêche 50 cl | 12 | 12 | 24 | non | `3502110123091` (12) | +36 Sam (18/10 08:05Z) | 36 |
    | `p-redbull` | Red Bull 25 cl | 24 | 24 | 48 | non | aucun | −3 Sam (19/10 16:00Z) | −3 |
    | `p-evian` | Évian 1,5 L | 1 | 6 | 12 | non | aucun | +4 Sam (18/10 09:00Z) | 4 |
    | `p-oasis` | Oasis Tropical 33 cl | 24 | 24 | 48 | oui | aucun | +24 Sam (17/10 08:00Z) | 24 |

  - **Catalogue `coca_archived` :** le Coca archivé, avec `5449000000996` (24 unités) et un stock de 24.

- [ ] **Step 1: Écrire les tests de l'API**

Le faux client renvoie un constructeur de requête : toutes les méthodes renvoient le constructeur et notent l'appel, et `then` résout `ok(rows)`. Tests (nom → assertions) :
- **« listCatalog lit tous les produits, triés à la française » :**
  - appels `[['select', '*'], ['order', 'name']]` sur `product_stock` ;
  - lignes reçues dans l'ordre Red Bull, Évian, Coca → noms rendus `['Coca-Cola 33 cl', 'Évian 1,5 L', 'Red Bull 25 cl']`.
- **« listProducts trie aussi à la française » :** même entrée, mêmes appels qu'au jalon 1, sortie triée.
- **« getProductDetail lit les codes et les 20 derniers mouvements » :**
  - appels exacts ci-dessus pour `'p9'` ;
  - résultat `{ barcodes: [{ code: '2000000000015', units: 24 }], movements: [{ id: 'm1', kind: 'inventory', delta: -3, counted: 53, employee: 'Sam', createdAt: '2026-10-19T12:32:00Z', cancelledAt: null, cancelledBy: null }] }`.
- **« createProduct envoie l'identifiant du téléphone » :** les paramètres du jalon 1, plus `p_id: 'p-new'`.
- **« updateProduct appelle update_product » :** `{ p_id: 'p9', p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 30, p_target_stock: 48 }` → `Product`.
- **« setArchived appelle set_product_archived » :** `{ p_product_id: 'p9', p_archived: true }` → `Product` avec `archived: true`.
- **« detachBarcode appelle detach_barcode » :** `{ p_code: '2000000000015' }` → `undefined`.
- **« recordInventory renvoie l'écart et le stock » :** `{ p_id: 'i1', p_product_id: 'p9', p_counted: 53, p_employee: 'Sam' }` → `{ delta: -3, stock: 53, counted: 53, duplicate: false }`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/data/api.test.ts`
Expected : FAIL, car les méthodes n'existent pas ou ne trient pas.

- [ ] **Step 3: Compléter `api.ts`, puis le faux backend**

- [ ] **Step 4: Lancer les tests et le test de bout en bout**

Run: `npm test && npm run e2e`
Expected : PASS, et les 7 scénarios du jalon 1 sont OK avec le faux backend mis à jour.

- [ ] **Step 5: Commit**

Message : `feat(data): catalogue, fiche produit, inventaire et archivage dans l'API et le faux backend`.

---

### Task 4: Coquille à onglets, catalogue partagé et À racheter

**Files:**
- Create: `src/app/authState.ts`, `src/app/authState.test.ts`, `src/app/useCatalog.ts`, `src/app/TabBar.tsx`, `src/shopping/ShoppingScreen.tsx`, `src/shopping/Shopping.css`
- Modify: `src/app/AppShell.tsx`, `src/app/AppShell.css`, `src/scanner/ScannerScreen.tsx`, `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `shoppingList`, `describeShoppingLine`, `formatClock` (Tâche 1) ; `api.listCatalog` (Tâche 3).
- Produces :
  - `authState.ts` : `type SessionState = 'checking' | 'signed_out' | 'signed_in'` et `nextSessionState(event: string, hasSession: boolean): SessionState | null` :
    - `INITIAL_SESSION` → `signed_in` ou `signed_out` ;
    - `SIGNED_IN` et `TOKEN_REFRESHED` avec une session → `signed_in` (m6) ;
    - `SIGNED_OUT` → `signed_out` ;
    - tout autre cas → `null`, sans changement.
  - `useCatalog.ts` :
    - `interface Catalog { products: Product[] | null; errorKind: ApiErrorKind | null; updatedAt: Date | null; refresh: () => void }` ;
    - `useCatalog(options: { enabled: boolean; onSessionExpired: () => void }): Catalog` ;
    - lecture quand `enabled` devient vrai, et quand la page redevient visible (`visibilitychange`) ;
    - une réponse arrivée après une lecture plus récente est ignorée ;
    - un échec garde la liste précédente ;
    - une session expirée appelle `onSessionExpired`.
  - `TabBar.tsx` :
    - `type Tab = 'scanner' | 'shopping' | 'stock'` ;
    - props `{ tab: Tab; shoppingCount: number | null; onChange: (tab: Tab) => void }` ;
    - libellés « Scanner », « À racheter » et « Stock ». Le bouton actif porte `aria-current="page"` ;
    - le badge est visible quand le nombre est supérieur à 0, et le bouton s'appelle alors « À racheter (3) » (`aria-label`).
  - `ScannerScreen` props `{ employee: string; active: boolean; onSessionExpired: () => void; onCatalogChanged: () => void }` :
    - la caméra démarre quand `active` est vrai et s'arrête (`scanner.stop()`) sinon ;
    - `onCatalogChanged` est appelé après un enregistrement ou une annulation réussis. La Tâche 5 l'étend à la création, à l'ajout d'un code et à la réactivation.
  - `ShoppingScreen` props `{ catalog: Catalog }` :
    - titre « À racheter » ;
    - liste `<ul aria-label="À racheter">`, une ligne `describeShoppingLine` par produit ;
    - « Rien à racheter pour l'instant. » quand la liste est vide ;
    - « Chargement… » tant que `products` vaut `null` ;
    - en cas d'erreur, `apiErrorMessage(errorKind)` et un bouton « Réessayer » ;
    - en bas, « Mis à jour à HH:MM » (`formatClock`).
  - `AppShell` :
    - les Réglages et l'écran Prénom ouvert depuis les Réglages s'affichent par-dessus l'app, masquée (`hidden`) sans être démontée ;
    - le Scanner reste monté (`active` vaut vrai seulement sur son onglet, Réglages fermés) ;
    - À racheter et Stock sont montés seulement quand leur onglet est ouvert ;
    - en-tête (ScanDrinks, prénom, ⚙) au-dessus de chaque onglet ;
    - l'onglet Scanner s'ouvre au démarrage ;
    - chaque changement d'onglet relit le catalogue, et le Scanner reçoit `catalog.refresh` comme `onCatalogChanged` ;
    - la Tâche 6 remplace le contenu de Stock, une ligne « Bientôt » d'ici là ;
    - **m5 :** après une déconnexion en échec, l'alerte « Déconnexion impossible… » ne s'affiche que si `supabase.auth.getSession()` renvoie encore une session (supabase-js 2.117.2 retire la session locale avant de renvoyer l'erreur).
  - Faux backend :
    - option `failLogout` : `/auth/v1/logout` est coupé ;
    - méthode `addMovement({ productId, kind, delta, employee })`, renvoyée avec `calls`, qui simule un autre téléphone.

- [ ] **Step 1: Écrire le test de `nextSessionState`**

```ts
test('session : transitions, dont TOKEN_REFRESHED (m6)', () => {
  expect(nextSessionState('INITIAL_SESSION', false)).toBe('signed_out')
  expect(nextSessionState('INITIAL_SESSION', true)).toBe('signed_in')
  expect(nextSessionState('TOKEN_REFRESHED', true)).toBe('signed_in')
  expect(nextSessionState('TOKEN_REFRESHED', false)).toBeNull()
  expect(nextSessionState('SIGNED_OUT', false)).toBe('signed_out')
  expect(nextSessionState('USER_UPDATED', true)).toBeNull()
})
```

- [ ] **Step 2: Écrire le scénario e2e H (onglets et À racheter)**

1. **Catalogue et badge.** `openApp(browser, { catalogue: 'pilotage' })`, connexion, puis attendre la fiche « Pack de 24 → +24 » sur le Scanner. Le bouton « À racheter (3) » est visible.
2. **À racheter.** Toucher « À racheter (3) ». Les lignes de la liste « À racheter » sont exactement :
   - `Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier` ;
   - `Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24` ;
   - `Évian 1,5 L — reste 4 — prendre 8 unités`.

   « Mis à jour à » est suivi de `\d{2}:\d{2}`, et `document.querySelector('video').srcObject` vaut `null`.
3. **Autre téléphone.**
   - `fake.addMovement({ productId: 'p-evian', kind: 'in', delta: 8, employee: 'Léa' })`, puis « Scanner ».
   - Le changement d'onglet relit le catalogue : le bouton s'appelle « À racheter (2) ».
   - Le toucher : la ligne Évian a disparu.
4. **Fiche gardée.**
   - Retour sur « Scanner » : la fiche « Pack de 24 → +24 » est toujours là. Quantité 2, puis « Valider ».
   - Expected : « ✓ +48 Coca-Cola 33 cl — stock : 58 (2 packs + 10) », puis le bouton « À racheter (1) ».
5. **m9.** Nouveau contexte, `{ catalogue: 'pilotage', failNextRecord: true }` :
   - « Valider » → « Réessayer » ;
   - « Réglages », puis « Retour » : la fiche montre toujours « Réessayer » ;
   - « Réessayer » donne « ✓ +24 … », avec deux appels `record_movement` et le même `p_id`.
6. **m5.** Nouveau contexte, `{ catalogue: 'pilotage', failLogout: true }` :
   - tous les dialogues sont acceptés et notés ;
   - « Réglages », puis « Se déconnecter » : le bouton « Se connecter » apparaît ;
   - les dialogues notés valent `['confirm: Se déconnecter ? Il faudra retaper le mot de passe du tabac.']`, sans alerte.

Ajouter `['H', scenarioTabs]` à la liste des scénarios.

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/app/authState.test.ts; E2E_ONLY=H npm run e2e`
Expected :
- FAIL : `authState` n'existe pas ;
- le scénario H échoue en attendant « À racheter (3) ».

- [ ] **Step 4: Écrire `authState.ts`, `useCatalog.ts`, `TabBar.tsx` et `ShoppingScreen.tsx`, puis adapter `AppShell.tsx` et `ScannerScreen.tsx`**

La barre d'onglets est fixée en bas, au-dessus de la zone du geste d'accueil (`padding-bottom: env(safe-area-inset-bottom)`). Ses boutons font 48 px de haut.

- [ ] **Step 5: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe, scénarios A à H compris.

- [ ] **Step 6: Commit**

Message : `feat(app): onglets, catalogue partagé et liste À racheter (m5, m6, m9)`.

---

### Task 5: Scanner — mode Inventaire, produits archivés et points reportés

**Files:**
- Create: `src/scanner/CountCard.tsx`, `src/scanner/ArchivedCard.tsx`, `src/inventory/CountFields.tsx`
- Modify: `src/domain/stock.ts`, `src/data/api.ts` (type de `MovementInput.mode`), `src/scanner/mode.ts`, `src/scanner/mode.test.ts`, `src/scanner/scanFlow.ts`, `src/scanner/scanFlow.test.ts`, `src/scanner/ScannerScreen.tsx`, `src/scanner/ConfirmCard.tsx`, `src/scanner/Notice.tsx`, `src/scanner/Scanner.css`, `src/products/ManualEntry.tsx`, `src/products/NewProductForm.tsx`, `src/codes/normalize.ts`, `src/codes/normalize.test.ts`, `src/scan/scannerErrors.ts`, `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `parseCount`, `formatGap`, `describeInventory` (Tâche 1) ; `api.recordInventory`, `api.setArchived` et `createProduct` avec `id` (Tâche 3) ; `onCatalogChanged` (Tâche 4).
- Produces :
  - `stock.ts` :
    - `type ScanMode = 'in' | 'out' | 'inventory'` et `type MoveMode = Exclude<ScanMode, 'inventory'>` ;
    - `movementDelta` et `describeConfirm` prennent un `MoveMode`, comme `MovementInput.mode`.
  - `mode.ts` : `loadMode()` renvoie aussi `'inventory'` ; toute autre valeur donne `'in'`.
  - `scanFlow.ts` :
    - `ConfirmState` gagne `counted: number | null` ;
    - l'événement `validate` devient `{ type: 'validate'; counted?: number }`. Depuis l'état `idle`, il enregistre `counted ?? null`. Depuis `failed`, il garde le `counted` déjà enregistré ;
    - la notice `saved` gagne `counted: number | null`, non nul après un inventaire ;
    - nouvelle étape `ArchivedState = { step: 'archived'; target: ConfirmTarget; movementId: string; status: 'idle' | 'saving' | 'failed'; errorKind: ApiErrorKind | null }`, exportée et ajoutée à `FlowState`. Elle est atteinte par `lookup_done` quand `product.archived` est vrai ;
    - événements `{ type: 'reactivate' }`, `{ type: 'reactivate_done'; product: Product }` et `{ type: 'reactivate_failed'; kind: ApiErrorKind }` ;
    - `reactivate_done` mène à la fiche de confirmation du produit réactivé, avec le même `movementId` ;
    - `close` ferme l'étape `archived`, sauf pendant l'envoi.
  - `CountFields` props `{ packSize: number; knownStock: number; packsText: string; unitsText: string; disabled: boolean; onChange: (packsText: string, unitsText: string) => void }`. Il affiche :
    - « Stock connu : 24 (1 pack) » ;
    - deux `HelpField`, « Packs de 24 » et « Unités en plus », ou un seul champ « Unités » si le pack Metro vaut 1. Leurs aides sont ajoutées à `FIELD_HELP` :
      - `countPacks` : « Packs entiers trouvés en réserve. » ;
      - `countUnits` : « Canettes ou bouteilles en plus des packs entiers. » ;
      - `countUnitsOnly` : « Canettes ou bouteilles trouvées en réserve. » ;
    - la ligne « = 53 (2 packs + 5) — écart : +29 » quand `parseCount` réussit, son message sinon. Rien quand les deux champs sont vides.
  - `CountCard` props `{ state: ConfirmState; onValidate: (counted?: number) => void; onClose: () => void }` :
    - `section` « Fiche de confirmation », `data-mode="inventory"` ;
    - « Valider » est actif quand `parseCount` réussit ;
    - « Réessayer » rappelle `onValidate()` sans valeur ;
    - les champs sont verrouillés pendant l'envoi et après un échec.
  - `ArchivedCard` props `{ state: ArchivedState; onReactivate: () => void; onClose: () => void }` :
    - `section` « Produit archivé », avec le nom et « Ce produit est archivé. Le réactiver pour l'utiliser ? » ;
    - boutons « Réactiver » (« Réactivation… » pendant l'envoi, « Réessayer » après un échec, avec le message de l'erreur) et « Annuler ».
  - `Notice` : après un inventaire, « ✓ Inventaire : 53 comptés (+29) Coca-Cola 33 cl — stock : 53 (2 packs + 5) », avec « Annuler ».
  - `ScannerScreen` :
    - troisième bouton de mode « Inventaire = », en bleu (`--mode-inv: #1d4ed8`) ;
    - sur l'étape `confirm`, `CountCard` en Inventaire et `ConfirmCard` sinon ;
    - l'envoi appelle `recordInventory` en Inventaire et `recordMovement` sinon ;
    - la réactivation appelle `setArchived(id, false)` ;
    - `onCatalogChanged()` après un enregistrement, une annulation, une réactivation, une fiche créée ou un code ajouté.
  - `ManualEntry` prop `mode: ScanMode`. En Inventaire, le choix du produit mène directement à la saisie du comptage (`units: product.packSize`, `code: null`).
  - **`normalize.ts` (m8) :** `isUnitFormat(format: string): boolean`, vrai pour `ean_13`, `ean_8`, `upc_a` et `upc_e`. `NewProductForm` refuse une canette lue dans un autre format, avec « Vise le code d'une canette ou d'une bouteille, pas celui d'un carton. », et continue la capture.
  - **`NewProductForm` (m10) :** un `id` généré une fois à l'ouverture (`useState(() => crypto.randomUUID())`) et envoyé à chaque essai de `createProduct`.
  - **`scannerErrors.ts` (m15) :** le chemin devient « Réglages › Safari › Caméra (iOS 18 et plus : Réglages › Apps › Safari › Caméra) › Autoriser ». Texte seul, sans test.
  - **Faux backend :** option `loseFirstCreate`. Le premier `create_product` est exécuté, puis sa réponse est coupée (`route.abort('internetdisconnected')`).

- [ ] **Step 1: Écrire les tests unitaires**

```ts
// mode.test.ts
test('le mode Inventaire est gardé ; une valeur inconnue donne Entrée', () => {
  const storage = memoryStorage()
  saveMode('inventory', storage)
  expect(loadMode(storage)).toBe('inventory')
  storage.setItem(MODE_KEY, 'x')
  expect(loadMode(storage)).toBe('in')
})

// scanFlow.test.ts (lipton, PACK, confirmed(), saving() : ceux du fichier ; confirmed() a maintenant counted: null)
test("Inventaire : le nombre compté est gardé à l'envoi et pour « Réessayer »", () => {
  const sent = flowReducer(confirmed(), { type: 'validate', counted: 53 })
  expect(sent).toMatchObject({ status: 'saving', counted: 53, movementId: 'm1' })
  const failed = flowReducer(sent, { type: 'save_failed', kind: 'network' })
  expect(flowReducer(failed, { type: 'validate', counted: 99 })).toMatchObject({ status: 'saving', counted: 53, movementId: 'm1' })
})
test('Inventaire enregistré : la notice porte le nombre compté', () => {
  const sent = flowReducer(confirmed(), { type: 'validate', counted: 53 })
  expect(flowReducer(sent, { type: 'save_done', delta: 29, stock: 53, at: 10_000 })).toMatchObject({
    notice: { kind: 'saved', movementId: 'm1', delta: 29, productName: 'Lipton Pêche 50 cl', stock: 53, packSize: 12, counted: 53 } })
})
test('produit archivé : réactivation puis fiche de confirmation', () => {
  const archived = flowReducer({ step: 'looking_up', code: PACK },
    { type: 'lookup_done', code: PACK, result: { found: true, product: { ...lipton, archived: true }, units: 12 }, movementId: 'm1' })
  expect(archived).toEqual({ step: 'archived', target: { product: { ...lipton, archived: true }, units: 12, code: PACK },
    movementId: 'm1', status: 'idle', errorKind: null })
  expect(flowReducer(archived, { type: 'code_read', rawValue: '5449000000996', format: 'ean_13', at: 0 })).toBe(archived)
  const sending = flowReducer(archived, { type: 'reactivate' })
  expect(flowReducer(sending, { type: 'close' })).toBe(sending)
  expect(flowReducer(sending, { type: 'reactivate_done', product: lipton })).toEqual({ step: 'confirm',
    target: { product: lipton, units: 12, code: PACK }, quantity: 1, movementId: 'm1', status: 'idle', errorKind: null, counted: null })
})
test('réactivation impossible : message, nouvel essai, fermeture', () => {
  const archived = flowReducer({ step: 'looking_up', code: PACK },
    { type: 'lookup_done', code: PACK, result: { found: true, product: { ...lipton, archived: true }, units: 12 }, movementId: 'm1' })
  const failed = flowReducer(flowReducer(archived, { type: 'reactivate' }), { type: 'reactivate_failed', kind: 'network' })
  expect(failed).toMatchObject({ step: 'archived', status: 'failed', errorKind: 'network' })
  expect(flowReducer(failed, { type: 'reactivate' })).toMatchObject({ status: 'saving', errorKind: null })
  expect(flowReducer(failed, { type: 'close' })).toEqual({ step: 'scanning', notice: null, cooldown: null })
})

// normalize.test.ts
test("isUnitFormat : seuls les formats d'une canette ou d'une bouteille", () => {
  expect(['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'].map(isUnitFormat)).toEqual([true, true, true, true, false, false])
})
```

Les tests existants qui comparent une fiche ou une notice `saved` entière reçoivent `counted: null`.

- [ ] **Step 2: Écrire les scénarios e2e I et J, et étendre le scénario D**

- **I (Inventaire),** catalogue `coca_with_code` :
  1. Connexion, puis « Inventaire = ».
  2. La fiche de confirmation a `data-mode="inventory"` et montre « Stock connu : 24 (1 pack) ».
  3. « Packs de 24 » ← 2 et « Unités en plus » ← 5 : la ligne « = 53 (2 packs + 5) — écart : +29 » apparaît.
  4. « Valider » : un appel `record_inventory` avec `{ p_product_id: 'p-coca', p_counted: 53, p_employee: 'Sam' }` et un `p_id` au format uuid. La notice est « ✓ Inventaire : 53 comptés (+29) Coca-Cola 33 cl — stock : 53 (2 packs + 5) ».
  5. « Annuler » sur la notice : `cancel_movement` vise ce `p_id`, et « Annulé — stock : 24 (1 pack) » s'affiche.
  6. « Saisie manuelle », puis « Coca-Cola 33 cl » : la saisie du comptage s'ouvre aussitôt (pas de « Par pack de 24 »).
  7. Après rechargement de la page, « Inventaire = » a `aria-pressed="true"`.
  8. **Premier jour** (spec §4.2), nouveau contexte `{ catalogue: 'empty' }` :
     - « Inventaire = », puis « Nouveau produit » sur la carte « Code inconnu » ;
     - « Ce code vaut (unités) » ← 24, puis « Créer le produit » ;
     - la saisie du comptage s'ouvre, avec « Stock connu : 0 ».
- **J (produit archivé),** catalogue `coca_archived` :
  1. La section « Produit archivé » montre « Coca-Cola 33 cl ».
  2. « Réactiver » : appel `set_product_archived` avec `{ p_product_id: 'p-coca', p_archived: false }`.
  3. La fiche de confirmation montre « Pack de 24 → +24 ».
- **D étendu (m10),** nouveau contexte `{ catalogue: 'empty', loseFirstCreate: true }` :
  1. Créer la fiche comme dans D : « Pas de connexion. Réessaie quand le réseau revient. » s'affiche.
  2. « Créer le produit » une seconde fois : « Pack de 24 → +24 ».
  3. Deux appels `create_product`, avec le même `p_id`.

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/scanner src/codes; E2E_ONLY=D,I,J npm run e2e`
Expected :
- FAIL des tests unitaires : `counted`, l'étape `archived` et `isUnitFormat` n'existent pas encore ;
- D échoue sur « Ce code appartient déjà à un autre produit. ».

- [ ] **Step 4: Écrire le code de la partie Interfaces**

- [ ] **Step 5: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 6: Commit**

Message : `feat(scanner): mode Inventaire, réactivation des produits archivés, création rejouable (m8, m10, m15)`.

---

### Task 6: Liste du stock et fiche produit (lecture, archivage)

**Files:**
- Create: `src/stock/StockScreen.tsx`, `src/stock/ProductSheet.tsx`, `src/stock/MovementList.tsx`, `src/stock/Stock.css`
- Modify: `src/app/AppShell.tsx`, `src/shopping/ShoppingScreen.tsx`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes :
  - `Catalog` (Tâche 4) ;
  - `filterProducts` (`src/products/search.ts`) ;
  - `isLow`, `movementLine` (Tâche 1) et `formatStock` ;
  - `api.getProductDetail` et `api.setArchived` (Tâche 3).
- Produces :
  - `StockScreen` props `{ catalog: Catalog; employee: string; onCatalogChanged: () => void; onSessionExpired: () => void }` :
    - titre « Stock », recherche « Rechercher un produit » ;
    - filtres « Actifs » et « Archivés » (`aria-pressed`) ;
    - liste `<ul aria-label="Produits">`. Chaque ligne est un bouton `product-row`, avec `span.product-name` et `span.product-stock` (`formatStock`) ;
    - classe `stock-low` sur une ligne active quand `isLow` est vrai ;
    - textes vides : « Aucun produit pour l'instant. », « Aucun produit archivé. » et « Aucun produit ne correspond. ».
  - `ProductSheet` props `{ product: Product; employee: string; onCatalogChanged: () => void; onClose: () => void; onSessionExpired: () => void }` :
    - `section` « Fiche produit », avec un titre au nom du produit ;
    - « Stock : 10 », en rouge si `isLow` ;
    - « Pack Metro : 24 · Seuil : 24 · Stock idéal : 48 » ;
    - « Codes » : une ligne « 5449000000996 — 24 unités » (« 1 unité » au singulier) par code. Sans code : « Aucun code : utilise « Saisie manuelle » au Scanner. » ;
    - « Derniers mouvements » : `MovementList`, une ligne `movementLine` par mouvement, barrée (classe `cancelled`) si le mouvement est annulé. Sans mouvement : « Aucun mouvement. » ;
    - les codes et les mouvements sont relus à l'ouverture et après chaque modification ;
    - **produit actif :** « Archiver » demande « Archiver « Coca-Cola 33 cl » ? Il disparaîtra des listes ; son historique est gardé. ». Après confirmation : `setArchived(id, true)`, `onCatalogChanged()`, puis `onClose()` ;
    - **produit archivé :** « Ce produit est archivé. » et « Réactiver » (`setArchived(id, false)`, puis `onCatalogChanged()`). La fiche reste ouverte ;
    - bouton « Retour ».
  - `ShoppingScreen` : chaque ligne devient un bouton qui ouvre la `ProductSheet` du produit. Elle reçoit donc les props de `StockScreen`.
  - `AppShell` : l'onglet Stock rend `StockScreen`.

- [ ] **Step 1: Écrire le scénario e2e K (Stock et fiche)**

Catalogue `pilotage`, connexion, puis « Stock ».
1. **Liste.**
   - Les noms valent `['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl']`, et les stocks `['10', '4', '36 (3 packs)', '−3']`.
   - `stock-low` est présent sur les lignes 1, 2 et 4, absent sur la ligne 3.
2. **Recherche.** « evian » ne laisse que « Évian 1,5 L ». Vider la recherche.
3. **Fiche du Coca.**
   - Ouvrir « Coca-Cola 33 cl » : « Stock : 10 », « Pack Metro : 24 · Seuil : 24 · Stock idéal : 48 » et « 5449000000996 — 24 unités ».
   - Les deux lignes de mouvements correspondent, dans l'ordre, à `/— Léa — Sortie −38$/` puis `/— Sam — Entrée \+48$/`.
4. **Archivage.**
   - « Archiver », dialogue accepté : retour à la liste, sans « Coca-Cola 33 cl ». Le bouton s'appelle « À racheter (2) ».
5. **Réactivation.**
   - « Archivés » : `['Coca-Cola 33 cl', 'Oasis Tropical 33 cl']`.
   - Ouvrir le Coca, puis « Réactiver » : appel `set_product_archived` avec `{ p_product_id: 'p-coca', p_archived: false }`, et « Archiver » réapparaît.
   - « Retour », puis « Actifs » : la liste contient « Coca-Cola 33 cl ».
6. **Depuis À racheter.** « À racheter (3) », puis la ligne Red Bull : la fiche « Red Bull 25 cl » s'ouvre.

- [ ] **Step 2: Lancer le scénario pour vérifier qu'il échoue**

Run: `E2E_ONLY=K npm run e2e`
Expected : échec, car l'onglet Stock affiche encore « Bientôt ».

- [ ] **Step 3: Écrire `StockScreen.tsx`, `ProductSheet.tsx` et `MovementList.tsx` ; brancher Stock et À racheter**

- [ ] **Step 4: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(stock): liste du stock, fiche produit, archivage et réactivation (RG-11)`.

---

### Task 7: Fiche produit — modifier, codes, corriger le stock, nouveau produit sans scan

**Files:**
- Create: `src/stock/ProductEditForm.tsx`, `src/stock/CodeList.tsx`, `src/stock/AddCodeForm.tsx`, `src/stock/ProductCreateForm.tsx`, `src/inventory/CorrectStockForm.tsx`
- Modify: `src/domain/productDraft.ts`, `src/domain/productDraft.test.ts`, `src/codes/normalize.ts`, `src/codes/normalize.test.ts`, `src/stock/ProductSheet.tsx`, `src/stock/StockScreen.tsx`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes :
  - `ProductSheet` et `StockScreen` (Tâche 6) ;
  - `CountFields` (Tâche 5) ;
  - `AttachForm`, `HelpField` et `FIELD_HELP` ;
  - les fonctions d'écriture de l'API (Tâche 3).
- Produces :
  - `productDraft.ts` :
    - `interface ProductFields { name: string; packSize: string; alertThreshold: string; targetStock: string }` ;
    - `validateProductFields(fields: ProductFields): { ok: true; product: Omit<NewProductInput, 'barcodes'> } | { ok: false; errors: Partial<Record<keyof ProductFields, string>> }`, avec les messages actuels de `validateDraft` ;
    - `validateDraft` s'appuie dessus, avec un comportement inchangé.
  - `normalize.ts` : `normalizeTypedCode(text: string): NormalizedCode`, pour un code tapé à la main :
    - les espaces sont retirés ;
    - 8 ou 13 chiffres : clé de contrôle vérifiée ;
    - 12 chiffres (UPC-A) : clé vérifiée, puis un 0 devant ;
    - 14 chiffres : clé vérifiée, puis ramené à 13 chiffres s'il commence par 0 ;
    - tout le reste donne `ignored('invalid_check_digit')`.
  - `ProductEditForm` props `{ product: Product; onSaved: () => void; onCancel: () => void; onSessionExpired: () => void }` :
    - champs `HelpField` « Nom », « Pack Metro (unités) », « Seuil d'alerte (unités) » et « Stock idéal (unités) », pré-remplis ;
    - le seuil et le stock idéal ne suivent pas le pack Metro ;
    - « Enregistrer » appelle `updateProduct`.
  - `CodeList` props `{ product: Product; barcodes: BarcodeEntry[]; onChanged: () => void; onSessionExpired: () => void }`. Pour chaque code :
    - « Modifier » ouvre le champ « Ce code vaut (unités) », et « Enregistrer » appelle `attachBarcode({ code, productId, units, move: false })` ;
    - « Retirer » demande « Retirer le code 5449000000996 ? Les mouvements passés ne changent pas. », puis appelle `detachBarcode`.
  - `AddCodeForm` props `{ product: Product; onDone: () => void; onCancel: () => void; onSessionExpired: () => void }` :
    - champ `HelpField` « Code-barres », avec l'aide « Les chiffres sous les barres. Plus simple : scanne le code au Scanner, puis « Ajouter à un produit existant ». » ;
    - « Continuer » refuse un code invalide avec « Code invalide : vérifie les chiffres. » ;
    - sinon, il ouvre `AttachForm` avec le code normalisé et le produit présélectionné. `onReady` mène à `onDone`.
  - `CorrectStockForm` props `{ product: Product; employee: string; onDone: (stock: number) => void; onCancel: () => void; onSessionExpired: () => void }` :
    - `CountFields` ;
    - un `id` généré à l'ouverture, gardé pour « Réessayer » ;
    - champs verrouillés pendant l'envoi et après un échec ;
    - `recordInventory` ; en cas de succès, la fiche affiche « Stock corrigé : 26 (1 pack + 2) ».
  - `ProductCreateForm` props `{ onCreated: (product: Product) => void; onCancel: () => void; onSessionExpired: () => void }` :
    - mêmes champs que la modification ;
    - le seuil et le stock idéal suivent le pack Metro (`newDraft` et `updateDraft`) ;
    - « Créer le produit » appelle `createProduct({ id, …, barcodes: [] })`, avec un `id` généré à l'ouverture ;
    - le produit créé ouvre sa fiche.
  - `ProductSheet`, pour un produit actif : boutons « Modifier », « Corriger le stock » et « Ajouter un code » ; `CodeList` remplace la liste simple. Un produit archivé reste en lecture seule.
  - `StockScreen` : bouton « Nouveau produit » sous la recherche.

- [ ] **Step 1: Écrire les tests unitaires**

```ts
// productDraft.test.ts
test('validateProductFields : RG-7, sans unités de code', () => {
  expect(validateProductFields({ name: ' Coca ', packSize: '24', alertThreshold: '24', targetStock: '48' }))
    .toEqual({ ok: true, product: { name: 'Coca', packSize: 24, alertThreshold: 24, targetStock: 48 } })
  expect(validateProductFields({ name: 'Coca', packSize: '24', alertThreshold: '24', targetStock: '24' }))
    .toEqual({ ok: false, errors: { targetStock: 'Le stock idéal doit être supérieur au seuil.' } })
  expect(validateProductFields({ name: 'Coca', packSize: '0', alertThreshold: '24', targetStock: '48' }))
    .toEqual({ ok: false, errors: { packSize: 'Entre 1 et 999.' } })
})

// normalize.test.ts
test('code tapé à la main : clé contrôlée, espaces ignorés, formes ramenées à 13 chiffres', () => {
  expect(normalizeTypedCode('4006381333931')).toEqual({ kind: 'product', code: '4006381333931' })
  expect(normalizeTypedCode('4006 3813 3393 1')).toEqual({ kind: 'product', code: '4006381333931' })
  expect(normalizeTypedCode('036000291452')).toEqual({ kind: 'product', code: '0036000291452' })
  expect(normalizeTypedCode('05449000000996')).toEqual({ kind: 'product', code: '5449000000996' })
  expect(normalizeTypedCode('96385074')).toEqual({ kind: 'product', code: '96385074' })
  expect(['4006381333932', 'abc', '', '12345'].map(normalizeTypedCode))
    .toEqual(Array(4).fill({ kind: 'ignored', reason: 'invalid_check_digit' }))
})
```

- [ ] **Step 2: Écrire le scénario e2e L (modifications depuis la fiche)**

Catalogue `pilotage`, connexion, « Stock », puis la fiche « Coca-Cola 33 cl ». Tous les dialogues sont acceptés.
1. **Modifier.**
   - « Modifier », « Seuil d'alerte (unités) » ← 30, « Stock idéal (unités) » ← 30, « Enregistrer » : « Le stock idéal doit être supérieur au seuil. », sans appel.
   - « Stock idéal (unités) » ← 48, « Enregistrer » : appel `update_product` avec `{ p_id: 'p-coca', p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 30, p_target_stock: 48 }`, et la fiche montre « Pack Metro : 24 · Seuil : 30 · Stock idéal : 48 ».
2. **Unités d'un code.** « Modifier » sur « 5449000000996 — 24 unités », 12, « Enregistrer » : appel `attach_barcode` avec `{ p_code: '5449000000996', p_product_id: 'p-coca', p_units: 12, p_move: false }`, et la ligne devient « 5449000000996 — 12 unités ».
3. **Ajouter un code.**
   - « Ajouter un code », « 4006381333932 », « Continuer » : « Code invalide : vérifie les chiffres. ».
   - « 4006381333931 », « Continuer », « Ce code vaut (unités) » ← 1, « Ajouter le code » : appel `attach_barcode` avec `{ p_code: '4006381333931', p_product_id: 'p-coca', p_units: 1, p_move: false }`, et la ligne « 4006381333931 — 1 unité » apparaît.
4. **Retirer un code.** « Retirer » sur cette ligne : appel `detach_barcode` avec `{ p_code: '4006381333931' }`, et la ligne disparaît.
5. **Corriger le stock.**
   - « Corriger le stock », « Packs de 24 » ← 1, « Unités en plus » ← 2 : « = 26 (1 pack + 2) — écart : +16 ».
   - « Valider » : appel `record_inventory` avec `p_product_id: 'p-coca'`, `p_counted: 26` et `p_employee: 'Sam'`.
   - La fiche montre « Stock : 26 (1 pack + 2) », et la première ligne de mouvement correspond à `/— Sam — Inventaire : 26 comptés \(\+16\)$/`.
6. **Nouveau produit sans scan.**
   - « Retour », « Nouveau produit », « Nom » ← « Schweppes Agrumes 33 cl », « Pack Metro (unités) » ← 24. Le seuil devient 24 et le stock idéal 48.
   - « Créer le produit » : appel `create_product` avec `p_barcodes: []`, `p_pack_size: 24`, `p_alert_threshold: 24`, `p_target_stock: 48` et un `p_id` au format uuid.
   - La fiche « Schweppes Agrumes 33 cl » montre « Aucun code : utilise « Saisie manuelle » au Scanner. », et le bouton s'appelle « À racheter (4) ».

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain/productDraft.test.ts src/codes/normalize.test.ts; E2E_ONLY=L npm run e2e`
Expected : FAIL, car les fonctions et les boutons n'existent pas encore.

- [ ] **Step 4: Écrire le code de la partie Interfaces**

- [ ] **Step 5: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 6: Commit**

Message : `feat(stock): modifier la fiche, gérer les codes, corriger le stock, nouveau produit sans scan`.

---

### Task 8: Mise en service du jalon 2

**Files:**
- Create: `docs/jalon-2-test.md`
- Modify: `README.md`, `docs/superpowers/specs/2026-10-19-scandrinks-design.md`

**Interfaces:**
- Consumes : la migration et les tests SQL (Tâche 2), l'app complète (Tâches 1 à 7).
- Produces : le jalon 2 en ligne. D'abord en préversion sur `https://jalon-2.scandrinks.pages.dev`, puis sur `https://scandrinks.pages.dev` après la fusion.

- [ ] **Step 1: Contrôles avant migration**, sur le vrai projet, avec `mcp__Supabase__execute_sql`

- `select count(*) from public.movements where not ((kind = 'in' and delta > 0) or (kind = 'out' and delta < 0) or kind = 'inventory') or ((kind = 'inventory') <> (counted is not null));`
  Expected : 0, donc les nouvelles contraintes acceptent les données d'essai.
- Noter les nombres de lignes de `products`, `barcodes` et `movements`.

- [ ] **Step 2: Appliquer la migration**

`mcp__Supabase__apply_migration`, avec `name: 'pilotage'` et le contenu exact de `supabase/migrations/20261020100000_pilotage.sql`.

- [ ] **Step 3: Tests SQL sur le vrai projet**

- `execute_sql` avec `supabase/tests/database.test.sql`. Expected : `OK`.
- Les trois nombres de lignes du Step 1 sont inchangés.

- [ ] **Step 4: Conseils de Supabase**

`get_advisors`, avec `security` puis `performance`. Expected : aucune alerte ERROR. Les alertes WARN sont notées dans le journal, avec leur lien de correction.

- [ ] **Step 5: Compatibilité avec l'app du jalon 1 en service**

Run, avec `SB` = `VITE_SUPABASE_URL` et `KEY` = `VITE_SUPABASE_PUBLISHABLE_KEY`, les valeurs de `.env.production` :

```bash
curl -sS -X POST "$SB/rest/v1/rpc/create_product" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"p_name":"x","p_pack_size":1,"p_alert_threshold":0,"p_target_stock":1,"p_barcodes":[]}'
```

Expected : `42501` (fonction trouvée, accès refusé sans connexion), et non `PGRST202` (fonction introuvable).

- [ ] **Step 6: Documentation**

- **`docs/jalon-2-test.md`**, en français simple, environ 20 minutes :
  1. les onglets et le badge ;
  2. À racheter : la liste, le nombre de packs, une entrée qui fait disparaître une ligne ;
  3. l'inventaire d'un pack (« packs + unités »), son écart, puis « Annuler » ;
  4. Stock : le tri, le rouge, la recherche ;
  5. la fiche : modifier un seuil et voir À racheter changer, corriger un stock, ajouter puis retirer un code ;
  6. archiver un produit d'essai, le retrouver dans « Archivés », le réactiver par un scan ;
  7. un nouveau produit sans scan ;
  8. deux iPhone : une entrée sur l'un, À racheter à jour sur l'autre ;
  9. le mode avion pendant un enregistrement, un changement d'onglet, puis « Réessayer ».

  Règle : le jalon 2 est validé si la liste d'achat est cohérente après quelques scans, sans aide. Le chemin des réglages caméra est celui du point m15.
- **README :** section « Jalon 2 », nouvelles fonctions SQL, commande des tests.
- **Spec :**
  - §6.3 : `create_product` avec `p_id` ; `update_product`, `set_product_archived` et `detach_barcode` ;
  - §6.5 : organisation « ScanDrinks » au lieu de « Webia », et ligne des limites mise à jour ;
  - §11 : les décisions de la section « Décisions prises dans ce plan », datées du 20/10/2026.

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 7: Commit et envoi**

Message : `docs(jalon-2): mise en service, protocole de test`, puis `git push -u origin jalon-2`.
Expected : Cloudflare construit la préversion.

- [ ] **Step 8: Contrôles de la préversion**

- La préversion répond en 200 et sert le paquet du build local.
- Sans connexion, `record_inventory`, `update_product`, `set_product_archived` et `detach_barcode` répondent `42501`.
- L'inscription est toujours refusée (`signup_disabled`).
- Script Playwright jetable, dans le dossier temporaire : un mauvais mot de passe donne « Mot de passe incorrect. ».

- [ ] **Step 9: Test du porteur du projet sur iPhone**, d'après `docs/jalon-2-test.md`

Les défauts trouvés sont corrigés en TDD sur `jalon-2`.

- [ ] **Step 10: Fusion dans `main`**, avec l'accord du porteur du projet

Run: `git fetch origin main && git checkout main && git merge --ff-only jalon-2 && git push origin main`
Expected : `scandrinks.pages.dev` sert le jalon 2.

---

## Décisions prises dans ce plan (la spec ne les fixe pas)

- **Onglets :** Scanner, À racheter et Stock ; l'onglet Historique arrive au jalon 3. Le Scanner s'ouvre au démarrage.
- **Réglages :** ils s'affichent par-dessus l'app, sans démonter le Scanner. Une fiche en cours survit à un changement d'onglet ou aux Réglages (m9).
- **Fraîcheur :** relecture à l'ouverture d'un onglet, au retour dans l'app et après chaque action, avec « Mis à jour à HH:MM » ; pas de Realtime.
- **Date des mouvements :** « lun. 14:32 » pendant 7 jours, puis « 13/10 10:05 », puis « 15/06/2025 12:00 » pour une autre année ; heure de Paris.
- **Inventaire :**
  - un comptage égal au stock est enregistré (écart 0), pour garder la trace du contrôle ;
  - les champs démarrent vides, sans le stock connu, pour ne pas influencer le comptage.
- **Modifier une fiche :** le seuil et le stock idéal ne suivent plus le pack Metro ; ils le suivent seulement à la création.
- **Codes depuis la fiche :**
  - un code ajouté à la main est tapé en chiffres, avec sa clé contrôlée ;
  - retirer un code supprime l'association, et les mouvements gardent le code en texte.
- **À racheter :** chaque ligne ouvre la fiche du produit.
- **Prénoms :** une seule orthographe par prénom (la première enregistrée) dans le choix du prénom.
- **Tri :** ordre alphabétique français partout (accents et casse ignorés).
