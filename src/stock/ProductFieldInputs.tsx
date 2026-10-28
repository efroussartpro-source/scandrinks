/**
 * ProductFieldInputs.tsx — Champs d'une fiche créée ou modifiée depuis le Stock.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-5 à RG-7)
 *
 * Nom, pack Metro, seuil d'alerte et stock idéal, chacun avec son aide. Les
 * valeurs par défaut (ou leur absence) sont l'affaire du formulaire qui les
 * utilise.
 */
import { selectAllSoon } from '../app/selectAll'
import { NAME_MAX_LENGTH, type ProductFields } from '../domain/productDraft'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'

type NumberField = Exclude<keyof ProductFields, 'name'>

const NUMBER_FIELDS: Array<{ field: NumberField; label: string; help: string }> = [
  { field: 'packSize', label: 'Pack Metro (unités)', help: FIELD_HELP.packSize },
  { field: 'alertThreshold', label: "Seuil d'alerte (unités)", help: FIELD_HELP.alertThreshold },
  { field: 'targetStock', label: 'Stock idéal (unités)', help: FIELD_HELP.targetStock },
]

interface ProductFieldInputsProps {
  values: ProductFields
  errors: Partial<Record<keyof ProductFields, string>>
  disabled: boolean
  onChange: (field: keyof ProductFields, value: string) => void
}

export default function ProductFieldInputs({ values, errors, disabled, onChange }: ProductFieldInputsProps) {
  return (
    <>
      <HelpField
        label="Nom"
        help={FIELD_HELP.name}
        error={errors.name}
        type="text"
        maxLength={NAME_MAX_LENGTH}
        value={values.name}
        disabled={disabled}
        onChange={(event) => onChange('name', event.target.value)}
      />
      {NUMBER_FIELDS.map(({ field, label, help }) => (
        <HelpField
          key={field}
          inline
          label={label}
          help={help}
          error={errors[field]}
          inputMode="numeric"
          pattern="[0-9]*"
          value={values[field]}
          disabled={disabled}
          onFocus={selectAllSoon}
          onChange={(event) => onChange(field, event.target.value)}
        />
      ))}
    </>
  )
}
