import { expect, test } from 'vitest'
import { formatClock, formatWhen, historyLine, movementLine, type HistoryMovement, type Movement } from './movements'

// now = mardi 20/10/2026, 14:00 à Paris.
const now = new Date('2026-10-20T12:00:00Z')
const m = (over: Partial<Movement> = {}): Movement => ({ id: 'm1', kind: 'in', delta: 24, counted: null, employee: 'Sam',
  createdAt: '2026-10-19T12:32:00Z', cancelledAt: null, cancelledBy: null, ...over })

test('heure de Paris : le jour de la semaine pendant 7 jours', () => {
  expect(formatWhen('2026-10-19T12:32:00Z', now)).toBe('lun. 14:32')
  expect(formatWhen('2026-10-19T22:30:00Z', now)).toBe('mar. 00:30')
  expect(formatWhen('2026-10-14T08:05:00Z', now)).toBe('mer. 10:05')
})

test("au-delà : la date, avec l'année si elle diffère", () => {
  expect(formatWhen('2026-10-13T08:05:00Z', now)).toBe('13/10 10:05')
  expect(formatWhen('2025-06-15T10:00:00Z', now)).toBe('15/06/2025 12:00')
  expect(formatClock(new Date('2026-10-20T12:05:00Z'))).toBe('14:05')
})

test('lignes de mouvements (§4.5)', () => {
  expect(movementLine(m(), now)).toBe('lun. 14:32 — Sam — Entrée +24')
  expect(movementLine(m({ kind: 'out', delta: -6 }), now)).toBe('lun. 14:32 — Sam — Sortie −6')
  expect(movementLine(m({ kind: 'inventory', delta: -3, counted: 53 }), now)).toBe('lun. 14:32 — Sam — Inventaire : 53 comptés (−3)')
  expect(movementLine(m({ cancelledAt: '2026-10-19T12:40:00Z', cancelledBy: 'Léa' }), now)).toBe('lun. 14:32 — Sam — Entrée +24 — annulé par Léa')
})

test("ligne d'historique : le produit à la fin, puis l'annulation", () => {
  const base: HistoryMovement = { ...m(), productId: 'p1', productName: 'Coca-Cola 33 cl' }
  expect(historyLine(base, now)).toBe('lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl')
  expect(historyLine({ ...base, kind: 'inventory', delta: -3, counted: 53 }, now))
    .toBe('lun. 14:32 — Sam — Inventaire : 53 comptés (−3) — Coca-Cola 33 cl')
  expect(historyLine({ ...base, cancelledAt: '2026-10-19T13:00:00Z', cancelledBy: 'Léa' }, now))
    .toBe('lun. 14:32 — Sam — Entrée +24 — Coca-Cola 33 cl — annulé par Léa')
})
