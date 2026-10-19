/**
 * ConfirmCard.tsx — Fiche de confirmation d'un mouvement (code connu ou saisie manuelle).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §7)
 *
 * Le mode est rappelé en couleur et par le signe (+24 ou −24). Pendant
 * l'envoi et après un échec, la quantité ne change plus : ce qui est réessayé
 * est exactement ce qui était affiché.
 */
import { apiErrorMessage } from '../data/apiErrors'
import { describeConfirm, QUANTITY_MAX, QUANTITY_MIN, type ScanMode } from '../domain/stock'
import type { ConfirmState } from './scanFlow'

interface ConfirmCardProps {
  state: ConfirmState
  mode: ScanMode
  onQuantity: (quantity: number) => void
  onValidate: () => void
  onClose: () => void
}

export default function ConfirmCard({ state, mode, onQuantity, onValidate, onClose }: ConfirmCardProps) {
  const { target, quantity, status, errorKind } = state
  const locked = status !== 'idle'

  return (
    <section className="card confirm" data-mode={mode} aria-label="Fiche de confirmation">
      <h2 className="card-title">{target.product.name}</h2>
      <p className="confirm-line">{describeConfirm(target.units, quantity, mode)}</p>
      <div className="quantity">
        <label htmlFor="confirm-quantity">Quantité</label>
        <button type="button" aria-label="Moins" disabled={locked || quantity <= QUANTITY_MIN} onClick={() => onQuantity(quantity - 1)}>
          −
        </button>
        <input
          id="confirm-quantity"
          inputMode="numeric"
          pattern="[0-9]*"
          value={quantity}
          disabled={locked}
          onFocus={(event) => event.target.select()}
          onChange={(event) => onQuantity(Number(event.target.value))}
        />
        <button type="button" aria-label="Plus" disabled={locked || quantity >= QUANTITY_MAX} onClick={() => onQuantity(quantity + 1)}>
          +
        </button>
      </div>
      {status === 'failed' && errorKind && (
        <p role="alert" className="message message-error">
          {apiErrorMessage(errorKind)}
        </p>
      )}
      <div className="card-actions">
        <button type="button" className="primary" disabled={status === 'saving'} onClick={onValidate}>
          {status === 'saving' ? 'Enregistrement…' : status === 'failed' ? 'Réessayer' : 'Valider'}
        </button>
        <button type="button" disabled={status === 'saving'} onClick={onClose}>
          Annuler
        </button>
      </div>
    </section>
  )
}
