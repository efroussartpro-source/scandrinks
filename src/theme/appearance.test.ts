import { expect, test } from 'vitest'
import { APPEARANCE_KEY, loadAppearance, resolveAppearance, saveAppearance } from './appearance'

// Stockage en mémoire, comme localStorage.
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) } as unknown as Storage
}

test('Automatique par défaut, et pour une valeur inconnue', () => {
  const storage = memoryStorage()
  expect(loadAppearance(storage)).toBe('auto')
  storage.setItem(APPEARANCE_KEY, 'violet')
  expect(loadAppearance(storage)).toBe('auto')
})

test('Clair et Sombre sont gardés par le téléphone', () => {
  const storage = memoryStorage()
  saveAppearance('dark', storage)
  expect(loadAppearance(storage)).toBe('dark')
  saveAppearance('light', storage)
  expect(loadAppearance(storage)).toBe('light')
})

test('stockage bloqué : Automatique, sans planter', () => {
  const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
  expect(loadAppearance(broken)).toBe('auto')
  expect(() => saveAppearance('dark', broken)).not.toThrow()
})

test.each([
  ['auto', true, 'dark'],
  ['auto', false, 'light'],
  ['light', true, 'light'],
  ['dark', false, 'dark'],
] as const)('resolveAppearance(%s, iPhone en sombre : %s) = %s', (value, systemDark, theme) => {
  expect(resolveAppearance(value, systemDark)).toBe(theme)
})
