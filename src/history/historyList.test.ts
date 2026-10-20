import { expect, test } from 'vitest'
import type { HistoryMovement } from '../domain/movements'
import { markCancelled, mergeHistoryPage } from './historyList'

const row = (id: string): HistoryMovement => ({ id, kind: 'in', delta: 1, counted: null, employee: 'Sam', createdAt: '2026-10-19T12:00:00Z',
  cancelledAt: null, cancelledBy: null, productId: 'p1', productName: 'Coca-Cola 33 cl' })

test('page suivante : ajoutée à la fin, sans doublon', () => {
  expect(mergeHistoryPage([row('a'), row('b')], [row('b'), row('c')]).map((m) => m.id)).toEqual(['a', 'b', 'c'])
})

test('annulation : seule la ligne visée change', () => {
  const list = markCancelled([row('a'), row('b')], 'b', '2026-10-19T13:00:00Z', 'Léa')
  expect(list.map((m) => [m.id, m.cancelledAt, m.cancelledBy])).toEqual([['a', null, null], ['b', '2026-10-19T13:00:00Z', 'Léa']])
})
