# SDD ledger — plan: docs/superpowers/plans/2026-10-20-jalon-3-suivi.md

Spec : `docs/superpowers/specs/2026-10-19-scandrinks-design.md` (§4, §4.5, §4.6, §5 RG-9 et RG-11, §6.3, §6.4, §7, §8, §9).
Méthode : exécution en ligne (executing-plans), validée par le porteur du projet le 20/10/2026 (« Go je valide »), relecture finale par un relecteur neuf.

## Pré-vol (interfaces partagées)

| Produit par | Consommé par | Interface | Constat |
|---|---|---|---|
| Tâche 1 | Tâche 3 | `HistoryMovement` (`productId`, `productName`) | cohérent avec `list_history` (`product_id`, `product_name`) |
| Tâche 1 | Tâche 4 | `historyLine`, `mergeHistoryPage`, `markCancelled` | cohérent |
| Tâche 1 | Tâche 5 | `validatePasswordChange`, `changePassword`, `classifyPasswordError`, `PasswordAuth` | `signIn` renvoie `{ error }`, comme `signInWithPassword` : cohérent |
| Tâche 1 | Tâche 6 | `createWakeLock(env)`, `startupErrorMessage` | cohérent |
| Tâche 2 | Tâche 3 | JSON de `list_history` ; réponse de `cancel_movement` (`cancelled_at`, `cancelled_by`) | le faux backend reprend les mêmes formes |
| Tâche 3 | Tâches 4 à 6 | `listHistory`, `cancelMovement` ; options du faux backend | cohérent |
| Tâche 5 | Tâche 5 (`AppShell`) | `LoginScreen.notice` devient `{ text, tone }` | seul appelant : `AppShell`, adapté dans la même tâche |
| Tâche 2 | Tâche 8 | fichier de migration | cohérent |

Pre-flight: Ruling: relecture finale après la Tâche 7 et avant la Tâche 8, comme au jalon 2, pour que la migration appliquée au vrai projet et la préversion testée soient la version relue — le plan ne place pas la relecture — coût si faux : aucun.
Pre-flight: Ruling: ce journal est versionné (`git add -f`) pendant le jalon, puis retiré du dépôt à la fin, pour survivre au recyclage du conteneur — coût si faux : aucun.

## Tâches
