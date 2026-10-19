import { describe, expect, test } from 'vitest'
import { createScanDeduper } from './deduper'

function clock() {
  let t = 0
  return { now: () => t, set: (v: number) => { t = v } }
}

describe('createScanDeduper', () => {
  test('par défaut, un code est relu 2 000 ms après sa dernière apparition', () => {
    const c = clock()
    const accept = createScanDeduper(undefined, c.now)
    expect(accept('A')).toBe(true)
    c.set(1999); expect(accept('A')).toBe(false)
    c.set(3999); expect(accept('A')).toBe(true)
  })
  test("accepte la première apparition d'un code", () => {
    const c = clock()
    expect(createScanDeduper(2000, c.now)('5449000000996')).toBe(true)
  })
  test("ignore le même code tant qu'il reste visible", () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    for (let t = 500; t <= 10_000; t += 500) {
      c.set(t)
      expect(accept('A')).toBe(false)
    }
  })
  test('relit le code après 2 000 ms sans le voir (borne incluse)', () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    c.set(1999); expect(accept('A')).toBe(false)
    c.set(3998); expect(accept('A')).toBe(false)
    c.set(5998); expect(accept('A')).toBe(true)
  })
  test("deux codes visibles ensemble ne sont acceptés qu'une fois chacun", () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    expect([accept('PACK'), accept('CANETTE')]).toEqual([true, true])
    for (let t = 150; t <= 3000; t += 150) {
      c.set(t)
      expect([accept('PACK'), accept('CANETTE')]).toEqual([false, false])
    }
  })
  test('un code ne bloque pas les autres', () => {
    const c = clock()
    const accept = createScanDeduper(2000, c.now)
    accept('A')
    c.set(100); expect(accept('B')).toBe(true)
    c.set(200); expect(accept('A')).toBe(false)
  })
})
