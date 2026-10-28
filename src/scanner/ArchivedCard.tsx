/**
 * ArchivedCard.tsx — Code d'un produit archivé : proposition de réactivation (RG-11).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §5)
 *
 * Réactivé, le produit revient dans les listes et la fiche de confirmation
 * s'ouvre aussitôt.
 */
import { apiErrorMessage } from '../data/apiErrors'
import type { ArchivedState } from './scanFlow'

interface ArchivedCardProps {
  state: ArchivedState
  onReactivate: () => void
  onClose: () => void
}

export default function ArchivedCard({ state, onReactivate, onClose }: ArchivedCardProps) {
  const { target, status, errorKind } = state
  return (
    <section className="card" aria-label="Produit archivé">
      <h2 className="card-title">{target.product.name}</h2>
      <p className="muted">Ce produit est archivé. Le réactiver pour l'utiliser ?</p>
      {status === 'failed' && errorKind && (
        <p role="alert" className="message message-error">
          {apiErrorMessage(errorKind)}
        </p>
      )}
      <div className="card-actions">
        <button type="button" className="primary" disabled={status === 'saving'} onClick={onReactivate}>
          {status === 'saving' ? 'Réactivation…' : status === 'failed' ? 'Réessayer' : 'Réactiver'}
        </button>
        <button type="button" className="plain" disabled={status === 'saving'} onClick={onClose}>
          Annuler
        </button>
      </div>
    </section>
  )
}
