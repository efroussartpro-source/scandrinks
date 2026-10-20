/**
 * CountFields.tsx — Saisie d'un comptage d'inventaire : packs Metro + unités (RG-4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §4.4)
 *
 * Le stock connu s'affiche au-dessus ; le total et l'écart s'affichent
 * dessous, avant « Valider ». Les champs démarrent vides pour ne pas
 * influencer le comptage. Sert au mode Inventaire du Scanner et à « Corriger
 * le stock » dans la fiche produit.
 */
import { selectAllSoon } from '../app/selectAll'
import { formatGap, parseCount } from '../domain/inventory'
import { formatStock } from '../domain/stock'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'
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
  const parsed = parseCount(packsText, unitsText, packSize)
  const empty = packsText.trim() === '' && unitsText.trim() === ''
  const byPack = packSize > 1

  return (
    <div className="count-fields">
      <p className="muted">Stock connu : {formatStock(knownStock, packSize)}</p>
      {byPack && (
        <HelpField
          label={`Packs de ${packSize}`}
          help={FIELD_HELP.countPacks}
          inputMode="numeric"
          pattern="[0-9]*"
          value={packsText}
          disabled={disabled}
          onFocus={selectAllSoon}
          onChange={(event) => onChange(event.target.value, unitsText)}
        />
      )}
      <HelpField
        label={byPack ? 'Unités en plus' : 'Unités'}
        help={byPack ? FIELD_HELP.countUnits : FIELD_HELP.countUnitsOnly}
        inputMode="numeric"
        pattern="[0-9]*"
        value={unitsText}
        disabled={disabled}
        onFocus={selectAllSoon}
        onChange={(event) => onChange(packsText, event.target.value)}
      />
      {!empty &&
        (parsed.ok ? (
          <p className="count-total">
            = {formatStock(parsed.counted, packSize)} — écart : {formatGap(parsed.counted - knownStock)}
          </p>
        ) : (
          <p className="field-error">{parsed.error}</p>
        ))}
    </div>
  )
}
