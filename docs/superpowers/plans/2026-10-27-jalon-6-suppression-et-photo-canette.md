# ScanDrinks — Jalon 6 (suppression et photo de la canette) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** deux ajouts.
- « Supprimer le produit » efface pour de bon un produit, ses codes et tout son historique, après un message de confirmation.
- À la création depuis un pack, la canette scannée pour le nom reçoit sa propre photo.

Validation (spec §9) : sur l'iPhone, dans la préversion, le porteur du projet crée un produit d'essai avec un pack et une canette, prend leurs deux photos, puis supprime le produit.

**Architecture :**
- **Base.** Une migration, `20261027120000_suppression.sql`, avec deux fonctions :
  - `public.delete_product(p_product_id uuid)`, en `security invoker` : elle fait les contrôles, puis appelle la suivante ;
  - `private.erase_product(p_product_id uuid)`, en `security definer` dans le schéma non exposé : elle verrouille le produit, puis efface ses mouvements, ses codes et la fiche.

  Aucun droit de table ne change : l'app n'a toujours aucun `DELETE` sur `products` ni sur `movements`.
- **App.**
  - `api.deleteProduct`. Une erreur de clé étrangère (23503) est classée « refusé ».
  - La fiche produit gagne « Supprimer le produit ». La liste d'où elle a été ouverte (Stock ou À racheter) affiche ensuite « X a été supprimé. ».
  - Une fin de journée refusée relit la liste et le jour.
- **Photo de la canette.**
  - `CodePhotoPicker` reçoit son sujet : le code, le pack ou la canette.
  - `NewProductForm` ajoute le cadre de la canette et envoie les deux photos ensemble, après la création.
- **Mise en service.** La migration contient des `delete`. Le porteur du projet la lance donc dans l'éditeur SQL, avant d'essayer la préversion (Tâche 5).

**Tech Stack :** celle du jalon 5 (Vite 8, React 19, TypeScript 7 strict, Vitest, Playwright 1.56.1, supabase-js 2.117.2), sans nouvelle dépendance.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, surtout :
- §4.2 (photo de la canette), §4.4 (« Supprimer le produit »), §4.7 ;
- RG-11 et RG-15 ;
- §6.3 (`delete_product`), §6.4 (suppression) ;
- §7 (les deux dernières lignes), §8 « Jalon 6 », §9 « Mise en service (jalon 6) » ;
- §10, et §11 (décisions du 27/10/2026).

**Ordre :** les Tâches 1 à 4, puis la relecture finale de toute la branche et ses corrections, puis la Tâche 5.
- La migration ne touche le vrai projet qu'à la Tâche 5. Une correction demandée par la relecture se fait donc dans le fichier, encore jamais appliqué.
- Le porteur du projet veut la fonction au plus vite.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Apostrophe droite `'` dans les textes de l'interface. Guillemets « » avec une espace simple à l'intérieur, comme dans tout le code.
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit.
- **iPhone.**
  - iOS 16.4 au minimum ; champs de saisie en 16 px au moins.
  - Rien ne dépasse en largeur à 320 px.
  - La confirmation passe par `window.confirm`, comme l'archivage et l'annulation dans l'Historique.
- **Charte.**
  - Couleurs de `src/theme/tokens.css` seulement ; classes communes de `AppShell.css`.
  - Bouton destructif : `className="danger block"`, comme « Archiver le produit ».
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`). Ne jamais toucher à l'organisation ni au projet « Webia ».
  - Une seule migration, faite de `create function`, `revoke` et `grant`. Ni `drop` ni `truncate`.
  - Les seules instructions `delete` sont les trois du corps de `private.erase_product`. C'est l'exception approuvée le 27/10/2026 (spec §9, « Mise en service (jalon 6) »).
  - Aucun droit de table ne change. Les migrations existantes ne sont jamais modifiées.
  - Les tests SQL tournent en local seulement (`supabase/tests/run-local.sh`).
  - Sur le vrai projet, seulement trois choses :
    - le porteur du projet lance la migration dans l'éditeur SQL ;
    - Claude fait des lectures (`select`) de contrôle ;
    - Claude ajoute la ligne d'historique de la migration (Tâche 5).

    Aucune écriture d'essai.
  - La remise à zéro n'est jamais lancée par Claude.
  - Seule la clé publique `sb_publishable_…` va dans le dépôt. Ne jamais demander de mot de passe, de jeton ni de clé secrète.
- **Mots de passe.** Jamais demandés, affichés, écrits ni journalisés.
- **Vidéo tuto et feuille A4.** Inchangées (décision du 27/10/2026). Ne rien modifier sous `public/tutoriel/`.
- **Préversion.** `https://jalon-6.scandrinks.pages.dev` utilise la vraie base. L'essai du porteur du projet crée un produit d'essai, puis le supprime.
- **Fusion** dans `main` : avec l'accord du porteur du projet.

## Review Focus

1. **Une suppression demandée deux fois** : double toucher, deux téléphones sur le même produit, ou réponse perdue puis nouvel essai.
   - Attendu : le second appel répond « supprimé », sans message d'erreur, et rien d'autre n'est effacé.
   - Tests : cas SQL 35, rejeu et identifiant inconnu (Tâche 1) ; scénario e2e U, réponse perdue puis nouvel essai (Tâche 2).
2. **Une suppression pendant qu'un autre téléphone enregistre** : scan validé, comptage, code ajouté.
   - Attendu : l'enregistrement passe avant puis disparaît avec le produit, ou bien il est refusé avec « Enregistrement refusé : … ». Jamais « Base injoignable », jamais de mouvement orphelin.
   - Tests : `delete-race.test.sh`, trois courses (Tâche 1) ; table de `classifyApiError`, 23503 (Tâche 2) ; scénario U, scan validé sur un produit supprimé ailleurs (Tâche 2).
3. **Une fin de journée qui contient un produit supprimé entre-temps.**
   - Attendu : elle est refusée une fois, puis la liste est relue sans lui. « Réessayer » enregistre le reste, et rien n'est compté deux fois.
   - Test : scénario U (Tâche 2).
4. **Une autre canette scannée après la photo de la première**, ou la canette retirée parce que son code est déjà pris.
   - Attendu : la photo de la première ne va jamais au code de la seconde. Le cadre repart de l'image d'Open Food Facts de la nouvelle canette, ou vide.
   - Tests : scénario V (Tâche 3). La photo de l'équipe et l'image d'Open Food Facts sont gardées avec le code pour lequel on les a obtenues, et ne servent que pour lui.
5. **Une des deux photos qui n'arrive pas** : réseau coupé, ou bloqué 15 s.
   - Attendu : le produit et ses deux codes sont créés, et l'autre photo est enregistrée. « Photo non enregistrée : réessaie depuis la fiche du produit. » s'affiche une seule fois.
   - Test : scénario V avec `failPhotoUpload` (Tâche 3).

---

### Task 1: La base — migration, tests SQL et courses

**Files:**
- Create : `supabase/migrations/20261027120000_suppression.sql`, `supabase/tests/delete-race.test.sh` (exécutable)
- Modify : `supabase/tests/database.test.sql` (en-tête, cas 34 à 36), `supabase/tests/run-local.sh` (lance aussi `delete-race.test.sh`, et son commentaire le dit), `supabase/tests/sales-race.test.sh` (rien : modèle à suivre)

**Interfaces:**
- Produces (SQL) :
  - **`public.delete_product(p_product_id uuid) returns jsonb`**
    - `language plpgsql security invoker set search_path = ''`.
    - Contrôles, dans l'ordre : `private.is_allowed()`, sinon `raise exception 'not_allowed' using errcode = '42501'` ; `p_product_id` vide, sinon `invalid_input:product`.
    - Appelle ensuite `private.erase_product(p_product_id)`, puis répond `{"status": "deleted"}`, que le produit ait existé ou non.
  - **`private.erase_product(p_product_id uuid) returns void`**
    - `language plpgsql security definer set search_path = ''`.
    - Contrôle d'abord `private.is_allowed()`, avec la même exception 42501.
    - Verrouille ensuite la ligne du produit (`perform 1 … for update`). Absente, il s'arrête sans rien faire.
    - Puis efface, dans cet ordre, les mouvements du produit (annulés et ventes compris), ses codes et la fiche.
  - **Droits.**
    - Pour chacune des deux fonctions : `revoke all … from public, anon` et `grant execute … to authenticated`.
    - Commentaire en tête du fichier : pourquoi `security definer` dans `private` (comme `private.is_allowed`), et pourquoi l'app n'a toujours aucun `DELETE` sur `products` ni `movements` (spec §6.4).

- [ ] **Step 1 : écrire les cas SQL qui échouent** (`database.test.sql`, après le cas 33, avant `reset role; rollback;`).

  Mise en place, en tant que `postgres` :
  - le produit D, « Test suppression » (`…d0d1`, pack 6), avec deux codes :
    - `2000000000091`, 6 unités, avec une image (`photo_path`, `photo_source` 'equipe') ;
    - `2000000000107`, 1 unité ;
  - un objet `storage.objects` à ce chemin, comme au cas 26 ;
  - ses mouvements : une entrée de 6, une sortie annulée, un inventaire et une vente du jour (`sale_day = pg_temp.today()`) ;
  - le produit E, « Témoin suppression » (`…e0e1`), avec une entrée de 12.

  Les cas :
  - **34. Droits.**
    - Sans connexion (`anon`) : `select public.delete_product('…d0d1')` → `42501`.
    - Compte B : même appel → `42501`, et `select private.erase_product('…d0d1')` → `42501`.
    - Compte A : `select public.delete_product(null)` → `invalid_input:product`.
    - D existe toujours, avec ses 2 codes et ses 4 mouvements.
  - **35. Effacement (RG-15), en tant que A.**
    - `public.delete_product('…d0d1')` = `{"status": "deleted"}`.
    - Ensuite, il ne reste rien de D : 0 ligne dans `products`, dans `product_stock`, dans `barcodes` (par `product_id`) et dans `movements` (par `product_id`, annulés compris).
    - `public.lookup_barcode('2000000000091')` est vide.
    - E garde son stock (12) et son mouvement.
    - L'objet de stockage de l'image est toujours là.
    - Rejoué : `public.delete_product('…d0d1')` = `{"status": "deleted"}`, de même qu'avec `gen_random_uuid()`.
    - Le code est de nouveau libre : `public.create_product('Recréé', 6, 6, 12, '[{"code":"2000000000091","units":6}]')` réussit.
    - Le cas 12 reste tel quel : `delete from public.movements` et `delete from public.products`, écrits directement, sont toujours refusés.
  - **36. Historique.** `public.list_history(null, null, 100)` ne contient aucun mouvement de D.

- [ ] **Step 2 : vérifier l'échec**

  Run : `pg_ctlcluster 16 main start; su postgres -c "bash supabase/tests/run-local.sh"`
  Expected : FAIL au cas 34, avec `function public.delete_product(uuid) does not exist`.

- [ ] **Step 3 : écrire la migration, d'abord sans le verrou de `private.erase_product`**

  Les trois `delete` seulement, dans l'ordre de l'Interfaces. Le verrou vient au Step 6 : la course doit d'abord le montrer nécessaire.

- [ ] **Step 4 : relancer les tests SQL**

  Run : la commande du Step 2. Expected : `OK`, puis « Remise à zéro : OK » et « Course OK », comme avant.

- [ ] **Step 5 : écrire `supabase/tests/delete-race.test.sh` et le voir échouer**

  Même structure que `sales-race.test.sh` : base jetable `scandrinks_delete_race`, mise en place, `SESSION` du compte A, fonction `race`. La session 1 garde son verrou 2 s ; la session 2 arrive 0,5 s après. Une session 2 qui doit échouer est lancée sans arrêter le script (`2>&1`, `|| true`) : sa sortie est comparée au message attendu. Les trois courses :
  1. **Un scan, puis la suppression.**
     - Session 1 : `record_movement` (entrée de 1) sur le produit P1, avec un identifiant neuf. Session 2 : `delete_product(P1)`.
     - Attendu : la session 1 répond normalement, la session 2 répond `{"status": "deleted"}`, et il reste 0 mouvement et 0 produit P1.
  2. **La suppression, puis un scan.**
     - Session 1 : `delete_product(P2)`. Session 2 : `record_movement` sur P2.
     - Attendu : la session 2 échoue avec `invalid_input:product`, et il reste 0 mouvement de P2.
  3. **La suppression, puis un code ajouté.**
     - Session 1 : `delete_product(P3)`. Session 2 : `attach_barcode('2000000000114', P3, 1, false)`.
     - Attendu : la sortie de la session 2 contient « violates foreign key constraint » (SQLSTATE 23503), et le code `2000000000114` n'existe pas.

  Le script affiche « Suppression en course OK ». Ajouter son lancement à la fin de `run-local.sh`.

  Run : la commande du Step 2. Expected : FAIL à la course 1. La suppression échoue sur la clé étrangère de `movements`, car le mouvement de la session 1 est arrivé après l'effacement des mouvements.

- [ ] **Step 6 : ajouter le verrou** (`perform 1 from public.products where id = p_product_id for update`, puis l'arrêt si absent), en tête de `private.erase_product`, après le contrôle d'accès.

- [ ] **Step 7 : tout relancer**

  Run : la commande du Step 2, puis `pg_ctlcluster 16 main stop`.
  Expected : `OK`, « Remise à zéro : OK », « Course OK », « Suppression en course OK ».

- [ ] **Step 8 : commit**

  ```bash
  git add supabase/migrations/20261027120000_suppression.sql supabase/tests/database.test.sql supabase/tests/delete-race.test.sh supabase/tests/run-local.sh
  git commit -m "feat(base): suppression définitive d'un produit (delete_product)"
  ```

---

### Task 2: Supprimer le produit — API, fiche, listes, fin de journée

**Files:**
- Create : `src/stock/deletion.ts`
- Modify :
  - `src/data/api.ts`, `src/data/api.test.ts`, `src/data/apiErrors.ts`, `src/data/apiErrors.test.ts` ;
  - `src/stock/ProductSheet.tsx` (bouton, confirmation, prop `onDeleted`, commentaire d'en-tête qui ne dit plus « on archive au lieu de supprimer ») ;
  - `src/stock/StockScreen.tsx`, `src/shopping/ShoppingScreen.tsx` (le message après suppression) ;
  - `src/sales/SalesScreen.tsx` (refus : relecture) ;
  - `e2e/fakeSupabase.mjs`, `e2e/app-smoke.mjs` (scénario U).

**Interfaces:**
- Consumes : `public.delete_product` (Tâche 1).
- Produces :
  - `api.deleteProduct(productId: string): Promise<void>` : `rpc('delete_product', { p_product_id: productId })`.
  - `classifyApiError` : SQLSTATE `23503` → `'invalid'`.
  - `src/stock/deletion.ts` :
    - `deleteConfirmMessage(name: string): string` → ``Supprimer « ${name} » pour de bon ? Ses codes et tout son historique (entrées, sorties, ventes, inventaires) seront effacés. Impossible de revenir en arrière.`` ;
    - `deletedMessage(name: string): string` → ``${name} a été supprimé.``.
  - `ProductSheet` : nouvelle prop `onDeleted: (name: string) => void`. Elle est appelée après la suppression, à la place de `onClose`.
  - Faux backend :
    - la fonction `delete_product`, qui efface le produit, ses codes et ses mouvements, et répond `{ status: 'deleted' }` même pour un produit absent ; un identifiant vide donne `invalid('product')` ;
    - `record_movement` et `attach_barcode` refusent un produit absent (`invalid('product')`), comme la base ;
    - `installFakeSupabase` renvoie aussi `deleteElsewhere(productId)`, une suppression faite sur un autre téléphone ;
    - le commentaire d'en-tête le documente.

- [ ] **Step 1 : tests unitaires qui échouent**
  - `api.test.ts`, « deleteProduct appelle delete_product » :

    ```ts
    const rpc = vi.fn(async () => ok({ status: 'deleted' }))
    await expect(createApi({ rpc, from: vi.fn() } as never).deleteProduct('p9')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('delete_product', { p_product_id: 'p9' })
    ```
  - `apiErrors.test.ts`, une ligne de plus dans la table : `[{ message: 'insert or update on table "barcodes" violates foreign key constraint "barcodes_product_id_fkey"', code: '23503', status: 409 }, 'invalid']`.

- [ ] **Step 2 : vérifier l'échec**

  Run : `npx vitest run src/data`. Expected : 2 échecs (`deleteProduct is not a function` ; `unknown` au lieu de `invalid`).

- [ ] **Step 3 : écrire `deleteProduct` et ajouter `'23503'` à `INVALID_CODES`**

- [ ] **Step 4 : vérifier le succès**

  Run : `npx vitest run src/data`. Expected : PASS.

- [ ] **Step 5 : étendre le faux backend (Interfaces), puis écrire le scénario e2e U (`scenarioDelete`)**, ajouté à la liste sous la lettre `U`.

  Les dialogues se lisent par `page.once('dialog', …)` : `dialog.message()`, puis `dismiss()` ou `accept()`.

  **Contexte 1 : `catalogue: 'pilotage'`, `clockAt: new Date('2026-10-22T17:30:00Z')`.**
  1. **Un scan validé sur un produit supprimé ailleurs.**
     - La fiche de confirmation du Coca s'affiche ; puis `fake.deleteElsewhere('p-coca')` et « Valider ».
     - Attendu : « Enregistrement refusé : vérifie la saisie ou scanne de nouveau. », et aucun mouvement ajouté.
     - « Annuler » ; le Coca, relu par la caméra, donne « Code inconnu : 5449000000996 ».
  2. **La confirmation refusée.**
     - « Stock » › « Lipton Pêche 50 cl » › « Supprimer le produit ».
     - Le dialogue dit exactement `deleteConfirmMessage('Lipton Pêche 50 cl')`. `dismiss()`.
     - Attendu : la fiche est toujours là, et aucun appel `delete_product`.
  3. **La confirmation acceptée.**
     - « Supprimer le produit », puis `accept()`.
     - Attendu :
       - la liste du Stock montre le statut « Lipton Pêche 50 cl a été supprimé. » ;
       - la liste « Produits » n'a plus de Lipton ;
       - un appel `delete_product` avec `{ p_product_id: 'p-lipton' }` ;
       - l'Historique n'a plus de ligne « Lipton Pêche 50 cl ».
  4. **Un produit archivé.**
     - « Stock » › « Archivés » › « Oasis Tropical 33 cl ». La fiche montre « Réactiver » et « Supprimer le produit ». `accept()`.
     - Attendu : « Oasis Tropical 33 cl a été supprimé. », puis « Aucun produit archivé. ».
  5. **Une fin de journée avec un produit supprimé entre-temps.**
     - « Ventes » : Red Bull 2 et Évian 3 › « Valider ». Le récapitulatif montre les deux.
     - `fake.deleteElsewhere('p-evian')`, puis « Enregistrer ».
     - Attendu : « Enregistrement refusé : vérifie le jour et les quantités. », puis le récapitulatif sans Évian.
     - « Réessayer ». Attendu : « Fin de journée enregistrée : 2 boissons. », et un seul mouvement de vente actif pour Red Bull ce jour-là.
  6. **Depuis À racheter.**
     - « À racheter » › « Red Bull 25 cl » › « Supprimer le produit ». `accept()`.
     - Attendu : on revient sur À racheter, avec « Red Bull 25 cl a été supprimé. ».

  **Contexte 2 : `catalogue: 'pilotage'`, `loseFirst: ['delete_product']`.**
  7. **Une réponse perdue.**
     - « Stock » › « Lipton Pêche 50 cl » › « Supprimer le produit ». `accept()`.
     - Attendu : « Pas de connexion. Réessaie quand le réseau revient. », et la fiche reste ouverte.
     - Nouvel essai, `accept()`. Attendu : « Lipton Pêche 50 cl a été supprimé. », et deux appels `delete_product`.
  8. **Une fiche ouverte pendant qu'un autre téléphone supprime.**
     - « Coca-Cola 33 cl » ouvert, puis `fake.deleteElsewhere('p-coca')`.
     - Puis `document.dispatchEvent(new Event('visibilitychange'))`, qui fait relire le catalogue.
     - Attendu : la fiche se ferme, et la liste n'a plus de Coca.

- [ ] **Step 6 : vérifier l'échec**

  Run : `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=U node e2e/app-smoke.mjs`.
  Expected : FAIL à l'étape 2 : le bouton « Supprimer le produit » est introuvable. L'étape 1 passe déjà, avec le refus du faux backend.

- [ ] **Step 7 : écrire l'écran**
  - **`ProductSheet`.**
    - Le bouton `danger block` « Supprimer le produit » vient après « Archiver le produit » ou « Réactiver ». Il est désactivé pendant `busy`.
    - Un refus de `window.confirm(deleteConfirmMessage(product.name))` ne fait rien.
    - Sinon : `api.deleteProduct`, puis `onCatalogChanged()`, puis `onDeleted(product.name)`. Une erreur passe par `fail()`, comme les autres actions de la fiche.
  - **`StockScreen` et `ShoppingScreen`.**
    - L'état `deleted: string | null` est rempli par `onDeleted`, qui ferme aussi la fiche.
    - En tête de la liste : `<p role="status" className="message message-ok">{deletedMessage(deleted)}</p>`.
    - Le message disparaît à l'ouverture d'une fiche, et à « Nouveau produit » dans le Stock.
  - **`SalesScreen.save`.** Sur une erreur `'invalid'`, on garde `SALES_REFUSED`, et on relit en plus : `load(day)` et `onCatalogChanged()`.

- [ ] **Step 8 : vérifier le succès, puis toute la suite**

  Run : la commande du Step 6. Expected : « Scénario U (suppression) : OK ».
  Run : `npm test && npm run build && npm run e2e`. Expected : tout passe, jusqu'à « E2E OK ».

- [ ] **Step 9 : commit**

  ```bash
  git add src/data src/stock src/shopping/ShoppingScreen.tsx src/sales/SalesScreen.tsx e2e/fakeSupabase.mjs e2e/app-smoke.mjs
  git commit -m "feat(stock): supprimer un produit pour de bon, après confirmation"
  ```

---

### Task 3: La photo de la canette

**Files:**
- Modify :
  - `src/photos/savePhoto.ts`, `src/photos/savePhoto.test.ts` (`choosePhoto`) ;
  - `src/photos/CodePhotoPicker.tsx` (prop `subject`) ;
  - `src/products/NewProductForm.tsx` (le cadre de la canette, les deux envois, le commentaire d'en-tête) ;
  - `src/products/AttachForm.tsx` (utilise `choosePhoto`, sans rien changer d'autre) ;
  - `e2e/app-smoke.mjs` (scénario V).

**Interfaces:**
- Produces :
  - `choosePhoto(teamPhoto: Blob | null, offImageUrl: string | null): PhotoChoice | null` dans `savePhoto.ts`. La photo de l'équipe passe d'abord, puis l'image d'Open Food Facts ; sinon `null`.
  - `export type PhotoSubject = 'code' | 'pack' | 'canette'`, et la prop `subject?: PhotoSubject` de `CodePhotoPicker` (`'code'` par défaut, rien ne change alors). Les textes par sujet :

    | Sujet | Groupe (`aria-label`) | Titre, sans image | Aide, sans image | Aide, photo prise | Aide, image d'Open Food Facts |
    |---|---|---|---|---|---|
    | `code` | Photo du code | Photo | Facultatif : vise le pack ou la canette, sans personne dans l'image, puis touche le bouton. | Elle sera gardée avec ce code. | Image : Open Food Facts. Elle sera gardée avec ce code. |
    | `pack` | Photo du pack | Photo du pack | Facultatif : vise le pack, sans personne dans l'image, puis touche le bouton. | Elle sera gardée avec le code du pack. | Image : Open Food Facts. Elle sera gardée avec le code du pack. |
    | `canette` | Photo de la canette | Photo de la canette | Facultatif : vise la canette, sans personne dans l'image, puis touche le bouton. | Elle sera gardée avec le code de la canette. | Image : Open Food Facts. Elle sera gardée avec le code de la canette. |

  - `NewProductForm` :
    - **Le premier cadre** prend le sujet `'pack'` dès qu'une canette est enregistrée (`unitCode`), `'code'` sinon.
    - **Le cadre de la canette** (`subject="canette"`, `key={unitCode}`) vient juste sous « Canette : … (1 unité) ».
    - **Une image ne sert que pour son code.** La photo de l'équipe et le résultat d'Open Food Facts sont gardés avec le code de la canette pour lequel on les a obtenus (`{ code, … }`), et ne servent que si ce code est encore `unitCode`. Une autre canette, ou une canette retirée sur `barcode_taken`, repart donc d'un cadre neuf. Ce n'est pas un effet qui remet à zéro.
    - **Le résultat d'Open Food Facts de la canette** (nom et image) vient de la recherche déjà faite pour le nom. Une réponse qui arrive pour une canette remplacée entre-temps est ignorée.
    - **À la création**, les photos choisies (pack, puis canette) partent ensemble, par `Promise.all` de `savePhoto`.
      - `photoPath` reste celui du code scanné.
      - `photoWarning: true` si une photo choisie n'a pas abouti.
      - Le bouton affiche « Envoi des photos… » pour deux photos, « Envoi de la photo… » pour une.

- [ ] **Step 1 : test unitaire qui échoue** (`savePhoto.test.ts`), « choosePhoto : la photo de l'équipe, sinon l'image d'Open Food Facts, sinon rien » :

  ```ts
  const jpeg = new Blob(['x'], { type: 'image/jpeg' })
  expect(choosePhoto(jpeg, OFF_URL)).toEqual({ source: 'equipe', jpeg })
  expect(choosePhoto(null, OFF_URL)).toEqual({ source: 'off', url: OFF_URL })
  expect(choosePhoto(null, null)).toBeNull()
  ```

  `OFF_URL` est une adresse `https://images.openfoodfacts.org/…`.

- [ ] **Step 2 : vérifier l'échec** — Run : `npx vitest run src/photos`. Expected : FAIL, `choosePhoto is not a function`.

- [ ] **Step 3 : écrire `choosePhoto`, puis l'utiliser dans `NewProductForm` et `AttachForm`** à la place du choix écrit sur place.

- [ ] **Step 4 : vérifier le succès** — Run : `npx vitest run src/photos`. Expected : PASS.

- [ ] **Step 5 : écrire le scénario e2e V (`scenarioUnitPhoto`)**, ajouté sous la lettre `V`.

  Mise en place :
  - `openApp(browser, { catalogue: 'empty' }, { initScript: installCamera })`, avec `installCamera` importé de `scripts/tutorial/page-helpers.js` ;
  - la caméra montre un code par `page.evaluate(([m, d]) => window.__tutorialCamera.show(m, d), [ean13Modules(code), code])`, avec `ean13Modules` de `e2e/ean13.mjs` ;
  - les codes : le pack `TUTORIAL_CODES.oasisPack` (`3124480191182`, inconnu d'Open Food Facts), la canette `TUTORIAL_CODES.oasisCan` (`3124480191014`, connue sans image), puis le Coca (`5449000000996`, connu avec image).

  Les étapes :
  1. **Le pack scanné.**
     - Attendu : « Code inconnu : 3124480191182 », puis « Nouveau produit ».
     - Un seul groupe photo, « Photo du code », et aucun groupe « Photo de la canette ».
     - « Prendre la photo ». Attendu : « Photo prise ».
  2. **La première canette.**
     - « Scanner une canette du pack », puis la caméra montre la canette Oasis.
     - Attendu :
       - « Canette : 3124480191014 (1 unité) » ;
       - le Nom vaut « Oasis Tropical 33 cl » ;
       - le groupe « Photo du pack » contient « Photo prise » ;
       - le groupe « Photo de la canette » montre « Photo de la canette » et « Prendre la photo ».
     - « Prendre la photo » dans ce groupe. Attendu : « Photo prise ».
  3. **Une autre canette.**
     - « Scanner une canette du pack », puis la caméra montre le Coca.
     - Attendu :
       - « Canette : 5449000000996 (1 unité) » ;
       - le groupe « Photo de la canette » montre « Image trouvée », sans « Photo prise » ;
       - le Nom vaut toujours « Oasis Tropical 33 cl ».
  4. **À 320 px de large** : `document.documentElement.scrollWidth <= 320`. Puis on revient à 390 px.
  5. **La création.**
     - « Ce code vaut (unités) » = 24, puis « Créer le produit ».
     - Attendu :
       - la fiche de confirmation montre « Pack de 24 → +24 » ;
       - `create_product` a reçu `p_barcodes` = `[{ code: '3124480191182', units: 24 }, { code: '5449000000996', units: 1 }]` ;
       - deux appels `set_barcode_photo` : le pack en `equipe`, le Coca en `off`, chacun avec un chemin `codes/<son code>/…` ;
       - aucun appel pour `3124480191014`.
  6. **Une photo qui n'arrive pas.** Nouveau contexte, avec `failPhotoUpload: true`.
     - Même chemin jusqu'à l'étape 2 (photo du pack, puis photo de la canette Oasis), puis « Créer le produit ».
     - Attendu : la fiche de confirmation montre « Photo non enregistrée : réessaie depuis la fiche du produit. », et un seul appel `set_barcode_photo`.

- [ ] **Step 6 : vérifier l'échec**

  Run : `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=V node e2e/app-smoke.mjs`.
  Expected : FAIL à l'étape 2 : pas de groupe « Photo de la canette ».

- [ ] **Step 7 : écrire `subject` dans `CodePhotoPicker`, puis le cadre de la canette et les deux envois dans `NewProductForm`**, selon l'Interfaces. Les textes viennent de la table, dans une constante de `CodePhotoPicker.tsx`.

- [ ] **Step 8 : vérifier le succès, puis toute la suite**

  Run : la commande du Step 6. Expected : « Scénario V (photo de la canette) : OK ».
  Run : `npm test && npm run build && npm run e2e`. Expected : tout passe, jusqu'à « E2E OK » ; les scénarios D, E et S sont inchangés.

- [ ] **Step 9 : commit**

  ```bash
  git add src/photos src/products e2e/app-smoke.mjs
  git commit -m "feat(photos): la photo de la canette à la création depuis un pack"
  ```

---

### Task 4: Documentation — README et guide d'essai

**Files:**
- Create : `docs/jalon-6-test.md`
- Modify : `README.md` (statut, section « Jalon 6 », liste des migrations, liste des tests SQL)

- [ ] **Step 1 : écrire `docs/jalon-6-test.md`**, guide à cocher pour le porteur du projet, sur le modèle de `docs/jalon-5-test.md`.

  **Partie A, la base (5 minutes, avant tout essai).**
  1. Ouvrir le fichier sur GitHub, branche `jalon-6` : `supabase/migrations/20261027120000_suppression.sql`. Bouton « Raw », puis tout copier.
  2. Dans Supabase, ouvrir le projet « scandrinks » (jamais « Webia »), puis « SQL Editor » › « New query ».
  3. Coller, puis « Run ». Supabase prévient, en anglais, qu'il y a une opération destructive. C'est normal, car le fichier crée la fonction qui efface : confirmer.
  4. Attendu : « Success. No rows returned ». M'écrire « C'est lancé ». Ne jamais envoyer de mot de passe ni de clé.

  **Partie B, la préversion `https://jalon-6.scandrinks.pages.dev`** (après mon contrôle de la partie A), avec un pack et une canette d'une boisson pas encore dans l'app :
  1. Scanner le pack › « Nouveau produit » › « Prendre la photo ».
  2. « Scanner une canette du pack » : vérifier « Photo du pack » et le cadre « Photo de la canette ». Prendre sa photo, puis « Créer le produit » › « Annuler ».
  3. Scanner la canette seule : sa photo s'affiche sur la fiche de confirmation. « Annuler », sans valider.
  4. « Stock » › le produit d'essai › « Supprimer le produit » › « Annuler » : rien ne change.
  5. De nouveau « Supprimer le produit » › « OK ».
     - Vérifier le message « … a été supprimé. ».
     - Le produit est absent du Stock, des Archivés et de l'Historique.
     - Le pack, scanné, est de nouveau « Code inconnu » : « Annuler ».

  En cas de souci, la ligne du §7 de la spec et quoi m'envoyer.

- [ ] **Step 2 : mettre à jour `README.md`**
  - **Le statut** : « jalon 6 (suppression et photo de la canette) en préparation », avec le lien vers ce plan.
  - **Une section « Jalon 6 »** : ce qu'il apporte, et le lien vers `docs/jalon-6-test.md`.
  - **Les migrations** : « Jalon 6 (`20261027120000_suppression.sql`) : `delete_product`, qui appelle `private.erase_product` (security definer, schéma non exposé). Elle efface le produit, ses codes et ses mouvements ; seule porte pour effacer. »
  - **Les tests SQL** : `delete-race.test.sh`, une suppression en même temps qu'un scan ou qu'un code ajouté.
  - **La liste des fonctions de l'app** (« archiver et réactiver ») : « archiver, réactiver et supprimer ».

- [ ] **Step 3 : vérifier que la feuille A4 et la vidéo n'ont pas bougé**

  Run : `node scripts/sheet/check.mjs && node scripts/tutorial/check.mjs && git status --short public/ docs/feuille-reserve.pdf`.
  Expected : les deux contrôles passent, et `git status` n'affiche rien.

- [ ] **Step 4 : commit**

  ```bash
  git add docs/jalon-6-test.md README.md
  git commit -m "docs: guide d'essai du jalon 6 et README"
  ```

---

### Task 5: Mise en service

Après la relecture finale de toute la branche et ses corrections.

- [ ] **Step 1 : la préversion construite**
  - `git push -u origin jalon-6`.
  - Run : `curl -s https://jalon-6.scandrinks.pages.dev/ | grep -o 'assets/index-[^"]*\.js'`, puis le fichier JS.
  - Expected : il contient « Supprimer le produit » et « Photo de la canette ».

- [ ] **Step 2 : la partie A par le porteur du projet.** Lui envoyer le lien GitHub du fichier et les étapes de `docs/jalon-6-test.md`, puis attendre « C'est lancé ». Claude ne lance pas la migration.

- [ ] **Step 3 : les contrôles en lecture seule** (`execute_sql`, projet `ubddiqqjdwcntdbrsrzr`), comparés à la base locale `scandrinks_local` que laisse `run-local.sh` :
  - les deux fonctions : `prosecdef`, `proconfig` (`search_path=""`), et les droits `anon` et `authenticated` (`has_function_privilege`) ;
  - leurs corps (`pg_get_functiondef`) : identiques une fois les espaces ignorés ;
  - les droits des tables, inchangés : `has_table_privilege('authenticated', 'public.products', 'delete')` et `…('public.movements', 'delete')` faux, `…('public.barcodes', 'delete')` vrai ;
  - les données intactes : le nombre de produits, de codes et de mouvements, avant et après.

  Expected : tout est identique.

- [ ] **Step 4 : la ligne d'historique, puis les conseils de Supabase**
  - Ajouter la ligne d'historique de la migration, comme le 20/10 : `insert into supabase_migrations.schema_migrations (version, name, statements)`. La version est l'heure UTC de la partie A, le nom `suppression`, et le texte de référence renvoie au fichier du dépôt. Aucune autre écriture.
  - Puis `get_advisors` (sécurité). Expected : aucune alerte nouvelle ; seule reste celle déjà connue sur les mots de passe divulgués.

- [ ] **Step 5 : la partie B par le porteur du projet**, sur la préversion. Attendre son retour, puis son « go ».

- [ ] **Step 6 : la fusion, après le « go »**
  - Run : `npm test && npm run build && npm run e2e`.
  - Puis `git checkout main && git merge --ff-only jalon-6 && git push origin main`.
  - Vérifier que `https://scandrinks.pages.dev` sert un JS qui contient « Supprimer le produit ».
  - Mettre le statut du README à « jalon 6 en ligne » : un commit sur `main`, poussé.
