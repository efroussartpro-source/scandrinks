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
Task 1: Ruling: changePassword va au-delà du tableau du brief sur deux points — (a) après un échec incertain, si l'essai du nouveau mot de passe échoue autrement que par un refus (réseau), le résultat est { step: 'verify', kind: 'network' } et non 'wrong_current', pour que « Réessayer » reste utile ; (b) une méthode qui lève au lieu de renvoyer son erreur compte comme une erreur renvoyée à la même étape (garde attempt), pour que l'écran ne reste jamais bloqué. Le tableau passe de 8 à 12 lignes (2 cas d'échec incertain de plus, ces 2 cas-là), plus un refus à l'ancien format sans code pour classifyPasswordError. Le test historyLine garde le « now » du fichier (même jour à Paris, mêmes valeurs attendues) — coût si faux : « Pas de connexion » affiché au lieu de « Mot de passe actuel incorrect » dans un cas rare.
Task 1: complete (commits 78fd085..f3a94f6, tests: npm test → Test Files 28 passed (28), Tests 267 passed (267) ; tsc propre)
Task 2: Ruling: le bouchon (auth.sessions, auth.jwt()) est complété dès l'étape 1, avant le passage au rouge, pour que l'échec tombe au cas 21 et non sur une table absente ; auth.jwt() y recopie la fonction du vrai projet (null sans claims) au lieu de « vide », et auth.sessions y a la RLS active sans règle, comme sur Supabase — coût si faux : aucun, ce n'est que l'imitation locale.
Task 2: Ruling: cas 22 avec quatre mouvements à +4, +3, +2 et +2 minutes au lieu de trois à +3, +2, +1 — à +1 minute, le mouvement du cas 20 (identifiant tiré au hasard) aurait créé une égalité d'ordre aléatoire ; le quatrième, à la même heure que le troisième, vérifie que l'identifiant départage (mutation « curseur sans identifiant » détectée). Ajouts : clés exactes de la réponse, limites 101 et null, curseur sans date, annulation visible dans l'historique (cas 23). Mutations : les 3 du plan et 2 de plus (curseur sans identifiant, annulation écrasée) échouent toutes ; le témoin passe — coût si faux : aucun, les tests sont seulement plus stricts.
Task 2: Ruling: is_allowed lit auth.sessions grâce au BYPASSRLS de postgres (RLS active sans règle sur auth.sessions, vérifié sur le vrai projet le 20/10/2026 : postgres bypassrls = vrai, propriétaire de is_allowed = postgres). La tâche 8 revérifie, juste après la migration, un appel de is_allowed avec une vraie session du compte du tabac, dans une transaction annulée — coût si faux : tous les téléphones refusés (PT401) jusqu'à correction.
Task 2: complete (commits d4e5584..e1ca9e6, tests: su postgres -c 'bash supabase/tests/run-local.sh' → OK)
Task 3: Ruling: PT401 rejoint les codes de session dans classifyApiError — la ligne du brief (PT401 avec statut 401) passait déjà grâce au statut ; une ligne sans statut, rouge avant le changement, fixe la règle pour le code seul. Un test de listHistory fixe aussi que le curseur garde le texte exact de la date (microsecondes) — coût si faux : aucun, une erreur de session de plus reconnue.
Task 3: Ruling: détails du faux backend que le brief ne fixait pas — PUT /auth/v1/user avec une session fermée répond 403 session_not_found (comme Supabase Auth) ; la déconnexion gère aussi la portée 'others' ; list_history refuse limite et curseur invalides comme la base ; extraMovements crée des entrées « Sam » m-x01…m-xNN, une minute d'écart à partir de 2026-10-17T06:59Z ; authCalls note 'token' pour chaque essai, accepté ou non ; un appel RPC refusé pour session fermée reste noté dans calls (calls = ce que l'app a envoyé). Nouveautés vérifiées par un script jetable dans le navigateur (historique 50 + 11 sans doublon, mot de passe, déconnexions, PT401, réponse perdue, première lecture coupée), hors dépôt — coût si faux : un scénario des tâches 4 à 6 à ajuster.
Task 3: complete (commits d4a8ab1..e5c29ec, tests: sh -c 'npm test && npm run e2e' → E2E OK)
