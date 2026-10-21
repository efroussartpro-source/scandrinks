import { expect, test } from 'vitest'
import { clampQuantity, confirmParts, formatPacks, formatStock, formatUnits, movementDelta, type MoveMode } from './stock'

// Le signe moins est U+2212 (−), pas le tiret du clavier.
test.each([
  [53, 24, '53 (2 packs + 5)'], [48, 24, '48 (2 packs)'], [24, 24, '24 (1 pack)'], [30, 24, '30 (1 pack + 6)'],
  [5, 24, '5'], [0, 24, '0'], [-6, 24, '−6'], [53, 1, '53'],
])('formatStock(%i, %i) = %s', (stock, pack, text) => { expect(formatStock(stock, pack)).toBe(text) })
test('movementDelta', () => {
  expect(movementDelta('in', 24, 3)).toBe(72)
  expect(movementDelta('out', 1, 6)).toBe(-6)
})
test('clampQuantity borne entre 1 et 99, et tronque', () => {
  expect([clampQuantity(0), clampQuantity(5), clampQuantity(150), clampQuantity(Number.NaN), clampQuantity(2.7)]).toEqual([1, 5, 99, 1, 2])
})
// La fiche de confirmation : « Pack de 24 » sous le nom, « +24 » en grand dans la couleur du mode.
test.each([
  [24, 1, 'in', 'Pack de 24', '+24'], [24, 3, 'in', 'Pack de 24 × 3', '+72'], [1, 1, 'out', "À l'unité", '−1'], [1, 6, 'out', "À l'unité × 6", '−6'],
])('confirmParts(%i, %i, %s)', (units, q, mode, what, delta) => { expect(confirmParts(units, q, mode as MoveMode)).toEqual({ what, delta }) })
// Listes et fiche : le nombre d'unités en grand, les packs Metro à part.
test('formatUnits : le nombre seul, avec le signe moins typographique', () => {
  expect([formatUnits(48), formatUnits(-3)]).toEqual(['48', '−3'])
})
// RG-1 : rien si le pack vaut 1, si le stock est négatif ou s'il fait moins d'un pack.
test.each([
  [48, 24, '2 packs'], [53, 24, '2 packs + 5'], [25, 24, '1 pack + 1'], [24, 24, '1 pack'], [10, 24, null], [36, 1, null], [-3, 24, null],
])('formatPacks(%i, %i) = %s', (stock, pack, text) => { expect(formatPacks(stock, pack)).toBe(text) })
