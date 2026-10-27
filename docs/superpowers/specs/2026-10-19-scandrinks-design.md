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

Depuis le jalon 5, le stock couvre toute la boutique (réserve, frigos et rayons) : les livraisons s'ajoutent par scan, et chaque soir l'équipe saisit dans l'onglet « Ventes » les ventes du jour, lues sur la caisse (§4.8).

### Critères de réussite

1. Pour un pack déjà connu, l'entrée se valide en **un geste après le scan**, deux s'il faut régler la quantité.
2. Une fiche produit créée au premier scan est **reconnue aux scans suivants**, et la quantité du pack s'ajoute toute seule.
3. La liste **À racheter** donne, pour chaque produit sous son seuil, **le nombre de packs Metro à prendre**.
4. **Tous les employés voient le même stock**, chacun sur son iPhone.
5. **0 € par mois**, sans compte Apple développeur ni App Store.

## 2. Utilisateurs et contexte d'usage

- Les employés du tabac, **chacun sur son propre iPhone** : 4 à 6 iPhone, sous **iOS 16.4 ou plus** (la version que vise la construction de l'app).
- **Moins de 30 références** de boissons.
- **Bon réseau** (wifi ou 4G) en boutique comme en réserve.
- **Pas de compte Apple développeur** : ScanDrinks est une app web installable, ouverte dans Safari puis ajoutée à l'écran d'accueil.
- **Tout le monde peut tout faire.** Le prénom enregistré sur chaque mouvement permet de savoir qui a fait quoi.
- Le stock suivi est **celui de toute la boutique** : réserve, frigos et rayons. Il monte avec les livraisons scannées et baisse avec les ventes saisies chaque soir (§4.8). Jusqu'au jalon 5, c'était celui de la réserve seule : un pack porté au frigo était scanné en sortie.

## 3. Périmètre

### Dans la version 1

- Scan de codes-barres avec trois modes : Entrée, Sortie, Inventaire.
- Fiche produit créée au premier scan, nom pré-rempli par Open Food Facts quand c'est possible.
- Plusieurs codes-barres par produit (canette = 1 unité, pack = N unités).
- Liste À racheter exprimée en packs Metro.
- Fin de journée : les ventes du jour, lues sur la caisse, saisies dans l'onglet « Ventes » (jalon 5).
- Liste du stock, fiche produit modifiable, archivage et suppression définitive (jalon 6).
- Inventaire (comptage) et correction du stock.
- Historique de tous les mouvements, avec annulation.
- Compte unique du tabac, prénom par téléphone, changement de mot de passe.
- Vidéo tuto et feuille A4 de la réserve.
- Une image par code-barres : celle d'Open Food Facts, recopiée, ou une photo prise par l'équipe.
- Apparence claire ou sombre, au choix de chaque téléphone.

### Hors version 1 (possible plus tard)

Notifications, lien automatique avec la caisse (lecture d'une capture d'écran ou accès direct à Bimedia), prix et budget Metro, import des factures Metro, partage de la liste par WhatsApp, mode hors ligne, plusieurs boutiques, suivi des dates limites (la DLUO figure dans le code long de certaines étiquettes de packs).

## 4. Parcours et écrans

L'app a cinq onglets en bas, chacun avec son icône : **Scanner**, **À racheter**, **Stock**, **Ventes** (la fin de journée, §4.8) et **Historique**. Une roue dentée, en haut de l'écran, ouvre les **Réglages**. L'aspect de chaque écran suit la charte visuelle (§6.7).

### 4.1 Première ouverture (une fois par téléphone)

1. Ouvrir le lien de l'app dans Safari, puis Partager → « Sur l'écran d'accueil ».
2. Ouvrir ScanDrinks depuis son icône.
3. Taper le mot de passe du tabac. L'adresse e-mail du compte est déjà remplie.
4. Choisir son prénom parmi ceux déjà utilisés, ou en taper un nouveau (1 à 30 caractères).

Le téléphone reste ensuite connecté.

### 4.2 Scanner (écran principal)

```
+--------------------------------+
| [logo] ScanDrinks    (Sam)  ⚙  |
| [ ENTRÉE + | SORTIE − | INV = ]|
| +----------------------------+ |
| |         [ caméra ]         | |
| +----------------------------+ |
| [image] Coca-Cola 33 cl   +24  |
|         Pack de 24             |
| Quantité         [−]  1  [+]   |
| [      VALIDER      ] Annuler  |
+--------------------------------+
| Scanner  À racheter  Stock  Ventes  Historique |
```

**Modes.** Trois modes, chacun avec sa couleur :

- **Entrée +** (vert) : retour de Metro ;
- **Sortie −** (orange) : casse, périmé ou boisson offerte, c'est-à-dire ce qui quitte la boutique sans passer par la caisse. Un pack porté au frigo reste dans la boutique : depuis le jalon 5, on ne le scanne plus ;
- **Inventaire =** (bleu) : comptage de ce qui reste.

Chaque téléphone garde le dernier mode choisi. La fiche de confirmation rappelle toujours le mode, en couleur et avec le signe (+24 ou −24).

**Code connu.** La fiche du produit s'affiche avec l'image du code scanné (§4.7), le nom, « Pack de 24 » et la quantité en très gros, dans la couleur du mode : « +24 ». Le bouton « Valider » prend lui aussi la couleur du mode. Le sélecteur de quantité (×1 à ×99) permet de compter plusieurs packs identiques en un seul scan. Après « Valider » :

- un message confirme l'action et donne le nouveau stock, avec un bouton « Annuler » pendant 5 secondes (ensuite, l'annulation se fait depuis l'Historique) ;
- la caméra est aussitôt prête pour le scan suivant.

**Code inconnu.** Deux choix :

1. **Nouveau produit.** Le formulaire contient :
   - **Nom** : pré-rempli si Open Food Facts connaît le code. Sinon, le bouton « Scanner une canette du pack » remplit le nom à partir de la canette et enregistre aussi le code de celle-ci (1 unité). Si la canette est inconnue elle aussi, son code est enregistré quand même et le nom se tape à la main.
   - **Ce code vaut** : N unités (obligatoire).
   - **Pack Metro** : le nombre d'unités du pack acheté d'habitude chez Metro. Pré-rempli avec N si N > 1, à saisir sinon.
   - **Seuil d'alerte** et **stock idéal** : pré-remplis à 1 et 2 packs Metro, modifiables. Ils suivent le pack Metro tant qu'on ne les a pas changés à la main.

   - **Image** (facultative, §4.7) : celle d'Open Food Facts si le code y est connu, sinon « Prendre la photo », prise par la caméra du Scanner.
   - **Photo de la canette** (facultative, jalon 6) : après « Scanner une canette du pack », la canette a son propre cadre, sous la ligne « Canette : … (1 unité) ». Il propose l'image d'Open Food Facts de la canette s'il la connaît, sinon « Prendre la photo », en visant la canette. Le premier cadre s'appelle alors « Photo du pack ». Une autre canette scannée efface la photo de la précédente, qui allait avec l'autre code.

   Une fois la fiche créée, l'app affiche la fiche de confirmation du mode en cours : « +24 » en Entrée, « −24 » en Sortie, la saisie du comptage en Inventaire.
2. **Ajouter ce code à un produit existant.** On choisit le produit dans la liste, puis on indique combien d'unités vaut ce code. Exemple : le code d'une canette seule, pour une fiche créée depuis le pack (1 unité). L'image du code se choisit comme pour un nouveau produit.

**Inventaire.** On scanne un produit, ou on le choisit dans la liste, puis on saisit ce qu'on compte en packs Metro + unités (« 2 packs + 5 » = 53). L'app affiche le stock qu'elle connaissait et l'écart. C'est aussi la **mise en place du premier jour** : un tour de la réserve, un scan par produit (avec création de la fiche si besoin), puis le comptage.

**Saisie manuelle.** Si un code est illisible ou absent, le bouton « Saisie manuelle » permet de choisir le produit dans la liste. La suite est la même fiche de confirmation.

**Produit archivé.** Si le code scanné appartient à un produit archivé, l'app propose de le réactiver.

### 4.3 À racheter

- La liste montre les produits dont le stock est inférieur ou égal au seuil (RG-5).
- Chaque ligne donne l'image du produit, le nom, le stock restant et **le nombre de packs à prendre**, mis en avant dans une pastille. Exemple : « Coca-Cola 33 cl — reste 10 — 2 packs de 24 ».
- Les produits en rupture (stock ≤ 0) viennent en premier, les autres suivent par ordre alphabétique.
- Un badge sur l'onglet indique le nombre de produits à racheter.
- Une ligne disparaît dès qu'une entrée fait repasser le stock au-dessus du seuil.

### 4.4 Stock et fiche produit

- La liste montre tous les produits actifs par ordre alphabétique : l'image du produit, le nom, son état ou ses packs (« 2 packs + 5 ») et le stock en gros à droite. Un produit est en rouge si son stock est inférieur ou égal au seuil (il figure alors dans À racheter) ou négatif. Un champ de recherche est placé en haut.
- Le filtre « Archivés » affiche les produits archivés, que l'on peut réactiver ou supprimer depuis leur fiche.
- La fiche produit contient, de haut en bas :
  - « Retour », puis l'image et le nom du produit ;
  - le stock en très gros, avec le pack Metro, le seuil et le stock idéal ;
  - deux boutons : « Corriger le stock » et « Modifier » ;
  - les codes, chacun avec son image, ses unités et la provenance de l'image ; « Modifier » et « Retirer » en liens sur la ligne ; « Ajouter un code » en fin de liste ;
  - les 20 derniers mouvements, le type en couleur ;
  - en bas : « Archiver le produit », en rouge (« Réactiver » pour un produit archivé), puis « Supprimer le produit », en rouge.
- Depuis la fiche, on peut :
  - modifier les champs ;
  - ajouter, modifier ou retirer un code, et changer son image en la touchant (appareil photo de l'iPhone) ;
  - « Corriger le stock », c'est-à-dire faire l'inventaire de ce seul produit ;
  - archiver le produit : il disparaît des listes, garde son historique et se réactive (RG-11) ;
  - le supprimer pour de bon (RG-15, jalon 6).
- Le bouton « Nouveau produit » crée une fiche sans scan, pour un produit dont le code est illisible.
- **Supprimer le produit** (jalon 6), depuis la fiche de tout produit, actif ou archivé :
  - un message de confirmation s'affiche dans la fenêtre de l'iPhone (« Annuler » / « OK ») : « Supprimer « Coca-Cola 33 cl » pour de bon ? Ses codes et tout son historique (entrées, sorties, ventes, inventaires) seront effacés. Impossible de revenir en arrière. » ;
  - « Annuler » ne change rien. Après « OK », la fiche se ferme, et la liste d'où elle avait été ouverte (Stock ou À racheter) affiche « Coca-Cola 33 cl a été supprimé. » ;
  - le produit disparaît partout (Stock, Archivés, À racheter, Ventes, choix d'un produit), avec ses codes et tous ses mouvements (Historique, « Déjà saisi » des Ventes). Ses codes redeviennent inconnus au scan ;
  - pour un produit qu'on arrête de vendre mais qui peut revenir, on l'archive plutôt : il garde son historique.

### 4.5 Historique

- L'historique montre tous les mouvements, du plus récent au plus ancien, par pages de 50 (« Voir plus »).
- Chaque ligne donne la date et l'heure (heure de Paris), le prénom, le type, le produit et la quantité. Exemples :
  - « lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl » ;
  - « Inventaire : 53 comptés (−3) » ;
  - « jeu. 19:42 — Sam — Vente −2 (ventes du 22/10) — Coca-Cola 50 cl », pour une fin de journée (§4.8).
- À l'écran, chaque ligne tient sur deux lignes : le produit et la quantité en couleur (orange pour une sortie ou une vente, vert pour une entrée, bleu pour un inventaire), puis le type, la date et le prénom.
- Toute ligne active peut être annulée, après confirmation, par le lien « Annuler » de la ligne. Une ligne annulée reste visible, barrée, avec la mention « annulé par [prénom] ».

### 4.6 Réglages

- **Changer de prénom**, avec le prénom du téléphone affiché.
- **Apparence** : « Automatique » (par défaut : comme l'iPhone), « Clair » ou « Sombre ». Le choix ne vaut que pour ce téléphone.
- **Tutoriel** : la vidéo tuto, lue sans quitter l'app (§9, « Mise en service »).
- **Changer le mot de passe du tabac.** Tous les téléphones sont déconnectés, celui-ci compris, et chacun retape le nouveau mot de passe.
- **Se déconnecter**, en rouge, à part.

### 4.7 Images des codes

- Chaque code-barres peut avoir une image : celle du pack pour le code du pack, celle de la canette pour le code de la canette. Elle est facultative.
- **Provenance :**
  - Open Food Facts, quand il connaît le code (souvent les canettes et les bouteilles) : l'image est proposée à la création, puis recopiée dans le stockage de ScanDrinks, avec la mention « Image : Open Food Facts » ;
  - sinon, une photo de l'équipe (souvent les packs Metro) : « Prendre la photo » à la création, par la caméra du Scanner, ou plus tard depuis la fiche, en touchant l'image d'un code, avec l'appareil photo de l'iPhone.
- **À la création depuis un pack**, la canette scannée pour le nom a son propre cadre, « Photo de la canette » (§4.2, jalon 6). Son image va au code de la canette, jamais à celui du pack.
- **Affichage :**
  - après un scan, sur la fiche de confirmation : l'image du code scanné ;
  - dans la fiche produit : l'image du produit en haut, et celle de chaque code ;
  - dans Stock et À racheter : l'image du produit.
- L'image du produit est celle du code dont les unités valent le pack Metro, sinon la première image disponible. Sans image, une icône grise la remplace.
- Les images montrent les produits, jamais les personnes.
- Les images d'un produit supprimé restent dans le stockage, sans servir (RG-15).

### 4.8 Fin de journée (onglet « Ventes », jalon 5)

Chaque soir, à la fermeture, une personne de l'équipe reporte dans l'app les ventes du jour, lues sur la caisse (Bimedia : écran « Lecture jour », famille des boissons). Le stock baisse d'autant.

- **L'onglet** s'appelle « Ventes » ; l'écran a pour titre « Fin de journée ».
- **Le jour** : aujourd'hui par défaut (heure de Paris). On peut choisir l'un des 6 jours d'avant, pour rattraper un soir oublié ; jamais un jour à venir.
- **Déjà saisi** : en haut, les produits déjà saisis pour ce jour, avec la quantité, le prénom et l'heure. Ils ne se saisissent pas une seconde fois. Pour corriger, on annule la vente dans l'Historique, puis on la saisit de nouveau.
- **À saisir** : tous les autres produits actifs, par ordre alphabétique, avec leur image et une case « vendus » vide, et un champ de recherche en haut. On tape le nombre d'unités vendues (canettes ou bouteilles), de 1 à 999 ; une case vide ou à 0 ne compte pas. Ce que l'app ne suit pas (café, café crème) n'y figure pas.
- **Le total du jour** s'affiche en bas (« 9 boissons ») : les unités déjà enregistrées pour ce jour plus celles en cours de saisie, à comparer avec la caisse, cafés retirés.
- **« Valider »** ouvre le récapitulatif (« Coca-Cola 50 cl : −1 », …). « Enregistrer » retire les ventes du stock ; « Revenir » ramène à la saisie, intacte.
- **Après l'enregistrement** : « Fin de journée enregistrée : 9 boissons. » Les produits passent dans « Déjà saisi ». Chaque produit vendu donne une ligne « Vente » dans l'Historique (§4.5) et dans sa fiche, annulable comme les autres.
- **Une boisson vendue absente de l'app** : on crée sa fiche (« Stock » › « Nouveau produit »), puis on la saisit.
- **Tout le monde** peut faire la fin de journée.

## 5. Règles de gestion

| Réf. | Règle |
|---|---|
| RG-1 | Le stock se compte **en unités** (canettes, bouteilles). Il s'affiche aussi en packs Metro : « 53 (2 packs + 5) ». Si le pack Metro vaut 1, ou si le stock est négatif, seules les unités sont affichées. |
| RG-2 | Chaque code-barres appartient à **un seul produit** et vaut de 1 à 999 unités. Un produit peut avoir plusieurs codes. |
| RG-3 | **Entrée** : stock + unités du code × quantité. **Sortie** : stock − unités du code × quantité. La quantité va de 1 à 99. Depuis le jalon 5, une sortie ne sert plus qu'à la casse, au périmé et aux boissons offertes (§4.2). |
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
| RG-14 | **Vente** (fin de journée) : stock − quantité vendue, en unités, de 1 à 999 par produit et par jour. Le jour est l'un des 7 derniers (aujourd'hui compris, heure de Paris), jamais à venir. Un produit a **au plus une vente active par jour** : une seconde saisie est refusée tant que la première n'est pas annulée. |
| RG-15 | **Suppression** (jalon 6) : après confirmation, le produit, ses codes et tous ses mouvements, annulés compris, sont effacés pour de bon, en une seule fois. Ses codes redeviennent inconnus ; les autres produits ne changent pas. Ses images restent dans le stockage, sans servir. On ne peut pas revenir en arrière : pour mettre un produit de côté en gardant son historique, on l'archive (RG-11). |

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
  - pas de service worker : sans mode hors ligne (hors version 1), il ne ferait qu'ajouter le risque de servir une ancienne version. Chaque ouverture charge la dernière version.
- **Navigation en mémoire, sans changement d'adresse.** Une web app installée sur iOS peut redemander l'autorisation caméra à chaque changement d'URL. L'app reste donc sur une seule page, et le flux caméra n'est pas coupé entre deux scans.
- **Scan** avec la bibliothèque `barcode-detector`, qui implémente l'API standard BarcodeDetector à partir de ZXing-C++ compilé en WebAssembly :
  - elle utilise la détection native quand le navigateur la propose, et ZXing sinon (c'est le cas de Safari) ;
  - formats lus : EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, Code 128 ;
  - le fichier WebAssembly est servi avec l'app, sans dépendre d'un CDN tiers.
- **Vidéo tuto au format HLS** : une liste `.m3u8` et de petits morceaux de vidéo, servis avec l'app.
  - Cloudflare Pages ne répond pas aux demandes partielles (en-tête `Range`, mesuré le 21/10/2026), dont un iPhone a besoin pour lire un fichier MP4. Une vidéo HLS n'en a pas besoin.
  - Lecteur natif de l'iPhone (`<video playsinline>`) ; rien n'est chargé avant le toucher de lecture.
- **Erreur d'affichage imprévue** : un filet de sécurité remplace l'écran par un message et « Recharger », au lieu d'une page blanche (§7).
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
| `photo_path` | text | chemin de l'image du code dans le stockage, vide sans image (§4.7) |
| `photo_source` | text | `off` (Open Food Facts) ou `equipe` (photo de l'équipe), vide sans image |
| `created_at` | timestamptz | |

**`movements`**

| Colonne | Type | Règle |
|---|---|---|
| `id` | uuid | clé, générée par le téléphone pour rendre chaque action unique (voir 7) |
| `product_id` | uuid | renvoie à `products` |
| `kind` | text | `in`, `out` ou `inventory` ; une vente est une sortie (`out`) qui porte un `sale_day` |
| `delta` | int | variation du stock en unités, positive ou négative |
| `barcode` | text | code scanné, s'il y a eu un scan |
| `counted` | int | quantité comptée, pour un inventaire |
| `employee` | text | prénom |
| `created_at` | timestamptz | |
| `cancelled_at` | timestamptz | vide tant que le mouvement est actif |
| `cancelled_by` | text | prénom de la personne qui annule |
| `sale_day` | date | jour des ventes, pour une vente (jalon 5) ; vide sinon. Un index unique interdit deux ventes actives d'un même produit le même jour. |

**Vue `product_stock`** : pour chaque produit, le stock est la somme des `delta` des mouvements non annulés. Elle donne aussi `photo_path`, l'image du produit (§4.7).

**Stockage des images** : Supabase Storage, compartiment privé `photos`, chemin `codes/<code>/<identifiant>.jpg`. Chaque image est un JPEG de 480 px de côté au plus, en qualité 0,8 (environ 30 à 60 Ko). Une nouvelle image a un nouveau nom ; l'ancienne reste dans le stockage, sans être affichée.

**Fonctions appelées par l'app.** Chacune s'exécute en une seule transaction et verrouille le produit concerné : deux scans simultanés ne peuvent pas fausser un calcul.

- `record_movement(id, code ou product_id, kind, quantity, employee)` : calcule delta = ± unités du code × quantité.
- `record_inventory(id, product_id, counted, employee)` : calcule l'écart par rapport au stock du moment.
- `cancel_movement(movement_id, employee)` : renvoie le stock, puis qui a annulé et quand. Une seconde annulation ne change rien et garde le premier auteur.
- `list_history(before_created_at, before_id, limit)` : l'historique, du plus récent au plus ancien, par pages (50 dans l'app), produits archivés compris. La page suivante part de la date et de l'identifiant du dernier mouvement affiché : un mouvement arrivé entre-temps ne décale rien. Depuis le jalon 5, chaque ligne donne aussi son `sale_day`.
- `record_sales(day, lines, employee)` (jalon 5) : enregistre la fin de journée d'un jour en une seule transaction, une vente par ligne (identifiant tiré par le téléphone, produit, quantité). Rejouée avec les mêmes identifiants, elle renvoie ce qui a déjà été enregistré ; si un produit a déjà une vente active ce jour-là sous un autre identifiant, rien n'est enregistré et elle nomme les produits concernés.
- `create_product(name, pack_size, alert_threshold, target_stock, barcodes, id)` : crée la fiche et son ou ses codes en une seule fois. `barcodes` est une liste de paires (code, unités), vide pour un produit créé sans scan. `id` est tiré par le téléphone : rejouée, ou envoyée deux fois en même temps, la création renvoie la fiche déjà créée.
- `update_product(id, name, pack_size, alert_threshold, target_stock)` : modifie la fiche, avec les mêmes règles qu'à la création.
- `set_product_archived(product_id, archived)` : archive ou réactive un produit.
- `attach_barcode(code, product_id, units, move)` : associe un code à un produit, ou le déplace si `move` est vrai.
- `detach_barcode(code)` : retire un code de son produit. Les mouvements passés gardent le code en texte.
- `lookup_barcode(code)` : le produit d'un code, ses unités et son image.
- `set_barcode_photo(code, path, source)` : relie au code une image déjà envoyée dans le stockage, et en note la provenance.
- `delete_product(product_id)` (jalon 6) : supprime le produit pour de bon (RG-15). Le produit est d'abord verrouillé, puis ses mouvements, ses codes et la fiche sont effacés, en une seule transaction. Un mouvement envoyé au même moment passe donc avant, et il est effacé avec le produit, ou bien il est refusé. Rejouée, ou envoyée par deux téléphones, elle renvoie le même résultat. L'effacement lui-même est fait par `private.erase_product`, en `security definer` dans le schéma non exposé, comme `private.is_allowed` : l'app n'a aucun droit d'effacer directement un produit ou un mouvement.

Les fonctions sont **idempotentes** : rejouée avec le même identifiant, une action ne crée pas de doublon.

### 6.4 Sécurité

- **Un compte unique pour le tabac** (Supabase Auth, e-mail + mot de passe). Le porteur du projet le crée dans le tableau de bord Supabase et choisit le mot de passe, qui n'est jamais communiqué à Claude.
- **Inscriptions désactivées** : personne ne peut créer de compte depuis l'app.
- **Row Level Security sur toutes les tables.** Seuls les comptes inscrits dans la table `allowed_users`, c'est-à-dire le compte du tabac, peuvent lire ou écrire. Sans connexion, tout est refusé, même avec le lien de l'app et la clé publique Supabase, qui est publique par conception.
- **Changement de mot de passe** depuis les Réglages : le mot de passe actuel est vérifié, le nouveau enregistré, puis toutes les sessions sont révoquées, celle du téléphone compris.
- **Session vérifiée à chaque appel** : la fonction d'accès (`is_allowed`) refuse un jeton dont la session est fermée. Un téléphone déconnecté par un changement de mot de passe est donc refusé tout de suite, sans attendre l'expiration de son jeton (jusqu'à une heure).
- **Images** : le compartiment `photos` est privé. Seuls les comptes de `allowed_users` y lisent et y ajoutent des images ; personne ne les modifie ni ne les supprime depuis l'app. L'app les affiche par des liens signés, valables une heure.
- **Suppression** (jalon 6) : un produit ne s'efface que par `delete_product`, en entier (RG-15). Le rôle de l'app n'a aucun droit de suppression sur les produits ni sur les mouvements ; il garde seulement celui de retirer un code. Une ligne d'historique ne s'efface donc jamais seule.
- **Données personnelles** : uniquement des prénoms. Pas de suivi d'audience, pas de publicité, pas d'outil de mesure.

### 6.5 Hébergement, comptes et coûts

| Élément | Service | Coût |
|---|---|---|
| Base de données et connexion | Supabase : projet `scandrinks` dans l'organisation « ScanDrinks » (offre gratuite), région Paris (eu-west-3) | 0 € |
| Fichiers de l'app | Cloudflare Pages, relié au dépôt GitHub, en https | 0 € |
| Noms des produits | API Open Food Facts | 0 € |
| Code source | GitHub, dépôt privé | 0 € |
| Images des codes | Supabase Storage, offre gratuite (1 Go) | 0 € |
| Vidéo tuto et sa page | Cloudflare Pages, avec l'app | 0 € |

Limites connues :

- L'offre gratuite de Supabase donne 500 Mo de base, ce qui suffit largement, et 1 Go de stockage : environ 20 000 images de 50 Ko.
- Supabase **met le projet en pause après 7 jours sans utilisation**. Les données sont conservées, et on le relance à la main depuis le tableau de bord (procédure dans le guide).
- Le projet a sa propre organisation, « ScanDrinks » : l'organisation « Webia » n'est pas touchée.
- Cloudflare Pages refuse les fichiers de plus de 25 Mo : la vidéo tuto, découpée en morceaux, reste bien en dessous.

### 6.6 Open Food Facts

- L'app ne l'appelle que pour un code inconnu : `GET https://world.openfoodfacts.org/api/v2/product/{code}.json?fields=product_name,product_name_fr,brands,quantity,image_front_url`.
- L'appel part directement du navigateur : Open Food Facts l'autorise (CORS), vérifié le 19/10/2026.
- **Image** : si `image_front_url` existe, l'app la propose ; à l'enregistrement, elle la télécharge (autorisé aussi, vérifié le 21/10/2026), la réduit et la recopie dans le stockage de ScanDrinks. Les images d'Open Food Facts sont sous licence libre (CC BY-SA) : la mention « Image : Open Food Facts » les accompagne dans la fiche.
- Le délai maximal est de 3 secondes. En cas d'échec ou de réponse vide, le nom reste à saisir.
- Le nom proposé reste modifiable, car les données sont parfois fausses : la Cristaline 1,5 L y est enregistrée sous le nom « isabelle ».

### 6.7 Charte visuelle (refonte du 21/10/2026)

Style « comme une app iPhone » : fond gris clair, cartes blanches, listes groupées, onglets avec icônes, et le vert ScanDrinks en accent. Maquettes de référence : https://claude.ai/artifact/K9LaQSBEFJ44is1kVoCb8a, page « Style A — tous les écrans ».

**Apparence.** Deux thèmes, jour et nuit, avec les mêmes écrans et les mêmes places. Le choix se fait dans Réglages › Apparence (§4.6) ; « Automatique » suit le réglage de l'iPhone.

**Couleurs.**

| Rôle | Jour | Nuit |
|---|---|---|
| Fond | `#F2F2F7` | `#000000` |
| Cartes et listes | `#FFFFFF` | `#1C1C1E` |
| Champs | `#F2F2F7` | `#2C2C2E` |
| Pistes (sélecteurs, recherche) | `#E3E3E8` | `#2C2C2E` |
| Séparateurs | `#E5E5EA` | `#38383A` |
| Texte | `#1C1C1E` | `#FFFFFF` |
| Texte secondaire | `#6C6C70` | `#98989F` |
| Vert (boutons pleins) | `#1F6F3F` | `#26804A` |
| Vert (textes, icônes) | `#1F6F3F` | `#4CD07D` |
| Vert pâle (boutons teintés, pastilles) | `#E7F1EB` | `#1E3326` |
| Orange Sortie (bouton plein / texte) | `#B45309` / `#A34A07` | `#A9520B` / `#FFA94D` |
| Bleu Inventaire (bouton plein / texte) | `#1D4ED8` / `#1D4ED8` | `#2F5FE0` / `#7FB2FF` |
| Rouge (textes) / rouge pâle (fonds) | `#C0392B` / `#FDECEA` | `#FF6961` / `#3A1D1B` |
| Pastille de l'onglet À racheter | `#D70015` | `#D70015` |
| Barre d'onglets | `#F9F9F9` | `#121214` |

**Contrastes.** Dans les deux thèmes, un texte atteint au moins 4,5:1 sur son fond, et un élément d'interface 3:1. Un test unitaire le vérifie sur les couleurs de la charte.

**Typographie.**
- La police du système : San Francisco sur iPhone.
- Grand titre en 32 px (800), titre de carte en 20 px (700).
- Texte en 17 px, texte secondaire en 15 px, note en 13 px, libellé d'onglet en 12 px (11 px sous 360 px de large, pour que les cinq onglets tiennent).
- Grands nombres en 34 à 40 px (800). Champs de saisie en 17 px.

**Formes.**
- Cartes et listes arrondies (14 à 18 px), boutons et champs aussi (12 à 14 px), pastilles rondes.
- Zones tactiles de 44 px au moins.

**Icônes.** Des icônes au trait, dessinées dans le code (SVG), reprises de la bibliothèque libre Lucide, sous licence ISC, mentionnée dans le code. Aucune dépendance.

**Composants.**
- **En-tête :** le logo, « ScanDrinks », le prénom dans une pastille, puis la roue dentée.
- **Barre d'onglets :** une icône et un nom par onglet ; l'onglet actif en vert ; la pastille rouge du nombre de produits à racheter.
- **Sélecteur de mode :** trois segments, dont l'actif est rempli de sa couleur (vert, orange, bleu).
- **Boutons :** principal (plein), teinté (fond pâle), lien (texte seul) et destructif (rouge). « Valider » prend la couleur du mode.
- **Cartes et listes groupées :** des séparateurs fins, et un chevron pour ouvrir une ligne.
- **Champs :** le libellé au-dessus, l'aide en petit dessous.
- **Messages :** une bande teintée avec une icône.
- **Images :** une vignette arrondie ; une icône grise quand il n'y a pas d'image.

**Mise en page.**
- Une seule colonne.
- « Retour » en haut des écrans secondaires.
- Les actions rares (archiver, se déconnecter) en bas, en rouge.
- La caméra du Scanner se réduit quand une fiche longue s'ouvre, pour laisser la place aux champs.

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
| Erreur d'affichage imprévue | « L'app a rencontré un problème. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks. », avec le bouton « Recharger ». |
| Vidéo tuto injoignable | « La vidéo ne se charge pas. Vérifie la connexion, puis réessaie. », sous le lecteur, avec « Réessayer » ; l'écran défile pour les montrer. |
| Image impossible à enregistrer (réseau) | La fiche ou le code est enregistré quand même, avec « Photo non enregistrée : réessaie depuis la fiche du produit. ». |
| Image d'Open Food Facts introuvable ou trop lente | Rien de bloquant : le cadre propose « Prendre la photo ». |
| Image impossible à afficher | Une icône grise la remplace. |
| Coupure réseau en enregistrant une fin de journée | Le même message et le même « Réessayer » qu'après un scan : chaque ligne a son identifiant, rien n'est compté deux fois. |
| Fin de journée déjà saisie ailleurs pour un produit (deux téléphones) | « Déjà saisi pour ce jour : [produits]. La liste est relue. » Rien n'est enregistré, et la liste se met à jour. |
| Coupure réseau en supprimant un produit | « Pas de connexion. Réessaie quand le réseau revient. » La fiche reste ouverte. Si la base avait déjà effacé, une nouvelle suppression aboutit sans rien faire de plus. |
| Produit supprimé sur un autre téléphone | Ce qui le vise encore (scan validé, comptage, code ajouté, annulation dans l'Historique) est refusé : « Enregistrement refusé : vérifie la saisie ou scanne de nouveau. » ; scanné de nouveau, son code est inconnu. Sa fiche, ouverte ailleurs, se ferme à la relecture suivante de la liste. Une fin de journée qui le contenait est refusée une fois (« Enregistrement refusé : vérifie le jour et les quantités. »), puis la liste est relue sans lui. |

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
- **Jalon 4** :
  - la remise à zéro, sur une base locale : tout est effacé sauf le compte du tabac ; relancée, elle ne change rien ; sur une base sans les objets de ScanDrinks, elle s'arrête sans rien toucher ;
  - la feuille A4 : le PDF tient sur une page A4, et son QR code, relu par ZXing, mène à la page de la vidéo ;
  - le script de la vidéo vérifie chaque écran avant le geste suivant : si l'app a changé, le tournage s'arrête au lieu de filmer un écran faux ;
  - le bouton « Tutoriel » et le filet de sécurité, dans les tests de bout en bout ;
  - la charte : les contrastes de ses couleurs, jour et nuit, par un test unitaire ; le choix de l'Apparence, gardé et appliqué, dans les tests de bout en bout ;
  - les images : la base (colonnes, fonction, droits du stockage) en tests SQL ; la copie depuis Open Food Facts, la photo, l'envoi, l'affichage et un envoi qui échoue, dans les tests de bout en bout, avec un stockage simulé.
- **Jalon 5** :
  - `record_sales`, en tests SQL : la baisse du stock, les bornes (quantité, jour), l'identifiant rejoué, une vente déjà active le même jour, l'annulation puis une nouvelle saisie, les droits ; et deux téléphones au même instant (deux sessions PostgreSQL simultanées, en local) ;
  - les règles pures, par des tests unitaires : les jours proposés (heure de Paris), la lecture des cases, le total, le libellé des ventes dans l'Historique ;
  - l'onglet « Ventes », dans les tests de bout en bout : saisie, récapitulatif, enregistrement, « Déjà saisi », coupure réseau puis « Réessayer », une saisie faite ailleurs entre-temps.
- **Jalon 6** :
  - `delete_product`, en tests SQL : les droits, l'identifiant vide, l'effacement du produit, de ses codes et de tous ses mouvements (annulés et ventes compris), les autres produits intacts, un code de nouveau libre, l'appel rejoué ; et une suppression en même temps qu'un scan, dans les deux ordres (deux sessions PostgreSQL simultanées, en local) ;
  - dans les tests de bout en bout : la confirmation refusée puis acceptée, le message de la liste, le produit absent de partout, un produit supprimé ailleurs pendant une fin de journée ; la photo de la canette (image d'Open Food Facts, photo de l'équipe, une autre canette scannée, un envoi qui échoue).
- **Recette en boutique** avec le porteur du projet, le jour J et pendant la semaine d'essai (§9, « Mise en service »), à partir d'une liste à cocher :
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
5. Le jour J : lancer la remise à zéro dans l'éditeur SQL de Supabase, installer l'app avec l'équipe et mener l'inventaire (jalon 4).

**Claude** : le code, les tests, la base de données, la documentation, la vidéo tuto, la feuille A4 de la réserve et le guide du jour J. Claude demande l'accord du porteur du projet avant de créer le projet Supabase.

### Jalons

À chaque jalon, une vraie version est testée sur iPhone.

| Jalon | Contenu | Validation |
|---|---|---|
| 0. Test du scan | Une page unique : caméra, lecture du code et nom donné par Open Food Facts. | Scan de 5 à 10 vrais packs Metro dans la réserve, sur iPhone. **Décision : on continue, ou on passe au plan B (app native).** |
| 1. Le cœur | Projet Supabase, tables, sécurité (dont l'inscription du compte du tabac dans `allowed_users`), connexion, prénom, scan Entrée/Sortie, création de fiches, ajout de codes. | Scanner et créer des fiches sur iPhone. |
| 2. Le pilotage | Stock, fiche produit, À racheter, Inventaire. | Une liste d'achat cohérente après quelques scans. |
| 3. Le suivi | Historique, annulation, changement de mot de passe, finitions. | Annuler une erreur, changer le mot de passe. |
| 4. La mise en service | Refonte visuelle (style iPhone, jour et nuit) et images des codes ; vidéo tuto (bouton « Tutoriel » et QR code), feuille A4 de la réserve, quatre corrections ; puis le jour J : remise à zéro, installation sur les iPhones de l'équipe, inventaire du premier jour. | Une semaine d'utilisation par l'équipe (détail ci-dessous). |
| 5. La fin de journée | Onglet « Ventes » : les ventes du jour, lues sur la caisse, saisies chaque soir ; le stock couvre toute la boutique ; feuille A4 et vidéo mises à jour. | Une semaine de fins de journée, puis le recomptage de 5 produits : les écarts s'expliquent. |
| 6. Suppression et photo de la canette | « Supprimer le produit », avec un message de confirmation ; la photo de la canette à la création depuis un pack. | Sur l'iPhone, dans la préversion : un produit d'essai créé avec un pack et une canette, leurs deux photos, puis sa suppression. |

Le rythme visé est d'une ou deux séances de travail par jalon. Le vrai délai dépend surtout des moments disponibles pour tester en boutique.

### Mise en service (jalon 4)

Le guide d'une page prévu devient deux supports : une **vidéo tuto** et une **feuille A4** affichée en réserve.

**La refonte visuelle et les images** (§4.7, §6.7) viennent en premier, à la demande du porteur du projet : la vidéo et la feuille montrent l'app finale.

**La vidéo tuto**

- Fabriquée par un script : un robot utilise la vraie app sur un iPhone simulé, avec une base simulée, des produits et des prénoms fictifs, et une fausse caméra qui montre les codes-barres. Un rond marque chaque toucher. Le même script la refait à l'identique quand l'app change.
- Environ 3 minutes, format vertical, sans le son : le titre du chapitre en haut, une phrase courte en bas qui dit quoi faire.
- Neuf chapitres :
  1. se connecter et choisir son prénom ;
  2. une livraison Metro : « Entrée + » ;
  3. un pack sorti de la réserve : « Sortie − » ;
  4. un produit inconnu : créer sa fiche, avec sa photo ;
  5. compter : « Inventaire » ;
  6. avant Metro : « À racheter » ;
  7. le stock et la fiche d'un produit ;
  8. corriger une erreur : « Historique » › « Annuler » ;
  9. la fin : installer l'app (renvoi à la feuille) et qui prévenir en cas de souci.
- Elle ne montre ni l'installation depuis Safari, impossible sur un iPhone simulé, ni un vrai pack. La feuille A4 explique l'installation.
- Trois accès :
  - le bouton « Tutoriel » des Réglages ;
  - la page https://scandrinks.pages.dev/tutoriel/, qu'ouvre le QR code de la feuille ;
  - le fichier MP4, remis au porteur du projet pour le groupe de l'équipe.

**L'écran « Tutoriel »** (Réglages)

- Le lecteur vidéo, avec une image d'attente, la mention « Environ 3 minutes, sans le son : tout est écrit. » et le bouton « Retour ». Comme pour tous les Réglages, la caméra du Scanner est arrêtée pendant ce temps.
- Rien n'est chargé avant le toucher de lecture. Sans réseau : « La vidéo ne se charge pas. Vérifie la connexion, puis réessaie. » et un bouton « Réessayer » (§7).

**La page de la vidéo** (`/tutoriel/`) : le même lecteur, et un lien « Ouvrir ScanDrinks ». Un navigateur qui ne lit pas le format HLS affiche « Ouvre cette page sur un iPhone pour voir la vidéo. ».

**La feuille A4 de la réserve** : un PDF d'une page, lisible en noir et blanc.

- En haut, le QR code de la vidéo.
- « Chaque fois que… » :
  - livraison Metro → « Entrée + » ;
  - je sors un pack → « Sortie − » ;
  - code inconnu → la fiche s'ouvre : photo du pack, nom, unités ;
  - je compte → « Inventaire » ;
  - avant Metro → « À racheter » ;
  - une erreur → « Historique » › « Annuler ».
- « Installer l'app sur un iPhone » : les étapes du §4.1, avec iOS 16.4 ou plus.
- « Si l'app affiche… » : les messages courants du §7, et quoi faire.
- En bas : « Un souci ? Préviens la personne qui gère ScanDrinks. »

**La remise à zéro**

- Avant l'inventaire du premier jour, la base repart vide : produits, codes et mouvements sont effacés. Le compte du tabac reste : ni `allowed_users` ni Supabase Auth ne sont touchés. Chaque fiche se recrée au premier scan, et l'Historique commence propre.
- Un script SQL, hors des migrations. Claude le prépare et le teste en local ; le porteur du projet le lance dans l'éditeur SQL de Supabase, le matin du jour J. Claude ne le lance jamais lui-même : c'est une action destructive.
- Il vérifie d'abord qu'il tourne bien sur le projet ScanDrinks, en y cherchant ses tables et ses fonctions. Sinon, il s'arrête sans rien toucher.
- Tout se fait en une seule transaction, et il affiche ce qu'il a effacé. Relancé, il ne change rien.
- Ensuite, Claude vérifie la base, en lecture seule.

**Le jour J** : un guide d'une page pour le porteur du projet, à cocher au fur et à mesure.

1. La veille : chaque iPhone est en iOS 16.4 ou plus (Réglages › Général › Informations), la feuille est imprimée et affichée, et l'équipe est prévenue d'apporter son iPhone chargé.
2. Le matin : la remise à zéro, en 5 minutes.
3. L'installation, en 15 minutes environ : chacun installe l'app depuis Safari avec la feuille ; le porteur du projet donne le mot de passe à voix haute ; chacun choisit son prénom. Les icônes installées depuis une préversion sont supprimées.
4. L'inventaire, boutique fermée ou avant l'ouverture. La réserve est partagée en zones, une par personne. Dans chaque zone : « Scanner » › « Inventaire », un scan par produit, la fiche créée si besoin (seuils pré-remplis, RG-7) avec la photo du pack, facultative (une dizaine de secondes par code), puis le comptage en packs et unités. Avec moins de 30 références et 4 à 6 personnes, compter une quinzaine de minutes. Deux règles :
   - **un produit = une seule personne**, même s'il est rangé à deux endroits : un second comptage remplacerait le premier au lieu de s'y ajouter (RG-4) ;
   - **pas d'entrée ni de sortie pendant l'inventaire**.
5. Les contrôles restants de la recette (§8) : l'écran allumé et la marge du bas dans l'app installée, avec la version d'iOS ; une coupure réseau simulée (mode avion) au moment de valider un recomptage, sans effet sur le stock.
6. Après : le porteur du projet ajuste dans « Stock » les seuils des produits qui partent vite ou lentement, puis relit « À racheter ».

**La semaine d'essai** (validation du jalon)

- L'équipe scanne chaque livraison et chaque pack sorti. Avant chaque passage chez Metro, le porteur du projet compare « À racheter » avec la réserve. Les soucis sont notés au fil de l'eau.
- En fin de semaine, 5 produits sont recomptés en « Inventaire » : l'app affiche l'écart avec son stock. Puis vient le bilan avec Claude.
- **Validé** si rien n'a bloqué et si « À racheter » était juste. Un écart au recomptage doit s'expliquer, par exemple par un scan oublié, retrouvé dans l'Historique.

**Corrigé avant le jour J** : ce qui gênerait pendant la semaine.

- Une erreur d'affichage imprévue laisse une page blanche : un message et « Recharger » à la place (§7).
- L'écran allumé, relâché par le système alors que la page est visible (en économie d'énergie par exemple), est redemandé (s7 du jalon 3).
- La fiche produit garde « Réessayer » après une lecture échouée, même après l'ouverture et la fermeture d'un panneau (s3).
- Un commentaire périmé (s8).

**Reporté**, car le changement de mot de passe est rare :

- les points s1, s2, s4, s5 et s6 du jalon 3 ;
- un message dédié sur les autres téléphones après un changement de mot de passe ;
- la protection contre les mots de passe divulgués, sans doute réservée à l'offre payante de Supabase ;
- les noms de l'historique des migrations.

**Déroulé**

1. La refonte visuelle et les images, puis un essai sur l'iPhone du porteur du projet, dans la préversion : le nouveau look, le mode nuit, les photos, et la lecture d'une vidéo HLS de 10 secondes, avant de fabriquer la vraie.
2. Le reste du jalon, puis la validation sur iPhone dans la préversion.
3. La fusion.
4. Le jour J, à la date choisie par le porteur du projet.
5. La semaine d'essai, puis le bilan.

### Bascule vers la fin de journée (jalon 5)

Décidée le 22/10/2026, jour J du jalon 4, à la demande du porteur du projet. Reportée d'un jour : le 22/10 au soir, la remise à zéro n'avait pas eu lieu (choix du porteur du projet).

- **Le 23/10/2026 au soir, boutique fermée** : la remise à zéro, puis tout de suite l'inventaire de toute la boutique (réserve, frigos et rayons), avec les deux règles de l'inventaire.
- **À partir du 24/10** : on scanne les livraisons (« Entrée + ») ; un pack porté au frigo ne se scanne plus ; « Sortie − » sert à la casse, au périmé et aux boissons offertes.
- **Chaque soir** : la fin de journée (§4.8). Tant que l'onglet n'est pas en service, on note les jours ; on les rattrape ensuite (7 jours au plus), avec l'historique jour par jour de la caisse. Le premier jour de ventes est le 24/10 : l'onglet ne propose pas les jours d'avant, que l'inventaire du 23/10 au soir compte déjà.
- **Les comptages** (« Inventaire = », « Corriger le stock ») se font boutique fermée : le soir après la fin de journée, ou le matin avant l'ouverture. En journée, les ventes du matin seraient retirées deux fois : par le comptage, puis par la fin de journée du soir.
- **Après l'inventaire** : relever les seuils et les stocks idéaux, qui comptent maintenant le frigo et les rayons.
- **La feuille A4 et la vidéo tuto** suivent : « Je sors un pack de la réserve » devient « En fin de journée », et le chapitre 3 de la vidéo montre la fin de journée.

### Mise en service (jalon 6)

Décidée le 27/10/2026, à la demande du porteur du projet.

1. **La base.** La migration du jalon 6 contient des effacements, dans le corps de `private.erase_product`. Le connecteur Supabase risque alors d'attendre une confirmation qui ne parvient pas au porteur du projet (leçon du 20/10). Le porteur du projet colle donc le fichier dans l'éditeur SQL de Supabase et le lance, guidé pas à pas. Claude vérifie ensuite, en lecture seule, que les deux fonctions et leurs droits sont identiques au fichier, puis inscrit la ligne d'historique de la migration (un ajout, comme le 20/10). L'app en ligne n'est pas touchée : elle n'appelle pas les nouvelles fonctions.
2. **La préversion**, sur l'iPhone du porteur du projet : un produit d'essai créé avec un pack et une canette, leurs deux photos, puis sa suppression. L'essai se nettoie ainsi tout seul.
3. **La publication**, sur son « go ».

La vidéo tuto et la feuille A4 ne changent pas : la photo de la canette est facultative, et la suppression est rare.

## 10. Risques et parades

| Risque | Probabilité | Impact | Parade |
|---|---|---|---|
| Le scan web est trop lent ou peu fiable sur iPhone | Moyenne | Fort | Le jalon 0 vient avant tout développement. Plan B : une app native Expo (compte Apple à 99 €/an), avec la même base de données. |
| iOS redemande l'autorisation caméra | Moyenne | Moyen | Page unique sans changement d'adresse et flux caméra conservé. Vérifié dès le jalon 1. |
| L'équipe oublie de scanner | Forte | Moyen | Inventaire rapide, stock négatif signalé, vidéo tuto et feuille A4 en réserve, historique pour retrouver les écarts. |
| Projet Supabase en pause (7 jours sans utilisation) | Faible | Moyen | Procédure de relance dans le guide. Les données sont conservées. |
| Le mot de passe partagé circule | Moyenne | Moyen | Changement de mot de passe en un geste, qui déconnecte tous les téléphones. |
| Données Open Food Facts fausses | Moyenne | Faible | Le nom reste toujours modifiable. |
| iOS efface les données locales d'un téléphone peu utilisé | Faible | Faible | Il suffit de se reconnecter : les données sont sur Supabase. |
| La vidéo tuto ne se lit pas sur iPhone depuis Cloudflare Pages | Faible | Moyen | Format HLS, qui se passe des demandes partielles ; essai sur iPhone avec une vidéo de 10 secondes avant de fabriquer la vraie. Repli : héberger la vidéo sur Supabase Storage, avec l'accord du porteur du projet. |
| Un iPhone de l'équipe a une version d'iOS trop ancienne | Faible | Moyen | Vérifié la veille du jour J ; mise à jour d'iOS, ou un autre iPhone pour cette personne. |
| Un produit compté deux fois à l'inventaire | Moyenne | Moyen | Un produit = une seule personne ; l'Historique montre les deux comptages, il suffit de recompter. |
| L'équipe ne prend pas les photos | Moyenne | Faible | Elles sont facultatives : une icône grise les remplace, et on peut les ajouter plus tard depuis la fiche. |
| L'appareil photo de l'iPhone coupe la caméra du Scanner | Moyenne | Faible | À la création, la photo vient de la caméra du Scanner, sans ouvrir l'appareil photo ; depuis la fiche, la caméra du Scanner est déjà arrêtée. |
| La remise à zéro lancée sur le mauvais projet | Faible | Fort | Le script vérifie d'abord les tables et les fonctions de ScanDrinks, et s'arrête sinon ; le guide dit de choisir le projet « scandrinks ». |
| Une fin de journée oubliée | Moyenne | Moyen | Rattrapage sur 7 jours avec l'historique de la caisse. En attendant, le stock est trop haut et « À racheter » peut manquer un produit : on rattrape avant d'aller chez Metro. |
| Une quantité mal recopiée de la caisse | Moyenne | Faible | Récapitulatif avant d'enregistrer, total à comparer avec la caisse ; annulation dans l'Historique, puis nouvelle saisie. |
| Une boisson quitte la boutique sans passer en caisse (offerte, cassée) | Moyenne | Faible | « Sortie − » ; le recomptage montre l'écart. |
| Un produit supprimé par erreur | Faible | Moyen | Le message de confirmation dit tout ce qui sera effacé ; « Archiver » reste pour mettre de côté. Sans retour possible : on recrée la fiche au scan suivant, puis on recompte en « Inventaire ». |

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
| 20/10/2026 | Projet Supabase dans sa propre organisation, « ScanDrinks » | Choix du porteur du projet ; l'organisation « Webia » reste à part |
| 20/10/2026 | Onglets Scanner, À racheter et Stock ; le Scanner s'ouvre au démarrage ; l'Historique arrive au jalon 3 | Le scan reste le geste principal ; les autres écrans sont à un doigt |
| 20/10/2026 | Les Réglages s'affichent par-dessus l'app ; une fiche en cours survit à un changement d'onglet (m9) | Ne jamais perdre un enregistrement en attente ni son « Réessayer » |
| 20/10/2026 | Listes relues à l'ouverture d'un onglet, au retour dans l'app et après chaque action, avec « Mis à jour à HH:MM » ; pas de mise à jour en direct | Moins de 30 produits : une relecture suffit, sans complexité en plus |
| 20/10/2026 | Date des mouvements : « lun. 14:32 » pendant 7 jours, puis « 13/10 10:05 », puis l'année si elle diffère ; heure de Paris | Lisible d'un coup d'œil dans la fiche |
| 20/10/2026 | Inventaire : un comptage égal au stock est enregistré (écart 0) ; les champs démarrent vides | Garder la trace du contrôle ; ne pas influencer le comptage |
| 20/10/2026 | En modification, le seuil et le stock idéal ne suivent plus le pack Metro | Ne pas écraser des valeurs déjà choisies |
| 20/10/2026 | Code ajouté depuis la fiche : tapé en chiffres, clé de contrôle vérifiée ; retirer un code supprime l'association, les mouvements gardent le code en texte | Éviter les fautes de frappe ; garder l'historique intact |
| 20/10/2026 | Chaque ligne d'« À racheter » ouvre la fiche du produit | Corriger le stock d'un produit à vérifier sans le chercher |
| 20/10/2026 | Une seule orthographe par prénom (la première enregistrée) dans le choix du prénom ; ordre alphabétique français partout (accents et casse ignorés) | Une liste propre, triée comme on l'attend |
| 20/10/2026 | Historique : pages de 50 avec un curseur (date, identifiant) ; le produit termine la ligne ; produits archivés compris | Un mouvement arrivé entre deux pages ne décale rien ; exemple du §4.5 |
| 20/10/2026 | Tout le monde peut annuler toute ligne active de l'Historique, après confirmation ; la ligne affiche le premier auteur de l'annulation ; la fiche produit reste en lecture | Petite équipe ; une seule façon d'annuler |
| 20/10/2026 | Changer le mot de passe demande l'actuel ; 8 caractères au moins ; tous les téléphones sont déconnectés tout de suite (session vérifiée par la base) ; les autres voient « Ta session a expiré : reconnecte-toi. » | Un téléphone laissé ouvert ne suffit pas ; l'effet doit être immédiat, pas au bout d'une heure |
| 20/10/2026 | Écran allumé seulement au Scanner, caméra en marche ; icône verte au code-barres blanc, sans texte, nom « ScanDrinks » | Le scan dure ; ailleurs, l'écran s'éteint comme d'habitude |
| 20/10/2026 | Pas de service worker (§6.2) ; « Recharger » si l'app ne peut pas démarrer | Pas de mode hors ligne en version 1 ; l'app installée n'a pas d'autre moyen de recharger |
| 20/10/2026 | Comptage vide : « Valider » reste grisé, sans message | Comportement du jalon 2 gardé |
| 20/10/2026 | Anciennes adresses de test fermées par une page qui renvoie vers l'app, plutôt que supprimées | Une icône installée depuis l'une d'elles montre comment réinstaller l'app |
| 21/10/2026 | Avant l'inventaire du premier jour, tout effacer sauf le compte du tabac ; script préparé et testé par Claude, lancé par le porteur du projet dans l'éditeur SQL | Historique propre ; une action destructive reste entre les mains du porteur du projet |
| 21/10/2026 | Le guide d'une page devient une vidéo tuto et une feuille A4 affichée en réserve | Choix du porteur du projet |
| 21/10/2026 | Vidéo fabriquée par un script, sur un iPhone simulé avec des produits fictifs ; film en continu plutôt que diaporama ; sous-titres, sans le son | Les gestes se voient ; refaite à l'identique quand l'app change |
| 21/10/2026 | Vidéo en ligne avec l'app : QR code sur la feuille, bouton « Tutoriel » dans les Réglages, fichier MP4 pour le groupe de l'équipe | Choix du porteur du projet |
| 21/10/2026 | Vidéo au format HLS | Cloudflare Pages ne répond pas aux demandes partielles (mesuré le 21/10/2026), dont un iPhone a besoin pour lire un MP4 |
| 21/10/2026 | Équipe de 4 à 6 iPhone, sous iOS 16.4 ou plus | Version que vise la construction de l'app (Vite 8) |
| 21/10/2026 | Inventaire du premier jour par zones ; un produit = une seule personne ; pas d'entrée ni de sortie pendant l'inventaire | Un second comptage remplace le premier (RG-4) |
| 21/10/2026 | Avant la semaine d'essai : page blanche remplacée par « Recharger », écran allumé redemandé (s7), « Réessayer » gardé sur la fiche (s3), commentaire périmé (s8) ; les autres points reportés attendent | Ce qui gênerait pendant la semaine ; le changement de mot de passe est rare |
| 21/10/2026 | Jalon 4 validé après une semaine d'usage : rien de bloquant, « À racheter » juste avant chaque passage chez Metro, écart expliqué au recomptage de 5 produits | Un critère vérifiable |
| 21/10/2026 | Refonte visuelle avant la vidéo : style « comme une app iPhone » (piste A sur trois), jour et nuit ; Réglages › Apparence, « Automatique » par défaut, choix par téléphone | Choix du porteur du projet, sur maquettes : l'app faisait brute, peu lisible, chargée et sans identité |
| 21/10/2026 | Refonte maison : couleurs, tailles et composants définis une fois ; icônes Lucide dans le code ; aucune dépendance | Le moins de risque ; les tests gardés |
| 21/10/2026 | « Valider » et la quantité en très gros prennent la couleur du mode | Un rappel de plus contre l'erreur de mode |
| 21/10/2026 | Fiche produit : deux boutons au lieu de sept ; Historique sur deux lignes, « Annuler » en lien | Des écrans moins chargés |
| 21/10/2026 | Une image par code, facultative : celle d'Open Food Facts, recopiée chez nous, ou une photo de l'équipe | Choix du porteur du projet ; les packs sont inconnus d'Open Food Facts |
| 21/10/2026 | La photo d'une création vient de la caméra du Scanner ; depuis la fiche, de l'appareil photo de l'iPhone | Ne pas couper la caméra du Scanner pendant une création |
| 21/10/2026 | Images dans un stockage privé, affichées par des liens signés d'une heure | Seul le compte du tabac voit les images |
| 22/10/2026 | Couleurs ajoutées à la charte (pastilles, boutons teintés des modes, barre d'onglets, vignette vide, tuiles des Réglages, viseur, ombres), contrastes vérifiés ; une ligne annulée en texte secondaire (`#6C6C70` de jour) | Le gris des maquettes (`#8E8E93`) n'atteint que 3,3:1 |
| 22/10/2026 | Apparence : « Automatique » suit l'iPhone par le CSS, « Clair » et « Sombre » sont posés sur la page ; la barre d'état suit le fond ; le choix reste sur le téléphone | Le mode automatique suit l'iPhone sans attendre l'app |
| 22/10/2026 | Scanner : modes au-dessus de la caméra ; caméra réduite pour une fiche longue ; consigne posée sur la caméra ; toute la fiche de confirmation prend la couleur du mode | Le mode reste en vue ; la fiche tient dans l'écran |
| 22/10/2026 | Textes nouveaux de la refonte (connexion, Apparence, À racheter, Stock, comptage, photos) ; les aides des champs restent celles de l'app ; VoiceOver lit toujours la phrase entière d'une ligne | Les aides validées au jalon 1 sont gardées ; la refonte n'enlève rien à VoiceOver |
| 22/10/2026 | Images : JPEG de 256 Kio au plus, nom contrôlé, jamais modifiées ni supprimées ; l'image d'un produit est celle du code du pack, sinon la plus ancienne ; liens signés demandés par lots, gardés 50 minutes ; la fiche est enregistrée avant l'envoi de la photo (15 s au plus) | Une photo ratée ne bloque jamais une création ; peu de demandes au stockage |
| 22/10/2026 | Seules les images de `images.openfoodfacts.org` sont recopiées ; la canette scannée pour le nom ne donne pas d'image à la création | N'aller chercher qu'à l'adresse attendue ; l'image de la canette n'est pas celle du pack, qui s'ajoute depuis la fiche |
| 22/10/2026 | Maquettes copiées dans le dépôt (`docs/maquettes/`) ; captures des écrans de jour et de nuit (`npm run screens`) | Le plan ne dépend pas du canevas en ligne ; chaque écran se compare aux maquettes |
| 22/10/2026 | QR code de la feuille écrit et relu par zxing-wasm | Déjà installé : aucune nouvelle dépendance |
| 22/10/2026 | Vidéo en HLS (segments fMP4 de 6 s), H.264 en 1080 × 1920 à 30 images/s, sans son, dans `/tutoriel/video/` ; le MP4 n'est pas versionné, il est remis au porteur du projet | Ce que l'iPhone lit sans demandes partielles ; un dépôt léger |
| 22/10/2026 | « Tutoriel » : une ligne des Réglages après l'Apparence, « Retour » vers les Réglages, un message si la vidéo ne se charge pas ; aucun lien de l'app vers la page `/tutoriel/` | Un seul chemin dans l'app ; la page sert au QR code |
| 22/10/2026 | Tournage : base simulée (catalogue « tutoriel »), lundi 26/10/2026 à 09:30, Sam et Léa ; l'erreur annulée est une ligne de Léa déjà présente ; fausse caméra, rond des touchers et alerte dessinée dans le tournage seulement | Données fictives ; l'app ne contient aucun trucage |
| 22/10/2026 | Filet de sécurité : le texte du §7, et « Recharger » relance la page ; l'écran allumé est redemandé une seule fois par activation ou par retour au premier plan (s7) | Pas de boucle de demandes si le système refuse |
| 22/10/2026 | « Base injoignable » reste tel quel dans l'app : la feuille et le guide du jour J disent quoi faire | C'est le renvoi vers la procédure du guide (§7) |
| 22/10/2026 | Vidéo injoignable : « Réessayer » sous le message, et l'écran défile jusqu'à eux, dans l'app comme sur la page `/tutoriel/` | Un lecteur en échec ne recharge plus rien de lui-même ; sous un grand lecteur, le message tombait hors de l'écran (relecture finale) |
| 22/10/2026 | Remise à zéro : deux gardes (les tables et les trois fonctions de ScanDrinks, puis au moins un compte autorisé), une seule transaction, une ligne de résultat ; le script se copie depuis GitHub | Ne jamais effacer un autre projet ; un résultat lisible d'un coup d'œil |
| 22/10/2026 | Les ventes du jour se saisissent à la main chaque soir, dans un onglet « Ventes » (fin de journée), d'après l'écran « Lecture jour » de la caisse Bimedia | Choix du porteur du projet : simple, gratuit, sans IA ; Bimedia n'a pas d'accès public (son serveur est sur le réseau de la boutique) et son écran ne se copie pas |
| 22/10/2026 | Le stock couvre toute la boutique ; un pack porté au frigo ne se scanne plus ; « Sortie − » sert à la casse, au périmé et aux boissons offertes | Les ventes de la caisse partent du frigo et des rayons : sinon, chaque boisson serait retirée deux fois |
| 22/10/2026 | Une vente est une sortie qui porte le jour des ventes (`sale_day`), au plus une active par produit et par jour ; saisie possible sur les 7 derniers jours | Migration par simples ajouts, sans toucher aux contraintes existantes ; l'app du jalon 4 la montre comme une sortie ; un soir oublié se rattrape sans double compte |
| 22/10/2026 | Bascule le 22/10/2026 au soir : inventaire de toute la boutique, boutique fermée | La caisse donne les ventes de toute la journée : compter en pleine journée retirerait deux fois les ventes du matin |
| 22/10/2026 | Libellé d'onglet en 11 px sous 360 px de large | Les cinq noms tiennent sur une ligne à 320 px (iPhone en affichage agrandi), sans texte coupé ; 12 px partout ailleurs |
| 22/10/2026 | Premier jour de ventes : le 23/10 (`VITE_FIRST_SALES_DAY`) ; l'onglet ne propose pas les jours d'avant | L'inventaire du 22/10 au soir compte déjà ces ventes : un rattrapage les retirerait deux fois (relecture finale) |
| 22/10/2026 | Les comptages se font boutique fermée, le soir après la fin de journée ou le matin avant l'ouverture | Les ventes ne quittent le stock qu'à la fin de journée : un comptage en journée retirerait deux fois celles du matin (relecture finale) |
| 22/10/2026 | Bascule reportée au 23/10 au soir (la remise à zéro, puis l'inventaire) ; premier jour de ventes : le 24/10 | La remise à zéro n'avait pas eu lieu le 22/10 ; choix du porteur du projet |
| 22/10/2026 | La saisie de l'onglet « Ventes » est gardée quand on change d'onglet ; au retour dans l'app, « Aujourd'hui » suit la date | Créer une boisson qui manque passe par « Stock » ; une app restée ouverte jusqu'au lendemain ne doit pas enregistrer sous la veille (relecture finale) |
| 27/10/2026 | Suppression définitive d'un produit, directement depuis sa fiche (actif ou archivé), après un message de confirmation : le produit, ses codes et tous ses mouvements ; « Archiver » reste | Choix du porteur du projet : « effacer pour de bon » plutôt qu'un simple changement de mot, et « directement » plutôt qu'« en deux temps » (archiver, puis supprimer depuis les Archivés). Remplace la règle d'origine « pas de suppression définitive » (§4.4) |
| 27/10/2026 | Une seule porte pour effacer : `delete_product`, qui appelle `private.erase_product` (`security definer`, schéma non exposé) : le produit verrouillé, puis ses mouvements, ses codes et la fiche effacés ; aucun droit de suppression directe sur les produits ni les mouvements ; les images restent dans le stockage | Une ligne d'historique ne s'efface jamais seule ; un mouvement envoyé au même moment passe avant ou il est refusé ; même règle que pour une image remplacée |
| 27/10/2026 | Migration du jalon 6 lancée par le porteur du projet dans l'éditeur SQL ; Claude vérifie ensuite en lecture seule et inscrit la ligne d'historique | Elle contient des effacements : le connecteur Supabase attend une confirmation qui ne parvient pas au porteur du projet (leçon du 20/10) |
| 27/10/2026 | Un enregistrement qui vise un produit supprimé entre-temps est « refusé », jamais « base injoignable » ; une fin de journée refusée relit la liste | Le message dit vrai ; la ligne disparue ne bloque pas la saisie suivante |
| 27/10/2026 | Photo de la canette à la création, quand on scanne une canette du pack ; le premier cadre devient « Photo du pack » ; l'image du produit reste celle du pack ; vidéo et feuille A4 inchangées | Demande du porteur du projet. Remplace la décision du 22/10 (« la canette scannée pour le nom ne donne pas d'image à la création ») : l'image de la canette va au code de la canette, jamais au pack. La photo est facultative : pas de nouveau tournage ni de nouvelle feuille à imprimer |

## 12. Glossaire

- **Unité** : une canette ou une bouteille.
- **Pack Metro** : le lot acheté chez Metro, par exemple 24 canettes.
- **Code** : le numéro du code-barres (EAN). Un même produit peut en avoir plusieurs.
- **Mouvement** : une ligne de l'historique (entrée, sortie ou inventaire).
- **Seuil d'alerte** : le stock à partir duquel le produit passe dans À racheter.
- **Stock idéal** : le stock visé après les courses.
- **HLS** : format vidéo d'Apple, découpé en petits morceaux, que l'iPhone lit directement.
- **Jour J** : le jour de la mise en service : remise à zéro, installation sur les iPhones et inventaire du premier jour.
- **Image d'un code** : la photo du pack ou de la canette qui porte ce code-barres.
- **Apparence** : le thème de l'app, jour (clair) ou nuit (sombre).
- **Fin de journée** : la saisie, chaque soir, des ventes du jour lues sur la caisse (onglet « Ventes »).
- **Vente** : le mouvement d'une fin de journée, une sortie datée du jour des ventes.
- **Archiver** : mettre un produit de côté. Il disparaît des listes, garde son historique et se réactive.
- **Supprimer** : effacer un produit pour de bon, avec ses codes et tout son historique (jalon 6).
