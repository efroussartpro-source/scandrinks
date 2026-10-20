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
Task 4: complete (commits c432f43..b37a589, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1 && npm run build >/dev/null 2>&1 && echo "build OK"' → build OK)
Task 5: Ruling: `scannerErrors.test.ts` fige le texte exact du message « caméra refusée » ; il est mis à jour avec le chemin de m15 — le plan prévoyait m15 « sans test », mais ce test existait — coût si faux : aucun.
Task 5: Ruling: `stock.test.ts` convertit le mode de test en `MoveMode` au lieu de `ScanMode` (conséquence du nouveau type de `describeConfirm`) — coût si faux : aucun.
Task 5: Ruling: `CountCard` reçoit `key={movementId}` : une nouvelle fiche repart de champs vides — coût si faux : aucun.
Task 5: Ruling: en Inventaire sans nombre compté (impossible : « Valider » attend un comptage valide), l'envoi échoue en « invalid » au lieu de rester bloqué — coût si faux : aucun.
Task 5: Step 3 → RED : 9 tests unitaires en échec (counted, étape archived, isUnitFormat, mode inventory) ; e2e (build sans tsc) : D attend la fiche après le nouvel essai (code déclaré pris), I attend « Inventaire = », J attend la carte « Produit archivé ».
Task 5: contrôle visuel (capture 390 × 844) : trois boutons de mode sur une ligne, fiche d'inventaire lisible (stock connu, aides, total en bleu).
Task 5: complete (commits b37a589..2527afe, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1 && npm run build >/dev/null 2>&1 && echo "build OK"' → build OK)
Task 6: Step 2 → RED : scénario K en échec en attendant la liste « Produits » (onglet Stock encore « Bientôt »).
Task 6: Ruling: la fiche relit ses codes et ses mouvements à l'ouverture et quand le stock du produit change (dépendance `product.stock`) — couvre les corrections et les mouvements des autres téléphones sans bouton « Actualiser » — coût si faux : une lecture de plus.
Task 6: Ruling: retouches d'affichage vues sur captures 390 × 844 : filtre choisi en foncé (Actifs/Archivés), « libellé : valeur » insécables dans la fiche (« Stock idéal : 48 » ne se coupe plus) ; texte inchangé — coût si faux : retouche d'affichage.
Task 6: complete (commits 2527afe..d05ddeb, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1 && npm run build >/dev/null 2>&1 && echo "build OK"' → build OK)
Task 7: Step 3 → RED : `validateProductFields` et `normalizeTypedCode` introuvables (2 tests) ; scénario L (build sans tsc) en échec en attendant le bouton « Modifier » de la fiche.
Task 7: Ruling: la fiche affiche tout de suite ce qu'elle vient d'enregistrer (modification, stock corrigé, réactivation) tant que le catalogue n'a pas été relu, et le Stock ouvre la fiche créée à partir de la réponse de `create_product` ; pour cela `ProductEditForm.onSaved` reçoit la fiche enregistrée (le brief disait `() => void`) — sans cela, une relecture lente ou en échec montrait les anciens chiffres, ou laissait la liste sans le produit créé (risque de doublon). Tests ajoutés après le code, chacun vu en échec en retirant le mécanisme (catalogue coupé dans L) — coût si faux : quelques lignes d'état.
Task 7: Ruling: fichier en plus du brief, `src/stock/ProductFieldInputs.tsx` : les quatre champs (nom, pack, seuil, stock idéal) communs à « Modifier » et « Nouveau produit » — évite deux copies des libellés et des aides — coût si faux : un fichier de plus.
Task 7: Ruling: boutons des codes au texte « Modifier » / « Retirer », nommés « Modifier le code X » / « Retirer le code X » pour les lecteurs d'écran (la fiche a déjà un « Modifier ») ; `CodeList` reçoit `readOnly` pour un produit archivé (codes sans boutons) — coût si faux : aucun.
Task 7: Ruling: champs de « Modifier » et « Nouveau produit » grisés pendant l'envoi (une valeur changée en cours d'envoi serait ignorée sans le dire) ; « Corriger le stock » a son propre repère bleu (`.card.correct-stock`), les couleurs des modes étant propres au Scanner ; phrase d'accueil de « Nouveau produit » : « Pour un produit dont le code ne se lit pas. Tu pourras taper ses chiffres ensuite, avec « Ajouter un code ». » (spec §4.4) — coût si faux : retouche de texte ou d'affichage.
Task 7: Ruling: faux backend : `loseFirstCreate` devient `loseFirst: [fonctions…]` ; le scénario L vérifie en plus du brief les réponses perdues de « Corriger le stock » et de « Nouveau produit » (même identifiant, champs figés), le texte de confirmation de « Retirer », et que le seuil ne suit pas le pack en modification (Review Focus 3) — coût si faux : aucun (tests).
Task 7: Ruling: Stock et À racheter restent démontés au changement d'onglet (choix de la Tâche 4 gardé) : un formulaire quitté pendant l'envoi perd son « Réessayer ». Refaire un inventaire est sans risque (comptage absolu, écart 0) ; refaire une création ne fait un doublon que si la première est passée et que la liste a été relue avant son arrivée — coût si faux : un doublon rare, à archiver à la main.
Task 7: mutations, toutes détectées par L : identifiant neuf à chaque essai (Corriger le stock, Nouveau produit), champs non figés après un échec, seuil qui suit le pack en modification.
Task 7: contrôle visuel (captures 390 × 844) : fiche avec « Corriger le stock » et « Modifier » sur une ligne, codes et leurs boutons, formulaires Modifier, Ajouter un code, Corriger le stock (repère bleu) et Nouveau produit.
Task 7: complete (commits d05ddeb..e51e835, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1 && npm run build >/dev/null 2>&1 && echo "build OK"' → build OK)
Task 8: Ruling: protocole de test (`docs/jalon-2-test.md`), README et spec rédigés pendant la relecture finale et envoyés dans un commit à part, à la demande du hook d'arrêt (modifications non envoyées) ; le commit de la Tâche 8 les complète après la mise en service — coût si faux : un commit de plus.
