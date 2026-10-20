/**
 * historyList.ts — Liste de l'Historique, page après page.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.5)
 *
 * « Voir plus » ajoute la page suivante à la fin, seulement si elle suit
 * encore la liste affichée : relue entre-temps (retour dans l'app), la liste
 * ne reçoit pas une page qui cacherait des lignes. Un mouvement déjà affiché
 * n'apparaît pas deux fois, même si la base le renvoie de nouveau. Une
 * annulation ne change que la ligne visée.
 */
import type { HistoryCursor, HistoryPage } from '../data/api'
import type { HistoryMovement } from '../domain/movements'

// Les lignes affichées et le curseur de la page suivante, toujours changés ensemble.
export interface HistoryState {
  movements: HistoryMovement[]
  next: HistoryCursor | null
}

export function mergeHistoryPage(current: HistoryMovement[], page: HistoryMovement[]): HistoryMovement[] {
  const shown = new Set(current.map((m) => m.id))
  return [...current, ...page.filter((m) => !shown.has(m.id))]
}

export function appendHistoryPage(state: HistoryState, cursor: HistoryCursor, page: HistoryPage): HistoryState {
  if (state.movements[state.movements.length - 1]?.id !== cursor.id) return state
  return { movements: mergeHistoryPage(state.movements, page.movements), next: page.next }
}

export function markCancelled(list: HistoryMovement[], id: string, cancelledAt: string, cancelledBy: string): HistoryMovement[] {
  return list.map((m) => (m.id === id ? { ...m, cancelledAt, cancelledBy } : m))
}
