# ScanDrinks — Jalon 3 (le suivi) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Ajouter le suivi :
- l'onglet **Historique** : tous les mouvements, par pages de 50, avec l'annulation d'une ligne ;
- le **changement du mot de passe du tabac**, qui déconnecte tous les téléphones ;
- des **finitions** : icône de l'app, écran qui reste allumé au Scanner, message clair si l'app ne peut pas démarrer, points reportés du jalon 2, fermeture des anciennes adresses de test.

Validation (spec §9) : sur iPhone, annuler une erreur et changer le mot de passe.

**Architecture :**
- **Historique.** Un quatrième onglet, servi par une fonction SQL `list_history` : 50 mouvements à la fois, du plus récent au plus ancien, avec le nom du produit. La page suivante part d'un curseur (date, identifiant) : un mouvement arrivé entre-temps ne décale rien. L'annulation reprend `cancel_movement` (jalon 1), qui renvoie maintenant aussi l'auteur et l'heure de l'annulation.
- **Mot de passe.** Depuis les Réglages :
  1. le téléphone vérifie le mot de passe actuel (nouvelle connexion) ;
  2. il change le mot de passe ;
  3. il ferme toutes les sessions du compte, la sienne comprise.
  Côté base, `private.is_allowed()` exige en plus que la session du jeton existe encore. Un autre téléphone est donc refusé dès sa requête suivante (erreur `PT401`, donc HTTP 401), et l'app le ramène à la connexion. Une réponse perdue en cours de route laisse « Réessayer », qui termine le changement sans jamais laisser d'autres téléphones connectés.
- **Base.** Une troisième migration, `20261020180000_suivi.sql`, sans instruction destructive : seulement `create or replace function` (mêmes signatures), `create function`, `grant` et `revoke`. Leçon du jalon 2 : le connecteur Supabase attend une confirmation, qui n'arrive pas, pour tout `drop`.
- Les règles (lignes d'historique, fusion des pages, validation et enchaînement du changement de mot de passe, maintien de l'écran allumé, message de démarrage) sont des modules purs testés.

**Tech Stack :** celle des jalons 1 et 2, sans nouvelle dépendance.

**Spec :** `docs/superpowers/specs/2026-10-19-scandrinks-design.md`, sections :
- §4 (quatre onglets), §4.5 (Historique), §4.6 (Réglages) ;
- §5 : RG-9 (annulation) et RG-11 (mouvements des produits archivés) ;
- §6.3, §6.4, §7, §8 ;
- §9, pour le jalon 3.

Les points reportés du jalon 2 sont dans la section « Bilan » de `docs/superpowers/plans/2026-10-20-jalon-2-pilotage.md` (p1 à p8).

**Périmètre :**
- **Traités ici :**
  - Historique et annulation ; changement du mot de passe ;
  - icônes ; page blanche sans configuration (m13) ; écran allumé au Scanner (reporté du jalon 1) ;
  - points reportés du jalon 2 : p2, p4, p6, p7 et p8 ;
  - fermeture des adresses de test des jalons 0 et 1.
- **Reportés :**
  - p1 (canette d'un produit archivé pendant la création d'un pack), avec le test e2e de la capture d'une canette par une vidéo à deux codes : les deux demandent la même vidéo de test ;
  - p3 (liste pas à jour après un archivage si la relecture échoue) : la liste affiche déjà l'erreur de connexion ;
  - pour le jalon 4 : le guide d'une page (m14, chemin des réglages caméra m15, installation depuis `scandrinks.pages.dev`), le message « Base injoignable » qui renvoie au guide, la protection contre les mots de passe divulgués et l'historique des migrations Supabase.
- **Pas de service worker.** Sans mode hors ligne (hors version 1), il ne ferait qu'ajouter le risque de servir une ancienne version de l'app.

## Global Constraints

- **Langue et code.**
  - Interface, commentaires et documentation en français ; identifiants en anglais.
  - Apostrophe droite `'` dans les textes de l'interface.
  - Espace insécable (U+00A0) avant « : » et à l'intérieur de « » dans les textes d'aide de `fieldHelp.ts`, comme aux jalons 1 et 2.
  - Le signe moins affiché est U+2212 (`−`).
- **TypeScript.** Mode `strict`, fichiers de test compris. `npm run build` vérifie les types puis construit la version de production.
- **Navigation.** Une seule page, sans changement d'URL : ni routeur, ni `#hash`, ni `history.pushState` (spec §6.2).
- **iPhone.**
  - iOS 16 au minimum.
  - Champs de saisie en 16 px au moins.
  - Chaque champ nouveau d'un formulaire (hors champ de recherche) passe par `HelpField`, avec une aide sous le champ. Les textes d'aide vivent dans `src/products/fieldHelp.ts`.
  - Rien ne dépasse en largeur à 320 px, ni ne passe sous la barre d'onglets.
- **Dépendances.** Aucune nouvelle ; versions exactes inchangées.
- **Supabase.**
  - Projet `scandrinks` (`ubddiqqjdwcntdbrsrzr`), organisation « ScanDrinks » (`zifknkzcboqmvxjyuolq`). Ne jamais toucher à l'organisation ni au projet « Webia ».
  - Toute modification de la base passe par une nouvelle migration, `supabase/migrations/20261020180000_suivi.sql`. Les migrations des jalons 1 et 2 ne sont jamais modifiées.
  - **Aucune instruction destructive dans la migration** : ni `drop`, ni `delete`, ni `truncate`, même dans un corps de fonction. Les fonctions changées gardent leur signature (`create or replace`).
  - Fonctions de l'app :
    - `security invoker` et `set search_path = ''` ;
    - accès vérifié en tête (erreur `42501`), puis paramètres validés (`invalid_input:<champ>`, code `P0001`) ;
    - `execute` retiré à `public` et `anon`, et accordé à `authenticated`.
  - **Compatibilité :** l'app du jalon 2 reste en service sur `scandrinks.pages.dev` jusqu'à la fusion. La migration ne casse aucun de ses appels : mêmes noms, mêmes paramètres, et des réponses seulement enrichies.
  - **La vraie base contient des données d'essai.** Les tests SQL n'en dépendent pas :
    - codes fictifs à préfixe `2` ;
    - prénoms manifestement fictifs, « Testeur » et « Testeuse » (point p4) ;
    - sessions fictives dans `auth.sessions`, annulées avec la transaction.
  - L'application de la migration au vrai projet (Tâche 8) est couverte par l'accord donné à la validation de ce plan.
- **Mots de passe.**
  - L'app ne les affiche, ne les enregistre et ne les journalise jamais.
  - Claude ne demande jamais un mot de passe : le porteur du projet choisit et tape lui-même le nouveau.
- **Faux backend (`e2e/fakeSupabase.mjs`).** Ses jetons portent un `session_id`, comme ceux de Supabase.
- **Adresses de test.**
  - Les préversions s'ouvrent dans Safari, sans être ajoutées à l'écran d'accueil.
  - L'icône de l'écran d'accueil vient toujours de `https://scandrinks.pages.dev`.
  - Tâche 7 : modifier les branches `jalon-0` et `jalon-1` pour fermer leurs adresses est couvert par l'accord donné à la validation de ce plan.
- **Règles de gestion (spec §5).**
  - Annuler un mouvement retire exactement son effet ; une seconde annulation ne change rien (RG-9).
  - Les mouvements d'un produit archivé restent dans l'historique (RG-11).

## Review Focus

1. **Mot de passe changé sur un téléphone pendant qu'un autre a une action en cours** (fiche de confirmation ouverte, « Corriger le stock »).
   - Comportement attendu : à la requête suivante, l'autre téléphone revient à la connexion avec « Ta session a expiré : reconnecte-toi. ». Rien n'est enregistré à moitié.
   - Tests : cas SQL 21 (Tâche 2) ; scénario e2e N, étape 3 (Tâche 5).
2. **Réponse perdue pendant le changement de mot de passe.**
   - Comportement attendu :
     - « changement non confirmé » et « Réessayer », avec les champs figés ;
     - « Réessayer » termine le changement, que le premier envoi soit passé ou non ;
     - jamais de mot de passe changé avec les autres téléphones encore connectés sans le dire.
   - Tests : `changePassword.test.ts` (Tâche 1) ; scénario e2e N, étape 4 (Tâche 5).
3. **Annuler dans l'Historique une ligne déjà annulée depuis un autre téléphone.**
   - Comportement attendu : aucun double effet, et la ligne affiche le premier auteur de l'annulation.
   - Tests : cas SQL 23 (Tâche 2) ; scénario e2e M, étape 4 (Tâche 4).
4. **« Voir plus » pendant que d'autres mouvements arrivent.**
   - Comportement attendu : aucune ligne en double ni manquante.
   - Tests : cas SQL 22 (Tâche 2) ; `historyList.test.ts` (Tâche 1) ; scénario e2e M, étape 2 (Tâche 4).
5. **Écran allumé.**
   - Comportement attendu :
     - l'écran reste allumé tant que le Scanner est à l'écran avec la caméra en marche ;
     - il est rendu au téléphone dès qu'on change d'onglet ou qu'on quitte l'app ;
     - un téléphone qui ne connaît pas cette fonction n'est pas gêné.
   - Tests : `wakeLock.test.ts` (Tâche 1) ; scénario e2e O (Tâche 6).

---

### Task 1: Règles pures

**Files:**
- Modify: `src/domain/movements.ts`, `src/domain/movements.test.ts`
- Create: `src/history/historyList.ts` (+ `.test.ts`), `src/auth/passwordRules.ts` (+ `.test.ts`), `src/auth/changePassword.ts` (+ `.test.ts`), `src/scan/wakeLock.ts` (+ `.test.ts`), `src/startup.ts` (+ `.test.ts`)

**Interfaces:**
- Consumes : `Movement`, `formatWhen` et `describeMovement` (`movements.ts`, jalon 2).
- Produces :
  - `movements.ts` :
    - `interface HistoryMovement extends Movement { productId: string; productName: string }` ;
    - `historyLine(m: HistoryMovement, now: Date): string`, soit `« <quand> — <prénom> — <description> — <produit> »`, plus `« — annulé par X »` (ou `« — annulé »`) si la ligne est annulée.
  - `historyList.ts` :
    - `mergeHistoryPage(current: HistoryMovement[], page: HistoryMovement[]): HistoryMovement[]` : ajoute la page à la fin, sans doublon d'identifiant ;
    - `markCancelled(list: HistoryMovement[], id: string, cancelledAt: string, cancelledBy: string): HistoryMovement[]`.
  - `passwordRules.ts` :
    - `PASSWORD_MIN_LENGTH = 8` ;
    - `validatePasswordChange(input: { current: string; next: string; confirm: string }): { ok: true } | { ok: false; field: 'current' | 'next' | 'confirm'; message: string }`. Les mots de passe ne sont jamais rognés.
  - `changePassword.ts` :
    - `interface PasswordAuth { signIn(password: string): Promise<{ error: unknown }>; updatePassword(password: string): Promise<{ error: unknown }>; signOutEverywhere(): Promise<{ error: unknown }>; signOutLocal(): Promise<void> }` ;
    - `type PasswordFailureKind = 'wrong_current' | 'weak' | 'same' | 'network' | 'unknown'` ;
    - `classifyPasswordError(error: unknown): PasswordFailureKind` ;
    - `changePassword(auth: PasswordAuth, input: { current: string; next: string }, options: { afterUncertainFailure: boolean }): Promise<{ ok: true } | { ok: false; step: 'verify' | 'update' | 'sign_out_everywhere'; kind: PasswordFailureKind }>`.
    - Enchaînement :
      1. `signIn(current)`. S'il est refusé (`wrong_current`) et que `afterUncertainFailure` est vrai, essayer `signIn(next)` : s'il réussit, le changement a déjà eu lieu, aller à l'étape 3.
      2. `updatePassword(next)`.
      3. `signOutEverywhere()`. Ce n'est qu'en cas de réussite que vient `signOutLocal()`.
  - `wakeLock.ts` : `createWakeLock(env: WakeLockEnv): { setActive(active: boolean): void; dispose(): void }`, avec `interface WakeLockEnv { request?: () => Promise<{ release(): Promise<void> }>; isVisible: () => boolean; onVisibilityChange: (listener: () => void) => () => void }`.
    - L'écran est demandé quand c'est actif et visible ; il est rendu quand ce n'est plus actif.
    - Il est redemandé au retour au premier plan, car iOS le rend seul quand l'app passe en arrière-plan.
    - Une demande refusée est oubliée, sans nouvel essai en boucle.
  - `startup.ts` : `startupErrorMessage(error: unknown): string`.

- [ ] **Step 1: Écrire les tests**

```ts
// movements.test.ts
test("ligne d'historique : le produit à la fin, puis l'annulation", () => {
  const now = new Date('2026-10-20T15:00:00Z')
  const base: HistoryMovement = { id: 'm1', kind: 'in', delta: 24, counted: null, employee: 'Sam', createdAt: '2026-10-19T12:32:00Z',
    cancelledAt: null, cancelledBy: null, productId: 'p1', productName: 'Coca-Cola 33 cl' }
  expect(historyLine(base, now)).toBe('lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl')
  expect(historyLine({ ...base, kind: 'inventory', delta: -3, counted: 53 }, now))
    .toBe('lun. 14:32 — Sam — Inventaire : 53 comptés (−3) — Coca-Cola 33 cl')
  expect(historyLine({ ...base, cancelledAt: '2026-10-19T13:00:00Z', cancelledBy: 'Léa' }, now))
    .toBe('lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl — annulé par Léa')
})

// historyList.test.ts
const row = (id: string): HistoryMovement => ({ id, kind: 'in', delta: 1, counted: null, employee: 'Sam', createdAt: '2026-10-19T12:00:00Z',
  cancelledAt: null, cancelledBy: null, productId: 'p1', productName: 'Coca-Cola 33 cl' })
test('page suivante : ajoutée à la fin, sans doublon', () => {
  expect(mergeHistoryPage([row('a'), row('b')], [row('b'), row('c')]).map((m) => m.id)).toEqual(['a', 'b', 'c'])
})
test('annulation : seule la ligne visée change', () => {
  const list = markCancelled([row('a'), row('b')], 'b', '2026-10-19T13:00:00Z', 'Léa')
  expect(list.map((m) => [m.id, m.cancelledBy])).toEqual([['a', null], ['b', 'Léa']])
})

// passwordRules.test.ts
test.each([
  [{ current: '', next: 'nouveau-mdp', confirm: 'nouveau-mdp' }, { ok: false, field: 'current', message: 'Tape le mot de passe actuel.' }],
  [{ current: 'ancien-mdp', next: 'court', confirm: 'court' }, { ok: false, field: 'next', message: 'Au moins 8 caractères.' }],
  [{ current: 'meme-mdp-1', next: 'meme-mdp-1', confirm: 'meme-mdp-1' },
    { ok: false, field: 'next', message: "Le nouveau mot de passe doit être différent de l'actuel." }],
  [{ current: 'ancien-mdp', next: 'nouveau-mdp', confirm: 'nouveau-mdP' }, { ok: false, field: 'confirm', message: 'Les deux saisies ne correspondent pas.' }],
  [{ current: 'ancien-mdp', next: ' nouveau-mdp ', confirm: ' nouveau-mdp ' }, { ok: true }],
])('validatePasswordChange(%j)', (input, expected) => expect(validatePasswordChange(input)).toEqual(expected))
```

Les tests de `changePassword.test.ts` utilisent un faux `PasswordAuth`. Il note chaque appel (`'signIn:<mdp>'`, `'update:<mdp>'`, `'everywhere'`, `'local'`) et répond selon un scénario. Les erreurs de forme Supabase sont :
- refus : `{ status: 400, code: 'invalid_credentials' }` ;
- mot de passe trop simple : `{ status: 422, code: 'weak_password' }` ;
- réseau : `{ name: 'AuthRetryableFetchError', status: 0 }`.

| Scénario | Appels attendus | Résultat attendu |
|---|---|---|
| tout passe | `signIn:ancien`, `update:nouveau`, `everywhere`, `local` | `{ ok: true }` |
| mot de passe actuel faux | `signIn:ancien` | `{ ok: false, step: 'verify', kind: 'wrong_current' }` |
| réseau coupé à la vérification | `signIn:ancien` | `{ ok: false, step: 'verify', kind: 'network' }` |
| nouveau mot de passe trop simple | `signIn:ancien`, `update:nouveau` | `{ ok: false, step: 'update', kind: 'weak' }` |
| réponse perdue au changement | `signIn:ancien`, `update:nouveau` | `{ ok: false, step: 'update', kind: 'network' }` |
| déconnexion générale impossible | `signIn:ancien`, `update:nouveau`, `everywhere` (sans `local`) | `{ ok: false, step: 'sign_out_everywhere', kind: 'network' }` |
| « Réessayer » après un changement passé (`afterUncertainFailure`) : l'ancien est refusé, le nouveau accepté | `signIn:ancien`, `signIn:nouveau`, `everywhere`, `local` | `{ ok: true }` |
| mot de passe actuel faux, sans échec incertain avant | `signIn:ancien` (pas d'essai avec le nouveau) | `{ ok: false, step: 'verify', kind: 'wrong_current' }` |

Plus : `classifyPasswordError` sur les trois formes d'erreur ci-dessus, `{ status: 422, code: 'same_password' }` donne `'same'`, et `new Error('boom')` donne `'unknown'`.

Les tests de `wakeLock.test.ts` utilisent un faux environnement : une demande renvoie un verrou qui note `release`, et la visibilité se commande à la main.
1. **Actif et visible :** une demande. **Pas actif :** rendu, une fois.
2. **Actif, puis app en arrière-plan puis au premier plan :** une seconde demande au retour.
3. **Sans `request` :** `setActive(true)` ne lève rien.
4. **Demande refusée :** `setActive(true)` ne lève rien. Un nouveau `setActive(true)` ne redemande qu'après un `setActive(false)`.
5. **`dispose()` :** rend l'écran et coupe l'écoute de la visibilité.

`startup.test.ts` :
- `startupErrorMessage(new Error('Configuration manquante : VITE_SUPABASE_URL (voir .env.production).'))` donne `"L'app ne peut pas démarrer : configuration manquante. Préviens la personne qui gère ScanDrinks."` ;
- `startupErrorMessage(new Error('Failed to fetch dynamically imported module'))` donne `"L'app ne peut pas démarrer. Recharge la page ; si ça continue, préviens la personne qui gère ScanDrinks."`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/domain src/history src/auth src/scan/wakeLock.test.ts src/startup.test.ts`
Expected : FAIL, car les modules et les fonctions n'existent pas.

- [ ] **Step 3: Écrire le code de la partie Interfaces**

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected : tout passe.

- [ ] **Step 5: Commit**

Message : `feat(domain): historique, mot de passe, écran allumé et démarrage (règles pures)`.

---

### Task 2: Migration du suivi et tests SQL

**Files:**
- Create: `supabase/migrations/20261020180000_suivi.sql`
- Modify: `supabase/tests/database.test.sql`, `supabase/tests/supabase-stub.sql`

**Interfaces:**
- Consumes : la base des jalons 1 et 2.
- Produces :
  - **`private.is_allowed()`** : `create or replace`, même signature. Elle reste `security definer`, `stable` et `set search_path = ''`.
    - Si aucune session `auth.sessions` ne porte l'identifiant `auth.jwt() ->> 'session_id'` avec `not_after` vide ou futur, elle lève `session_revoked` (code `PT401`, que PostgREST rend en HTTP 401).
    - Sinon, elle renvoie comme avant l'existence du compte dans `allowed_users`.
  - **`public.list_history(p_before_created_at timestamptz default null, p_before_id uuid default null, p_limit int default 50) returns jsonb`** : `stable`, accès vérifié.
    - Erreurs : `p_limit` hors de 1 à 100 → `invalid_input:limit` ; un seul des deux éléments du curseur → `invalid_input:cursor`.
    - Renvoie un tableau d'objets `{ id, kind, delta, counted, employee, created_at, cancelled_at, cancelled_by, product_id, product_name }`, triés par `created_at` puis `id` décroissants.
    - Avec un curseur, seulement les lignes où `(created_at, id) < (p_before_created_at, p_before_id)`. Produits archivés compris.
  - **`public.cancel_movement(p_movement_id uuid, p_employee text)`** : `create or replace`, même signature et même comportement. La réponse ajoute `cancelled_at` et `cancelled_by`, ceux du mouvement après l'appel : le premier auteur est gardé.
  - **`public.create_product(...)`** : `create or replace`, même signature à 6 paramètres (point p7). Nouvel ordre :
    1. accès ;
    2. contrôle des champs (`private.checked_product_name`) ;
    3. `insert … on conflict (id) do nothing returning id`. Sans ligne insérée, renvoyer la fiche existante, sans autre contrôle ;
    4. sinon, contrôle des codes (liste, format, unités, `barcode_taken:<code>`) puis insertion des codes.
    Une création rejouée, ou deux envois simultanés du même identifiant, renvoient donc la même fiche.
  - Droits de `list_history` : `revoke` à `public` et `anon`, `grant` à `authenticated`.
  - `supabase-stub.sql` : `auth.sessions (id uuid primary key, user_id uuid not null, not_after timestamptz)` et `auth.jwt()`, qui renvoie `request.jwt.claims` en `jsonb` (vide s'il n'y en a pas).

- [ ] **Step 1: Mettre à jour et compléter `database.test.sql`**

Dans la mise en place, en tant que `postgres` :
- sessions `…0000a1a1` pour A et `…0000b2b2` pour B ;
- les claims de A et de B portent leur `session_id` ;
- les prénoms « Sam » et « Léa » deviennent « Testeur » et « Testeuse », et « sam » devient « testeur » (cas 20) ;
- le cas 9 vérifie en plus qu'aucun produit « Doublon » n'existe après l'échec.

Nouveaux cas :
- **21. Session fermée ou expirée.** Avec les claims de A et un `session_id` absent de `auth.sessions` :
  - `select 1 from public.product_stock` échoue avec `PT401` ;
  - `select public.lookup_barcode('2000000000022')` échoue avec `PT401`.
  Puis même chose avec une session de A dont `not_after` est passé. Les claims de A reviennent ensuite à sa session valide.
- **22. Historique.** Trois mouvements de A insérés à `now() + 3`, `+ 2` et `+ 1 minute`, avec des identifiants fixes.
  - `list_history(null, null, 2)` renvoie les deux premiers, dans cet ordre, avec `product_name`.
  - La page suivante (curseur du second) commence par le troisième.
  - Les deux pages n'ont aucun identifiant en commun.
  - `list_history(null, null, 0)` donne `invalid_input:limit` ; `list_history(now(), null, 10)` donne `invalid_input:cursor`.
  - Un mouvement d'un produit archivé figure dans la liste.
  - Sans connexion (`anon`), l'appel est refusé (`42501`), comme pour B.
- **23. Annulation déjà faite.** Après une annulation par « Testeur », une seconde par « Testeuse » renvoie `cancelled_by = 'Testeur'` et un `cancelled_at` non nul. Le stock est inchangé.
- **24. Suppressions (point p4).**
  - `anon` : `delete from public.barcodes` échoue avec `42501`.
  - B : la même suppression, lancée par une aide `pg_temp.run(text)` qui fait `execute`, ne retire aucune ligne.
  - Comme au jalon 2, toute instruction de suppression reste dans une chaîne de texte.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `su postgres -c "bash supabase/tests/run-local.sh"`
Expected : ÉCHEC (fonction `list_history` absente, ou session non vérifiée au cas 21).

- [ ] **Step 3: Écrire la migration et compléter `supabase-stub.sql`**

- [ ] **Step 4: Lancer les tests**

Run: `su postgres -c "bash supabase/tests/run-local.sh"`
Expected : `OK`. Puis mutations : sans le contrôle de session, avec `<=` au lieu de `<` dans le curseur, et sans le `on conflict` (une création rejouée doit alors échouer au cas 13). Chacune doit faire échouer un cas.

- [ ] **Step 5: Commit**

Message : `feat(db): historique paginé, session vérifiée, annulation détaillée, création sans conflit`.

---

### Task 3: API et faux backend

**Files:**
- Modify: `src/data/api.ts`, `src/data/api.test.ts`, `src/data/apiErrors.test.ts`, `e2e/fakeSupabase.mjs`

**Interfaces:**
- Consumes : `HistoryMovement` (Tâche 1) ; `list_history` et `cancel_movement` (Tâche 2).
- Produces :
  - `api.ts` :
    - `HISTORY_PAGE_SIZE = 50` ;
    - `interface HistoryCursor { createdAt: string; id: string }` ;
    - `listHistory(cursor: HistoryCursor | null): Promise<{ movements: HistoryMovement[]; next: HistoryCursor | null }>`. `next` est le curseur de la dernière ligne quand la page est pleine, `null` sinon ;
    - `cancelMovement(movementId, employee): Promise<{ stock: number; cancelledAt: string; cancelledBy: string }>`.
  - Faux backend :
    - **jetons :** chaque connexion crée une session (`session_id` dans le jeton) ; le mot de passe courant est gardé en mémoire ;
    - **`PUT /auth/v1/user`** `{ password }` : 422 `same_password` ou `weak_password` (moins de 8 caractères) ; sinon il change le mot de passe et renvoie l'utilisateur ;
    - **`POST /auth/v1/logout?scope=global|local`** : ferme toutes les sessions, ou celle du jeton ;
    - **requête avec un jeton de session fermée :** 401 `{ code: 'PT401', message: 'session_revoked' }` ;
    - **RPC :** `list_history` (même tri et même curseur que la base) et `cancel_movement`, qui renvoie `cancelled_at` et `cancelled_by` ;
    - **options :** `extraMovements: n` (n mouvements de plus, datés à la minute) ; `failFirstRead: 'movements' | 'barcodes'` (première lecture coupée) ; `loseFirst` accepte aussi `'auth:user'` ;
    - **le retour gagne :** `revokeAllSessions()`, comme un changement de mot de passe sur un autre téléphone ; `cancelElsewhere(id, employee)` ; `authCalls`, qui note `token`, `user` et `logout:<scope>` ;
    - **le refus d'accès pour une session fermée vaut aussi pour les lectures** (`product_stock`, `barcodes`, `movements`).

- [ ] **Step 1: Écrire les tests**

`api.test.ts` :
- `listHistory(null)` appelle `rpc('list_history', { p_before_created_at: null, p_before_id: null, p_limit: 50 })`.
- Avec 50 lignes, `next` vaut `{ createdAt, id }` de la dernière. Avec 3 lignes, `next` vaut `null`. `product_name` devient `productName`.
- `listHistory({ createdAt: '2026-10-19T12:00:00+00:00', id: 'm9' })` passe ces deux valeurs.
- `cancelMovement('m1', 'Sam')` renvoie `{ stock: 24, cancelledAt: '2026-10-19T13:00:00+00:00', cancelledBy: 'Léa' }` pour la réponse `{ stock: 24, product_id: 'p1', cancelled_at: '2026-10-19T13:00:00+00:00', cancelled_by: 'Léa' }`.

`apiErrors.test.ts` : `{ code: 'PT401', message: 'session_revoked', status: 401 }` donne `'session'`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/data`
Expected : FAIL (`listHistory` absent, champs d'annulation manquants).

- [ ] **Step 3: Écrire le code et le faux backend**

- [ ] **Step 4: Lancer les tests**

Run: `npm test && npm run e2e`
Expected : tout passe. Les scénarios A à L ne changent pas.

- [ ] **Step 5: Commit**

Message : `feat(data): historique et annulation détaillée dans l'API ; sessions et mot de passe dans le faux backend`.

---

### Task 4: Onglet Historique

**Files:**
- Create: `src/history/HistoryScreen.tsx`, `src/history/History.css`
- Modify: `src/app/TabBar.tsx`, `src/app/AppShell.tsx`, `src/app/AppShell.css`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `api.listHistory`, `api.cancelMovement` (Tâche 3) ; `historyLine`, `mergeHistoryPage` et `markCancelled` (Tâche 1).
- Produces :
  - **`Tab`** : `'scanner' | 'shopping' | 'stock' | 'history'`. Le quatrième bouton s'appelle « Historique ».
    - Les quatre onglets tiennent sur une ligne dès 320 px. Le badge d'« À racheter » ne pousse pas les autres boutons.
  - **`HistoryScreen`**, props `{ employee: string; onCatalogChanged: () => void; onSessionExpired: () => void }` :
    - titre `h1` « Historique » ; liste `ul aria-label="Historique"` ;
    - chaque ligne affiche `historyLine` ;
    - une ligne active porte le bouton « Annuler », de nom accessible `Annuler : <ligne>` ;
    - une ligne annulée est barrée (`li.cancelled`), sans bouton ;
    - « Voir plus » charge la page suivante, tant qu'il y en a une ;
    - autres états : « Chargement… », « Aucun mouvement pour l'instant. », erreur avec « Réessayer » ;
    - la première page est relue à l'ouverture de l'onglet et au retour dans l'app ;
    - « Annuler » :
      1. confirmation « Annuler ce mouvement ?\n<ligne>\nLe stock sera recalculé. » ;
      2. `cancelMovement(id, employee)` ;
      3. `markCancelled` avec l'auteur renvoyé par la base, puis `onCatalogChanged()` ;
      4. un échec affiche le message sous la liste ; une session expirée appelle `onSessionExpired`.
  - **`AppShell`** affiche `HistoryScreen` quand l'onglet est « Historique ». Changer d'onglet relit le catalogue, comme avant.

- [ ] **Step 1: Écrire le scénario e2e M (Historique)**

Catalogue `pilotage`, avec `extraMovements: 55` : des entrées de +1 sur le Lipton, datées avant les mouvements du catalogue. Le Lipton reste au-dessus de son seuil, donc « À racheter » ne change pas. Connexion, puis onglet « Historique ».
1. **Les lignes.** La première ligne correspond à `/— Sam — Sortie −3 — Red Bull 25 cl$/`, la deuxième à `/— Léa — Sortie −38 — Coca-Cola 33 cl$/`. Une ligne correspond à `/— Sam — Entrée \+24 — Oasis Tropical 33 cl$/` (produit archivé).
2. **« Voir plus ».**
   - 50 lignes ; « Voir plus » ; 61 lignes, sans identifiant en double ; « Voir plus » disparaît.
   - Appels `list_history` : le second porte le curseur de la 50ᵉ ligne.
3. **Annuler.**
   - « Annuler » sur la ligne de Léa : le texte de la confirmation commence par « Annuler ce mouvement ? » et finit par « Le stock sera recalculé. ».
   - Appel `cancel_movement` avec `{ p_movement_id: 'm-c2', p_employee: 'Sam' }`.
   - La ligne finit par « — annulé par Sam » et porte la classe `cancelled`. L'onglet devient « À racheter (2) » : le Coca remonte à 48.
4. **Déjà annulé ailleurs.** `fake.cancelElsewhere('m-r1', 'Léa')`, puis « Annuler » sur la ligne du Red Bull : la ligne finit par « — annulé par Léa ».
5. **Retour dans l'app.** `fake.addMovement` (une entrée « Zoé » sur le Lipton), puis `visibilitychange` (caché, puis visible).
   - La première ligne correspond à `/— Zoé — Entrée \+12 — Lipton Pêche 50 cl$/`.
   - Le catalogue est relu : un appel `product_stock` de plus (point p4, retour dans l'app).

- [ ] **Step 2: Lancer le scénario pour vérifier qu'il échoue**

Run: `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=M node e2e/app-smoke.mjs`
Expected : FAIL, en attendant le bouton « Historique ».

- [ ] **Step 3: Écrire le code de la partie Interfaces**

- [ ] **Step 4: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

Captures 390 × 844 et 320 × 640 de la barre d'onglets, de l'Historique avec une ligne annulée et de « Voir plus » : rien ne dépasse, et aucun bouton n'est caché sous la barre d'onglets.

- [ ] **Step 5: Commit**

Message : `feat(history): onglet Historique, « Voir plus » et annulation`.

---

### Task 5: Changement du mot de passe du tabac

**Files:**
- Create: `src/settings/ChangePasswordScreen.tsx`, `src/auth/passwordAuth.ts`
- Modify: `src/settings/SettingsScreen.tsx`, `src/auth/LoginScreen.tsx`, `src/app/AppShell.tsx`, `src/products/fieldHelp.ts`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `validatePasswordChange`, `changePassword`, `classifyPasswordError` (Tâche 1) ; `SHOP_EMAIL` et `supabase` (`supabaseClient.ts`) ; `HelpField`.
- Produces :
  - **`passwordAuth.ts`** : `createPasswordAuth(client, email: string, beforeLocalSignOut: () => void): PasswordAuth`.
    - `signIn` appelle `signInWithPassword({ email, password })`.
    - `updatePassword` appelle `updateUser({ password })`.
    - `signOutEverywhere` appelle `auth.admin.signOut(<jeton courant>, 'global')`. Cette fonction ne touche pas à la session du téléphone : en cas d'échec, « Réessayer » reste possible.
    - `signOutLocal` appelle `beforeLocalSignOut()`, puis `signOut({ scope: 'local' })`.
  - **`SettingsScreen`** : un bouton « Changer le mot de passe du tabac », entre « Changer de prénom » et « Se déconnecter ».
  - **`ChangePasswordScreen`**, props `{ onDone: () => void; onCancel: () => void; beforeLocalSignOut: () => void }`. C'est un écran par-dessus l'app, comme le choix du prénom.
    - Titre `h1` « Mot de passe du tabac ». Texte : « Tous les téléphones seront déconnectés, celui-ci compris : chacun devra retaper le nouveau mot de passe. »
    - Un champ caché `autocomplete="username"` avec `SHOP_EMAIL`, pour le trousseau iCloud.
    - Trois `HelpField` de type `password` :
      - « Mot de passe actuel » (`current-password`) ;
      - « Nouveau mot de passe » (`new-password`) ;
      - « Retape le nouveau mot de passe » (`new-password`).
    - Aides (`fieldHelp.ts`) :
      - `passwordCurrent` : « Celui que tu tapes aujourd'hui pour te connecter. » ;
      - `passwordNew` : « Au moins 8 caractères. Note-le avant de valider : toute l'équipe en aura besoin. » ;
      - `passwordConfirm` : « Tape-le une seconde fois, pour éviter une faute de frappe. ».
    - Boutons : « Changer le mot de passe » (« Changement… » pendant l'envoi) et « Annuler ».
    - Les erreurs de saisie (`validatePasswordChange`) s'affichent sous le champ concerné, sans aucun appel.
    - Messages d'échec :

      | Cas | Message |
      |---|---|
      | `wrong_current` | « Mot de passe actuel incorrect. » |
      | `weak` | « Mot de passe refusé : trop simple. Choisis-en un plus long ou moins courant. » |
      | `same` | « Le nouveau mot de passe doit être différent de l'actuel. » |
      | `network` à la vérification | « Pas de connexion. Réessaie quand le réseau revient. » |
      | `network` au changement ou à la déconnexion générale | « Pas de connexion : changement non confirmé. Touche « Réessayer ». » |
      | `unknown` | « Changement impossible. Réessaie. » |

    - **Échec réseau au changement ou à la déconnexion générale :** les champs se figent et le bouton devient « Réessayer ». Un nouvel essai se fait avec `afterUncertainFailure: true`.
  - **`LoginScreen`** : prop `notice: { text: string; tone: 'error' | 'ok' } | null`. `ok` s'affiche en vert (`message-ok`, `role="status"`).
  - **`AppShell`** : écran `'password'` par-dessus l'app. `beforeLocalSignOut` note une déconnexion voulue et prépare le message « Mot de passe changé. Connecte-toi avec le nouveau mot de passe. » (`ok`). Les autres messages de connexion gardent le ton `error`.

- [ ] **Step 1: Écrire le scénario e2e N (mot de passe)**

1. **Saisies refusées.**
   - Réglages, puis « Changer le mot de passe du tabac ». Une aide est visible sous chacun des trois champs.
   - Confirmation différente : « Les deux saisies ne correspondent pas. », sans appel d'authentification.
   - Mot de passe actuel faux : « Mot de passe actuel incorrect. ».
2. **Changement réussi.**
   - Appels, dans l'ordre : `token`, `user`, `logout:global`, `logout:local`.
   - Retour à la connexion avec « Mot de passe changé. Connecte-toi avec le nouveau mot de passe. ».
   - L'ancien mot de passe donne « Mot de passe incorrect. » ; le nouveau ouvre l'app.
3. **Autre téléphone** (nouveau contexte, catalogue par défaut).
   - Connexion ; la fiche de confirmation du Coca est ouverte.
   - `fake.revokeAllSessions()`, puis « Valider » : retour à la connexion avec « Ta session a expiré : reconnecte-toi. ». Aucun mouvement n'est enregistré.
4. **Réponse perdue** (`loseFirst: ['auth:user']`).
   - Premier essai : « Pas de connexion : changement non confirmé. Touche « Réessayer ». », champs figés.
   - « Réessayer » : appels `token` (refusé avec l'ancien), `token` (accepté avec le nouveau), `logout:global` et `logout:local`, sans second `user`. Retour à la connexion avec le message de réussite.

- [ ] **Step 2: Lancer le scénario pour vérifier qu'il échoue**

Run: `npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=N node e2e/app-smoke.mjs`
Expected : FAIL, en attendant le bouton « Changer le mot de passe du tabac ».

- [ ] **Step 3: Écrire le code de la partie Interfaces**

- [ ] **Step 4: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe. Captures de l'écran du mot de passe (390 × 844), vierge puis après un échec réseau.

- [ ] **Step 5: Commit**

Message : `feat(settings): changer le mot de passe du tabac, tous les téléphones déconnectés`.

---

### Task 6: Finitions

**Files:**
- Create: `public/icon.svg`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`, `scripts/render-icons.mjs`, `src/app/icons.test.ts`, `src/scan/useScreenWakeLock.ts`
- Modify: `index.html`, `public/manifest.webmanifest`, `src/main.tsx`, `src/scanner/ScannerScreen.tsx`, `src/stock/ProductSheet.tsx`, `src/stock/AddCodeForm.tsx`, `src/styles.css`, `e2e/app-smoke.mjs`

**Interfaces:**
- Consumes : `createWakeLock` et `startupErrorMessage` (Tâche 1) ; `failFirstRead` du faux backend (Tâche 3).
- Produces :
  - **Icônes.** `icon.svg` : fond vert `#1f6f3f`, code-barres blanc dans un cadre arrondi, sans texte. `scripts/render-icons.mjs` le rend en PNG 180, 192 et 512 px avec le Chromium de Playwright. `index.html` reçoit `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` et `<meta name="apple-mobile-web-app-title" content="ScanDrinks" />` ; le manifeste reçoit `icons` (192 et 512, `image/png`).
  - **Écran allumé.** `useScreenWakeLock(active: boolean)` : il lie `createWakeLock` à `navigator.wakeLock` et à `document`. Il est actif quand le Scanner est à l'écran (`active`) et que la caméra tourne.
  - **Démarrage.** `main.tsx` charge `App` par `import()`. En cas d'échec, `#root` affiche `startupErrorMessage(error)` dans un paragraphe, au lieu d'une page blanche (m13).
  - **Fiche produit (p2).** Quand la lecture des codes et des mouvements échoue, un bouton « Réessayer » sous le message la relance.
  - **« Code-barres » (p6).** `onFocus={selectAllSoon}`.
  - **Barre d'onglets (p8).** `html { scroll-padding-bottom: 76px }` : un champ amené à l'écran ne passe plus dessous.

- [ ] **Step 1: Écrire les tests**

`icons.test.ts` : les PNG ont les dimensions 180, 192 et 512, lues dans l'en-tête IHDR. Le manifeste déclare 192 et 512, et `index.html` déclare `apple-touch-icon`.

Scénario e2e O (finitions), avec un faux `navigator.wakeLock` installé par `addInitScript`, qui note `request` et `release` :
1. **Écran allumé.** Connexion : la caméra tourne, une demande est notée. Onglet « Stock » : un rendu. Retour au Scanner : une nouvelle demande.
2. **Fiche produit (p2).** Avec `failFirstRead: 'movements'` : fiche du Coca, puis le message de connexion avec « Réessayer ». Un appui affiche « Derniers mouvements ».
3. **« Code-barres » (p6).** « Ajouter un code », puis un code faux et « Continuer ». Toucher le champ sélectionne tout son contenu.
4. **Barre d'onglets (p8).** « Nouveau produit » : `focus()` sur « Stock idéal (unités) ». Le bas du champ est au-dessus du haut de la barre d'onglets.

Scénario K complété (point p4) :
- « Archiver » refusé une première fois : aucun appel `set_product_archived`, et la fiche reste ouverte ;
- le texte de la confirmation est exactement « Archiver « Coca-Cola 33 cl » ? Il disparaîtra des listes ; son historique est gardé. ».

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/app/icons.test.ts; npx vite build --mode e2e --outDir dist-e2e && E2E_ONLY=K,O node e2e/app-smoke.mjs`
Expected : FAIL (icônes absentes, aucune demande d'écran allumé, pas de « Réessayer » dans la fiche).

- [ ] **Step 3: Écrire le code de la partie Interfaces**

- [ ] **Step 4: Lancer les tests**

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe. Capture de l'icône 180 px, et vérification à la main : une configuration manquante (`npx vite build --mode sans-config --outDir dist-sans-config`, servi par `vite preview`) affiche le message de démarrage au lieu d'une page blanche.

- [ ] **Step 5: Commit**

Message : `feat(app): icône, écran allumé au Scanner, message de démarrage et finitions (m13, p2, p4, p6, p8)`.

---

### Task 7: Fermer les anciennes adresses de test

**Files :** sur les branches `jalon-0` et `jalon-1` seulement : `index.html`, remplacé par une page fixe.

**Interfaces:**
- Produces : `https://jalon-0.scandrinks.pages.dev` et `https://jalon-1.scandrinks.pages.dev` affichent une page sans application :
  - titre « ScanDrinks — adresse de test fermée » ;
  - texte : « Cette adresse servait aux tests. L'app ScanDrinks est maintenant sur scandrinks.pages.dev. » puis « Pour la réinstaller : supprime cette icône de l'écran d'accueil, ouvre le lien ci-dessous dans Safari, puis Partager → « Sur l'écran d'accueil ». » ;
  - lien « Ouvrir ScanDrinks » vers `https://scandrinks.pages.dev`.
  Une icône installée depuis une de ces adresses montre donc ce message au lieu d'une ancienne version.

- [ ] **Step 1: Vérifier l'état actuel**

Run: `curl -sS https://jalon-1.scandrinks.pages.dev/ | grep -c "adresse de test fermée"` (même chose pour `jalon-0`)
Expected : `0`.

- [ ] **Step 2: Sur chaque branche, remplacer `index.html`, construire puis envoyer**

Run : sur chaque branche, `npm ci && npm run build` (le build doit passer), puis commit `chore(jalon-N): adresse de test fermée, renvoi vers scandrinks.pages.dev` et `git push origin jalon-N`.

- [ ] **Step 3: Vérifier les deux adresses une fois Cloudflare à jour**

Run : la commande du Step 1.
Expected : `1` pour les deux. `https://scandrinks.pages.dev` est inchangé (même paquet qu'avant).

---

### Task 8: Mise en service du jalon 3

**Files:**
- Create: `docs/jalon-3-test.md`
- Modify: `README.md`, `docs/superpowers/specs/2026-10-19-scandrinks-design.md`

**Interfaces:**
- Consumes : la migration et les tests SQL (Tâche 2) ; l'app (Tâches 1 à 6).
- Produces : le jalon 3 en ligne, d'abord en préversion sur `https://jalon-3.scandrinks.pages.dev`, puis sur `https://scandrinks.pages.dev` après la fusion.

- [ ] **Step 1: Contrôles avant migration**, sur le vrai projet

- Nombres de lignes de `products`, `barcodes` et `movements`.
- Des sessions sont ouvertes dans `auth.sessions` : ce sont celles des téléphones connectés, qui doivent le rester après la migration.
- Aucun prénom « Testeur » ou « Testeuse » n'existe déjà.

- [ ] **Step 2: Appliquer la migration**

`apply_migration`, avec `name: 'suivi'` et le contenu exact du fichier. Elle ne contient aucune instruction destructive, donc pas de confirmation attendue.

Si l'outil n'aboutit pas : vérifier d'abord que rien n'a été appliqué. Le porteur du projet exécute alors le fichier dans l'éditeur SQL. Puis contrôle par empreintes et ligne d'historique, comme au jalon 2.

- [ ] **Step 3: Tests SQL sur le vrai projet**

`execute_sql` avec `supabase/tests/database.test.sql`. Expected : `OK`. Les nombres de lignes du Step 1 sont inchangés.

- [ ] **Step 4: Conseils de Supabase**

`get_advisors`, avec `security` puis `performance`. Expected : aucune alerte ERROR. Les alertes WARN sont notées dans le journal.

- [ ] **Step 5: Compatibilité avec l'app du jalon 2 en service**

- Sans connexion, `list_history` répond `42501`.
- `cancel_movement` à 2 paramètres est toujours trouvé : `42501` et non `PGRST202`.
- Le porteur du projet ouvre l'app installée (jalon 2, sur `scandrinks.pages.dev`) et vérifie que le Stock s'affiche. Une session valide n'est pas touchée par le contrôle de session.

- [ ] **Step 6: Documentation**

- **`docs/jalon-3-test.md`**, en français simple, environ 20 minutes :
  1. Historique : les lignes, « Voir plus » ;
  2. annuler une erreur (une entrée de test) et voir le stock revenir ;
  3. deux iPhone : une annulation sur l'un, l'Historique à jour sur l'autre ;
  4. l'écran reste allumé au Scanner plus longtemps que le verrouillage automatique ;
  5. le changement du mot de passe avec deux iPhone. Choisir un moment calme et prévenir l'équipe : tous les téléphones devront retaper le nouveau mot de passe ;
  6. l'icône vue dans « Sur l'écran d'accueil », sans l'ajouter ;
  7. la page « adresse de test fermée » sur l'ancienne icône du jalon 1, si elle est encore là.

  Règle : la préversion se teste dans Safari, sans l'installer.
- **README :** section « Jalon 3 », fonctions SQL, installation depuis `https://scandrinks.pages.dev` uniquement.
- **Spec :**
  - §6.3 : `list_history`, la réponse de `cancel_movement`, `create_product` sans conflit ;
  - §6.4 : la session vérifiée par `is_allowed` ;
  - §11 : les décisions de la section « Décisions prises dans ce plan », datées du jour.

Run: `npm test && npm run e2e && npm run build`
Expected : tout passe.

- [ ] **Step 7: Commit et envoi**

Message : `docs(jalon-3): mise en service, protocole de test`, puis `git push -u origin jalon-3`.

- [ ] **Step 8: Contrôles de la préversion**

- HTTP 200, même paquet que le build local.
- Sans connexion, `list_history` répond `42501`. L'inscription est toujours refusée.
- Script Playwright jetable : un mauvais mot de passe donne « Mot de passe incorrect. ».

- [ ] **Step 9: Test du porteur du projet sur iPhone**, d'après `docs/jalon-3-test.md`

Les défauts trouvés sont corrigés en TDD sur `jalon-3`.

- [ ] **Step 10: Fusion dans `main`**, avec l'accord du porteur du projet

Run: `git fetch origin main && git checkout main && git merge --ff-only jalon-3 && git push origin main`
Expected : `scandrinks.pages.dev` sert le jalon 3 (même paquet que la préversion).

---

## Décisions prises dans ce plan (la spec ne les fixe pas)

- **Historique :**
  - pagination par curseur (date, identifiant) plutôt que par numéro de page : un mouvement arrivé entre deux pages ne décale rien ;
  - le nom du produit termine la ligne (exemple de la spec) ;
  - les produits archivés y figurent ;
  - tout le monde peut annuler toute ligne active, après confirmation ;
  - la ligne affiche toujours le premier auteur de l'annulation ;
  - la fiche produit reste en lecture seule : on annule depuis l'Historique.
- **Mot de passe :**
  - le mot de passe actuel est demandé : un téléphone laissé déverrouillé ne suffit pas pour le changer ;
  - 8 caractères au moins ;
  - tous les téléphones sont déconnectés, celui-ci compris (spec §4.6). L'effet est immédiat grâce au contrôle de session dans la base, et non à l'expiration du jeton (jusqu'à une heure) ;
  - sur les autres téléphones, le message reste « Ta session a expiré : reconnecte-toi. ».
- **Écran allumé :** seulement au Scanner, caméra en marche. Il est rendu dès qu'on change d'onglet ou qu'on quitte l'app.
- **Icône :** fond vert de l'app avec un code-barres blanc, sans texte. Le nom sous l'icône est « ScanDrinks ».
- **Pas de service worker** (voir « Périmètre »).
- **Comptage vide (p5) :** « Valider » reste grisé, sans message tant que rien n'est tapé. À défaut d'un autre choix du porteur du projet, le comportement du jalon 2 est gardé.
- **Anciennes adresses de test :** fermées par une page d'explication plutôt que supprimées. Une icône installée depuis l'une d'elles montre ainsi comment réinstaller l'app.
