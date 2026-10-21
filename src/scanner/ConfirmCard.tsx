/**
 * ConfirmCard.tsx — Fiche de confirmation d'un mouvement (code connu ou saisie manuelle).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §6.7, §7)
 *
 * L'image du code lu ouvre la fiche (maquette I-confirm). Le mode est
 * rappelé en couleur et par le signe : « Pack de 24 » sous le nom, « +24 »
 * en très gros, et « Valider », dans la couleur du mode (maquette
 * docs/maquettes/Main.dc.html). Pendant l'envoi et après un
 * échec, la quantité ne change plus : ce qui est réessayé est exactement ce
 * qui était affiché.
 */
import { useEffect, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import { saveErrorMessage } from '../data/apiErrors'
import { parseIntInRange } from '../domain/productDraft'
import { confirmParts, QUANTITY_MAX, QUANTITY_MIN, type MoveMode } from '../domain/stock'
import Thumb from '../photos/Thumb'
import type { ConfirmState } from './scanFlow'

interface ConfirmCardProps {
  state: ConfirmState
  mode: MoveMode
  onQuantity: (quantity: number) => void
  onValidate: () => void
  onClose: () => void
}

export default function ConfirmCard({ state, mode, onQuantity, onValidate, onClose }: ConfirmCardProps) {
  const { target, quantity, status, errorKind } = state
  const locked = status !== 'idle'
  const { what, delta } = confirmParts(target.units, quantity, mode)
  // Ce qui est tapé reste tel quel (le champ peut être vide un instant) ; seule une
  // valeur de 1 à 99 change la quantité. En quittant le champ, il reprend la quantité.
  const [text, setText] = useState(String(quantity))
  useEffect(() => setText(String(quantity)), [quantity])

  function type(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    setText(digits)
    const value = parseIntInRange(digits, QUANTITY_MIN, QUANTITY_MAX)
    if (value !== null) onQuantity(value)
  }

  return (
    <section className="card confirm" data-mode={mode} aria-label="Fiche de confirmation">
      <div className="confirm-head">
        <Thumb path={target.photoPath} size={64} />
        <div className="confirm-text">
          <h2 className="card-title">{target.product.name}</h2>
          <span className="confirm-what">{what}</span>
        </div>
        <span className="confirm-delta">{delta}</span>
      </div>
      <div className="quantity">
        <label htmlFor="confirm-quantity">Quantité</label>
        <div className="stepper">
          <button type="button" aria-label="Moins" disabled={locked || quantity <= QUANTITY_MIN} onClick={() => onQuantity(quantity - 1)}>
            −
          </button>
          <input
            id="confirm-quantity"
            inputMode="numeric"
            pattern="[0-9]*"
            value={text}
            disabled={locked}
            onFocus={selectAllSoon}
            onBlur={() => setText(String(quantity))}
            onChange={(event) => type(event.target.value)}
          />
          <button type="button" aria-label="Plus" disabled={locked || quantity >= QUANTITY_MAX} onClick={() => onQuantity(quantity + 1)}>
            +
          </button>
        </div>
      </div>
      {status === 'failed' && errorKind && (
        <p role="alert" className="message message-error">
          {saveErrorMessage(errorKind)}
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
