# Jalon 2 — Test sur iPhone

**But :** vérifier avec la vraie base le pilotage du stock :
- la liste « À racheter » et son badge ;
- l'inventaire ;
- la liste du stock et la fiche produit.

**Durée :** environ 20 minutes, dans la réserve.
**Lien :** la préversion https://jalon-2.scandrinks.pages.dev, puis https://scandrinks.pages.dev après la fusion.

> Les données de ce test servent aux essais : la base sera remise à zéro avant l'inventaire du premier jour (jalon 4).

## Matériel

- Ton iPhone et, si possible, celui d'un collègue.
- Le mot de passe du tabac.
- Deux ou trois packs déjà enregistrés au jalon 1 (le Lipton, le Red Bull…).
- Un article qui n'est pas suivi dans l'app, par exemple un paquet de chewing-gums : il sert à essayer « Ajouter un code ».

## Étapes

1. **Ouvre la préversion** dans Safari, sans l'installer : l'icône de l'écran d'accueil reste sur le jalon 1 jusqu'à la fusion.
   - Connecte-toi avec le mot de passe du tabac, puis choisis ton prénom.
   - En bas, trois onglets : « Scanner », « À racheter » et « Stock ». Le Scanner s'ouvre au démarrage.
2. **La liste « À racheter ».**
   - Un produit y entre quand son stock descend à son seuil d'alerte ou en dessous. Le badge rouge de l'onglet donne leur nombre.
   - Ouvre l'onglet. Une ligne par produit, par exemple « Lipton Pêche 50 cl — reste 4 — prendre 2 packs de 12 ». Les ruptures (stock à 0 ou moins) sont en tête, en rouge.
   - En bas de la liste : « Mis à jour à HH:MM ».
   - Au Scanner, en « Entrée + », fais une entrée qui remonte un de ces produits au-dessus de son seuil. Reviens sur « À racheter » : sa ligne a disparu et le badge a baissé.
3. **L'inventaire d'un pack.**
   - Au Scanner, touche « Inventaire = », puis scanne un pack.
   - La fiche montre « Stock connu : … ». Tape les packs entiers dans « Packs de … », puis les canettes en plus dans « Unités en plus ».
   - Avant « Valider », la ligne « = … — écart : … » donne le total et la différence avec le stock connu.
   - Essaie une saisie fausse, par exemple des lettres : un message refuse la saisie.
   - Touche « Valider » : le message donne le nouveau stock. Touche « Annuler » sur ce message : le stock d'avant revient.
   - Repasse en « Entrée + » pour la suite : l'app garde le dernier mode choisi.
4. **L'onglet « Stock ».**
   - Les produits sont rangés par ordre alphabétique, avec leur stock en packs, par exemple « 36 (3 packs) ». Ceux à racheter sont en rouge.
   - Tape quelques lettres dans « Rechercher un produit », sans accents ni majuscules : la liste se filtre.
5. **La fiche d'un produit** : touche une ligne de « Stock ».
   - **Modifier un seuil.**
     - Touche « Modifier ». Mets un « Seuil d'alerte » plus haut que le stock actuel, et un « Stock idéal » plus haut que ce seuil, puis touche « Enregistrer ».
     - Le produit passe en rouge et apparaît dans « À racheter ».
     - Remets ensuite les anciennes valeurs.
   - **Corriger le stock.**
     - Touche « Corriger le stock » et compte le produit en packs + unités. Vérifie l'écart, puis touche « Valider ».
     - La fiche affiche « Stock corrigé : … » et l'inventaire apparaît en tête des « Derniers mouvements ».
   - **Ajouter puis retirer un code.**
     - Touche « Ajouter un code », tape les chiffres d'un code en changeant le dernier, puis « Continuer » : « Code invalide : vérifie les chiffres. ».
     - Tape maintenant le bon code de l'article non suivi (les chiffres sous les barres), puis « Continuer ». Indique ce qu'il vaut (1), puis « Ajouter le code » : il apparaît dans « Codes ».
     - Touche « Retirer » sur ce code et confirme : il disparaît.
6. **Archiver un produit d'essai** (la fiche « Coca 33 cl » du jalon 1, par exemple).
   - Sur sa fiche, touche « Archiver » et confirme. Il disparaît de « Stock » et d'« À racheter ».
   - Touche « Archivés » : il y est.
   - Au Scanner, scanne un de ses codes : « Ce produit est archivé. Le réactiver pour l'utiliser ? ». Touche « Réactiver » : la fiche habituelle s'affiche et le produit revient dans « Actifs ».
7. **Un nouveau produit sans scan.**
   - Dans « Stock », touche « Nouveau produit ». Donne un nom, par exemple « Essai sans code », puis le pack Metro : le seuil et le stock idéal se remplissent seuls.
   - Touche « Créer le produit » : sa fiche s'ouvre, avec « Aucun code ».
   - Archive-le ensuite : c'était un essai.
8. **Deux iPhone.**
   - Sur le second iPhone, ouvre « À racheter ».
   - Sur le premier, fais une entrée sur un produit de cette liste.
   - Sur le second, touche un autre onglet puis reviens sur « À racheter », ou quitte Safari et reviens : la liste, le badge et « Mis à jour à » ont changé.
9. **Le mode avion.**
   - Au Scanner, sur une fiche, active le mode avion, puis touche « Valider » : « Pas de connexion : enregistrement non confirmé. Touche « Réessayer ». » s'affiche.
   - Va sur l'onglet « Stock », puis reviens sur « Scanner » : la fiche et son « Réessayer » sont toujours là.
   - Désactive le mode avion, puis touche « Réessayer » : le stock n'augmente qu'une fois.

## Ce qu'on décide ensuite

| Résultat | Suite |
|---|---|
| La liste d'achat est cohérente après quelques scans, sans aide | **Jalon 2 validé** : je fusionne, l'icône de l'écran d'accueil passe au jalon 2, puis je prépare le jalon 3 (historique, annulation, changement de mot de passe). |
| Un point coince | Décris-moi ce qui s'est passé, une capture d'écran aide beaucoup. Je corrige, puis tu refais les points concernés. |

## En cas de souci

- **« Mot de passe incorrect. »** : vérifie les majuscules. L'adresse du compte est déjà remplie.
- **« L'accès à la caméra a été refusé »** : va dans Réglages › Safari › Caméra (iOS 18 et plus : Réglages › Apps › Safari › Caméra) et choisis « Autoriser », puis recharge la page.
- **« Ta session a expiré : reconnecte-toi. »** : retape le mot de passe du tabac.
- **« Base injoignable »** : la base est peut-être en pause, après 7 jours sans utilisation. Préviens-moi.
