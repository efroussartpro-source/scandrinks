import { expect, test } from 'vitest'
import { loadMode, MODE_KEY, saveMode } from './mode'

test('mode par défaut : Entrée ; stockage bloqué → Entrée sans planter', () => {
  const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
  expect(loadMode(broken)).toBe('in')
  expect(() => saveMode('out', broken)).not.toThrow()
})

// Stockage en mémoire, comme localStorage.
function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) } as unknown as Storage
}

test('le mode Inventaire est gardé ; une valeur inconnue donne Entrée', () => {
  const storage = memoryStorage()
  saveMode('inventory', storage)
  expect(loadMode(storage)).toBe('inventory')
  storage.setItem(MODE_KEY, 'x')
  expect(loadMode(storage)).toBe('in')
})
