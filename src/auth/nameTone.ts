/**
 * nameTone.ts — L'initiale et la couleur d'un prénom, sur l'écran « Qui es-tu ? ».
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.7, « Qui es-tu ? »)
 *
 * La couleur vient du prénom lui-même : toujours la même pour un prénom,
 * parmi quatre teintes pâles (vert, orange, bleu, rouge). Le prénom est lu
 * sans les espaces autour et sous une seule forme d'accents (NFC) : « élodie »
 * tapé avec l'accent séparé de sa lettre garde son « É » et sa couleur.
 */

export type NameTone = 'green' | 'orange' | 'blue' | 'red'

const TONES: readonly NameTone[] = ['green', 'orange', 'blue', 'red']

function clean(name: string): string {
  return name.trim().normalize('NFC')
}

// La première lettre, en majuscule : « élodie » → « É » ; '' pour un prénom vide.
export function initialOf(name: string): string {
  const [first = ''] = Array.from(clean(name))
  return first.toLocaleUpperCase('fr-FR')
}

// La somme des codes des caractères, modulo 4 : vert, orange, bleu, rouge.
export function nameTone(name: string): NameTone {
  const sum = Array.from(clean(name)).reduce((total, char) => total + (char.codePointAt(0) ?? 0), 0)
  return TONES[sum % TONES.length]
}
