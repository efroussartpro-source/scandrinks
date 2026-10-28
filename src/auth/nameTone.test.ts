import { expect, test } from 'vitest'
import { initialOf, nameTone } from './nameTone'

// Le prénom tapé avec l'accent séparé de sa lettre (e + accent aigu) : la même personne que « élodie ».
const decomposed = 'élodie'

test.each([
  ['Sam', 'S'],
  ['élodie', 'É'],
  [decomposed, 'É'],
  ['  Léa', 'L'],
  ['', ''],
])("initialOf(%j) : l'initiale en majuscule", (name, initial) => {
  expect(initialOf(name)).toBe(initial)
})

// Les quatre teintes, calculées une fois le 28/10/2026 : la couleur d'un prénom ne change jamais.
test.each([
  ['Karim', 'green'],
  ['Sam', 'orange'],
  ['Léa', 'blue'],
  ['Hugo', 'red'],
])('nameTone(%j) : %s', (name, tone) => {
  expect(nameTone(name)).toBe(tone)
})

test("nameTone : la même couleur quelle que soit la façon d'écrire l'accent ou les espaces autour", () => {
  expect(nameTone(decomposed)).toBe(nameTone('élodie'))
  expect(nameTone(' Sam ')).toBe(nameTone('Sam'))
  expect(nameTone('')).toBe('green')
})
