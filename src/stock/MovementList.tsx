/**
 * MovementList.tsx — Derniers mouvements d'un produit, du plus récent au plus ancien.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §4.5)
 *
 * Chaque ligne montre la pastille du type (+, − ou =, dans sa couleur), puis
 * « Sortie −24 » dans la couleur du type, le moment et le prénom (maquette
 * C1-Fiche) ; VoiceOver lit la phrase entière. Une ligne annulée reste
 * visible, barrée, avec « annulé par … ».
 */
import { movementLine, movementParts, type Movement } from '../domain/movements'

const MARK: Record<Movement['kind'], string> = { in: '+', out: '−', inventory: '=' }

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
            <span className={`movement-mark mark-${movement.kind}`} aria-hidden="true">
              {MARK[movement.kind]}
            </span>
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
