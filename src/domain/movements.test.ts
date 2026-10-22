import { expect, test } from 'vitest'
import { describeMovement, formatClock, formatWhen, historyLine, historyParts, movementLine, movementParts, type HistoryMovement, type Movement } from './movements'

// now = mardi 20/10/2026, 14:00 à Paris.
const now = new Date('2026-10-20T12:00:00Z')
const m = (over: Partial<Movement> = {}): Movement => ({ id: 'm1', kind: 'in', delta: 24, counted: null, employee: 'Sam',
  createdAt: '2026-10-19T12:32:00Z', cancelledAt: null, cancelledBy: null, saleDay: null, ...over })

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

// Fiche produit : le mouvement en titre, puis le moment et le prénom.
test('movementParts', () => {
  expect(movementParts(m(), now)).toEqual({ title: 'Entrée +24', meta: 'lun. 14:32 · Sam' })
  expect(movementParts(m({ cancelledAt: '2026-10-19T12:40:00Z', cancelledBy: 'Léa' }), now).meta).toBe('lun. 14:32 · Sam — annulé par Léa')
  expect(movementParts(m({ kind: 'inventory', delta: -3, counted: 53 }), now).title).toBe('Inventaire : 53 comptés (−3)')
})

// Historique : le produit en titre, la quantité à droite, puis le type, le moment et le prénom.
test('historyParts', () => {
  const base: HistoryMovement = { ...m(), productId: 'p1', productName: 'Coca-Cola 33 cl' }
  expect(historyParts({ ...base, kind: 'out', delta: -24 }, now))
    .toEqual({ title: 'Coca-Cola 33 cl', amount: '−24', meta: 'Sortie · lun. 14:32 · Sam' })
  expect(historyParts({ ...base, kind: 'inventory', delta: 29, counted: 53 }, now))
    .toMatchObject({ amount: '53 comptés', meta: 'Inventaire (+29) · lun. 14:32 · Sam' })
  expect(historyParts({ ...base, kind: 'inventory', delta: -2, counted: 1 }, now).amount).toBe('1 compté')
  expect(historyParts({ ...base, cancelledAt: '2026-10-19T13:00:00Z', cancelledBy: null }, now).meta).toBe('Entrée · lun. 14:32 · Sam — annulé')
})

// Fin de journée (§4.5, §4.8) : une vente est une sortie qui porte le jour des ventes.
test("une vente, dans la fiche et dans l'Historique", () => {
  const evening = new Date('2026-10-22T18:00:00Z')
  const sale: HistoryMovement = { ...m({ kind: 'out', delta: -2, createdAt: '2026-10-22T17:42:00Z', saleDay: '2026-10-22' }),
    productId: 'p1', productName: 'Coca-Cola 50 cl' }
  expect(describeMovement(sale)).toBe('Vente −2 (ventes du 22/10)')
  expect(historyLine(sale, evening)).toBe('jeu. 19:42 — Sam — Vente −2 (ventes du 22/10) — Coca-Cola 50 cl')
  expect(historyParts(sale, evening)).toEqual({ title: 'Coca-Cola 50 cl', amount: '−2', meta: 'Vente (ventes du 22/10) · jeu. 19:42 · Sam' })
  expect(movementParts(sale, evening).title).toBe('Vente −2 (ventes du 22/10)')
  expect(describeMovement(m({ kind: 'out', delta: -24 }))).toBe('Sortie −24')
})
