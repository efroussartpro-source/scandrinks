import { expect, test } from 'vitest'
import { describeInventory, formatGap, parseCount } from './inventory'

test('RG-4 : « 2 packs + 5 » de 24 = 53', () => {
  expect(parseCount('2', '5', 24)).toEqual({ ok: true, counted: 53 })
})

test('un champ vide compte pour 0', () => {
  expect([parseCount('', '53', 24), parseCount('2', '', 24), parseCount('0', '0', 24)])
    .toEqual([{ ok: true, counted: 53 }, { ok: true, counted: 48 }, { ok: true, counted: 0 }])
})

test('pack Metro de 1 : seul le champ des unités compte', () => {
  expect(parseCount('7', '3', 1)).toEqual({ ok: true, counted: 3 })
})

test('saisies refusées', () => {
  expect(parseCount('', ' ', 24)).toEqual({ ok: false, error: 'Saisis ce que tu as compté.' })
  expect(parseCount('2a', '', 24)).toEqual({ ok: false, error: 'Chiffres uniquement.' })
  expect(parseCount('-1', '', 24)).toEqual({ ok: false, error: 'Chiffres uniquement.' })
  expect(parseCount('417', '', 24)).toEqual({ ok: false, error: 'Entre 0 et 9 999 unités.' })
  expect(parseCount('', '10000', 1)).toEqual({ ok: false, error: 'Entre 0 et 9 999 unités.' })
  expect(parseCount('416', '15', 24)).toEqual({ ok: true, counted: 9999 })
})

test('écart et résumé', () => {
  expect([formatGap(29), formatGap(-3), formatGap(0)]).toEqual(['+29', '−3', '0'])
  expect(describeInventory(53, -3)).toBe('Inventaire : 53 comptés (−3)')
  expect(describeInventory(1, 0)).toBe('Inventaire : 1 compté (0)')
  expect(describeInventory(0, -12)).toBe('Inventaire : 0 compté (−12)')
})
