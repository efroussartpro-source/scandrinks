/**
 * selectAll.ts — Sélectionner tout le contenu d'un champ quand on le touche.
 *
 * Sur iPhone, select() appelé pendant le focus est aussitôt annulé par le
 * toucher qui a donné le focus : on sélectionne donc juste après.
 */
import type { FocusEvent } from 'react'

export function selectAllSoon(event: FocusEvent<HTMLInputElement>): void {
  const input = event.currentTarget
  setTimeout(() => {
    if (document.activeElement === input) input.setSelectionRange(0, input.value.length)
  }, 0)
}
