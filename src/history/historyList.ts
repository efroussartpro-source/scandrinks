/**
 * historyList.ts — Liste de l'Historique, page après page.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.5)
 *
 * « Voir plus » ajoute la page suivante à la fin. Un mouvement déjà affiché
 * n'apparaît pas deux fois, même si la base le renvoie de nouveau. Une
 * annulation ne change que la ligne visée.
 */
import type { HistoryMovement } from '../domain/movements'

export function mergeHistoryPage(current: HistoryMovement[], page: HistoryMovement[]): HistoryMovement[] {
  const shown = new Set(current.map((m) => m.id))
  return [...current, ...page.filter((m) => !shown.has(m.id))]
}

export function markCancelled(list: HistoryMovement[], id: string, cancelledAt: string, cancelledBy: string): HistoryMovement[] {
  return list.map((m) => (m.id === id ? { ...m, cancelledAt, cancelledBy } : m))
}
