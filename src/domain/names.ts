/**
 * names.ts — Tri des noms de produits dans l'ordre alphabétique français.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3, §4.4)
 *
 * Accents et casse ignorés (« Évian » se range entre « Coca » et « Lipton »),
 * nombres dans l'ordre (« Pack 9 » avant « Pack 10 »).
 */

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareNames(a.name, b.name))
}
