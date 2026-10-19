import { expect, test } from 'vitest'
import { loadEmployeeName, saveEmployeeName, validateEmployeeName } from './employee'

const brokenStorage = { getItem: () => { throw new Error('SecurityError') }, setItem: () => { throw new Error('SecurityError') } } as unknown as Storage

test.each([['  Sam  ', { ok: true, name: 'Sam' }], ['', { ok: false, message: 'Le prénom doit faire entre 1 et 30 caractères.' }],
  ['x'.repeat(31), { ok: false, message: 'Le prénom doit faire entre 1 et 30 caractères.' }]])('validateEmployeeName(%j)', (raw, expected) => {
  expect(validateEmployeeName(raw)).toEqual(expected)
})

test('stockage bloqué (navigation privée) : rien ne plante, pas de prénom mémorisé', () => {
  expect(() => saveEmployeeName('Sam', brokenStorage)).not.toThrow()
  expect(loadEmployeeName(brokenStorage)).toBeNull()
})

test('prénom mémorisé puis relu', () => {
  const memory = new Map<string, string>()
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v) } } as unknown as Storage
  saveEmployeeName('Sam', storage)
  expect(loadEmployeeName(storage)).toBe('Sam')
})
