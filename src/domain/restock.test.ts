import { expect, test } from 'vitest'
import type { Product } from '../data/api'
import { describeShoppingLine, isLow, listState, restockLine, shoppingList, shoppingParts, shoppingSummary } from './restock'

const p = (name: string, packSize: number, alertThreshold: number, targetStock: number, stock: number, archived = false): Product =>
  ({ id: name, name, packSize, alertThreshold, targetStock, archived, stock, photoPath: null })

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

// Liste du Stock : l'état sous le nom.
test('listState : « À racheter » pour un produit actif au seuil, sinon les packs', () => {
  expect(listState(p('Coca-Cola 33 cl', 24, 24, 48, 10))).toBe('À racheter')
  expect(listState(p('Red Bull 25 cl', 24, 24, 48, -3))).toBe('À racheter · stock à vérifier')
  expect(listState(p('Lipton Pêche 50 cl', 12, 12, 24, 36))).toBe('3 packs')
  expect(listState(p('Évian 1,5 L', 1, 6, 12, 4))).toBe('À racheter')
  expect(listState(p('Évian 1,5 L', 1, 6, 12, 20))).toBeNull()
  expect(listState(p('Oasis Tropical 33 cl', 24, 24, 48, 10, true))).toBeNull()
})

// À racheter : le reste sous le nom, la quantité à prendre dans une pastille, le pack dessous.
test('shoppingParts : reste, quantité et pack', () => {
  expect(shoppingParts(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 10)))).toEqual({ rest: 'Reste 10', amount: '2 packs', note: 'de 24' })
  expect(shoppingParts(restockLine(p('Red Bull 25 cl', 24, 24, 48, -3))))
    .toEqual({ rest: 'Reste −3 · stock à vérifier', amount: '2 packs', note: 'de 24' })
  expect(shoppingParts(restockLine(p('Évian 1,5 L', 1, 6, 12, 4)))).toEqual({ rest: 'Reste 4', amount: '8 unités', note: "à l'unité" })
})

test('shoppingParts : singulier', () => {
  expect(shoppingParts(restockLine(p('Coca-Cola 33 cl', 24, 24, 48, 24))).amount).toBe('1 pack')
  expect(shoppingParts(restockLine(p('Évian 1,5 L', 1, 6, 7, 6))).amount).toBe('1 unité')
})

test('shoppingSummary : le nombre de produits et l’heure de la lecture', () => {
  expect([shoppingSummary(3, '12:03'), shoppingSummary(1, '12:03'), shoppingSummary(0, '12:03')])
    .toEqual(['3 produits · mis à jour à 12:03', '1 produit · mis à jour à 12:03', 'Mis à jour à 12:03'])
})
