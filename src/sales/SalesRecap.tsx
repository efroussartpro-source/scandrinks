/**
 * SalesRecap.tsx — Récapitulatif d'une fin de journée, avant de l'enregistrer (§4.8).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.8, §7)
 *
 * « Coca-Cola 50 cl : −1 », une ligne par produit, puis le total à comparer
 * avec la caisse. « Enregistrer » retire les ventes du stock ; après un
 * échec, il devient « Réessayer » et renvoie les mêmes lignes. « Revenir »
 * ramène à la saisie, intacte.
 */
import { formatDrinks } from '../domain/sales'
import { formatDelta } from '../domain/stock'

interface SalesRecapProps {
  dayShort: string
  lines: Array<{ productId: string; name: string; quantity: number }>
  units: number
  saving: boolean
  error: string | null
  onSave: () => void
  onBack: () => void
}

export default function SalesRecap({ dayShort, lines, units, saving, error, onSave, onBack }: SalesRecapProps) {
  return (
    <>
      <h2 className="sales-recap-title">Ventes du {dayShort}</h2>
      <ul className="group sales-recap" aria-label="Récapitulatif">
        {lines.map((line) => (
          <li key={line.productId}>
            <span className="sales-recap-name">{line.name}</span> : <span className="sales-recap-amount kind-out">{formatDelta(-line.quantity)}</span>
          </li>
        ))}
      </ul>
      <p className="sales-total">Total : {formatDrinks(units)}</p>
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
      <button type="button" className="primary block" disabled={saving} onClick={onSave}>
        {saving ? 'Enregistrement…' : error ? 'Réessayer' : 'Enregistrer'}
      </button>
      <button type="button" className="plain block" disabled={saving} onClick={onBack}>
        Revenir
      </button>
    </>
  )
}
