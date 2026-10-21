/**
 * MovementList.tsx — Derniers mouvements d'un produit, du plus récent au plus ancien.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §4.5)
 *
 * Chaque ligne montre « Sortie −24 » dans la couleur du type, puis le moment
 * et le prénom (maquette J-fiche) ; VoiceOver lit la phrase entière. Une
 * ligne annulée reste visible, barrée, avec « annulé par … ».
 */
import { movementLine, movementParts, type Movement } from '../domain/movements'

interface MovementListProps {
  movements: Movement[]
}

export default function MovementList({ movements }: MovementListProps) {
  if (movements.length === 0) return <p className="muted">Aucun mouvement.</p>
  const now = new Date()
  return (
    <ul className="group movement-list" aria-label="Derniers mouvements">
      {movements.map((movement) => {
        const { title, meta } = movementParts(movement, now)
        return (
          <li key={movement.id} className={movement.cancelledAt !== null ? 'cancelled' : undefined}>
            <span className="movement-visual" aria-hidden="true">
              <span className={`movement-title kind-${movement.kind}`}>{title}</span>
              <span className="movement-meta">{meta}</span>
            </span>
            <span className="visually-hidden movement-line">{movementLine(movement, now)}</span>
          </li>
        )
      })}
    </ul>
  )
}
