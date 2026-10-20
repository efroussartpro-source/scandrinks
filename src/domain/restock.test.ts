import { expect, test } from 'vitest'
import type { Product } from '../data/api'
import { describeShoppingLine, isLow, restockLine, shoppingList } from './restock'

const p = (name: string, packSize: number, alertThreshold: number, targetStock: number, stock: number, archived = false): Product =>
  ({ id: name, name, packSize, alertThreshold, targetStock, archived, stock })

test('RG-6 : il manque 38 → 2 packs de 24 (exemple de la spec)', () => {
  expect(describeShoppingLine(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 10)))).toBe('Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24')
})

test('RG-6 : arrondi au pack supérieur, et singulier', () => {
  expect(describeShoppingLine(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 24)))).toBe('Coca-Cola 33 cl — reste 24 — prendre 1 pack de 24')
  expect(describeShoppingLine(restockLine(p('Lipton', 12, 6, 30, 5)))).toBe('Lipton — reste 5 — prendre 3 packs de 12')
})

test('RG-6 : stock négatif compté pour 0, avec « stock à vérifier »', () => {
  const line = restockLine(p('Red Bull 25 cl', 24, 24, 48, -3))
  expect(line).toMatchObject({ toBuy: 2, unit: 'pack', checkStock: true })
  expect(describeShoppingLine(line)).toBe('Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier')
})

test('RG-6 : pack Metro de 1 → quantité en unités', () => {
  expect(describeShoppingLine(restockLine(p('Évian 1,5 L', 1, 6, 12, 4)))).toBe('Évian 1,5 L — reste 4 — prendre 8 unités')
  expect(describeShoppingLine(restockLine(p('Évian 1,5 L', 1, 6, 7, 6)))).toBe('Évian 1,5 L — reste 6 — prendre 1 unité')
})

test('RG-5 : seulement les produits actifs, au seuil ou en dessous', () => {
  expect(shoppingList([p('Coca-Cola 33 cl', 24, 24, 48, 10), p('Lipton', 12, 12, 24, 36), p('Oasis', 24, 24, 48, 0, true)])
    .map((l) => l.product.name)).toEqual(['Coca-Cola 33 cl'])
})

test('ordre : ruptures (stock ≤ 0) en premier, puis ordre alphabétique', () => {
  expect(shoppingList([p('Évian 1,5 L', 1, 6, 12, 4), p('Schweppes 33 cl', 24, 24, 48, 0), p('Coca-Cola 33 cl', 24, 24, 48, 10), p('Red Bull 25 cl', 24, 24, 48, -3)])
    .map((l) => l.product.name)).toEqual(['Red Bull 25 cl', 'Schweppes 33 cl', 'Coca-Cola 33 cl', 'Évian 1,5 L'])
})

test('isLow : stock au seuil ou en dessous, négatif compris', () => {
  expect([isLow({ stock: 24, alertThreshold: 24 }), isLow({ stock: 25, alertThreshold: 24 }), isLow({ stock: -1, alertThreshold: 0 })])
    .toEqual([true, false, true])
})
