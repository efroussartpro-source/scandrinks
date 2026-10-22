import { expect, test } from 'vitest'
import { formatDrinks, formatSaleDay, parseSold, readEntries, salesDays } from './sales'

const firstDay = (iso: string) => salesDays(new Date(iso))[0].day

test("les 7 jours proposés un jeudi soir : aujourd'hui d'abord, puis les 6 jours d'avant", () => {
  expect(salesDays(new Date('2026-10-22T17:30:00Z'))).toEqual([
    { day: '2026-10-22', label: "Aujourd'hui, jeu. 22/10", short: 'jeu. 22/10' },
    { day: '2026-10-21', label: 'Hier, mer. 21/10', short: 'mer. 21/10' },
    { day: '2026-10-20', label: 'mar. 20/10', short: 'mar. 20/10' },
    { day: '2026-10-19', label: 'lun. 19/10', short: 'lun. 19/10' },
    { day: '2026-10-18', label: 'dim. 18/10', short: 'dim. 18/10' },
    { day: '2026-10-17', label: 'sam. 17/10', short: 'sam. 17/10' },
    { day: '2026-10-16', label: 'ven. 16/10', short: 'ven. 16/10' },
  ])
})

test("à minuit, heure de Paris, « aujourd'hui » change de jour", () => {
  expect(firstDay('2026-10-22T21:59:00Z')).toBe('2026-10-22')
  expect(firstDay('2026-10-22T22:00:00Z')).toBe('2026-10-23')
})

test("autour du changement d'heure (25/10/2026), chaque jour une fois, sans trou", () => {
  expect(firstDay('2026-10-25T22:30:00Z')).toBe('2026-10-25')
  expect(firstDay('2026-10-25T23:00:00Z')).toBe('2026-10-26')
  expect(salesDays(new Date('2026-10-26T18:00:00Z')).map((day) => day.day)).toEqual([
    '2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20',
  ])
})

test("au changement d'année, les jours restent ceux du calendrier", () => {
  const days = salesDays(new Date('2027-01-02T10:00:00Z'))
  expect(days.slice(0, 3)).toEqual([
    { day: '2027-01-02', label: "Aujourd'hui, sam. 02/01", short: 'sam. 02/01' },
    { day: '2027-01-01', label: 'Hier, ven. 01/01', short: 'ven. 01/01' },
    { day: '2026-12-31', label: 'jeu. 31/12', short: 'jeu. 31/12' },
  ])
})

test.each([
  ['', { kind: 'empty' }],
  ['   ', { kind: 'empty' }],
  ['0', { kind: 'empty' }],
  ['00', { kind: 'empty' }],
  ['3', { kind: 'ok', quantity: 3 }],
  [' 3 ', { kind: 'ok', quantity: 3 }],
  ['03', { kind: 'ok', quantity: 3 }],
  ['999', { kind: 'ok', quantity: 999 }],
  ['1000', { kind: 'invalid' }],
  ['1,5', { kind: 'invalid' }],
  ['-2', { kind: 'invalid' }],
  ['12a', { kind: 'invalid' }],
  ['٣', { kind: 'invalid' }],
])('case « %s »', (text, expected) => {
  expect(parseSold(text)).toEqual(expected)
})

test('la saisie : les cases remplies des produits de la liste, dans son ordre ; un produit parti ne compte pas', () => {
  expect(readEntries({ p1: '3', p2: '', p3: '1000', p4: '2', parti: '5' }, ['p1', 'p2', 'p3', 'p4'])).toEqual({
    lines: [
      { productId: 'p1', quantity: 3 },
      { productId: 'p4', quantity: 2 },
    ],
    invalidIds: ['p3'],
    units: 5,
  })
})

test('le total en boissons, et le jour des ventes', () => {
  expect(formatDrinks(0)).toBe('0 boisson')
  expect(formatDrinks(1)).toBe('1 boisson')
  expect(formatDrinks(9)).toBe('9 boissons')
  expect(formatSaleDay('2026-10-22')).toBe('22/10')
})

test("avant le premier jour de ventes, aucun jour n'est proposé ; ensuite, seulement les jours à partir de lui", () => {
  expect(salesDays(new Date('2026-10-22T17:30:00Z'), '2026-10-23')).toEqual([])
  expect(salesDays(new Date('2026-10-25T17:30:00Z'), '2026-10-23')).toEqual([
    { day: '2026-10-25', label: "Aujourd'hui, dim. 25/10", short: 'dim. 25/10' },
    { day: '2026-10-24', label: 'Hier, sam. 24/10', short: 'sam. 24/10' },
    { day: '2026-10-23', label: 'ven. 23/10', short: 'ven. 23/10' },
  ])
  expect(salesDays(new Date('2026-10-30T17:30:00Z'), '2026-10-23').map((day) => day.day)).toEqual([
    '2026-10-30', '2026-10-29', '2026-10-28', '2026-10-27', '2026-10-26', '2026-10-25', '2026-10-24',
  ])
})
