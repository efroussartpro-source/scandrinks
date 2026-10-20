# SDD ledger — plan: docs/superpowers/plans/2026-10-20-jalon-2-pilotage.md

Exécution : Native (executing-plans), choisie par le porteur du projet le 20/10/2026 (« Go je valide »), relecture finale par un relecteur neuf. Espace isolé : branche `jalon-2` (pas `main`), dépôt /home/user/scandrinks.
Spec : docs/superpowers/specs/2026-10-19-scandrinks-design.md (lue). Accord donné à la validation du plan : application de la migration au vrai projet `scandrinks` (Tâche 8).

## Pre-flight (interfaces partagées)

| Producteur → consommateur | Produit / consommé | Constat |
|---|---|---|
| T1 → T3 | `sortByName`, type `Movement` | cohérent |
| T1 → T4 | `shoppingList`, `describeShoppingLine`, `formatClock` | cohérent |
| T1 → T5 | `parseCount`, `formatGap`, `describeInventory` | cohérent |
| T1 → T6 | `isLow`, `movementLine` | cohérent |
| T2 → T3 | noms et paramètres `p_…` ; réponses : `record_inventory` → `movement_id, delta, stock, counted, duplicate` ; `update_product` et `set_product_archived` → ligne `product_stock` ; `detach_barcode` → `status` ; `create_product` + `p_id` | cohérent |
| T3 → T4 | `listCatalog` | cohérent |
| T3 → T5 | `recordInventory`, `setArchived`, `createProduct({ …, id })` | cohérent |
| T3 → T6, T7 | `getProductDetail`, `setArchived`, `updateProduct`, `attachBarcode`, `detachBarcode`, `recordInventory`, `createProduct` | cohérent |
| T4 → T5 | prop `onCatalogChanged` du Scanner (T5 l'étend) | cohérent |
| T4 → T6 | `Catalog`, emplacement Stock « Bientôt » remplacé, props de `ShoppingScreen` étendues | cohérent |
| T5 → T7 | `CountFields` | cohérent |
| T6 → T7 | `ProductSheet`, `StockScreen` | cohérent |
| T3 → T4, T5 (faux backend) | catalogues `pilotage` et `coca_archived` ; options ajoutées par T4 (`failLogout`, `addMovement`) et T5 (`loseFirstCreate`) | cohérent |

Pre-flight: Ruling: la relecture finale a lieu après la Tâche 7 et avant la Tâche 8, pour que la migration appliquée au vrai projet et la préversion testée par le porteur du projet soient la version relue — le plan ne place pas la relecture — coût si faux : aucun.
Pre-flight: Ruling: ce journal est versionné (`git add -f`), comme au jalon 1, pour survivre au recyclage du conteneur pendant le test sur iPhone ; il sera retiré du dépôt à la fin du jalon — coût si faux : aucun.

## Tâches
Task 1: complete (commits 5f2b9e4..01e9eb6, tests: bash -c 'set -o pipefail; npx vitest run src/domain >/dev/null && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  217 passed (217))
Task 2: Ruling: contrôles des champs d'une fiche (RG-7) factorisés dans `private.checked_product_name` (security invoker, `execute` pour `authenticated` seulement), utilisé par `create_product` et `update_product` — évite deux copies des mêmes règles ; le plan ne nomme pas d'aide — coût si faux : aucun.
Task 2: Ruling: une fonction stable (`lookup_barcode`) voit la base telle qu'au début de la requête qui l'appelle : écrire et relire dans la même expression ne voit pas l'écriture (cas 18 en échec). Écritures et relectures sont séparées en requêtes distinctes, et les comparaisons qui peuvent valoir NULL passent à `is distinct from` / `is not true` ; le cas 8 du jalon 1 vérifiait en fait NULL et passait sans rien contrôler (unités du code) : corrigé de la même façon — coût si faux : aucun.
Task 2: Step 2 → `run-local.sh` avant migration : ÉCHEC attendu (« function public.record_inventory(uuid, unknown, integer, unknown) does not exist », cas 1).
Task 2: Step 5 → mutations (6, dont 3 en plus du plan), toutes détectées : delta inversé → « ÉCHEC : inventaire » ; detach sur code inconnu → erreur au retrait rejoué ; sans stock idéal > seuil → ÉCHEC cas 10 ; unités non mises à jour (migration du jalon 1, restaurée) → « ÉCHEC : unités du code mis à jour » ; lookup sans contrôle d'accès → ÉCHEC cas 2 ; droit update gardé sur la table → ÉCHEC cas 19. Fichiers restaurés (cmp et git diff vides).
Task 2: complete (commits 01e9eb6..ff2a0f7, tests: su postgres -c 'bash supabase/tests/run-local.sh' → OK)
Task 3: Ruling: `createProduct` exige maintenant `id` ; pour que l'app compile, `NewProductForm` passe un identifiant neuf à chaque essai (comportement du jalon 1 inchangé). La Tâche 5 le rend stable par fiche (m10), ce qui garde le scénario D étendu en échec jusque-là — le plan ne dit pas comment l'app compile entre les Tâches 3 et 5 — coût si faux : aucun.
Task 3: complete (commits ff2a0f7..c432f43, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1' → E2E OK)
Task 4: Step 3 → RED : authState introuvable ; scénario H en échec en attendant « À racheter (3) » (lancé après un build e2e sans `tsc`, que le test unitaire en échec bloquait).
Task 4: Ruling: règle globale `[hidden] { display: none !important }` dans styles.css — sinon `.app { display: flex }` annulait l'attribut `hidden` et les Réglages s'affichaient sous l'app — coût si faux : aucun.
Task 4: Ruling: barre d'onglets en `position: fixed` (et non collée au bas du contenu), avec 76 px réservés sous l'app — elle reste en bas même sur une liste courte ; vérifié sur captures 390 × 844 (Scanner avec fiche, À racheter) — coût si faux : retouche d'affichage.
Task 4: Ruling: boutons d'onglets cherchés par nom exact dans l'e2e (« Scanner » trouverait aussi « Scanner une canette du pack ») — coût si faux : aucun.
