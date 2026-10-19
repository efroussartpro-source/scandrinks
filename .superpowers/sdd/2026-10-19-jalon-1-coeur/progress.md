# SDD ledger — plan: docs/superpowers/plans/2026-10-19-jalon-1-coeur.md

Exécution : Native (executing-plans), relecture finale par un relecteur neuf. Espace isolé : branche `jalon-1` (pas `main`), dépôt /home/user/scandrinks.
Spec : docs/superpowers/specs/2026-10-19-scandrinks-design.md (lue).
Accord du porteur du projet (19/10/2026, « Go je suis tes recommandations ») : plan validé, méthode Native, création du projet Supabase `scandrinks`. Adresse Gmail dédiée : pas encore reçue (nécessaire à la Tâche 10).

## Pre-flight (interfaces partagées)

| Producteur → consommateur | Produit / consommé | Constat |
|---|---|---|
| T1 → T7 | `createScannerController` / `useBarcodeScanner` inchangés ; T7 ajoute la relance au premier plan dans le hook | cohérent |
| T2 → T7, T8 | `normalizeScannedCode` → `product` / `ignored(not_a_product | invalid_check_digit)` ; T7 : notice pour `not_a_product`, silence pour `invalid_check_digit` | cohérent |
| T3 → T5 | `ScanMode`, `NewProductInput` | cohérent |
| T3 → T7, T8 | `clampQuantity`, `describeConfirm`, `formatStock`, `formatDelta` ; brouillon + `parseIntInRange` | cohérent |
| T4 → T5 | noms et paramètres `p_…` des 6 fonctions ; réponses jsonb (`record_movement` → `movement_id, delta, stock, duplicate`) | cohérent |
| T4 → T9 | le faux backend reproduit les mêmes formes de réponse | Ruling ci-dessous (delta) |
| T5 → T6, T7, T8 | `supabase`, `api`, `Product`, `LookupResult`, `ApiErrorKind`, `apiErrorMessage`, `classifyApiError` | cohérent |
| T6 → T7, T8 | `employee`, `onSessionExpired` | cohérent |
| T7 → T8 | `choose_attach` (produit facultatif), `product_ready`, `close` ; état `attach { code, product }` | Ruling ci-dessous (carte Code inconnu) |
| T6, T7, T8 → T9 | textes exacts (connexion, prénom, fiche, notices, carte Code inconnu, formulaires) | vérifiés un à un : cohérents |
| T4 → T10 | `allowed_users` | cohérent |

Pre-flight: Ruling: le faux backend (T9) renvoie `delta` dans la réponse de `record_movement`, comme la fonction SQL (T4) — la T9 ne le nomme pas, mais les Constats exigent des réponses « à l'identique » — coût si faux : aucun.
Pre-flight: Ruling: la carte « Code inconnu » (textes produits par T8) est rendue en T8 ; en T7, l'étape `unknown` affiche le même emplacement « Bientôt » + « Annuler » que les autres étapes à venir, l'appel Open Food Facts étant déjà fait par l'écran (T7) — le plan ne nomme pas qui rend la carte en T7 — coût si faux : aucun (T8 la remplace).

## Tâches
Blocage T4 Step 1 : `create_project` refusé — le compte enzofroussart21@gmail.com a déjà 2 projets gratuits actifs (limite par membre, toutes organisations confondues ; un seul est visible dans Webia). Décision demandée au porteur du projet (pause d'un projet inutilisé / autre compte Supabase / offre payante), le 19/10/2026.
Pre-flight: Ruling: en attendant le projet, la migration et les tests SQL de la T4 sont développés et lancés sur le PostgreSQL 16 local du conteneur, avec une imitation minimale de Supabase (`supabase/tests/supabase-stub.sql` : rôles anon/authenticated/service_role, schéma auth, auth.uid(), droits par défaut de Supabase), puis relancés tels quels sur le vrai projet dès qu'il existe — les T5 à T9 n'utilisent pas la vraie base — coût si faux : un écart 16/17 ou une différence d'imitation, rattrapé par la relance des tests sur le vrai projet.
Task 1: Ruling: le test « arrêt pendant le branchement » vérifie en plus que la caméra est rendue avant la fin du branchement, puis l'état idle et l'absence d'analyse — tel qu'écrit dans le plan, il passait encore sans le contrôle de session après attachCamera (mutation vérifiée) — coût si faux : aucun.
Task 1: complete (commits 088b0c1..8caa062, tests: npm test && npm run typecheck → 87 passed (87), typecheck OK)
Task 2: Ruling: un EAN-13, EAN-8, UPC-A ou UPC-E de longueur anormale est traité comme une lecture parasite (invalid_check_digit, ignorée sans message) — le plan ne dit rien des longueurs, et le message « pas un produit » serait faux pour une lecture ratée — coût si faux : aucun en pratique, ZXing donne toujours la bonne longueur.
Task 2: complete (commits 8caa062..a6ecd23, tests: npm run typecheck && npm test → 110 passed (110), typecheck OK)
Task 3: complete (commits a6ecd23..6405fa1, tests: bash -c 'set -o pipefail; npm run typecheck >/dev/null && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  143 passed (143))
Task 4: Ruling: les fonctions d'écriture vérifient l'accès en tête (erreur 42501) — sans cela, un compte absent de allowed_users recevait « invalid_input:product » (produit invisible par la RLS), donc « Enregistrement refusé » au lieu de « Ce compte n'a pas accès au stock » — coût si faux : aucun.
Task 4: Ruling: tests SQL renforcés après contrôle par mutations (5 erreurs introduites dans la migration, toutes détectées) : renvoi tardif d'un même identifiant avec une saisie changée (doit renvoyer le premier enregistrement), seconde annulation par une autre personne (cancelled_by inchangé), interdiction de supprimer (RG-11) — coût si faux : aucun.
Task 4: en cours — local OK (commit c33db4e, su postgres -c "bash supabase/tests/run-local.sh" → OK). Reste, dès que le projet existe : Step 1 (création), migration appliquée, tests SQL et conseils Supabase (Steps 4 à 6) sur le vrai projet.
Task 5: Ruling: supabaseClient.ts exporte aussi SHOP_EMAIL (VITE_SHOP_EMAIL contrôlée au même endroit que les deux autres variables), que l'écran de connexion utilisera — coût si faux : aucun.
Task 5: complete (commits c33db4e..52ac840, tests: bash -c 'set -o pipefail; npm run typecheck >/dev/null && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  175 passed (175))
Task 6: Ruling: lecture et écriture sûres du stockage local regroupées dans src/app/storage.ts (reprises par mode.ts en T7) — coût si faux : aucun.
Task 6: Ruling: l'en-tête (ScanDrinks, prénom, ⚙ Réglages) n'apparaît que sur l'écran Scanner ; Réglages et Prénom ont leur propre titre, et l'écran Prénom ouvert depuis les Réglages a un bouton « Retour » — coût si faux : retouche d'affichage.
Task 6: Ruling: « Se déconnecter » sans réseau : supabase-js garde alors la session locale (l'appel de déconnexion échoue) ; l'app l'annonce par « Déconnexion impossible sans réseau. Réessaie quand le réseau revient. » au lieu de rester connectée sans rien dire — coût si faux : aucun.
Task 6: complete (commits 52ac840..cb0cd62, tests: bash -c 'set -o pipefail; npm run build >/dev/null && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  175 passed (175))
Task 7: Ruling: les boutons de mode sont désactivés pendant l'envoi et après un échec, comme la quantité — sinon « Réessayer » pourrait envoyer l'autre mode avec le même identifiant, alors que la base a peut-être déjà reçu le premier — coût si faux : pour changer de mode après une coupure, il faut « Annuler » puis rescanner.
Task 7: Ruling: tous les messages (enregistré, annulé, pas un produit, erreur) disparaissent au bout de 5 s, sauf pendant une annulation en cours — le plan ne fixe la durée que pour l'enregistrement — coût si faux : retouche d'affichage.
Task 7: Ruling: le nom Open Food Facts d'un code inconnu est gardé par code ; en cas d'échec (réseau, délai), il est redemandé à la lecture suivante du même code — coût si faux : aucun.
Task 7: contrôle manuel dans Chromium (fausse caméra, base simulée) : connexion, prénom, fiche « Pack de 24 → +24 », Valider → record_movement avec les paramètres exacts, message « ✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs) » ; aucune erreur de page.
Task 7: complete (commits cb0cd62..8e13492, tests: bash -c 'set -o pipefail; npm run build >/dev/null 2>&1 && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  189 passed (189))
Task 8: Ruling: la recherche traite la ponctuation comme un espace (« Coca-Cola » trouve « Coca Cola 33 cl »), avec un test — sinon la liste filtrée sur le nom Open Food Facts pouvait cacher la bonne fiche, ce qui va contre le Review Focus 1 — coût si faux : aucun.
Task 8: Ruling: ajouts d'interface non nommés par le plan : « Aucun produit ne correspond. » (recherche sans résultat), « Choisir un autre produit » (ajout) et « Autre produit » (saisie manuelle) pour revenir à la liste, « Recherche du nom… » pendant l'appel Open Food Facts — coût si faux : retouche d'affichage.
Task 8: Ruling: la capture d'une canette n'est pas couverte par le test e2e (la fausse caméra ne montre qu'un code) ; elle est vérifiée au test sur iPhone (protocole) et par la relecture finale. Limite connue : une canette restée dans le champ depuis le scan du pack n'est rendue qu'après être sortie du champ 2 s (anti-doublon du lecteur) — coût si faux : un geste de plus.
Task 8: contrôle manuel dans Chromium : nouveau produit (nom « Coca-Cola 330 ml », 24/24/48, create_product exact, fiche +24), ajout (recherche « Coca-Cola », Lipton masqué, unités 1, attach_barcode exact, fiche « À l'unité → +1 »), saisie manuelle (fiche « Pack de 24 → +24 ») ; aucune erreur de page.
Task 8: complete (commits 8e13492..4d1bf2a, tests: bash -c 'set -o pipefail; npm run build >/dev/null 2>&1 && npm test 2>&1 | grep -E "^ +Tests "' →       Tests  195 passed (195))
Task 9: le test sait échouer : p_kind forcé à 'out' dans api.recordMovement → échec du scénario A au point 5 (message +24 jamais affiché) ; restauré → E2E OK.
Task 9: complete (commits 4d1bf2a..0733629, tests: bash -c 'set -o pipefail; npm test 2>&1 | grep -E "^ +Tests " && npm run e2e 2>&1 | tail -1' → E2E OK)
Task 10: Ruling: le protocole et le README (Step 4) sont écrits et validés en commit avant la relecture finale, pour qu'elle les couvre ; .env.production et l'envoi de la branche suivront dès que le projet Supabase existe — coût si faux : aucun.
Final review: relecteur neuf (opus) lancé sur 29f210a..594ea7c, avec le Review Focus du plan et les Ruling: du journal.

## Relecture finale (opus) — tri

Verdict du relecteur : « With fixes ». Critique : aucun. Important : 4. Mineurs : 12. Une question de libellé (spec).
Re-notation par l'effet sur un employé :
- I1 quantité tapée au clavier (« 16 » au lieu de « 6 ») → Important (maintenu) : mauvais stock enregistré.
- I2 aucun délai maximal sur les appels à la base → Important (maintenu) : écran bloqué sans bouton.
- I3 échec d'annulation perdu si un code est relu pendant l'annulation → Important (maintenu) : mouvement compté à tort, sans historique pour le voir.
- I4 liste pré-filtrée qui cache la bonne fiche → Important (maintenu) : pousse au doublon (Review Focus 1).
- m7 code de lot qui efface le message « enregistré » et son « Annuler » → re-noté Important : fréquent avec les packs Red Bull (code de lot à côté de l'EAN), l'employé perd la confirmation et la seule annulation possible au jalon 1.
- m5, m6, m8 à m16 → mineurs (voir les lignes « minor (deferred) » plus bas).
Final: fixed I1 quantité tapée au clavier — e2e A « La quantité se tape au clavier » RED (« × 16 ») → GREEN, suite 199/199, E2E OK (7 scénarios).
Final: fixed I2 appels sans délai maximal (db.timeout 15 s) + « Annuler » pendant la recherche — test « recherche en cours : Annuler revient à la lecture » et e2e G (recherche bloquée, enregistrement bloqué → « Réessayer » même p_id) RED → GREEN, suite 199/199, E2E OK.
Final: fixed I3 échec d'annulation perdu — test « pendant l'annulation, aucun code n'est relu et le résultat s'affiche toujours » RED → GREEN (événement undo_started, état scanning.undoing), suite 199/199.
Final: fixed I4 liste pré-filtrée qui cache la bonne fiche — test « recherche pré-remplie sans résultat : toute la liste s'affiche » RED → GREEN (productsForSearch), suite 199/199.
Final: fixed m7 (re-noté Important) code de lot qui efface le message enregistré — test « un code de lot n'efface pas le message « enregistré » ni son bouton Annuler » RED → GREEN, suite 199/199.
Final: Ruling: la règle de la T6 sur « Se déconnecter » sans réseau reposait sur une prémisse fausse (supabase-js 2.117.2 déconnecte le téléphone même si l'appel échoue) : l'alerte « Déconnexion impossible » s'affiche donc à tort, par-dessus l'écran de connexion — gardé en mineur (m5), corrigé au jalon suivant — coût si faux : une alerte trompeuse, rare, sans effet sur les données.
Final: Ruling: libellé de la spec « Pas de connexion, rien n'a été enregistré. » gardé tel quel en attendant l'avis du porteur du projet (proposition : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ») — la réponse peut se perdre alors que la base a enregistré ; « Réessayer » ne crée pas de doublon, mais « Annuler » puis un nouveau scan le peut — coût si faux : rare double comptage.
Final: minor (deferred): m5 alerte « Déconnexion impossible » affichée à tort quand la déconnexion sans réseau a en fait réussi (AppShell.tsx) — n'alerter que si getSession() garde une session.
Final: minor (deferred): m6 TOKEN_REFRESHED ignoré : ouverte hors réseau après plus d'une heure, l'app reste sur la connexion alors que la session se rétablit seule (AppShell.tsx).
Final: minor (deferred): m8 « Scanner une canette du pack » accepte n'importe quel autre code (ITF-14 d'un carton, pack voisin) comme 1 unité (NewProductForm.tsx).
Final: minor (deferred): m9 le bouton ⚙ reste actif pendant une recherche, un envoi ou après un échec : ouvrir les Réglages perd le résultat ou le nouvel essai avec le même identifiant.
Final: minor (deferred): m10 nouvel essai de création après une réponse perdue : « Ce code appartient déjà à un autre produit » alors que c'est la fiche qui vient d'être créée.
Final: minor (deferred): m11 durcissement SQL : droits de mise à jour par colonne (movements.cancelled_at/cancelled_by, barcodes.product_id/units) et contrainte liant le signe de delta à in/out ; le compte du tabac peut aujourd'hui écrire en direct en contournant les fonctions.
Final: minor (deferred): m12 tests SQL à compléter : allowed_users ni lisible ni modifiable par A et B, écritures directes de B refusées, B refusé sur attach/cancel, anon refusé sur les fonctions d'écriture (propriétés vérifiées vraies par le relecteur).
Final: minor (deferred): m13 page blanche si .env.production manque (erreur levée avant le rendu React) : cas d'une préversion construite sans configuration.
Final: minor (deferred): m14 un code vu pendant qu'une fiche ou un formulaire est ouvert est « consommé » par l'anti-doublon : le pack suivant identique n'est lu qu'après 2 s hors du champ (ajouter un conseil dans le guide : quantité, ou détourner la caméra).
Final: minor (deferred): m15 chemin des réglages caméra « Réglages › Apps › Safari » valable à partir d'iOS 18 seulement (iOS 16–17 : « Réglages › Safari ») dans scannerErrors.ts et le protocole.
Final: minor (deferred): m16 un compte absent de allowed_users ressemble à un catalogue vide (« Code inconnu » partout) jusqu'à une création refusée — envisager 42501 aussi dans lookup_barcode.
Final: minor (deferred): recommandation — test e2e de la capture d'une canette avec une vidéo qui alterne deux codes.
Final: Ruling: hors jalon 1 (Inventaire, réactivation des archivés, À racheter, Stock, Historique, mot de passe, service worker, icônes) — prévu aux jalons 2 et 3 — coût si faux : aucun.
Final: Ruling: « Base injoignable » avec renvoi au guide : le guide est au jalon 4 ; le message affiché pour un projet en pause sera vérifié sur le vrai projet — coût si faux : un message moins précis.
Final: Ruling: tri français de order('name') : moins de 30 produits, à revoir au jalon 2 avec la liste du stock — coût si faux : ordre légèrement différent pour les accents.
Final: Ruling: UPC-E gardé sur 8 chiffres et identifiant GS1 (01) cherché seulement en tête : choix du plan, conformes à l'usage GS1 et rares en France — coût si faux : un code non reconnu, rattachable à la main.
Final: Ruling: formulaire d'ajout pré-rempli à 1 unité : choix du plan ; la fiche affiche « À l'unité → +1 », une erreur se voit avant de valider — coût si faux : une correction de plus.
Final: Ruling: Wake Lock et performance de décodage reportés au jalon 3 ; avertissement de taille du paquet sans conséquence tant qu'il n'y a pas de service worker — coût si faux : écran qui se met en veille pendant une longue session.
Final: Ruling: adresse du compte du tabac visible dans l'app : acceptée par le plan (Gmail dédiée) ; d'où l'importance d'un mot de passe long — coût si faux : tentatives de connexion par des tiers, limitées par Supabase.
Final: Ruling: variantes de casse des prénoms dans list_employees, trim JS contre btrim SQL, absence de stock en direct entre téléphones : sans effet visible au jalon 1 — coût si faux : cosmétique.
Final: Ruling: même pack relu après les Réglages ou le retour au premier plan : voulu (e2e A point 8), il faut toujours « Valider » — coût si faux : aucun.
Final: Ruling: insert dans auth.users du test SQL à vérifier sur le vrai projet — sera fait à la relance des tests sur Supabase — coût si faux : test à ajuster.

## Reprise dans une nouvelle session
19/10/2026 : le connecteur Supabase ne voit que l'organisation « Webia ». Le porteur du projet a créé l'organisation « Scandrinks », a mis en pause le projet « Webia » (ne pas y toucher), et reconnecte le connecteur ; reprise dans une nouvelle session. Adresse du compte du tabac : Tabvapshoplongecourt@gmail.com. Note de reprise : docs/superpowers/plans/2026-10-19-jalon-1-reprise.md. Ce journal est versionné exprès (git add -f) pour survivre au changement de session ; le retirer du dépôt à la fin du jalon.
