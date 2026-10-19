# ScanDrinks — Cahier des charges (conception)

| | |
|---|---|
| **Date** | 19 octobre 2026 |
| **Statut** | Validé par le porteur du projet le 19/10/2026 (conception présentée en 4 parties les 18 et 19/10/2026) |
| **Porteur du projet** | Enzo Froussart |
| **Réalisation** | Claude : code, tests, base de données, documentation |
| **Dépôt** | `efroussartpro-source/scandrinks` (privé) |

---

## 1. Contexte et objectif

Le bureau de tabac vend des boissons (canettes, bouteilles) achetées en packs chez Metro. Les packs sont rangés en réserve, puis sortis au fur et à mesure pour remplir le frigo et les rayons.

Aujourd'hui, savoir quoi racheter demande de compter à la main. **ScanDrinks** fait gagner ce temps : on scanne le code-barres d'un pack, l'app reconnaît le produit et ajoute la bonne quantité, et une liste indique ce qu'il faut racheter et combien.

### Critères de réussite

1. Pour un pack déjà connu, l'entrée se valide en **un geste après le scan**, deux s'il faut régler la quantité.
2. Une fiche produit créée au premier scan est **reconnue aux scans suivants**, et la quantité du pack s'ajoute toute seule.
3. La liste **À racheter** donne, pour chaque produit sous son seuil, **le nombre de packs Metro à prendre**.
4. **Tous les employés voient le même stock**, chacun sur son iPhone.
5. **0 € par mois**, sans compte Apple développeur ni App Store.

## 2. Utilisateurs et contexte d'usage

- Les employés du tabac, **chacun sur son propre iPhone**.
- **Moins de 30 références** de boissons.
- **Bon réseau** (wifi ou 4G) en boutique comme en réserve.
- **Pas de compte Apple développeur** : ScanDrinks est une app web installable, ouverte dans Safari puis ajoutée à l'écran d'accueil.
- **Tout le monde peut tout faire.** Le prénom enregistré sur chaque mouvement permet de savoir qui a fait quoi.
- Le stock suivi est **celui de la réserve**. Ce qui est au frigo ou en rayon est considéré comme sorti.

## 3. Périmètre

### Dans la version 1

- Scan de codes-barres avec trois modes : Entrée, Sortie, Inventaire.
- Fiche produit créée au premier scan, nom pré-rempli par Open Food Facts quand c'est possible.
- Plusieurs codes-barres par produit (canette = 1 unité, pack = N unités).
- Liste À racheter exprimée en packs Metro.
- Liste du stock, fiche produit modifiable, archivage.
- Inventaire (comptage) et correction du stock.
- Historique de tous les mouvements, avec annulation.
- Compte unique du tabac, prénom par téléphone, changement de mot de passe.

### Hors version 1 (possible plus tard)

Notifications, lien avec la caisse, prix et budget Metro, import des factures Metro, partage de la liste par WhatsApp, mode hors ligne, plusieurs boutiques, suivi des dates limites (la DLUO figure dans le code long de certaines étiquettes de packs).

## 4. Parcours et écrans

L'app a quatre onglets en bas : **Scanner**, **À racheter**, **Stock**, **Historique**. Une icône en haut de l'écran ouvre les **Réglages**.

### 4.1 Première ouverture (une fois par téléphone)

1. Ouvrir le lien de l'app dans Safari, puis Partager → « Sur l'écran d'accueil ».
2. Ouvrir ScanDrinks depuis son icône.
3. Taper le mot de passe du tabac. L'adresse e-mail du compte est déjà remplie.
4. Choisir son prénom parmi ceux déjà utilisés, ou en taper un nouveau (1 à 30 caractères).

Le téléphone reste ensuite connecté.

### 4.2 Scanner (écran principal)

```
+------------------------------+
|                              |
|          [ caméra ]          |
|                              |
+------------------------------+
| ENTRÉE + | SORTIE - | INV =  |
+------------------------------+
| Coca-Cola 33 cl              |
| Pack de 24               +24 |
| Quantité      [-]  1  [+]    |
| [         VALIDER          ] |
+------------------------------+
```

**Modes.** Trois modes, chacun avec sa couleur :

- **Entrée +** (vert) : retour de Metro ;
- **Sortie −** (orange) : passage de la réserve au frigo ou au rayon ;
- **Inventaire =** (bleu) : comptage de ce qui reste.

Chaque téléphone garde le dernier mode choisi. La fiche de confirmation rappelle toujours le mode, en couleur et avec le signe (+24 ou −24).

**Code connu.** La fiche du produit s'affiche avec la quantité du code, par exemple « Pack de 24 → +24 ». Le sélecteur de quantité (×1 à ×99) permet de compter plusieurs packs identiques en un seul scan. Après « Valider » :

- un message confirme l'action et donne le nouveau stock, avec un bouton « Annuler » pendant 5 secondes (ensuite, l'annulation se fait depuis l'Historique) ;
- la caméra est aussitôt prête pour le scan suivant.

**Code inconnu.** Deux choix :

1. **Nouveau produit.** Le formulaire contient :
   - **Nom** : pré-rempli si Open Food Facts connaît le code. Sinon, le bouton « Scanner une canette du pack » remplit le nom à partir de la canette et enregistre aussi le code de celle-ci (1 unité). Si la canette est inconnue elle aussi, son code est enregistré quand même et le nom se tape à la main.
   - **Ce code vaut** : N unités (obligatoire).
   - **Pack Metro** : le nombre d'unités du pack acheté d'habitude chez Metro. Pré-rempli avec N si N > 1, à saisir sinon.
   - **Seuil d'alerte** et **stock idéal** : pré-remplis à 1 et 2 packs Metro, modifiables. Ils suivent le pack Metro tant qu'on ne les a pas changés à la main.

   Une fois la fiche créée, l'app affiche la fiche de confirmation du mode en cours : « +24 » en Entrée, « −24 » en Sortie, la saisie du comptage en Inventaire.
2. **Ajouter ce code à un produit existant.** On choisit le produit dans la liste, puis on indique combien d'unités vaut ce code. Exemple : le code d'une canette seule, pour une fiche créée depuis le pack (1 unité).

**Inventaire.** On scanne un produit, ou on le choisit dans la liste, puis on saisit ce qu'on compte en packs Metro + unités (« 2 packs + 5 » = 53). L'app affiche le stock qu'elle connaissait et l'écart. C'est aussi la **mise en place du premier jour** : un tour de la réserve, un scan par produit (avec création de la fiche si besoin), puis le comptage.

**Saisie manuelle.** Si un code est illisible ou absent, le bouton « Saisie manuelle » permet de choisir le produit dans la liste. La suite est la même fiche de confirmation.

**Produit archivé.** Si le code scanné appartient à un produit archivé, l'app propose de le réactiver.

### 4.3 À racheter

- La liste montre les produits dont le stock est inférieur ou égal au seuil (RG-5).
- Chaque ligne donne le nom, le stock restant et **le nombre de packs à prendre**. Exemple : « Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24 ».
- Les produits en rupture (stock ≤ 0) viennent en premier, les autres suivent par ordre alphabétique.
- Un badge sur l'onglet indique le nombre de produits à racheter.
- Une ligne disparaît dès qu'une entrée fait repasser le stock au-dessus du seuil.

### 4.4 Stock et fiche produit

- La liste montre tous les produits actifs par ordre alphabétique, avec le stock au format « 53 (2 packs + 5) ». Un produit est en rouge si son stock est inférieur ou égal au seuil (il figure alors dans À racheter) ou négatif. Un champ de recherche est placé en haut.
- Le filtre « Archivés » affiche les produits archivés, que l'on peut réactiver.
- La fiche produit contient : nom, pack Metro, seuil, stock idéal, codes associés avec leurs unités, et les 20 derniers mouvements.
- Depuis la fiche, on peut :
  - modifier les champs ;
  - ajouter, modifier ou retirer un code ;
  - « Corriger le stock », c'est-à-dire faire l'inventaire de ce seul produit ;
  - archiver le produit. Il n'y a pas de suppression définitive : l'archivage la remplace et préserve l'historique.
- Le bouton « Nouveau produit » crée une fiche sans scan, pour un produit dont le code est illisible.

### 4.5 Historique

- L'historique montre tous les mouvements, du plus récent au plus ancien, par pages de 50 (« Voir plus »).
- Chaque ligne donne la date et l'heure (heure de Paris), le prénom, le type, le produit et la quantité. Exemples :
  - « lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl » ;
  - « Inventaire : 53 comptés (−3) ».
- Toute ligne active peut être annulée, après confirmation. Une ligne annulée reste visible, barrée, avec la mention « annulé par [prénom] ».

### 4.6 Réglages

- **Changer de prénom.**
- **Changer le mot de passe du tabac.** Tous les téléphones sont déconnectés, celui-ci compris, et chacun retape le nouveau mot de passe.
- **Se déconnecter.**

## 5. Règles de gestion

| Réf. | Règle |
|---|---|
| RG-1 | Le stock se compte **en unités** (canettes, bouteilles). Il s'affiche aussi en packs Metro : « 53 (2 packs + 5) ». Si le pack Metro vaut 1, ou si le stock est négatif, seules les unités sont affichées. |
| RG-2 | Chaque code-barres appartient à **un seul produit** et vaut de 1 à 999 unités. Un produit peut avoir plusieurs codes. |
| RG-3 | **Entrée** : stock + unités du code × quantité. **Sortie** : stock − unités du code × quantité. La quantité va de 1 à 99. |
| RG-4 | **Inventaire** : le stock prend la valeur comptée (de 0 à 9 999). L'écart (compté − stock connu) est enregistré comme un mouvement de type inventaire. |
| RG-5 | Un produit apparaît dans **À racheter** quand son stock est inférieur ou égal au seuil. |
| RG-6 | Quantité à racheter = stock idéal − max(stock, 0), **arrondie au pack Metro supérieur**. Exemple : seuil 24, stock idéal 48, stock 10 → il manque 38 → 2 packs de 24. Un stock négatif compte pour 0, et la ligne porte la mention « stock à vérifier ». Si le pack Metro vaut 1, la quantité est donnée en unités. |
| RG-7 | **Valeurs autorisées** : pack Metro de 1 à 999 ; seuil de 0 à 9 999 ; stock idéal **strictement supérieur** au seuil. À la création, seuil = 1 pack Metro et stock idéal = 2 packs Metro. |
| RG-8 | Le stock **peut devenir négatif**, par exemple après une entrée oubliée. Rien n'est bloqué : le stock s'affiche en rouge avec le bouton « Corriger le stock ». |
| RG-9 | Le stock ne se saisit jamais directement. C'est **la somme des mouvements non annulés**, donc annuler un mouvement retire exactement son effet. |
| RG-10 | Modifier les unités d'un code ou le pack Metro **ne change pas les mouvements passés**. |
| RG-11 | Un produit archivé disparaît des listes (Stock, À racheter, choix d'un produit) mais reste visible avec le filtre « Archivés ». Ses mouvements restent dans l'historique. Scanner un de ses codes propose de le réactiver. |
| RG-12 | Déplacer un code vers un autre produit ne change pas les mouvements passés. |
| RG-13 | **Chaque code lu est normalisé avant toute recherche.** Un UPC-A (12 chiffres) devient son EAN-13, avec un 0 devant. Un GTIN à 14 chiffres qui commence par 0 (carton ITF-14 ou code long) est ramené à 13 chiffres. Un code long GS1 (Code 128) qui contient un identifiant produit (01) est ramené à ce GTIN : le code court et le code long d'une même étiquette désignent donc le même produit. Un code long sans identifiant produit (lot ou date seuls) est ignoré, avec le message « Ce code n'identifie pas un produit ». Un code EAN, UPC ou ITF dont la clé de contrôle est fausse est ignoré, car c'est une lecture parasite. |

## 6. Architecture technique

### 6.1 Vue d'ensemble

```
iPhone (Safari, app sur l'écran d'accueil)
+----------------------------------+
| ScanDrinks : app web React       |-- code inconnu --> Open Food Facts
| caméra + ZXing (WebAssembly)     |                    (nom du produit)
+----------------+-----------------+
                 | https, compte du tabac
                 v
Supabase, projet « scandrinks » (Paris)
  - Auth : compte unique du tabac
  - PostgreSQL : products, barcodes, movements
  - Fonctions : record_movement, record_inventory, cancel_movement,
    create_product, attach_barcode

Cloudflare Pages : héberge les fichiers de l'app,
déploiement automatique depuis GitHub
```

### 6.2 Application

- React + TypeScript, construite avec Vite.
- **App web installable (PWA)** :
  - un manifeste donne le nom, l'icône et l'affichage plein écran ;
  - un service worker garde l'app en cache pour qu'elle s'ouvre vite ;
  - une nouvelle version s'installe automatiquement à l'ouverture suivante.
- **Navigation en mémoire, sans changement d'adresse.** Une web app installée sur iOS peut redemander l'autorisation caméra à chaque changement d'URL. L'app reste donc sur une seule page, et le flux caméra n'est pas coupé entre deux scans.
- **Scan** avec la bibliothèque `barcode-detector`, qui implémente l'API standard BarcodeDetector à partir de ZXing-C++ compilé en WebAssembly :
  - elle utilise la détection native quand le navigateur la propose, et ZXing sinon (c'est le cas de Safari) ;
  - formats lus : EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, Code 128 ;
  - le fichier WebAssembly est servi avec l'app, sans dépendre d'un CDN tiers.
- Conventions de code (comme ScamScanner) : identifiants en anglais ; commentaires, documentation et interface en français.

### 6.3 Données (PostgreSQL, Supabase)

**`products`**

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid | clé |
| `name` | text | obligatoire, 1 à 80 caractères |
| `pack_size` | int | pack Metro, de 1 à 999 |
| `alert_threshold` | int | de 0 à 9 999 |
| `target_stock` | int | strictement supérieur à `alert_threshold` |
| `archived` | bool | `false` par défaut |
| `created_at`, `updated_at` | timestamptz | |

**`barcodes`**

| Colonne | Type | Règle |
|---|---|---|
| `code` | text | clé : un code appartient à un seul produit |
| `product_id` | uuid | renvoie à `products` |
| `units` | int | de 1 à 999 |
| `created_at` | timestamptz | |

**`movements`**

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid | clé, générée par le téléphone pour rendre chaque action unique (voir 7) |
| `product_id` | uuid | renvoie à `products` |
| `kind` | text | `in`, `out` ou `inventory` |
| `delta` | int | variation du stock en unités, positive ou négative |
| `barcode` | text | code scanné, s'il y a eu un scan |
| `counted` | int | quantité comptée, pour un inventaire |
| `employee` | text | prénom |
| `created_at` | timestamptz | |
| `cancelled_at` | timestamptz | vide tant que le mouvement est actif |
| `cancelled_by` | text | prénom de la personne qui annule |

**Vue `product_stock`** : pour chaque produit, le stock est la somme des `delta` des mouvements non annulés.

**Fonctions appelées par l'app.** Chacune s'exécute en une seule transaction et verrouille le produit concerné : deux scans simultanés ne peuvent pas fausser un calcul.

- `record_movement(id, code ou product_id, kind, quantity, employee)` : calcule delta = ± unités du code × quantité.
- `record_inventory(id, product_id, counted, employee)` : calcule l'écart par rapport au stock du moment.
- `cancel_movement(movement_id, employee)`.
- `create_product(name, pack_size, alert_threshold, target_stock, barcodes)` : crée la fiche et son ou ses codes en une seule fois. `barcodes` est une liste de paires (code, unités).
- `attach_barcode(code, product_id, units, move)` : associe un code à un produit, ou le déplace si `move` est vrai.

Les fonctions sont **idempotentes** : rejouée avec le même identifiant, une action ne crée pas de doublon.

### 6.4 Sécurité

- **Un compte unique pour le tabac** (Supabase Auth, e-mail + mot de passe). Le porteur du projet le crée dans le tableau de bord Supabase et choisit le mot de passe, qui n'est jamais communiqué à Claude.
- **Inscriptions désactivées** : personne ne peut créer de compte depuis l'app.
- **Row Level Security sur toutes les tables.** Seuls les comptes inscrits dans la table `allowed_users`, c'est-à-dire le compte du tabac, peuvent lire ou écrire. Sans connexion, tout est refusé, même avec le lien de l'app et la clé publique Supabase, qui est publique par conception.
- **Changement de mot de passe** depuis les Réglages : le mot de passe est mis à jour et toutes les sessions sont révoquées.
- **Données personnelles** : uniquement des prénoms. Pas de suivi d'audience, pas de publicité, pas d'outil de mesure.

### 6.5 Hébergement, comptes et coûts

| Élément | Service | Coût |
|---|---|---|
| Base de données et connexion | Supabase : nouveau projet `scandrinks` dans l'organisation « Webia » (offre gratuite, 2ᵉ projet actif sur les 2 autorisés), région Paris (eu-west-3) | 0 € |
| Fichiers de l'app | Cloudflare Pages, relié au dépôt GitHub, en https | 0 € |
| Noms des produits | API Open Food Facts | 0 € |
| Code source | GitHub, dépôt privé | 0 € |

Limites connues :

- L'offre gratuite de Supabase donne 500 Mo de base, ce qui suffit largement.
- Supabase **met le projet en pause après 7 jours sans utilisation**. Les données sont conservées, et on le relance à la main depuis le tableau de bord (procédure dans le guide).
- L'organisation « Webia » n'aura plus de place pour un 3ᵉ projet gratuit.

### 6.6 Open Food Facts

- L'app ne l'appelle que pour un code inconnu : `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,product_name_fr,brands,quantity`.
- L'appel part directement du navigateur : Open Food Facts l'autorise (CORS), vérifié le 19/10/2026.
- Le délai maximal est de 3 secondes. En cas d'échec ou de réponse vide, le nom reste à saisir.
- Le nom proposé reste modifiable, car les données sont parfois fausses : la Cristaline 1,5 L y est enregistrée sous le nom « isabelle ».

## 7. Gestion des erreurs

| Situation | Comportement |
|---|---|
| Coupure réseau au moment de valider | Message « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». » et bouton « Réessayer ». La saisie reste affichée. La réponse a pu se perdre alors que la base avait enregistré : grâce à l'identifiant unique de l'action, « Réessayer » ne crée jamais de doublon. |
| Double scan du même code | Le code n'est pas relu tant que sa fiche est affichée, ni pendant 2 secondes après la validation. |
| Saisie hors limites | Le champ est refusé avec un message clair (bornes de RG-3, RG-4 et RG-7). |
| Code déjà associé à un autre produit | L'app indique le produit concerné et laisse le choix : laisser le code ou le déplacer. |
| Caméra refusée | L'app explique comment la réactiver dans les réglages de l'iPhone. La saisie manuelle reste disponible. |
| Open Food Facts lent ou en panne | Au bout de 3 secondes, le nom reste vide et se saisit à la main. Jamais bloquant. |
| Session expirée ou mot de passe changé | Retour à l'écran de connexion, avec une explication. |
| Base injoignable (panne ou projet en pause) | Message « Base injoignable » avec un renvoi vers la procédure du guide. |
| Nouvelle version publiée | Installation automatique à l'ouverture suivante. |

## 8. Stratégie de test

- **Tests unitaires (Vitest) des règles de calcul**, lancés à chaque modification :
  - RG-1 : affichage en packs + unités ;
  - RG-3 et RG-4 : calcul des variations ;
  - RG-6 : arrondi et stock négatif ;
  - RG-7 : validations.
- **Tests de la base de données**, sur le projet Supabase, avant la mise en service :
  - les fonctions : entrée, sortie, inventaire, annulation, idempotence ;
  - les contraintes ;
  - la sécurité : refus sans connexion, refus pour un compte absent de `allowed_users`.
- **Contrôles à chaque étape** : TypeScript en mode strict et construction de la version de production.
- **Recette en boutique** avec le porteur du projet, à partir d'une liste à cocher :
  - scans de vrais packs Metro et création de 3 fiches ;
  - une sortie et un inventaire ;
  - la liste d'achat ;
  - deux iPhones qui scannent en même temps ;
  - une coupure réseau simulée (mode avion).

## 9. Organisation et jalons

### Qui fait quoi

**Le porteur du projet**, avec un guidage pas à pas :

1. Créer le dépôt privé `scandrinks` sur GitHub et y donner accès à Claude (jalon 0).
2. Créer un compte Cloudflare gratuit et le relier au dépôt (jalon 0).
3. Dans Supabase, créer le compte du tabac (e-mail + mot de passe) et désactiver les inscriptions (jalon 1).
4. Tester sur iPhone à chaque jalon, puis faire la recette en boutique (jalon 4).

**Claude** : le code, les tests, la base de données, la documentation et le guide d'une page. Claude demande l'accord du porteur du projet avant de créer le projet Supabase.

### Jalons

À chaque jalon, une vraie version est testée sur iPhone.

| Jalon | Contenu | Validation |
|---|---|---|
| 0. Test du scan | Une page unique : caméra, lecture du code et nom donné par Open Food Facts. | Scan de 5 à 10 vrais packs Metro dans la réserve, sur iPhone. **Décision : on continue, ou on passe au plan B (app native).** |
| 1. Le cœur | Projet Supabase, tables, sécurité (dont l'inscription du compte du tabac dans `allowed_users`), connexion, prénom, scan Entrée/Sortie, création de fiches, ajout de codes. | Scanner et créer des fiches sur iPhone. |
| 2. Le pilotage | Stock, fiche produit, À racheter, Inventaire. | Une liste d'achat cohérente après quelques scans. |
| 3. Le suivi | Historique, annulation, changement de mot de passe, finitions. | Annuler une erreur, changer le mot de passe. |
| 4. La mise en service | Installation sur les iPhones de l'équipe, inventaire du premier jour, guide d'une page. | Une semaine d'utilisation par l'équipe. |

Le rythme visé est d'une ou deux séances de travail par jalon. Le vrai délai dépend surtout des moments disponibles pour tester en boutique.

## 10. Risques et parades

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Le scan web est trop lent ou peu fiable sur iPhone | Moyenne | Fort | Le jalon 0 vient avant tout développement. Plan B : une app native Expo (compte Apple à 99 €/an), avec la même base de données. |
| iOS redemande l'autorisation caméra | Moyenne | Moyen | Page unique sans changement d'adresse et flux caméra conservé. Vérifié dès le jalon 1. |
| L'équipe oublie de scanner | Forte | Moyen | Inventaire rapide, stock négatif signalé, guide d'une page, historique pour retrouver les écarts. |
| Projet Supabase en pause (7 jours sans utilisation) | Faible | Moyen | Procédure de relance dans le guide. Les données sont conservées. |
| Le mot de passe partagé circule | Moyenne | Moyen | Changement de mot de passe en un geste, qui déconnecte tous les téléphones. |
| Données Open Food Facts fausses | Moyenne | Faible | Le nom reste toujours modifiable. |
| iOS efface les données locales d'un téléphone peu utilisé | Faible | Faible | Il suffit de se reconnecter : les données sont sur Supabase. |

## 11. Journal des décisions

| Date | Décision | Raison |
|---|---|---|
| 18/10/2026 | Les sorties de stock se font par scan (Entrée + Sortie), l'inventaire sert à corriger | Une alerte toujours à jour ; l'inventaire rattrape les oublis |
| 18/10/2026 | Un iPhone par employé, avec des données partagées en ligne | L'équipe est sur iPhone et le réseau est bon partout |
| 19/10/2026 | App web installable, plutôt qu'une app native ou un outil sans code | Pas de compte Apple, 0 €, mises à jour instantanées |
| 19/10/2026 | Liste « À racheter », sans notifications en V1 | Suffisant pour préparer Metro, et plus simple |
| 19/10/2026 | Tout le monde peut tout faire, avec un historique par prénom | Petite équipe, simplicité |
| 19/10/2026 | Pas de catégories | Moins de 30 références |
| 19/10/2026 | Stock en unités, arrondi au pack supérieur, stock négatif autorisé | Validé à la partie 2 |
| 19/10/2026 | Supabase (Paris) et Cloudflare Pages | Gratuits, compte Supabase déjà relié, usage professionnel autorisé |
| 19/10/2026 | Nom : ScanDrinks | Choix du porteur du projet |
| 19/10/2026 | **Jalon 0 : GO pour l'app web** | Test en boutique sur iPhone : unités et packs lus rapidement. Les codes des packs sont inconnus d'Open Food Facts, comme prévu, et la fiche se crée au premier scan |
| 19/10/2026 | Normalisation des codes (RG-13) | Étiquettes réelles : le pack Lipton porte deux codes (EAN-13 et code long GS1 avec DLUO et lot), le pack Red Bull a un code de lot à part |
| 19/10/2026 | Un plan d'implémentation par jalon | Chaque jalon est validé sur iPhone avant d'écrire le suivant |
| 19/10/2026 | Après une coupure : « enregistrement non confirmé », et non plus « rien n'a été enregistré » | Relecture du jalon 1 : la réponse peut se perdre alors que la base a enregistré. « Réessayer » ne crée pas de doublon |

## 12. Glossaire

- **Unité** : une canette ou une bouteille.
- **Pack Metro** : le lot acheté chez Metro, par exemple 24 canettes.
- **Code** : le numéro du code-barres (EAN). Un même produit peut en avoir plusieurs.
- **Mouvement** : une ligne de l'historique (entrée, sortie ou inventaire).
- **Seuil d'alerte** : le stock à partir duquel le produit passe dans À racheter.
- **Stock idéal** : le stock visé après les courses.
