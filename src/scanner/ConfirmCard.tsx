/**
 * ConfirmCard.tsx — Fiche de confirmation d'un mouvement (code connu ou saisie manuelle).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §6.7, §7)
 *
 * La photo du code lu ouvre la fiche, en grand sur sa plaque, avec la
 * quantité dans une carte à droite (maquette C2-Sortie). Le mode est
 * rappelé en couleur et par le signe : « +24 » en très gros, « Pack de 24 »
 * sous le nom, et « Valider », large, à gauche, dans la couleur du mode.
 * Pendant l'envoi et après un
 * échec, la quantité ne change plus : ce qui est réessayé est exactement ce
 * qui était affiché. Une photo choisie à la création du code mais non
 * enregistrée est signalée sous l'en-tête ; « Valider » marche quand même.
 */
import { useEffect, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import { saveErrorMessage } from '../data/apiErrors'
import { parseIntInRange } from '../domain/productDraft'
import { confirmParts, QUANTITY_MAX, QUANTITY_MIN, type MoveMode } from '../domain/stock'
import { PHOTO_NOT_SAVED_MESSAGE } from '../photos/photos'
import Thumb from '../photos/Thumb'
import { IconCheck } from '../ui/icons'
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
  const units = target.units * quantity
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
      <div className="confirm-head tile-plate">
        <span className="confirm-photo">
          <Thumb path={target.photoPath} fill emptyLabel />
        </span>
        <span className="confirm-amount">
          <span className="confirm-delta">{delta}</span>
          <span className="confirm-unit">{units > 1 ? 'unités' : 'unité'}</span>
        </span>
      </div>
      <div className="confirm-text">
        <h2 className="card-title">{target.product.name}</h2>
        <span className="confirm-what">{what}</span>
      </div>
      {target.photoWarning && <p className="message message-warning">{PHOTO_NOT_SAVED_MESSAGE}</p>}
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
        <button type="button" className="primary with-icon" disabled={status === 'saving'} onClick={onValidate}>
          {status === 'idle' && <IconCheck size={20} strokeWidth={2.6} />}
          {status === 'saving' ? 'Enregistrement…' : status === 'failed' ? 'Réessayer' : 'Valider'}
        </button>
        <button type="button" className="plain" disabled={status === 'saving'} onClick={onClose}>
          Annuler
        </button>
      </div>
    </section>
  )
}
