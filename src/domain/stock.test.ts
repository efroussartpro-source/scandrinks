import { expect, test } from 'vitest'
import { clampQuantity, describeConfirm, formatStock, movementDelta, type MoveMode } from './stock'

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
test.each([
  [24, 1, 'in', 'Pack de 24 → +24'], [24, 3, 'in', 'Pack de 24 × 3 → +72'], [1, 1, 'out', "À l'unité → −1"], [1, 6, 'out', "À l'unité × 6 → −6"],
])('describeConfirm(%i, %i, %s)', (units, q, mode, text) => { expect(describeConfirm(units, q, mode as MoveMode)).toBe(text) })

