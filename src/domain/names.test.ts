import { expect, test } from 'vitest'
import { sortByName } from './names'

test("tri français : accents et casse ignorés, nombres dans l'ordre", () => {
  expect(sortByName([{ name: 'Red Bull 25 cl' }, { name: 'Évian 1,5 L' }, { name: 'coca-Cola 33 cl' }, { name: 'Lipton' }]).map((x) => x.name))
    .toEqual(['coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton', 'Red Bull 25 cl'])
  expect(sortByName([{ name: 'Pack 10' }, { name: 'Pack 9' }]).map((x) => x.name)).toEqual(['Pack 9', 'Pack 10'])
})

test('sortByName ne modifie pas la liste reçue', () => {
  const list = [{ name: 'b' }, { name: 'a' }]
  sortByName(list)
  expect(list.map((x) => x.name)).toEqual(['b', 'a'])
})
