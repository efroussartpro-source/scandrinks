/**
 * CountCard.tsx — Fiche de confirmation en mode Inventaire (RG-4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §4.7, §7)
 *
 * L'image du code scanné ouvre la fiche, comme en Entrée et en Sortie.
 * On saisit ce qu'on compte en packs Metro + unités ; « Valider » envoie le
 * total. Pendant l'envoi et après un échec, les champs ne changent plus :
 * « Réessayer » renvoie exactement le nombre déjà envoyé, avec le même
 * identifiant.
 */
import { useState } from 'react'
import { saveErrorMessage } from '../data/apiErrors'
import { parseCount } from '../domain/inventory'
import CountFields from '../inventory/CountFields'
import { PHOTO_NOT_SAVED_MESSAGE } from '../photos/photos'
import Thumb from '../photos/Thumb'
import type { ConfirmState } from './scanFlow'

interface CountCardProps {
  state: ConfirmState
  onValidate: (counted?: number) => void
  onClose: () => void
}

export default function CountCard({ state, onValidate, onClose }: CountCardProps) {
  const { target, status, errorKind } = state
  const [packsText, setPacksText] = useState('')
  const [unitsText, setUnitsText] = useState('')
  const parsed = parseCount(packsText, unitsText, target.product.packSize)

  function validate() {
    if (status === 'failed') onValidate()
    else if (parsed.ok) onValidate(parsed.counted)
  }

  return (
    <section className="card confirm" data-mode="inventory" aria-label="Fiche de confirmation">
      <div className="confirm-head">
        <Thumb path={target.photoPath} size={64} />
        <div className="confirm-text">
          <h2 className="card-title">{target.product.name}</h2>
        </div>
      </div>
      {target.photoWarning && <p className="message message-warning">{PHOTO_NOT_SAVED_MESSAGE}</p>}
      <CountFields
        packSize={target.product.packSize}
        knownStock={target.product.stock}
        packsText={packsText}
        unitsText={unitsText}
        disabled={status !== 'idle'}
        onChange={(packs, units) => {
          setPacksText(packs)
          setUnitsText(units)
        }}
      />
      {status === 'failed' && errorKind && (
        <p role="alert" className="message message-error">
          {saveErrorMessage(errorKind)}
        </p>
      )}
      <div className="card-actions">
        <button type="button" className="primary" disabled={status === 'saving' || (status === 'idle' && !parsed.ok)} onClick={validate}>
          {status === 'saving' ? 'Enregistrement…' : status === 'failed' ? 'Réessayer' : 'Valider'}
        </button>
        <button type="button" disabled={status === 'saving'} onClick={onClose}>
          Annuler
        </button>
      </div>
    </section>
  )
}
