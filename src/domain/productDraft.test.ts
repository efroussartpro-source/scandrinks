import { expect, test } from 'vitest'
import { newDraft, parseIntInRange, updateDraft, validateDraft, type DraftField } from './productDraft'

test.each([[' 24 ', 1, 999, 24], ['0', 1, 999, null], ['1000', 1, 999, null], ['12.5', 1, 999, null], ['', 0, 9999, null], ['abc', 1, 999, null]])(
  'parseIntInRange(%j, %i, %i) = %j', (raw, min, max, expected) => { expect(parseIntInRange(raw, min, max)).toBe(expected) })
test('un code de 24 unités pré-remplit pack Metro 24, seuil 24 et stock idéal 48', () => {
  const d = updateDraft(newDraft('Lipton Pêche 50 cl'), 'codeUnits', '24')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['24', '24', '48'])
})
test("un code d'une unité laisse le pack Metro à saisir", () => {
  const d = updateDraft(newDraft('Coca-Cola 33 cl'), 'codeUnits', '1')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['', '', ''])
  const d2 = updateDraft(d, 'packSize', '12')
  expect([d2.alertThreshold, d2.targetStock]).toEqual(['12', '24'])
})
test('unités corrigées de 24 à 1 : le pack Metro pré-rempli se vide', () => {
  const d = updateDraft(updateDraft(newDraft('X'), 'codeUnits', '24'), 'codeUnits', '1')
  expect([d.packSize, d.alertThreshold, d.targetStock]).toEqual(['', '', ''])
})
test('seuil modifié à la main : il ne suit plus le pack Metro', () => {
  let d = updateDraft(newDraft('X'), 'codeUnits', '24')
  d = updateDraft(d, 'alertThreshold', '10')
  d = updateDraft(d, 'packSize', '12')
  expect([d.alertThreshold, d.targetStock]).toEqual(['10', '48'])
})
test('pack Metro modifié à la main : il ne suit plus les unités du code', () => {
  let d = updateDraft(newDraft('X'), 'packSize', '6')
  d = updateDraft(d, 'codeUnits', '24')
  expect(d.packSize).toBe('6')
})
test('validation : fiche correcte', () => {
  const d = updateDraft(newDraft('  Lipton Pêche 50 cl  '), 'codeUnits', '12')
  expect(validateDraft(d)).toEqual({ ok: true, codeUnits: 12, product: { name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24 } })
})
test.each([
  ['name', '', 'Le nom est obligatoire (80 caractères au plus).'],
  ['name', 'x'.repeat(81), 'Le nom est obligatoire (80 caractères au plus).'],
  ['codeUnits', '0', 'Entre 1 et 999.'],
  ['packSize', '1000', 'Entre 1 et 999.'],
  ['alertThreshold', '10000', 'Entre 0 et 9\u00a0999.'],
  ['targetStock', '100000', 'Entre 1 et 99\u00a0999.'],
  ['targetStock', '24', 'Le stock idéal doit être supérieur au seuil.'],
])('validation : %s = %s refusé', (field, value, message) => {
  const base = updateDraft(newDraft('Coca-Cola 33 cl'), 'codeUnits', '24')
  const result = validateDraft(updateDraft(base, field as DraftField, value))
  expect(result).toMatchObject({ ok: false, errors: { [field]: message } })
})
