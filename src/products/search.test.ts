import { expect, test } from 'vitest'
import { filterProducts, productsForSearch, suggestSearchTerm } from './search'

test.each([['Coca-Cola 330 ml', 'Coca-Cola'], ['Ice tea saveur pêche', 'Ice'], ['33 cl', ''], [null, '']])(
  'suggestSearchTerm(%j) = %j', (name, term) => { expect(suggestSearchTerm(name)).toBe(term) })

test('filterProducts ignore la casse et les accents', () => {
  const p = (name: string) => ({ id: name, name, packSize: 1, alertThreshold: 0, targetStock: 1, archived: false, stock: 0 })
  const list = [p('Coca-Cola 33 cl'), p('Lipton Pêche 50 cl'), p('Coca Zéro 33 cl')]
  expect(filterProducts(list, 'coca').map((x) => x.name)).toEqual(['Coca-Cola 33 cl', 'Coca Zéro 33 cl'])
  expect(filterProducts(list, 'PECHE').map((x) => x.name)).toEqual(['Lipton Pêche 50 cl'])
  expect(filterProducts(list, '')).toHaveLength(3)
})

test('le nom proposé par Open Food Facts retrouve la fiche, avec ou sans trait d’union', () => {
  const p = (name: string) => ({ id: name, name, packSize: 24, alertThreshold: 24, targetStock: 48, archived: false, stock: 0 })
  const list = [p('Coca Cola 33 cl'), p('Lipton Pêche 50 cl')]
  expect(filterProducts(list, suggestSearchTerm('Coca-Cola 330 ml')).map((x) => x.name)).toEqual(['Coca Cola 33 cl'])
})

test("recherche pré-remplie sans résultat : toute la liste s'affiche, avec un avertissement", () => {
  const p = (name: string) => ({ id: name, name, packSize: 24, alertThreshold: 24, targetStock: 48, archived: false, stock: 0 })
  const list = [p('Coca 33 cl'), p('Coca Zéro 33 cl'), p('Lipton Pêche 50 cl')]
  expect(productsForSearch(list, 'Coca-Cola', 'Coca-Cola')).toEqual({ products: list, widened: true })
  expect(productsForSearch(list, 'Coca', 'Coca-Cola')).toEqual({ products: [list[0], list[1]], widened: false })
  expect(productsForSearch(list, 'Fanta', 'Coca-Cola')).toEqual({ products: [], widened: false })
})
