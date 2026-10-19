# Jalon 1 — Test sur iPhone

**But :** vérifier avec la vraie base les gestes de tous les jours :
- se connecter ;
- créer les fiches des packs en les scannant ;
- faire des entrées et des sorties.

**Durée :** environ 20 minutes, dans la réserve.
**Lien :** la préversion https://jalon-1.scandrinks.pages.dev, puis https://scandrinks.pages.dev après la fusion.

> Les données de ce test servent aux essais : la base sera remise à zéro avant l'inventaire du premier jour (jalon 4).

## Matériel

- Ton iPhone et, si possible, celui d'un collègue.
- Le mot de passe du tabac.
- Un pack Lipton (avec son code court et son code long), un pack Red Bull, un autre pack avec ses canettes, et une canette seule d'un pack.

## Étapes

1. **Vérifie la version d'iOS** : Réglages › Général › Informations › Version d'iOS. Il faut iOS 16 au minimum.
2. **Installe l'app.**
   - Ouvre le lien dans Safari.
   - Fais Partager → « Sur l'écran d'accueil ».
   - Ouvre ScanDrinks depuis l'icône.
3. **Connecte-toi** avec le mot de passe du tabac. Choisis ensuite ton prénom : « Nouveau prénom », puis « C'est moi ».
4. **Vérifie la caméra.**
   - Elle démarre seule ; autorise-la une fois.
   - Touche ⚙ (Réglages), puis « Retour » : la caméra doit repartir sans redemander l'autorisation.
5. **Crée les fiches de 3 à 5 vrais packs**, en mode « Entrée + ».
   - **Le Lipton, par son code court.**
     - Scanne-le : « Code inconnu » s'affiche. Touche « Nouveau produit ».
     - Vérifie le nom, puis indique dans « Ce code vaut » le nombre de bouteilles du pack.
     - Touche « Créer le produit ».
     - Scanne ensuite le **code long** du même pack : la même fiche doit s'ouvrir.
   - **Le Red Bull.**
     - Son petit code de lot doit afficher « Ce code n'identifie pas un produit ».
     - Le code du pack doit ouvrir la création de fiche.
   - **Un autre pack, avec sa canette.** Dans le formulaire, touche « Scanner une canette du pack » et vise une canette : elle est enregistrée avec la fiche.
6. **Scanne la canette seule d'un pack déjà créé**, mais sans sa canette.
   - Pour bien tester, crée d'abord la fiche d'un pack de Coca en tapant toi-même le nom « Coca 33 cl », sans scanner de canette.
   - Scanne ensuite une canette de Coca seule. Sur « Code inconnu », touche « Ajouter à un produit existant ».
   - « Coca 33 cl » doit être dans la liste. Si le nom donné par Open Food Facts ne correspond pas, la liste complète s'affiche avec un avertissement.
7. **Fais des entrées et des sorties.**
   - **Entrée de 2 packs :** sur la fiche, touche le chiffre de la quantité et tape 2 au clavier, puis touche « Valider ». Vérifie le stock affiché. Essaie aussi « + » et « − ».
   - **Sortie :** passe en « Sortie − ». La fiche devient orange, avec le signe moins. Fais une sortie de quelques unités.
   - **Annulation :** juste après une validation, touche « Annuler » sur le message.
8. **Essaie avec deux iPhone** : scannez le même produit l'un après l'autre. Le stock affiché doit suivre les deux mouvements.
9. **Essaie le mode avion.**
   - Sur une fiche, active le mode avion, puis touche « Valider ».
   - « Pas de connexion, rien n'a été enregistré. » doit s'afficher.
   - Désactive le mode avion, puis touche « Réessayer » : le stock ne doit augmenter qu'une fois.

## Ce qu'on décide ensuite

| Résultat | Suite |
|---|---|
| Tout fonctionne sans aide | **Jalon 1 validé** : je fusionne, puis je prépare le jalon 2 (stock, liste À racheter, inventaire). |
| Un point coince | Décris-moi ce qui s'est passé, une capture d'écran aide beaucoup. Je corrige, puis tu refais les points concernés. |

## En cas de souci

- **« Mot de passe incorrect. »** : vérifie les majuscules. L'adresse du compte est déjà remplie.
- **« L'accès à la caméra a été refusé »** : va dans Réglages › Apps › Safari › Caméra, choisis « Autoriser », puis ferme l'app et rouvre-la.
- **« Ta session a expiré : reconnecte-toi. »** : retape le mot de passe du tabac.
- **« Base injoignable »** : la base est peut-être en pause, après 7 jours sans utilisation. Préviens-moi.
