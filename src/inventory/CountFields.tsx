/**
 * CountFields.tsx — Saisie d'un comptage d'inventaire : packs Metro + unités (RG-4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §4.4, §6.7)
 *
 * Le stock connu s'affiche au-dessus ; les packs et les unités se saisissent
 * côte à côte, avec une seule aide pour les deux ; le total et l'écart
 * s'affichent dessous, dans une bande bleue, avant « Valider » (maquette
 * docs/maquettes/J-inventaire.dc.html). Les champs démarrent vides pour ne
 * pas influencer le comptage. Sert au mode Inventaire du Scanner et à
 * « Corriger le stock » dans la fiche produit.
 */
import { useId } from 'react'
import { selectAllSoon } from '../app/selectAll'
import { formatGap, parseCount } from '../domain/inventory'
import { formatStock } from '../domain/stock'
import { FIELD_HELP } from '../products/fieldHelp'
import './Inventory.css'

interface CountFieldsProps {
  packSize: number
  knownStock: number
  packsText: string
  unitsText: string
  disabled: boolean
  onChange: (packsText: string, unitsText: string) => void
}

export default function CountFields({ packSize, knownStock, packsText, unitsText, disabled, onChange }: CountFieldsProps) {
  const id = useId()
  const helpId = `${id}-help`
  const parsed = parseCount(packsText, unitsText, packSize)
  const empty = packsText.trim() === '' && unitsText.trim() === ''
  const byPack = packSize > 1

  return (
    <div className="count-fields">
      <p className="muted">Stock connu : {formatStock(knownStock, packSize)}</p>
      <div className="count-inputs">
        {byPack && (
          <div className="field">
            <label htmlFor={`${id}-packs`}>{`Packs de ${packSize}`}</label>
            <input
              id={`${id}-packs`}
              aria-describedby={helpId}
              inputMode="numeric"
              pattern="[0-9]*"
              value={packsText}
              disabled={disabled}
              onFocus={selectAllSoon}
              onChange={(event) => onChange(event.target.value, unitsText)}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-units`}>{byPack ? 'Unités en plus' : 'Unités'}</label>
          <input
            id={`${id}-units`}
            aria-describedby={helpId}
            inputMode="numeric"
            pattern="[0-9]*"
            value={unitsText}
            disabled={disabled}
            onFocus={selectAllSoon}
            onChange={(event) => onChange(packsText, event.target.value)}
          />
        </div>
      </div>
      <p id={helpId} className="field-help count-help">
        {byPack ? FIELD_HELP.countBoth : FIELD_HELP.countUnitsOnly}
      </p>
      {!empty &&
        (parsed.ok ? (
          <p className="count-result">
            <span className="count-total">= {formatStock(parsed.counted, packSize)}</span>
            <span className="count-gap">écart : {formatGap(parsed.counted - knownStock)}</span>
          </p>
        ) : (
          <p className="field-error">{parsed.error}</p>
        ))}
    </div>
  )
}
