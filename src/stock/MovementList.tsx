/**
 * MovementList.tsx — Derniers mouvements d'un produit, du plus récent au plus ancien.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §4.5)
 *
 * Une ligne annulée reste visible, barrée, avec « annulé par … ».
 */
import { movementLine, type Movement } from '../domain/movements'

interface MovementListProps {
  movements: Movement[]
}

export default function MovementList({ movements }: MovementListProps) {
  if (movements.length === 0) return <p className="muted">Aucun mouvement.</p>
  const now = new Date()
  return (
    <ul className="movement-list" aria-label="Derniers mouvements">
      {movements.map((movement) => (
        <li key={movement.id} className={movement.cancelledAt !== null ? 'cancelled' : undefined}>
          {movementLine(movement, now)}
        </li>
      ))}
    </ul>
  )
}
