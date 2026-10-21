/**
 * stock.ts — Affichage du stock et variation d'un mouvement (RG-1, RG-3).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §5)
 *
 * Le stock se compte en unités et s'affiche aussi en packs Metro :
 * « 53 (2 packs + 5) ». Le signe moins affiché est le signe typographique
 * U+2212, plus lisible que le tiret.
 */

export type ScanMode = 'in' | 'out' | 'inventory'

// Mode d'une entrée ou d'une sortie ; l'inventaire a sa propre saisie (inventory.ts).
export type MoveMode = Exclude<ScanMode, 'inventory'>

export const QUANTITY_MIN = 1
export const QUANTITY_MAX = 99

const MINUS = '−'

export function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return QUANTITY_MIN
  return Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.trunc(q)))
}

export function movementDelta(mode: MoveMode, units: number, quantity: number): number {
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

// Fiche de confirmation : ce qui est compté (« Pack de 24 × 3 », « À l'unité »), sous le nom,
// et la variation (« +72 », « −1 »), en grand dans la couleur du mode.
export function confirmParts(units: number, quantity: number, mode: MoveMode): { what: string; delta: string } {
  const what = units === 1 ? "À l'unité" : `Pack de ${units}`
  const times = quantity > 1 ? ` × ${quantity}` : ''
  return { what: `${what}${times}`, delta: formatDelta(movementDelta(mode, units, quantity)) }
}
