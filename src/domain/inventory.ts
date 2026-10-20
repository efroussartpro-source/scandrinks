/**
 * inventory.ts — Saisie d'un comptage d'inventaire et écart (RG-4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §5)
 *
 * On compte en packs Metro + unités (« 2 packs + 5 » = 53). Un champ vide
 * vaut 0, mais il faut au moins un nombre. La valeur comptée va de 0 à
 * 9 999 unités. L'écart (compté − stock connu) devient un mouvement
 * d'inventaire.
 */
import { formatDelta } from './stock'

export const COUNT_MAX = 9999

export type CountInput = { ok: true; counted: number } | { ok: false; error: string }

const DIGITS = /^\d+$/

export function parseCount(packsText: string, unitsText: string, packSize: number): CountInput {
  // Avec un pack Metro de 1, seul le champ des unités est affiché.
  const packs = packSize > 1 ? packsText.trim() : ''
  const units = unitsText.trim()
  if (packs === '' && units === '') return { ok: false, error: 'Saisis ce que tu as compté.' }
  if ((packs !== '' && !DIGITS.test(packs)) || (units !== '' && !DIGITS.test(units))) {
    return { ok: false, error: 'Chiffres uniquement.' }
  }
  const counted = Number(packs || 0) * packSize + Number(units || 0)
  if (counted > COUNT_MAX) return { ok: false, error: 'Entre 0 et 9 999 unités.' }
  return { ok: true, counted }
}

export function formatGap(gap: number): string {
  return gap === 0 ? '0' : formatDelta(gap)
}

// « Inventaire : 53 comptés (−3) » ; « compté » au singulier pour 0 et 1.
export function describeInventory(counted: number, delta: number): string {
  return `Inventaire : ${counted} ${counted > 1 ? 'comptés' : 'compté'} (${formatGap(delta)})`
}
