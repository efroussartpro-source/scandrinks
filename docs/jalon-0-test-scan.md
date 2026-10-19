# Jalon 0 — Test du scan en boutique

**But :** vérifier que l'iPhone lit vite et bien les codes-barres des packs Metro avant de construire le reste de l'app.
**Durée :** environ 15 minutes.

## Matériel

- Ton iPhone chargé, dans la réserve, avec l'éclairage habituel.
- 5 à 10 packs différents, sous film plastique et en carton.
- 2 ou 3 canettes ou bouteilles seules.
- Des produits importés, s'il y en a.

## Étapes

1. **Ouvre le lien de l'app dans Safari.** Touche « Démarrer la caméra », puis autorise l'accès à la caméra.
2. **Scanne chaque pack.** Vise le code-barres du pack dans le cadre blanc, à 20-30 cm. Pour chacun, note deux choses :
   - si la lecture prend 3 secondes ou moins : le cadre s'entoure de vert et une ligne s'ajoute dans la liste ;
   - si les chiffres affichés sont bien ceux imprimés sous le code-barres du pack, et pas ceux d'une canette vue à travers le film.
3. **Refais l'essai avec quelques canettes ou bouteilles seules.**
4. **Teste l'app depuis l'écran d'accueil.**
   - Dans Safari, fais Partager → « Sur l'écran d'accueil ».
   - Ouvre ScanDrinks depuis l'icône, puis touche « Démarrer la caméra ». Note si l'autorisation caméra est redemandée.
   - Ferme l'app en la balayant vers le haut, rouvre-la, et note de nouveau.
5. **Envoie-moi le rapport.** Touche « Copier le rapport » et colle-le dans la conversation avec Claude. Ajoute tes remarques : ce qui a bien marché, ce qui a moins bien marché, les packs difficiles.

## Ce qu'on décide ensuite

| Résultat | Suite |
|---|---|
| Au moins 8 packs sur 10 lus en 3 secondes ou moins, sans manipulation compliquée, avec le bon code | **GO** : on construit l'app (jalons 1 à 3) |
| Moins bien | Je fais quelques réglages (image plus fine en 1920×1080, zone de lecture au centre), puis tu refais le test |
| Toujours insuffisant | **Plan B** : une app native, qui demande un compte Apple à 99 €/an. La base de données reste la même |

## En cas de souci

- **« L'accès à la caméra a été refusé »** : va dans Réglages › Apps › Safari › Caméra, choisis « Autoriser », puis recharge la page.
- **Rien ne se lit** : vérifie l'éclairage et éloigne un peu le téléphone. Les iPhone récents font mal la mise au point de trop près.
- **La caméra s'arrête quand tu changes d'app** : c'est normal. Touche de nouveau « Démarrer la caméra ».
