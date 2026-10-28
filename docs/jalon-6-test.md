# Jalon 6 — Mise en place et test sur iPhone

**But :** mettre en place la suppression dans la base, puis vérifier sur iPhone la photo de la canette et la suppression d'un produit, avant la publication.

**Durée :** 5 minutes pour la partie A, 10 minutes pour la partie B.
**Liens :**
- le fichier de la partie A : https://github.com/efroussartpro-source/scandrinks/blob/jalon-6/supabase/migrations/20261027120000_suppression.sql ;
- la préversion de la partie B : https://jalon-6.scandrinks.pages.dev, dans Safari, **sans l'installer**. Après la publication, l'app habituelle : https://scandrinks.pages.dev.

> **La préversion utilise la vraie base**, comme l'app en service : ce que tu enregistres compte vraiment. Ici, le seul produit enregistré est celui de l'essai, et la partie B le supprime à la fin, avec tout ce qui le concerne.

## Matériel

- Pour la partie A : un ordinateur, connecté à GitHub et à Supabase.
- Pour la partie B : ton iPhone, le mot de passe du tabac, et **un pack avec une de ses canettes, d'une boisson qui n'est pas encore dans l'app** (une boisson de chez toi convient).

## A. La base (avant tout essai)

- [ ] **1. Le fichier.** Ouvre le lien du fichier ci-dessus (branche `jalon-6`). Touche « Raw », puis copie tout le texte.
- [ ] **2. Supabase.** Ouvre le projet **« scandrinks »**, jamais « Webia ». Puis « SQL Editor » › « New query ».
- [ ] **3. Le lancement.** Colle le texte, puis « Run ».
  - Si Supabase prévient, en anglais, que la requête contient une opération destructive : c'est normal, car le fichier crée la fonction qui efface un produit. Confirme (« Run this query »).
  - Attendu : « Success. No rows returned ».
  - Lancé une seconde fois par erreur, il répond « already exists » : rien n'a changé, ce n'est pas grave.
- [ ] **4. Préviens-moi.** Écris-moi « C'est lancé ». Je vérifie la base, en lecture seule, puis je te dis de passer à la partie B. N'envoie jamais de mot de passe ni de clé.

L'app en service n'est pas touchée : elle ne se sert pas encore de cette fonction.

## B. La préversion (après mon feu vert)

Ouvre la préversion dans Safari, connecte-toi, puis choisis ton prénom. Reste en « Entrée + ».

- [ ] **5. Le pack et sa photo.** Scanne le pack : « Code inconnu ». Touche « Nouveau produit », vise le pack, puis « Prendre la photo » : « Photo prise ».
- [ ] **6. La canette et sa photo.**
  - Touche « Scanner une canette du pack », puis vise une canette.
  - La ligne « Canette : … (1 unité) » apparaît. Le premier cadre dit maintenant « Elle sera gardée avec le code du pack. ».
  - Sous la ligne, un second cadre est apparu, pour la canette : soit « Image trouvée » (l'image d'Open Food Facts, déjà prête), soit « Photo de la canette » : vise alors la canette et touche « Prendre la photo ». Dans les deux cas, son texte finit par « … avec le code de la canette. ».
- [ ] **7. La création.** Indique combien d'unités vaut le code du pack, puis « Créer le produit ». La fiche de confirmation montre la photo du pack : touche « Valider ». Cette entrée d'essai sera effacée à l'étape 10, avec le produit.
- [ ] **8. La canette seule.** Éloigne le pack, puis scanne la canette seule : la fiche de confirmation montre la photo de la canette. Touche « Annuler », sans valider.
- [ ] **9. La suppression refusée.** « Stock » › le produit d'essai › tout en bas, « Supprimer le produit ».
  - Le message dit : « Supprimer « … » pour de bon ? Ses codes et tout son historique (entrées, sorties, ventes, inventaires) seront effacés. Impossible de revenir en arrière. »
  - Touche « Annuler » : la fiche est toujours là, rien n'a changé.
- [ ] **10. La suppression acceptée.** De nouveau « Supprimer le produit », puis « OK ».
  - La liste du Stock revient avec « … a été supprimé. ».
  - Le produit n'est plus dans le Stock, ni dans « Archivés ». Dans l'Historique, la ligne de l'entrée d'essai a disparu.
  - Dans « Scanner », le pack est de nouveau « Code inconnu » : touche « Annuler ».
- [ ] **11. Le mode sombre.** Réglages › « Apparence » › « Sombre » : la fiche produit et ses deux boutons rouges se lisent bien. Remets ensuite ton réglage habituel.
- [ ] **12. La base vide pour l'inventaire de ce soir.** Elle remplace la remise à zéro : personne n'utilise l'app avant l'inventaire, il n'y a donc rien à perdre.
  - Dans « Stock », supprime un par un les produits qui restent : les 3 produits d'essai du 20 au 22/10. Pour chacun : la fiche › « Supprimer le produit » › « OK ».
  - Regarde aussi « Archivés » : il doit être vide.
  - Le Stock affiche « Aucun produit pour l'instant. ». Écris-moi « Base vide » : je vérifie, en lecture seule, qu'il ne reste ni produit, ni code, ni mouvement, et que le compte du tabac est toujours là.
- [ ] **13. Le premier jour de ventes.** Touche « Ventes » : jusqu'au 28/10 compris, l'écran dit « La fin de journée commence le 29/10. ». C'est normal : l'inventaire de ce soir compte déjà les ventes d'avant.

## Si quelque chose cloche

- « Base injoignable » au moment de supprimer : la partie A n'est sans doute pas faite. Préviens-moi.
- « Pas de connexion. Réessaie quand le réseau revient. » : touche de nouveau « Supprimer le produit » quand le réseau revient. Le nouvel essai ne fait rien de plus que le premier.
- « Photo non enregistrée : réessaie depuis la fiche du produit. » : le produit est bien créé. La photo se reprend depuis sa fiche, en touchant l'image du code.

## Ce que tu me renvoies

« OK », ou ce qui ne va pas, avec le numéro de l'étape et une capture d'écran. Après ton « go », je publie la nouvelle version, avant l'inventaire de ce soir.

## Ce soir, boutique fermée : l'inventaire

Avec l'app habituelle (https://scandrinks.pages.dev), comme prévu dans `docs/jalon-4-jour-j.md` : « Scanner » › « Inventaire = », un scan par produit, la fiche créée si besoin, avec la photo du pack et celle de la canette, puis le comptage. Un produit = une seule personne, et ni entrée ni sortie pendant l'inventaire. Ensuite, relève les seuils et les stocks idéaux. La première fin de journée a lieu demain soir, le 29/10.
