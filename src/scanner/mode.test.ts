import { expect, test } from 'vitest'
import { loadMode, saveMode } from './mode'

test('mode par défaut : Entrée ; stockage bloqué → Entrée sans planter', () => {
  const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } } as unknown as Storage
  expect(loadMode(broken)).toBe('in')
  expect(() => saveMode('out', broken)).not.toThrow()
})
