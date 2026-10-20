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
