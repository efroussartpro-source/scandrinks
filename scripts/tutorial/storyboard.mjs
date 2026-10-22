/**
 * storyboard.mjs — Le déroulé de la vidéo tuto : la carte de titre, les neuf chapitres et leurs sous-titres, la carte de fin.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service », la vidéo tuto) ;
 * docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 5, le storyboard : textes exacts).
 *
 * record.mjs joue les chapitres dans cet ordre et note l'heure de chaque
 * titre et de chaque sous-titre ; le montage les écrit sur la vidéo ;
 * check.mjs vérifie que rien ne manque. La vidéo est sans le son : chaque
 * texte reste à l'écran le temps de le lire (readingTime).
 */

export const TITLE_CARD = ['ScanDrinks', 'Le tuto en 3 minutes', 'Sans le son : tout est écrit.']

export const END_CARD = [
  "Installer l'app sur un autre iPhone : la feuille de la réserve explique tout.",
  'Un souci ? Préviens la personne qui gère ScanDrinks.',
]

export const CHAPTERS = [
  {
    key: 'connexion',
    title: 'Se connecter',
    captions: {
      icone: "Ouvre ScanDrinks depuis son icône sur l'écran d'accueil.",
      motDePasse: 'Tape le mot de passe du tabac, puis « Se connecter ».',
      prenom: 'Choisis ton prénom, ou tape-le la première fois : il signe chacun de tes gestes.',
      scanner: "Le Scanner s'ouvre, caméra prête. Le téléphone reste connecté.",
    },
  },
  {
    key: 'entree',
    title: 'Une livraison Metro : Entrée +',
    captions: {
      mode: 'Retour de Metro : touche « Entrée + », en vert.',
      scan: "Vise le code-barres du pack : sa fiche s'affiche, avec +24.",
      quantite: 'Plusieurs packs identiques ? Règle la quantité avec + et −.',
      valider: 'Touche « Valider » : le message donne le nouveau stock.',
      eloigner: 'Éloigne le pack : sinon, sa fiche revient 2 secondes plus tard.',
    },
  },
  {
    key: 'sortie',
    title: 'Un pack vers le frigo : Sortie −',
    captions: {
      mode: 'Tu sors un pack de la réserve : touche « Sortie − », en orange.',
      scan: 'Scanne le pack, vérifie −24, puis « Valider ».',
      annuler: 'Une erreur juste après ? « Annuler » dans le message, pendant 5 secondes.',
    },
  },
  {
    key: 'nouveau',
    title: 'Un produit inconnu : créer sa fiche',
    captions: {
      inconnu: "Code inconnu ? L'app propose de créer sa fiche.",
      nouveau: 'Touche « Nouveau produit ».',
      photo: 'Vise le pack, puis « Prendre la photo » : elle aide à reconnaître le produit.',
      canette: 'Pour le nom, touche « Scanner une canette du pack » et vise une canette.',
      nom: "Le nom s'écrit tout seul. Sinon, tape-le.",
      unites: "Indique combien d'unités vaut le code du pack : ici 24.",
      seuils: 'Pack Metro, seuil et stock idéal se remplissent seuls ; tu pourras les changer.',
      creer: '« Créer le produit », puis « Valider » : le pack entre en stock.',
    },
  },
  {
    key: 'inventaire',
    title: 'Compter : Inventaire',
    captions: {
      mode: 'Pour compter, touche « Inventaire = », en bleu.',
      scan: "Scanne le produit : l'app montre le stock qu'elle connaît.",
      saisie: 'Tape ce que tu comptes : les packs, puis les unités en plus.',
      ecart: "L'écart s'affiche. « Valider » : le stock prend la valeur comptée.",
      regle: 'Le premier jour, on compte tout : un produit = une seule personne.',
    },
  },
  {
    key: 'racheter',
    title: 'Avant Metro : À racheter',
    captions: {
      ouvrir: 'Avant Metro, ouvre « À racheter » : le chiffre dit combien de produits manquent.',
      packs: 'Chaque ligne donne le nombre de packs à prendre.',
      disparait: "Une ligne disparaît dès que l'entrée du produit est scannée.",
    },
  },
  {
    key: 'stock',
    title: "Le stock et la fiche d'un produit",
    captions: {
      liste: '« Stock » : tous les produits. En rouge, ceux à racheter.',
      fiche: 'Touche un produit : sa fiche, ses codes et ses derniers mouvements.',
      actions: '« Corriger le stock » pour recompter, « Modifier » pour changer les seuils.',
    },
  },
  {
    key: 'historique',
    title: 'Corriger une erreur : Historique',
    captions: {
      liste: '« Historique » : tous les gestes, du plus récent au plus ancien.',
      erreur: 'Ici, une sortie de Red Bull scannée par erreur en « Entrée + ».',
      annuler: 'Touche « Annuler » sur la ligne, puis « OK ».',
      barree: 'La ligne est barrée, le stock recalculé. Refais ensuite le bon geste.',
    },
  },
  {
    key: 'reglages',
    title: 'Les Réglages et la suite',
    captions: {
      reglages: 'La roue dentée ouvre les Réglages : revoir ce tuto, changer de prénom, passer en mode sombre.',
    },
  },
]

// Temps de lecture d'un texte, en millisecondes : 65 ms par caractère, et 2,8 s au moins.
export function readingTime(text) {
  return Math.max(2800, 65 * text.length)
}
