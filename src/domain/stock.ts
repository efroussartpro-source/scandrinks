/**
 * stock.ts — Affichage du stock et variation d'un mouvement (RG-1, RG-3).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §5)
 *
 * Le stock se compte en unités et s'affiche aussi en packs Metro :
 * « 53 (2 packs + 5) ». Le signe moins affiché est le signe typographique
 * U+2212, plus lisible que le tiret.
 */

export type ScanMode = 'in' | 'out'

export const QUANTITY_MIN = 1
export const QUANTITY_MAX = 99

const MINUS = '−'

export function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return QUANTITY_MIN
  return Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.trunc(q)))
}

export function movementDelta(mode: ScanMode, units: number, quantity: number): number {
  return (mode === 'in' ? 1 : -1) * units * quantity
}

// RG-1 : unités seules si le pack Metro vaut 1, si le stock est négatif ou s'il fait moins d'un pack.
export function formatStock(stock: number, packSize: number): string {
  if (stock < 0) return MINUS + String(-stock)
  const packs = packSize > 1 ? Math.floor(stock / packSize) : 0
  if (packs === 0) return String(stock)
  const rest = stock - packs * packSize
  const packLabel = packs === 1 ? '1 pack' : `${packs} packs`
  return rest === 0 ? `${stock} (${packLabel})` : `${stock} (${packLabel} + ${rest})`
}

export function formatDelta(delta: number): string {
  return delta < 0 ? MINUS + String(-delta) : '+' + String(delta)
}

// Ligne de la fiche de confirmation : « Pack de 24 × 3 → +72 », « À l'unité → −1 ».
export function describeConfirm(units: number, quantity: number, mode: ScanMode): string {
  const what = units === 1 ? "À l'unité" : `Pack de ${units}`
  const times = quantity > 1 ? ` × ${quantity}` : ''
  return `${what}${times} → ${formatDelta(movementDelta(mode, units, quantity))}`
}
