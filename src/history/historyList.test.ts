import { expect, test } from 'vitest'
import type { HistoryMovement } from '../domain/movements'
import { appendHistoryPage, markCancelled, mergeHistoryPage } from './historyList'

const row = (id: string): HistoryMovement => ({ id, kind: 'in', delta: 1, counted: null, employee: 'Sam', createdAt: '2026-10-19T12:00:00Z',
  cancelledAt: null, cancelledBy: null, saleDay: null, productId: 'p1', productName: 'Coca-Cola 33 cl' })

test('page suivante : ajoutée à la fin, sans doublon', () => {
  expect(mergeHistoryPage([row('a'), row('b')], [row('b'), row('c')]).map((m) => m.id)).toEqual(['a', 'b', 'c'])
})

test('annulation : seule la ligne visée change', () => {
  const list = markCancelled([row('a'), row('b')], 'b', '2026-10-19T13:00:00Z', 'Léa')
  expect(list.map((m) => [m.id, m.cancelledAt, m.cancelledBy])).toEqual([['a', null, null], ['b', '2026-10-19T13:00:00Z', 'Léa']])
})

const cursorOf = (m: HistoryMovement) => ({ createdAt: m.createdAt, id: m.id })

test('« Voir plus » : la page suit la liste, elle est ajoutée avec sa propre suite', () => {
  const state = { movements: [row('a'), row('b')], next: cursorOf(row('b')) }
  const after = appendHistoryPage(state, cursorOf(row('b')), { movements: [row('c')], next: null })
  expect(after.movements.map((m) => m.id)).toEqual(['a', 'b', 'c'])
  expect(after.next).toBeNull()
})

test("« Voir plus » pendant une relecture : la page d'avant est écartée, aucune ligne n'est cachée", () => {
  // Retour dans l'app : la liste a été relue (z, nouveau, puis a) pendant que la page qui suivait b arrivait.
  const reloaded = { movements: [row('z'), row('a')], next: cursorOf(row('a')) }
  expect(appendHistoryPage(reloaded, cursorOf(row('b')), { movements: [row('c')], next: null })).toBe(reloaded)
})
