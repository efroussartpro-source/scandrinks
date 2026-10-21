/**
 * fieldHelp.ts — Aides affichées sous les champs des fiches produit et du mot de passe.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §4.6, RG-5 à RG-7)
 *
 * Demandées par le porteur du projet après le test sur iPhone du jalon 1.
 */
export const FIELD_HELP = {
  name: "Le nom de la boisson, affiché partout dans l'app, par exemple « Coca-Cola 33 cl ».",
  unitCapture: "Facultatif : enregistre aussi le code d'une canette, pour la reconnaître quand elle est scannée seule.",
  barcode: 'Les chiffres sous les barres. Plus simple : scanne le code au Scanner, puis « Ajouter à un produit existant ».',
  codeUnits: 'Canettes ou bouteilles comptées à chaque scan de ce code : 24 pour un pack de 24, 1 pour une canette.',
  packSize: "Nombre d'unités du pack acheté chez Metro : le stock et les achats se comptent aussi en packs.",
  alertThreshold: 'Quand le stock descend à ce nombre ou en dessous, le produit passe dans « À racheter ».',
  countBoth: 'Packs entiers trouvés en réserve, puis les canettes ou bouteilles en plus.',
  countUnitsOnly: 'Canettes ou bouteilles trouvées en réserve.',
  targetStock: "Le stock visé après les courses : l'app calcule les packs à acheter pour l'atteindre.",
  passwordCurrent: "Celui que tu tapes aujourd'hui pour te connecter.",
  passwordNew: "Au moins 8 caractères. Note-le avant de valider : toute l'équipe en aura besoin.",
  passwordConfirm: 'Tape-le une seconde fois, pour éviter une faute de frappe.',
} as const
