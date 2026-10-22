# ScanDrinks — Jalon 5 (la fin de journée) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** l'onglet « Ventes ». Chaque soir, l'équipe y saisit les ventes du jour, lues sur la caisse, et le stock de toute la boutique baisse d'autant. La feuille A4 et la vidéo tuto suivent.

Validation (spec §9) : une semaine de fins de journée, puis le recomptage de 5 produits. Les écarts doivent s'expliquer.

**Architecture :**
- **Base.** Une seule migration, faite uniquement d'ajouts :
  - la colonne `movements.sale_day` et sa contrainte ;
  - un index unique partiel : au plus une vente active par produit et par jour ;
  - la fonction `record_sales(day, lines, employee)` ;
  - `list_history`, qui rend aussi `sale_day`.

  Une vente est une sortie (`kind = 'out'`) datée. Ni la vue `product_stock`, ni `cancel_movement`, ni l'app du jalon 4 n'ont donc à changer.
- **Règles pures.**
  - `src/domain/sales.ts` : les 7 jours proposés (heure de Paris), la lecture des cases, le total.
  - `src/domain/movements.ts` nomme les ventes : « Vente −2 (ventes du 22/10) ».
- **API.** `recordSales` et `listDaySales` ; la fiche produit et l'Historique lisent `sale_day`. Le faux backend des tests de bout en bout suit la base.
- **Écran.** `src/sales/SalesScreen.tsx` est le cinquième onglet, entre Stock et Historique.
  - Il reprend les classes communes : listes groupées, recherche, messages.
  - Pas de nouvelle maquette : les captures `npm run screens` le montrent au porteur du projet dès la Tâche 4.
- **Mise en service.** La préversion lit `sale_day` : la migration passe donc sur le vrai projet avant elle. Cela se fait à la Tâche 7, après la relecture finale, avec l'accord du porteur du projet.

**Tech Stack :** celle du jalon 4 (Vite 8, React 19, TypeScript 7 strict, Vitest, Playwright 1.56.1, supabase-js 2.117.2, zxing-wasm 3.1.3), sans nouvelle dépendance. La vidéo utilise ffmpeg, et la feuille poppler-utils, comme au jalon 4.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, surtout :
- §1, §2 (le stock couvre toute la boutique) ;
- §4 (cinq onglets), §4.2 (« Sortie − »), §4.5 (lignes « Vente »), §4.8 (l'écran) ;
- RG-3 et RG-14 ;
- §6.3 (`sale_day`, `record_sales`, `list_history`), §6.7 (charte) ;
- §7 (les deux dernières lignes), §8 « Jalon 5 », §9 « Bascule vers la fin de journée » ;
- §10, et §11 (décisions du 22/10/2026).

**Ordre :** les Tâches 1 à 6, puis la relecture finale de toute la branche, puis la Tâche 7 (mise en service).
- La migration ne touche le vrai projet qu'à la Tâche 7. Une correction demandée par la relecture se fait donc dans le fichier, encore jamais appliqué.
- Délai visé : en service avant la fermeture du 23/10, première fin de journée. Les ventes du 22/10 n'ont pas à être saisies : l'inventaire de ce soir les compte déjà.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Apostrophe droite `'` dans les textes de l'interface. Le signe moins affiché est U+2212 (`−`), toujours via `formatDelta`.
  - Espace insécable avant « : » seulement dans les textes d'aide de `fieldHelp.ts`, comme avant.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit.
- **Navigation.** Une seule page, sans changement d'URL. « Ventes » est un onglet de la barre, démonté quand on le quitte, comme l'Historique.
- **iPhone.**
  - iOS 16.4 au minimum ; champs de saisie en 16 px au moins.
  - Clavier numérique : `inputMode="numeric" pattern="[0-9]*"`.
  - Rien ne dépasse en largeur à 320 px, ni ne passe sous la barre d'onglets.
- **Charte.**
  - Couleurs de `src/theme/tokens.css` seulement ; classes communes de `AppShell.css`.
  - Libellé d'onglet en 12 px, et 11 px sous 360 px de large : sans cela, les cinq noms ne tiennent pas à 320 px. C'est le seul écart, inscrit dans la spec à la Tâche 5.
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées. L'icône de l'onglet est recopiée de lucide-static 0.468.0, comme les autres, sans installer le paquet.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`). Ne jamais toucher à l'organisation ni au projet « Webia ».
  - Une seule migration, faite d'ajouts. Aucune instruction `drop`, `delete` ni `truncate`, même dans un corps de fonction.
  - `create or replace` seulement pour `list_history`, avec la même signature. Les migrations existantes ne sont jamais modifiées.
  - Les tests SQL tournent en local seulement (`supabase/tests/run-local.sh`). Sur le vrai projet, rien d'autre que la migration (Tâche 7, avec l'accord du porteur du projet), puis des lectures (`select`) de contrôle ; aucune écriture d'essai.
  - Seule la clé publique `sb_publishable_…` va dans le dépôt. Ne jamais demander de mot de passe, de jeton ni de clé secrète.
- **Mots de passe.** Jamais demandés, affichés, écrits ni journalisés.
- **Vidéo.**
  - Données fictives seulement : la version e2e, sa base simulée, ses prénoms (Sam, Léa). Jamais la vraie base, ni le vrai mot de passe, ni l'adresse du compte du tabac.
  - `public/tutoriel/` est en ligne pour tous : aucun fichier de plus de 25 Mo, et `public/tutoriel/video/` reste sous 20 Mo.
  - Le MP4 n'est pas versionné.
- **Préversion.** `https://jalon-5.scandrinks.pages.dev` utilise la vraie base. L'essai du porteur du projet y enregistre une vente, puis l'annule.
- **Fusion** dans `main` : avec l'accord du porteur du projet.

## Review Focus

1. **Saisie juste après minuit, ou autour du changement d'heure** (nuit du 24 au 25/10/2026).
   - Attendu : « Aujourd'hui » est le jour du calendrier de Paris quand l'écran s'ouvre. Les 6 jours d'avant suivent le calendrier ; on ne retranche jamais des tranches de 24 h. La base accepte les mêmes 7 jours.
   - Tests : `sales.test.ts`, autour de minuit et du 25/10 (Tâche 2) ; bornes du jour en SQL, cas 31 (Tâche 1).
2. **Ce qu'on tape dans une case** : « 03 », « 3 » entouré d'espaces, « 1,5 », « -2 », « 1000 », ou un collage « 12a ».
   - Attendu : les espaces sont ignorés et « 03 » vaut 3. Le reste est refusé : la case passe en rouge, et « Valider » affiche le message sans ouvrir le récapitulatif.
   - Tests : `parseSold` dans `sales.test.ts` (Tâche 2) ; scénario e2e T, étape 2 (Tâche 4).
3. **Un produit qui quitte « À saisir » pendant qu'on tape** : archivé, ou saisi sur un autre téléphone.
   - Attendu : il disparaît de la liste à la relecture. Ce qu'on avait tapé pour lui n'entre ni dans le total ni dans l'envoi.
   - Tests : `readEntries` ignore les produits absents de la liste (Tâche 2) ; scénario T, étape 6 (Tâche 4).
4. **Changement de jour rapide, avec une réponse lente.**
   - Attendu : « Déjà saisi » montre toujours le jour choisi. Une réponse en retard, pour l'ancien jour, est ignorée.
   - Test : scénario T, étape 8, avec une lecture retardée (Tâche 4).
5. **Deux téléphones qui enregistrent le même produit, le même jour, au même instant.**
   - Attendu : l'un enregistre ; l'autre reçoit « Déjà saisi pour ce jour : … », jamais un message d'erreur trompeur ni un doublon. Un envoi jumeau, avec les mêmes identifiants, est rejoué sans rien compter deux fois.
   - Test : `supabase/tests/sales-race.test.sh`, deux sessions PostgreSQL simultanées (Tâche 1).

---

### Task 1: La base — migration et tests SQL

**Files:**
- Create : `supabase/migrations/20261022130000_fin_de_journee.sql`, `supabase/tests/sales-race.test.sh`
- Modify : `supabase/tests/database.test.sql` (cas 30 à 33, en-tête), `supabase/tests/run-local.sh` (lance aussi la course)

**Interfaces:**
- Produces (SQL) :
  - **Colonne et contraintes.**
    - `public.movements.sale_day date`, vide par défaut.
    - Contrainte `movements_sale_day_out check (sale_day is null or kind = 'out')`.
    - Index `movements_one_active_sale`, unique, sur `public.movements (product_id, sale_day) where sale_day is not null and cancelled_at is null`.
  - **`public.record_sales(p_day date, p_lines jsonb, p_employee text) returns jsonb`.**
    - `language plpgsql security invoker set search_path = ''`.
    - Droits : `revoke all … from public, anon` ; `grant execute … to authenticated`.
    - Entrée `p_lines` : `[{ "id": uuid, "product_id": uuid, "quantity": int }]`.
    - Réponses :
      - `{"status": "recorded", "units": <int>, "duplicate": <bool>}` ;
      - `{"status": "already_recorded", "products": [<noms>]}`. L'ordre des noms est indifférent : l'app les trie.
    - Erreurs : `not_allowed` (42501), puis, dans cet ordre, ces exceptions P0001 :
      - `invalid_input:employee` : prénom de 1 à 30 caractères après `btrim` ;
      - `invalid_input:day` : jour vide, ou hors de [aujourd'hui − 6 ; aujourd'hui], avec aujourd'hui = `(now() at time zone 'Europe/Paris')::date` ;
      - `invalid_input:lines` : pas un tableau, 0 ligne ou plus de 200, ou deux lignes avec le même identifiant ou le même produit ;
      - `invalid_input:id` : identifiant vide, ou déjà pris par un mouvement qui n'est pas une vente de ce produit ce jour-là ;
      - `invalid_input:product` : produit vide ou inconnu ;
      - `invalid_input:quantity` : quantité vide ou hors de 1 à 999.
  - **`public.list_history(...)`** : même signature, même comportement. Chaque ligne reçoit aussi `'sale_day'`.

- **Déroulé de `record_sales`.** Le verrou vient avant tout contrôle :
  1. Les contrôles d'accès et de saisie ci-dessus.
  2. Les produits des lignes sont verrouillés dans un ordre fixe : `perform 1 from public.products where id in (…) order by id for update`. Deux téléphones attendent alors l'un après l'autre, sans interblocage.
  3. Un produit absent donne `invalid_input:product`.
  4. **Lignes rejouées** (identifiant déjà en base) : elles sont vérifiées, puis comptées sans être réinsérées.
  5. **Conflit** : un produit d'une nouvelle ligne a déjà une vente active ce jour-là. La fonction répond alors `already_recorded` avec les noms concernés, sans rien insérer, même pour les autres lignes.
  6. **Nouvelles lignes** : `kind 'out'`, `delta = −quantity`, `sale_day = p_day`, `barcode` vide, prénom nettoyé par `btrim`.
  7. **Réponse.**
     - `units` : la somme des quantités. Une ligne rejouée compte ce qui avait été enregistré (−delta), même si la quantité envoyée a changé depuis.
     - `duplicate` : vrai si aucune ligne n'est nouvelle.
- En-tête du fichier, dans le style des migrations précédentes :
  - les ventes de fin de journée, compatibles avec l'app du jalon 4 encore en service, qui voit une vente comme une sortie ;
  - rien n'est retiré.

- [ ] **Step 1: Écrire les tests SQL (cas 30 à 33)** dans `database.test.sql`, avant `reset role; rollback;` ; l'en-tête cite la fin de journée.

  **Mise en place**, en tant que postgres :
  - trois produits, « Test ventes A », « Test ventes B » et « Test ventes C » (identifiants fictifs `…f0a1`, `…f0b1`, `…f0c1`, pack de 6) ;
  - une entrée de 12 pour chacun ;
  - `scandrinks_test.today` = le jour de Paris.

  **30. Saisie, rejeu, conflit, annulation**, en tant que A :
  - **Enregistrement.** `record_sales(today, [A:3 id s1, B:2 id s2], ' Testeur ')` donne exactement `{"status":"recorded","units":5,"duplicate":false}`.
    - Stocks : A = 9, B = 10.
    - La ligne s1 : `kind 'out'`, `delta −3`, `sale_day` = today, `barcode` vide, `employee 'Testeur'`.
  - **Rejeu à l'identique** : `{"status":"recorded","units":5,"duplicate":true}` ; les stocks ne bougent pas.
  - **Rejeu modifié** : s1 seule, avec la quantité 4, donne `units 3` et `duplicate true`.
  - **Conflit** : `[A:1 id s3, C:2 id s4]` donne `status already_recorded` et `products ["Test ventes A"]`. Ni s3 ni s4 n'existent ensuite, et le stock de C reste 12.
  - **Annulation puis nouvelle saisie** : `cancel_movement(s1, 'Testeur')`, puis `[A:1 id s5]` donne `recorded`, avec `units 1`. Stock de A : 11.

  **31. Bornes** (chacune par `pg_temp.expect_error`, sauf la première) :
  - Jour accepté : `today − 6`, pour C avec un nouvel identifiant, donne `recorded`.
  - `invalid_input:day` :
    - jour `today − 7` ;
    - jour `today + 1` ;
    - jour `null`.
  - `invalid_input:quantity` :
    - quantité 0 ;
    - quantité 1000.
  - Erreur `22P02` : quantité `1.5`.
  - `invalid_input:lines` :
    - `'[]'` ;
    - `'{}'` ;
    - deux lignes du même produit ;
    - deux lignes de même identifiant.
  - `invalid_input:product` : produit inconnu.
  - `invalid_input:id` :
    - identifiant `null` ;
    - s2 renvoyé pour le produit A ;
    - s2 renvoyé pour le jour `today − 1`.
  - `invalid_input:employee` : prénom `'  '`.

  **32. Droits et contraintes :**
  - Sans connexion (anon) : 42501. Avec le compte B : 42501.
  - En postgres :
    - une entrée (`'in'`) avec un `sale_day` donne 23514 ;
    - une seconde vente active de B le même jour, insérée directement, donne 23505.
  - En tant que A : `update public.movements set sale_day = …` donne 42501, car la colonne n'est pas modifiable.

  **33. Historique** : `list_history(null, null, 100)` contient s2 avec `sale_day` = today. Une entrée de la mise en place a la clé `sale_day`, de valeur `null`.

- [ ] **Step 2: Écrire `supabase/tests/sales-race.test.sh`**, sur le modèle de `reset.test.sh` (fonctions `fresh`, `scandrinks`, `value`, `fail`, `expect_equal`).

  **Base jetable `scandrinks_race`** :
  - l'imitation de Supabase et les migrations ;
  - le compte du tabac, sa session et son entrée dans `allowed_users`, comme la mise en place de `database.test.sql` ;
  - un produit « Course Coca » avec une entrée de 12.

  **Session des deux psql** :
  - `set role authenticated; set request.jwt.claims = '…';`, avec `-q -At`, pour que seule la réponse JSON s'affiche ;
  - le jour vaut `(now() at time zone 'Europe/Paris')::date`.

  **Cas 1, deux saisies du même produit :**
  - La session 1, en arrière-plan, envoie `begin`, puis la vente de 2 (id r1), `pg_sleep(2)` et `commit`. Sa sortie va dans un fichier temporaire.
  - 0,5 s plus tard, la session 2 envoie la vente de 3 (id r2). Elle attend le verrou, puis répond `already_recorded` avec `["Course Coca"]`.
  - La session 1 a répondu `recorded`. Il reste une seule vente active, et le stock vaut 10.

  **Cas 2, un envoi jumeau.** Même montage, pour la veille, avec la même ligne (id t1, quantité 1) dans les deux sessions :
  - la session 1 répond `recorded` avec `duplicate false` ;
  - la session 2 répond `recorded` avec `duplicate true` ;
  - une seule ligne t1.

  Le script affiche « Course OK ». `run-local.sh` le lance après `reset.test.sh`.

- [ ] **Step 3: Vérifier que les tests échouent**

  Run : `pg_ctlcluster 16 main start; su postgres -c "bash supabase/tests/run-local.sh"`
  Expected : FAIL au cas 30 (`function public.record_sales(...) does not exist`).

- [ ] **Step 4: Écrire la migration** `20261022130000_fin_de_journee.sql`, selon les Interfaces ci-dessus.

- [ ] **Step 5: Vérifier que tout passe**

  Run : `su postgres -c "bash supabase/tests/run-local.sh"`
  Expected : `OK`, puis la sortie de la remise à zéro sans erreur, puis « Course OK ». Arrêter ensuite le PostgreSQL local : `pg_ctlcluster 16 main stop`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261022130000_fin_de_journee.sql supabase/tests/
git commit -m "feat(base): ventes de fin de journée (sale_day, record_sales)"
```

### Task 2: Règles pures — jours, cases, total et libellés

**Files:**
- Create : `src/domain/sales.ts`, `src/domain/sales.test.ts`
- Modify :
  - `src/domain/movements.ts`, `src/domain/movements.test.ts` ;
  - chaque littéral `Movement` ou `HistoryMovement` des tests, qui reçoit `saleDay: null` (`tsc` les liste ; par exemple `src/history/historyList.test.ts`).

**Interfaces:**
- Produces (`src/domain/sales.ts`) :
  - `SOLD_MAX = 999`.
  - `interface SalesDay { day: string; label: string; short: string }` :
    - `day` au format `AAAA-MM-JJ` ;
    - `label` : « Aujourd'hui, jeu. 22/10 », « Hier, mer. 21/10 », puis « mar. 20/10 » ;
    - `short` : « jeu. 22/10 ».
  - `salesDays(now: Date): SalesDay[]` donne 7 jours, aujourd'hui en premier.
    - Le jour de Paris vient d'`Intl.DateTimeFormat` (`timeZone: 'Europe/Paris'`).
    - Les jours d'avant se calculent sur le calendrier : `Date.UTC(année, mois − 1, jour − i)`, puis un format avec `timeZone: 'UTC'`. On ne retranche jamais 24 h.
  - `type SoldInput = { kind: 'empty' } | { kind: 'ok'; quantity: number } | { kind: 'invalid' }`.
  - `parseSold(text: string): SoldInput` :
    - texte coupé de ses espaces ;
    - vide, ou un nombre égal à 0 : `empty` ;
    - `/^[0-9]+$/` de 1 à 999 : `ok` ;
    - le reste : `invalid`.
  - `interface SalesDraft { lines: Array<{ productId: string; quantity: number }>; invalidIds: string[]; units: number }`.
  - `readEntries(entries: Readonly<Record<string, string>>, productIds: readonly string[]): SalesDraft` :
    - seuls comptent les produits de `productIds`, dans leur ordre ;
    - une case vide ou à 0 est ignorée ;
    - `units` est la somme des quantités valides.
  - `formatDrinks(units: number): string` : « 0 boisson », « 1 boisson », « 9 boissons ».
  - `formatSaleDay(day: string): string` : `'2026-10-22'` donne « 22/10 ».
  - `NOTHING_SOLD_MESSAGE = 'Tape le nombre de boissons vendues.'`.
  - `SOLD_INVALID_MESSAGE = 'Vendus : un nombre de 1 à 999.'`.
- Produces (`src/domain/movements.ts`) :
  - `Movement` reçoit `saleDay: string | null` ; `HistoryMovement` en hérite.
  - Une sortie avec `saleDay` est une vente :
    - `describeMovement` donne « Vente −2 (ventes du 22/10) » ;
    - `historyParts` donne pour type « Vente (ventes du 22/10) », avec le montant `formatDelta(delta)` ;
    - `movementLine`, `historyLine` et `movementParts` suivent sans autre changement.
  - L'en-tête du fichier cite l'exemple de vente du §4.5.

- [ ] **Step 1: Écrire les tests**

  **`sales.test.ts` :**
  - **Jours d'un jeudi soir.** `salesDays(new Date('2026-10-22T17:30:00Z'))` donne exactement ces 7 jours :
    - `{ day: '2026-10-22', label: "Aujourd'hui, jeu. 22/10", short: 'jeu. 22/10' }` ;
    - `{ day: '2026-10-21', label: 'Hier, mer. 21/10', short: 'mer. 21/10' }` ;
    - puis les jours du 20 au 16/10, avec les libellés « mar. 20/10 », « lun. 19/10 », « dim. 18/10 », « sam. 17/10 » et « ven. 16/10 ».
  - **Minuit**, d'après le premier `day` :
    - `2026-10-22T21:59:00Z` donne `'2026-10-22'` ;
    - `2026-10-22T22:00:00Z` donne `'2026-10-23'`.
  - **Changement d'heure** :
    - `2026-10-25T22:30:00Z` donne `'2026-10-25'` ;
    - `2026-10-25T23:00:00Z` donne `'2026-10-26'` ;
    - les jours de `2026-10-26T18:00:00Z` vont du 26 au 20/10, chacun une fois, sans trou.
  - **Changement d'année** : `2027-01-02T10:00:00Z` donne « Aujourd'hui, sam. 02/01 », « Hier, ven. 01/01 », puis « jeu. 31/12 » (`'2026-12-31'`).
  - **`parseSold`** :
    - `''`, `'   '`, `'0'` et `'00'` donnent `empty` ;
    - `'3'`, `' 3 '` et `'03'` donnent `ok 3`, et `'999'` donne `ok 999` ;
    - `'1000'`, `'1,5'`, `'-2'`, `'12a'` et `'٣'` donnent `invalid`.
  - **`readEntries`** : avec `{ p1: '3', p2: '', p3: '1000', p4: '2', parti: '5' }` et la liste `['p1', 'p2', 'p3', 'p4']`, le résultat est :
    - `lines` : `[{ productId: 'p1', quantity: 3 }, { productId: 'p4', quantity: 2 }]` ;
    - `invalidIds` : `['p3']` ;
    - `units` : 5.
  - **Formats** : `formatDrinks(0)`, `formatDrinks(1)` et `formatDrinks(9)` ; `formatSaleDay('2026-10-22')` donne `'22/10'`.

  **`movements.test.ts`**, pour une vente de Coca-Cola 50 cl : `delta −2`, `saleDay '2026-10-22'`, Sam, `createdAt '2026-10-22T17:42:00Z'`, `now` = `2026-10-22T18:00:00Z`. On attend :
  - `describeMovement` : « Vente −2 (ventes du 22/10) » ;
  - `historyLine` : « jeu. 19:42 — Sam — Vente −2 (ventes du 22/10) — Coca-Cola 50 cl » ;
  - `historyParts` : `{ title: 'Coca-Cola 50 cl', amount: '−2', meta: 'Vente (ventes du 22/10) · jeu. 19:42 · Sam' }` ;
  - `movementParts` : le titre « Vente −2 (ventes du 22/10) ».

  Une sortie sans `saleDay` reste « Sortie −24 ».

- [ ] **Step 2: Vérifier l'échec**

  Run : `npx vitest run src/domain`
  Expected : FAIL. `sales.ts` est introuvable, et les libellés de vente sont absents.

- [ ] **Step 3: Écrire `sales.ts`, puis compléter `movements.ts`** ; ajouter `saleDay: null` aux littéraux des tests.

- [ ] **Step 4: Vérifier**

  Run : `npx vitest run src/domain && npm run typecheck`
  Expected : tous les tests passent, et la vérification des types est sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/domain src/history/historyList.test.ts
git commit -m "feat(ventes): jours, cases, total et libellés des ventes"
```

### Task 3: API et faux backend

**Files:**
- Modify : `src/data/api.ts`, `src/data/api.test.ts`, `e2e/fakeSupabase.mjs`

**Interfaces:**
- Consumes :
  - `Movement.saleDay` (Tâche 2) ;
  - `compareNames` (`src/domain/names.ts`) ;
  - la fonction SQL et ses réponses (Tâche 1).
- Produces (`src/data/api.ts`) :
  - `interface DaySale { id: string; productId: string; productName: string; units: number; employee: string; createdAt: string }`. Ici, `units` est positif : −delta.
  - `interface SaleLine { id: string; productId: string; quantity: number }`.
  - `interface SalesInput { day: string; lines: SaleLine[]; employee: string }`.
  - `type RecordSalesResult = { status: 'recorded'; units: number; duplicate: boolean } | { status: 'already_recorded'; products: string[] }`.
  - **`api.recordSales(input: SalesInput): Promise<RecordSalesResult>`.**
    - Appel : `rpc('record_sales', { p_day, p_lines: [{ id, product_id, quantity }], p_employee })`.
    - Les noms d'`already_recorded` sont triés par `compareNames`.
  - **`api.listDaySales(day: string): Promise<DaySale[]>`.**
    - Lecture : `from('movements').select('id, product_id, delta, employee, created_at, product:products(name)').eq('sale_day', day).is('cancelled_at', null)`.
    - Résultat trié par nom de produit (`compareNames`).
  - `MovementRow` reçoit `sale_day?: string | null`, et `toMovement` le rend en `saleDay` (`?? null`).
  - `getProductDetail` ajoute `sale_day` à sa liste de colonnes.
- Produces (`e2e/fakeSupabase.mjs`) :
  - `movementRow(productId, kind, delta, employee, createdAt, counted = null, saleDay = null)` : la ligne porte `sale_day`.
  - La route `/rest/v1/movements` :
    - filtre sur `product_id=eq.…`, `sale_day=eq.…` et `cancelled_at=is.null`, chacun seulement s'il est présent ;
    - ses lignes portent `sale_day` ;
    - si le `select` contient `product:products(name)`, chaque ligne reçoit `product: { name }`.
  - Les lignes de `list_history` portent `sale_day`.
  - **`record_sales`** suit les mêmes règles, réponses et erreurs que la base, conflit compris.
    - « Aujourd'hui » est le jour de Paris de l'horloge simulée : `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' })`.
    - Chaque nouvelle vente est datée `now()`.
  - `addMovement({ productId, kind, delta, employee, saleDay = null })`.
  - Le commentaire des options le note : `loseFirst` accepte `'record_sales'`.

- [ ] **Step 1: Écrire les tests** (`api.test.ts`). Le faux constructeur de requête apprend la méthode `is`. Tests :
  - **`recordSales`.**
    - Il appelle `record_sales` avec `{ p_day: '2026-10-22', p_lines: [{ id: 'l1', product_id: 'p1', quantity: 3 }], p_employee: 'Sam' }`.
    - Il rend `{ status: 'recorded', units: 3, duplicate: false }`.
    - Un `already_recorded` qui cite `['Red Bull 25 cl', 'Évian 1,5 L', 'Coca-Cola 33 cl']` devient `['Coca-Cola 33 cl', 'Évian 1,5 L', 'Red Bull 25 cl']`.
  - **`listDaySales('2026-10-22')`.**
    - Appels notés : `select`, avec la chaîne exacte ci-dessus, `eq('sale_day', '2026-10-22')` et `is('cancelled_at', null)`.
    - Les lignes `{ id, product_id, delta: -3, employee, created_at, product: { name } }` deviennent des `DaySale` (`units 3`), triés à la française.
  - **`sale_day`.**
    - `getProductDetail` le demande et le rend en `saleDay` ;
    - `listHistory` le rend ;
    - une ligne sans `sale_day` donne `saleDay: null`.

- [ ] **Step 2: Vérifier l'échec**

  Run : `npx vitest run src/data`
  Expected : FAIL. `recordSales` et `listDaySales` n'existent pas encore, et `saleDay` manque.

- [ ] **Step 3: Écrire l'API, puis le faux backend.**

- [ ] **Step 4: Vérifier**

  Run : `npm test && npm run e2e`
  Expected : tous les tests unitaires passent, puis « E2E OK ». Les scénarios existants ne voient aucune différence.

- [ ] **Step 5: Commit**

```bash
git add src/data e2e/fakeSupabase.mjs
git commit -m "feat(api): ventes du jour et enregistrement de la fin de journée"
```

### Task 4: L'onglet « Ventes »

**Files:**
- Create : `src/sales/SalesScreen.tsx`, `src/sales/SalesRecap.tsx`, `src/sales/Sales.css`
- Modify :
  - `src/app/TabBar.tsx`, `src/app/AppShell.tsx`, `src/app/AppShell.css`, `src/ui/icons.tsx` ;
  - `src/auth/LoginScreen.tsx` et `src/products/fieldHelp.ts` (textes « réserve ») ;
  - `e2e/app-smoke.mjs` (scénario T, scénario M à 320 px, option d'horloge d'`openApp`), `e2e/screens.mjs`.

**Interfaces:**
- Consumes :
  - Tâche 2 : `salesDays`, `parseSold`, `readEntries`, `formatDrinks`, `NOTHING_SOLD_MESSAGE`, `SOLD_INVALID_MESSAGE` ;
  - Tâche 3 : `api.listDaySales`, `api.recordSales`, `DaySale` ;
  - l'existant : `Catalog` (`useCatalog`), `Thumb`, `filterProducts`, `selectAllSoon`, `formatClock`, `formatDelta`, `classifyApiError`, `apiErrorMessage`, `saveErrorMessage`.
- Produces :
  - **Onglet.**
    - `Tab` reçoit `'sales'`. Ordre de `TABS` : Scanner, À racheter, Stock, Ventes, Historique.
    - « Ventes » a pour icône `IconReceiptText` : Lucide `receipt-text`, tracés de `icons/receipt-text.svg` tirés de `npm pack lucide-static@0.468.0` dans le dossier de travail temporaire, sans installer le paquet.
    - En-tête de `TabBar.tsx` : les cinq onglets tiennent sur une ligne dès 320 px.
  - **`AppShell.css`** : `.tab-bar` en `repeat(5, minmax(0, 1fr))` ; `@media (max-width: 359px) { .tab-bar button { font-size: 11px; } }`.
  - **`AppShell`** : `tab === 'sales'` affiche `<SalesScreen catalog={catalog} employee={employee} onCatalogChanged={catalog.refresh} onSessionExpired={onSessionExpired} />`.
  - **`SalesScreen({ catalog, employee, onCatalogChanged, onSessionExpired })`**, `section.sales` étiquetée par `h1#sales-title` « Fin de journée ». De haut en bas :
    1. **Le jour.** Un `select` étiqueté « Jour des ventes », dont les options viennent de `salesDays(new Date())`, calculé à l'ouverture. Aujourd'hui est choisi d'abord.
       - Changer de jour avec une saisie en cours demande `window.confirm('Changer de jour ? La saisie en cours sera effacée.')`. Sur refus, le jour reste.
       - Sinon, la saisie est effacée, puis la liste du jour est lue.
    2. **Les messages du haut.**
       - Succès : `p[role=status].message.message-ok`.
       - Conflit : `p[role=alert].message.message-error`.
       - Lecture impossible : le message d'`apiErrorMessage` et « Réessayer ».
       - Catalogue illisible : comme dans le Stock, avec « Réessayer » (`catalog.refresh`).
       - Tant que la liste du jour ou le catalogue n'ont pas été lus : « Chargement… ».
    3. **« Déjà saisi »**, en `h2.section-label`, s'il y a des ventes actives ce jour-là. C'est une `ul.group` nommée « Déjà saisi », triée par nom.
       - Chaque ligne : `Thumb` 44 (l'image vient du catalogue), le nom, en dessous `${employee} · ${formatClock(createdAt)}`, et à droite le montant `formatDelta(−units)` en classe `kind-out`.
       - VoiceOver lit une phrase cachée : `${nom} : ${formatDrinks(units)}, ${employee}, ${heure}`.
    4. **« À saisir »**, en `h2.section-label`. Ce sont les produits actifs du catalogue, sans vente active ce jour-là, par ordre alphabétique.
       - Au-dessus : le champ de recherche du Stock, « Rechercher un produit » (`filterProducts`).
       - Puis une `ul.group` nommée « À saisir ». Chaque ligne : `Thumb` 44, le nom (deux lignes au plus, puis « … »), et une case.
       - La case : `aria-label` « Vendus : ${nom} », `placeholder` « vendus », `inputMode` numérique, police de 17 px, sélection du contenu au toucher.
       - Une case invalide a `aria-invalid="true"` et la bordure de couleur d'erreur.
       - Listes vides : « Aucun produit pour l'instant. », « Tout est saisi pour ce jour. » ou « Aucun produit ne correspond. ».
       - Dessous, `p.note` : « Une boisson manque ? « Stock » › « Nouveau produit », puis reviens ici. »
    5. **Le total.** `p.sales-total` : `Total du jour : ${formatDrinks(déjà saisi + saisie valide)}`.
    6. **Le bouton.** Un message d'erreur de saisie éventuel, puis `button.primary.block` « Valider ». Il est masqué quand plus rien n'est à saisir.
       - Sans ligne : `NOTHING_SOLD_MESSAGE`.
       - Avec une case invalide : `SOLD_INVALID_MESSAGE`, et la recherche est vidée pour montrer la case rouge.
       - Sinon, le récapitulatif s'ouvre.
  - **`SalesRecap({ dayShort, lines, units, saving, error, onSave, onBack })`** : `lines` est une liste de `{ name, quantity }`, `error` vaut `string | null`.
    - `h2` « Ventes du ${dayShort} ».
    - `ul.group` nommée « Récapitulatif » ; une ligne par produit : `${nom} : ${formatDelta(−quantity)}`, dans l'ordre de la saisie.
    - `Total : ${formatDrinks(units)}`.
    - L'erreur éventuelle, dans `p[role=alert]`.
    - `button.primary.block` : « Enregistrer », « Réessayer » après une erreur, « Enregistrement… » pendant l'envoi.
    - `button.block` « Revenir » : le retour à la saisie, intacte.
  - **Règles de l'écran.**
    - **Identifiants.** Un par jour et par produit (`Map` en `useRef`, clé `${day}:${productId}`, `crypto.randomUUID()`). On le garde jusqu'à un enregistrement réussi de ce produit : « Réessayer », ou « Revenir » puis « Valider », renvoie donc le même.
    - **Lecture du jour.** La liste lue est rangée avec son jour. Une réponse plus ancienne que la dernière demande est ignorée (compteur, comme dans l'Historique). La liste est relue au retour dans l'app (`visibilitychange`).
    - **Enregistré** :
      - message `Fin de journée enregistrée : ${formatDrinks(result.units)}.` ;
      - la saisie est vidée, et les identifiants envoyés sont oubliés ;
      - retour à la saisie, liste relue, `onCatalogChanged()`, puis `window.scrollTo(0, 0)`.
    - **Déjà saisi ailleurs** (`already_recorded`) :
      - message `Déjà saisi pour ce jour : ${noms.join(', ')}. La liste est relue.` ;
      - les cases de ces produits sont vidées ;
      - retour à la saisie, liste relue, `onCatalogChanged()`, puis `window.scrollTo(0, 0)`.
    - **Échec de l'envoi.**
      - Session expirée : `onSessionExpired()`.
      - Saisie refusée (`invalid`) : « Enregistrement refusé : vérifie le jour et les quantités. ».
      - Autre échec : `saveErrorMessage(kind)`, pour la coupure : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ».
      - Dans tous ces cas, le récapitulatif reste affiché.
  - **Textes « réserve »** (le stock couvre toute la boutique, spec §2) :
    - `LoginScreen` : « Le stock de la boutique, sur ton iPhone. » ;
    - `FIELD_HELP.countBoth` : « Packs entiers trouvés dans la boutique, puis les canettes ou bouteilles en plus. » ;
    - `FIELD_HELP.countUnitsOnly` : « Canettes ou bouteilles trouvées dans la boutique. ».
  - **Tests de bout en bout.** `openApp(browser, fakeOptions, { initScript, clockAt })` : avec `clockAt`, la page reçoit `page.clock.install({ time: clockAt })` puis `resume()` avant `goto`. La base simulée reçoit alors `now` = `clockAt` + le temps écoulé, comme dans `scripts/tutorial/record.mjs`.

- [ ] **Step 1: Écrire le scénario e2e T (`scenarioSales`)**, ajouté à la liste. Ses réglages :
  - catalogue `pilotage`, avec `loseFirst: ['record_sales']` ;
  - `clockAt = new Date('2026-10-22T17:30:00Z')` (jeudi 19:30 à Paris) ;
  - les heures se vérifient par `/19:3\d/`.

  1. **Ouverture.**
     - Après la connexion, les noms des onglets sont, dans l'ordre : « Scanner », « À racheter (3) », « Stock », « Ventes », « Historique ».
     - « Ventes » ouvre le titre « Fin de journée », et la caméra s'arrête.
     - Les options de « Jour des ventes » sont : « Aujourd'hui, jeu. 22/10 », « Hier, mer. 21/10 », « mar. 20/10 », « lun. 19/10 », « dim. 18/10 », « sam. 17/10 » et « ven. 16/10 ». La valeur choisie est `2026-10-22`.
     - Il n'y a pas de liste « Déjà saisi ». « À saisir » contient : Coca-Cola 33 cl, Évian 1,5 L, Lipton Pêche 50 cl et Red Bull 25 cl. L'Oasis, archivée, n'y est pas.
     - Le total affiche « Total du jour : 0 boisson ».
  2. **Saisies refusées.**
     - « Valider » sans rien : « Tape le nombre de boissons vendues. ».
     - Coca à « 1000 » : sa case a `aria-invalid="true"`.
     - « Valider » : « Vendus : un nombre de 1 à 999. », et le récapitulatif ne s'ouvre pas.
  3. **Saisie.**
     - Coca « 3 », Évian « 2 », Red Bull « 0 ».
     - La recherche « lip » ne montre plus que Lipton, à qui l'on met « 4 ».
     - Recherche vidée : les 4 lignes reviennent, la case Coca vaut toujours « 3 ».
     - Le total affiche « Total du jour : 9 boissons ».
  4. **Récapitulatif.**
     - « Valider » ouvre « Ventes du jeu. 22/10 », avec les lignes « Coca-Cola 33 cl : −3 », « Évian 1,5 L : −2 », « Lipton Pêche 50 cl : −4 », et « Total : 9 boissons ».
     - « Revenir » : la case Coca vaut « 3 ». « Valider » rouvre le récapitulatif.
  5. **Coupure réseau.**
     - « Enregistrer » affiche « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ».
     - « Réessayer » affiche « Fin de journée enregistrée : 9 boissons. ».
     - Il y a eu deux appels `record_sales`, avec les mêmes `p_lines`, identifiants compris, et `p_day` à `'2026-10-22'`.
     - « Déjà saisi » montre, dans l'ordre :
       - les noms Coca-Cola 33 cl, Évian 1,5 L et Lipton Pêche 50 cl ;
       - les montants « −3 », « −2 » et « −4 » ;
       - les détails `Sam · 19:3x`.
     - « À saisir » ne contient plus que Red Bull 25 cl, avec une case vide.
     - Le total affiche « Total du jour : 9 boissons ».
     - Dans le Stock, chaque vente n'a compté qu'une fois : Coca 7, Évian 2, Lipton 32.
  6. **Saisi ailleurs.**
     - `fake.addMovement({ productId: 'p-redbull', kind: 'out', delta: -1, employee: 'Léa', saleDay: '2026-10-22' })`.
     - Dans « Ventes », Red Bull « 2 », « Valider », « Enregistrer » : « Déjà saisi pour ce jour : Red Bull 25 cl. La liste est relue. ».
     - « Déjà saisi » montre 4 lignes, dont Red Bull « −1 » par Léa, puis « Tout est saisi pour ce jour. ». Plus de « Valider ».
     - Le total affiche « Total du jour : 10 boissons ».
     - Le Stock montre Red Bull à −4.
  7. **Historique et annulation.**
     - La liste contient « … — Sam — Vente −3 (ventes du 22/10) — Coca-Cola 33 cl ».
     - Le détail de cette ligne est `Vente (ventes du 22/10) · jeu. 19:3x · Sam`. Son montant « −3 » est en `rgb(163, 74, 7)`.
     - On annule cette ligne, en acceptant la confirmation : elle porte « annulé par Sam ».
     - Retour dans « Ventes » : Coca est revenu dans « À saisir », et le total affiche « Total du jour : 7 boissons ».
     - Coca « 5 », « Valider », « Enregistrer » : « Fin de journée enregistrée : 5 boissons. », puis « Total du jour : 12 boissons ».
  8. **Autre jour, réponse lente.**
     - « Hier, mer. 21/10 » : pas de « Déjà saisi », et les 4 produits sont à saisir.
     - La lecture de `sale_day=eq.2026-10-22` est retardée de 1,5 s (`page.route`, puis `fallback`).
     - On choisit « Aujourd'hui », puis aussitôt « Hier ». Une fois la réponse retardée arrivée (`waitForResponse`), il n'y a toujours pas de « Déjà saisi ». Puis on retire la route.
     - Évian « 1 » ; « Aujourd'hui » ouvre la confirmation « Changer de jour ? La saisie en cours sera effacée. ». On la refuse : le jour reste la veille, et Évian vaut « 1 ».
     - « Valider » ouvre « Ventes du mer. 21/10 ». « Enregistrer » affiche « Fin de journée enregistrée : 1 boisson. », et le dernier `p_day` vaut `'2026-10-21'`.
     - Lipton « 2 », puis « Aujourd'hui » : on accepte la confirmation, on revient à la veille, et la case Lipton est vide.
  9. **Fiche produit.** Dans le Stock, la fiche d'Évian 1,5 L a pour premier mouvement « Vente −1 (ventes du 21/10) ».
  10. **Lecture coupée.** Nouveau contexte, catalogue `pilotage`, `cutReads: 'movements'`.
      - « Ventes » affiche « Pas de connexion. Réessaie quand le réseau revient. » et « Réessayer », sans liste « À saisir ».
      - Après `restoreReads()` et « Réessayer », les 4 lignes apparaissent.
  11. **320 px.** Nouveau contexte, catalogue `pilotage`, `longNames: true`, écran de 320 × 640.
      - Coca « 3 », puis on fait défiler jusqu'en bas. Aucun débordement : `document.documentElement.scrollWidth <= 320`. « Valider » reste au-dessus de la barre d'onglets.
      - Le récapitulatif ne déborde pas non plus.
      - Les 5 noms d'onglets tiennent, comme dans le scénario M.

  Scénario M, étape 2 : `buttons.length === 5`, et le commentaire parle des cinq onglets.

- [ ] **Step 2: Vérifier l'échec**

  Run : `E2E_ONLY=T,M npm run e2e`
  Expected : FAIL, faute d'onglet « Ventes ».

- [ ] **Step 3: Écrire l'onglet, l'écran, le récapitulatif et le CSS, puis les textes « réserve ».**
  - `Sales.css` : les lignes de saisie en grille (image 44 px, nom, case de 76 × 44 px centrée).
  - Le total en 17 px gras.

- [ ] **Step 4: Ajouter deux captures** à `e2e/screens.mjs`, catalogue `pilotage` :
  - `ventes` : Coca « 3 » et Évian « 2 » tapés ;
  - `ventes-recap` : après « Valider ».

  Lancer `npm run screens`, puis envoyer au porteur du projet `dist-screens/jour/ventes.png` et `dist-screens/nuit/ventes.png`, sans attendre sa réponse.

- [ ] **Step 5: Vérifier**

  Run : `npm test && npm run build && npm run e2e`
  Expected : tous les tests passent, la construction réussit, puis « Scénario T (ventes) : OK » et « E2E OK ».

- [ ] **Step 6: Commit**

```bash
git add src e2e
git commit -m "feat(ventes): onglet « Ventes », la fin de journée"
```

### Task 5: Feuille A4, guides et spec

**Files:**
- Modify :
  - `scripts/sheet/sheet.html`, `scripts/sheet/check.mjs`, `docs/feuille-reserve.pdf` ;
  - `docs/jalon-4-jour-j.md`, `README.md` ;
  - `docs/superpowers/specs/2026-10-19-scandrinks-design.md`.
- Create : `docs/jalon-5-test.md`

**Interfaces:**
- Consumes : les textes exacts de l'écran (Tâche 4).

- [ ] **Step 1: Mettre à jour la feuille et son contrôle**
  - **Ligne remplacée.** « Je sors un pack de la réserve » devient :
    - à gauche : « En fin de journée » ;
    - à droite : « Onglet « Ventes » : le nombre vendu de chaque boisson, lu sur la caisse (« Lecture jour »), puis « Valider » et « Enregistrer ». ».
  - **Ligne ajoutée**, juste après :
    - à gauche : « Une boisson cassée, périmée ou offerte » ;
    - à droite : « « Scanner » › « Sortie − », le scan, puis « Valider ». Un pack porté au frigo ne se scanne pas. ».
  - `KEY_TEXTS` reçoit « En fin de journée », « Lecture jour » et « Un pack porté au frigo ne se scanne pas. ».
  - Si le PDF passe à 2 pages, on réduit d'abord les marges verticales des titres `h2`. La taille du texte reste à 10,5 pt.

  Run : `npm run sheet`
  Expected : « Feuille OK » (une page A4, le QR code relu, les textes clés).

- [ ] **Step 2: Écrire `docs/jalon-5-test.md`**, le protocole du porteur du projet sur la préversion, dans Safari sans installer. Une case à cocher par étape :
  1. Connexion, prénom. Les cinq onglets s'affichent, « Ventes » entre « Stock » et « Historique ».
  2. « Ventes » : le titre « Fin de journée », le jour du jour en premier, puis la liste des produits.
  3. Le clavier numérique s'ouvre au toucher d'une case. La case reste visible au-dessus du clavier, et « Valider » s'atteint en faisant défiler.
  4. Le test : 1 vente sur un produit, puis le total « 1 boisson », « Valider », le récapitulatif, « Enregistrer ». Le message s'affiche, et le produit passe dans « Déjà saisi ».
  5. Le Stock du produit a baissé de 1.
  6. L'Historique montre « Vente −1 (ventes du …) ». « Annuler », puis « OK » : la ligne est barrée, et le stock est revenu.
  7. De retour dans « Ventes », le produit est de nouveau à saisir.
  8. Un coup d'œil en mode sombre.

  Le protocole prévient : **la préversion utilise la vraie base**. On n'y enregistre que la vente d'essai, et on l'annule. Il se termine par la ligne à renvoyer : « OK », ou les problèmes avec une capture.

- [ ] **Step 3: Mettre à jour les guides.**
  - **`docs/jalon-4-jour-j.md`.**
    - L'inventaire du soir couvre toute la boutique : réserve, frigos et rayons. Les zones incluent les frigos et les rayons.
    - La semaine d'essai suit les règles du §9 « Bascule » :
      - chaque livraison est scannée ;
      - aucun pack porté au frigo n'est scanné ;
      - « Sortie − » sert à la casse, au périmé et aux boissons offertes ;
      - chaque soir, la fin de journée, avec les soirs manqués rattrapés (7 jours au plus) ;
      - les seuils sont relevés après l'inventaire.
  - **`README.md`.**
    - Une section « Jalon 5 — la fin de journée » : l'onglet, la migration `20261022130000_fin_de_journee.sql`, le protocole `docs/jalon-5-test.md`, et la course SQL dans `run-local.sh`.
    - La liste des onglets.
    - La ligne d'état : « jalon 5 en préparation ».

- [ ] **Step 4: Mettre à jour la spec.**
  - §6.7 : « libellé d'onglet en 12 px (11 px sous 360 px de large, pour que les cinq onglets tiennent) ».
  - §8, Jalon 5 : ajouter « deux téléphones au même instant (deux sessions PostgreSQL simultanées, en local) ».
  - §11 : une ligne datée du 22/10/2026, « Libellé d'onglet en 11 px sous 360 px de large », avec sa raison : les cinq noms tiennent à 320 px.

- [ ] **Step 5: Vérifier**

  Run : `npm run sheet && npm test`
  Expected : « Feuille OK », et tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add scripts/sheet docs README.md
git commit -m "docs: feuille A4, guides et spec pour la fin de journée"
```

### Task 6: Vidéo tuto — le chapitre 3 devient la fin de journée

**Files:**
- Modify : `scripts/tutorial/storyboard.mjs`, `scripts/tutorial/record.mjs`, `e2e/fakeSupabase.mjs` (catalogue `tutoriel`), `src/settings/tutorial.test.ts`
- Regenerate : `public/tutoriel/video/*`

**Interfaces:**
- Consumes : l'écran et ses textes exacts (Tâche 4) ; `movementRow(…, saleDay)` (Tâche 3).
- Produces (storyboard, textes exacts, clés dans l'ordre du film) :
  - **Chapitre 2 (`entree`).** Ses sous-titres, dans l'ordre : `mode`, `scan`, `quantite`, `valider`, puis `annuler` (repris de l'ancien chapitre 3, texte inchangé), puis `eloigner`.
  - **Chapitre 3.** Clé `ventes`, titre « Le soir : la fin de journée ». Ses sous-titres :
    - `ouvrir` : « Le soir, à la fermeture, ouvre « Ventes ». » ;
    - `caisse` : « Sur la caisse, « Lecture jour » donne les boissons vendues : tape chaque nombre, sans les cafés. » ;
    - `total` : « Le total du jour doit être celui de la caisse. Puis « Valider ». » ;
    - `enregistrer` : « Vérifie le récapitulatif, puis « Enregistrer » : le stock baisse. » ;
    - `sortie` : « Un pack porté au frigo ne se scanne plus. « Sortie − » : casse, périmé ou boisson offerte. ».
  - **Chapitre 8.** Le sous-titre `erreur` devient « Ici, un pack de Red Bull cassé, scanné par erreur en « Entrée + ». ».
  - **`FILMED_AT`** devient `new Date('2026-10-26T18:00:00Z')`, soit le lundi 26/10 à 19:00 à Paris. Son commentaire est mis à jour.
  - **Catalogue `tutoriel`.**
    - `m-t2`, `m-t4` et `m-t8` deviennent des ventes du 24/10 (`saleDay '2026-10-24'`), avec les mêmes dates et quantités.
    - Le commentaire de l'erreur de Red Bull dit « qui était une casse ».
  - **Le film du chapitre 3.**
    - « Ventes », puis on attend « Fin de journée ».
    - Coca-Cola 33 cl « 12 », Évian 50 cl « 2 », Red Bull 25 cl « 4 », tapés lentement, puis on attend « Total du jour : 18 boissons ».
    - « Valider », puis on attend « Ventes du lun. 26/10 ».
    - « Enregistrer », puis on attend « Fin de journée enregistrée : 18 boissons. ».
    - « Scanner », puis on attend la caméra.
    - Lipton n'est pas touché : le chapitre 5 voit toujours « Stock connu : 10 ».
    - « À racheter (3) » reste Évian, Lipton et Oasis : Coca est à 60 et Red Bull à 68, puis 44 après le chapitre 8.

- [ ] **Step 1: Écrire le test** (`tutorial.test.ts`), sur `storyboard.mjs?raw` :
  - le chapitre 3 a la clé `ventes` et le sous-titre `sortie` exact ;
  - aucun texte ne contient plus « sors un pack de la réserve ».

- [ ] **Step 2: Vérifier l'échec**

  Run : `npx vitest run src/settings`
  Expected : FAIL, la clé est encore `sortie`.

- [ ] **Step 3: Mettre à jour le storyboard, le film et le catalogue.**

- [ ] **Step 4: Tourner, monter et contrôler**

  Run : `npm run tutorial && npm test`
  Expected :
  - « Vidéo OK : <durée> s, <taille> Mo », avec une durée de 150 à 240 s et moins de 20 Mo ;
  - tous les tests passent, dont « la liste HLS est la vraie vidéo, de 150 à 240 s ».

  Regarder 3 images du chapitre 3, extraites du MP4 de `dist-tutorial/` : le titre, la saisie, puis le message.

- [ ] **Step 5: Commit**

```bash
git add scripts/tutorial e2e/fakeSupabase.mjs src/settings/tutorial.test.ts public/tutoriel/video
git commit -m "feat(tutoriel): chapitre 3, la fin de journée"
```

### Relecture finale (après la Tâche 6)

Relecture de toute la branche (executing-plans), avec la Review Focus ci-dessus et les « Ruling: » du registre. Les corrections Critical et Important passent en une seule passe, chacune RED puis GREEN. Ensuite seulement vient la Tâche 7.

### Task 7: Mise en service

**Files:** aucun dans le code. Le registre note chaque étape.

- [ ] **Step 1: Demander l'accord du porteur du projet** pour appliquer la migration sur le vrai projet (AskUserQuestion).
  - Elle ne fait qu'ajouter : l'app en service (jalon 4) continue de marcher.
  - Sans accord, rien ne se fait.
- [ ] **Step 2: Appliquer** avec `mcp__Supabase__apply_migration`, sur le projet `ubddiqqjdwcntdbrsrzr` :
  - nom `fin_de_journee` ;
  - requête : le contenu exact du fichier.

  Expected : `list_migrations` montre `fin_de_journee`.
- [ ] **Step 3: Contrôler par des lectures** (`execute_sql`, `select` seulement) :
  - la colonne `sale_day` (`information_schema.columns`) ;
  - la contrainte `movements_sale_day_out` ;
  - l'index `movements_one_active_sale` (`pg_indexes`) ;
  - `has_function_privilege` sur `public.record_sales(date, jsonb, text)` : vrai pour `authenticated`, faux pour `anon` ;
  - `pg_get_functiondef` de `list_history`, qui contient `sale_day` ;
  - `get_advisors` en sécurité : aucun nouvel avertissement.
- [ ] **Step 4: Préversion.**
  - Pousser `jalon-5`.
  - `https://jalon-5.scandrinks.pages.dev` répond 200, et son JavaScript contient « Fin de journée ».
- [ ] **Step 5: Essai du porteur du projet** avec `docs/jalon-5-test.md`. On attend son retour, et on corrige si besoin, par TDD, puis on pousse.
- [ ] **Step 6: Fusion** dans `main`, avec son accord (AskUserQuestion).
  - Pousser `main`.
  - `https://scandrinks.pages.dev` sert la nouvelle version.
  - README : « jalon 5 en service ».
- [ ] **Step 7: Message au porteur du projet.**
  - La fin de journée chaque soir, à partir du 23/10.
  - « Sortie − » sert à la casse, au périmé et aux boissons offertes.
  - Relever les seuils après l'inventaire.
  - Imprimer la nouvelle `docs/feuille-reserve.pdf` et remplacer l'ancienne.
  - Le bilan après une semaine : le recomptage de 5 produits.
