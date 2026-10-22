# Jalon 4 — Le jour J

**Pour qui :** toi, le porteur du projet. Coche chaque case au fur et à mesure.
**Le programme :** la remise à zéro de la base (5 minutes), l'installation de l'app sur les iPhones de l'équipe (15 minutes environ), puis l'inventaire de toute la boutique (réserve, frigos et rayons), le soir à la fermeture.

> **Changement du 22/10/2026 (jalon 5, la fin de journée).** Le stock couvre maintenant toute la boutique : les livraisons s'ajoutent par scan, et chaque soir l'équipe saisit les ventes du jour dans l'onglet « Ventes ». L'inventaire du premier jour se fait donc le soir, à la fermeture, et compte aussi les frigos et les rayons. Rien n'est scanné entre la remise à zéro et cet inventaire.
**Ce qu'il te faut :** ton ordinateur ou ton iPhone, pour le tableau de bord Supabase et GitHub ; le mot de passe du tabac ; la feuille A4 de la réserve.

## La veille

- [ ] Chaque iPhone de l'équipe est en iOS 16.4 ou plus : Réglages › Général › Informations. Sinon, mets iOS à jour (Réglages › Général › Mise à jour logicielle), ou prévois un autre iPhone pour cette personne.
- [ ] La feuille A4 est imprimée et affichée dans la réserve.
- [ ] L'équipe est prévenue : chacun vient avec son iPhone chargé.
- [ ] La boutique est partagée en zones, une par personne : la réserve, les frigos, les rayons. Note qui prend quelle zone.
- [ ] Tu as ouvert l'app une fois (https://scandrinks.pages.dev) : elle s'affiche normalement. Si elle dit « Base injoignable », la base est en pause : voir « Si la base est en pause », en bas.

## Le matin : la remise à zéro (5 minutes)

> Elle efface les produits, les codes et les mouvements : les essais des tests disparaissent, et l'Historique commence propre. Le compte du tabac reste, avec son mot de passe. C'est toi qui la lances : je ne la lance jamais moi-même.

1. [ ] Ouvre le tableau de bord Supabase (https://supabase.com/dashboard). Choisis l'organisation « ScanDrinks », puis le projet « scandrinks ». **Jamais « Webia ».**
2. [ ] Dans le menu de gauche, ouvre « SQL Editor », puis une nouvelle requête vide (le bouton « + »).
3. [ ] Dans un autre onglet, ouvre le script sur GitHub : https://github.com/efroussartpro-source/scandrinks/blob/main/supabase/remise-a-zero.sql. Touche le bouton « Copy raw file » (l'icône de copie, au-dessus du texte du fichier), puis colle tout dans la requête vide.
4. [ ] Touche « Run ». Supabase prévient, en anglais, que la requête contient une opération destructive : c'est normal, confirme (« Run this query »).
5. [ ] Le résultat, sous la requête, tient en une ligne : « Remise à zéro faite : … produit(s), … code(s) et … mouvement(s) effacés. Compte du tabac gardé (1). ».
6. [ ] Préviens-moi : je vérifie la base, en lecture seule.

Si Supabase affiche une erreur à la place de cette ligne (en rouge, par exemple « ERROR: P0001: Arrêt : … ») :
- elle contient « Arrêt : ce projet n'est pas ScanDrinks. » : rien n'a été effacé. Tu n'es pas dans le bon projet : choisis « scandrinks », puis relance ;
- elle contient un autre « Arrêt : » : rien n'a été effacé. Ne relance pas, et préviens-moi ;
- toute autre erreur : ne relance pas, et préviens-moi. Je regarde la base, en lecture seule.

Relancer le script une seconde fois ne change rien : il n'y a plus rien à effacer.

## L'installation (15 minutes environ)

Chacun suit la feuille, section « Installer l'app sur un iPhone ».

- [ ] Ceux qui ont encore une icône ScanDrinks installée depuis une préversion (une adresse en « jalon-… ») la suppriment : appui long sur l'icône, puis supprimer.
- [ ] Dans Safari, chacun ouvre scandrinks.pages.dev, puis touche Partager › « Sur l'écran d'accueil » › « Ajouter ».
- [ ] Chacun ouvre ScanDrinks depuis son icône. Tu donnes le mot de passe du tabac **à voix haute** : personne ne l'écrit, ni sur papier ni dans un message.
- [ ] Chacun choisit son prénom (ou le tape, la première fois), puis autorise la caméra.

## L'inventaire

Le soir, boutique fermée. Chacun dans sa zone (réserve, frigos ou rayons), pour chaque produit :

- [ ] « Scanner » › « Inventaire = », un scan du pack, puis le comptage : les packs, et les unités en plus. « Valider ».
- [ ] Code inconnu : l'app affiche « Code inconnu ». Touche « Nouveau produit ». La photo du pack est facultative (une dizaine de secondes par code) ; « Scanner une canette du pack » donne le nom ; puis les unités du pack, et les seuils se remplissent seuls. « Créer le produit », puis le comptage.

Deux règles :
- [ ] **Un produit = une seule personne**, même s'il est rangé à deux endroits (en réserve et au frigo, par exemple) : cette personne additionne tout, car un second comptage remplacerait le premier au lieu de s'y ajouter. Si un produit a été compté deux fois, recompte-le en entier.
- [ ] **Pas d'entrée ni de sortie pendant l'inventaire.**

## Les contrôles de la recette (10 minutes)

Sur ton iPhone, dans l'app installée :

- [ ] **L'écran reste allumé.** Ouvre le Scanner, caméra en marche, et pose l'iPhone sans le toucher, plus longtemps que son verrouillage automatique (Réglages › Luminosité et affichage › Verrouillage automatique) : l'écran reste allumé. Note la version d'iOS (Réglages › Général › Informations).
- [ ] **La marge du bas.** « Stock » › « Nouveau produit », puis touche le champ « Stock idéal (unités) » : il reste visible au-dessus des onglets. Puis « Annuler ».
- [ ] **Une coupure pendant un recomptage.** Au Scanner, en « Inventaire = », scanne un produit déjà compté et saisis le même nombre. Active le mode avion (Wi-Fi coupé), puis « Valider » : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». ». Coupe le mode avion, puis « Réessayer ». Dans « Historique », une seule ligne pour ce comptage, avec « Inventaire (0) ».

## Après l'inventaire

- [ ] Relève les seuils : ils comptent maintenant les frigos et les rayons. Dans « Stock », fiche › « Modifier », puis ajuste le seuil d'alerte et le stock idéal, en commençant par les produits qui partent vite.
- [ ] Relis « À racheter » : la liste correspond à ce qui manque vraiment.

## La semaine d'essai

Les règles depuis le 23/10/2026 :
- [ ] Chaque livraison Metro est scannée en « Entrée + ».
- [ ] Un pack porté au frigo ne se scanne plus : il reste dans la boutique.
- [ ] « Sortie − » sert seulement à la casse, au périmé et aux boissons offertes.
- [ ] Chaque soir, à la fermeture, la fin de journée : onglet « Ventes », les boissons vendues lues sur la caisse (« Lecture jour »), puis « Valider » et « Enregistrer ». Un soir oublié se rattrape dans les 7 jours, en choisissant le jour.
- [ ] Avant chaque passage chez Metro, compare « À racheter » avec ce que tu vois en boutique.
- [ ] Tiens un carnet de bord : la date, l'iPhone, ce qui s'est passé, et une capture d'écran si possible.
- [ ] En fin de semaine, recompte 5 produits en « Inventaire = » et note les écarts affichés.
- [ ] Puis le bilan avec moi. Le jalon est validé si rien n'a bloqué et si « À racheter » était juste. Un écart au recomptage doit s'expliquer, par exemple par un scan oublié, retrouvé dans l'Historique.

## Si la base est en pause

Après 7 jours sans utilisation, Supabase met la base en pause : l'app affiche « Base injoignable ». Ouvre le tableau de bord Supabase › projet « scandrinks » › « Restore project ». Les données sont gardées ; la base revient en quelques minutes.

## En cas de souci

Le tableau « Si l'app affiche… » de la feuille dit quoi faire. Sinon, note-le dans le carnet de bord et préviens-moi.
