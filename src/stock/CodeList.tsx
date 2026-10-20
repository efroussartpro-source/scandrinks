/**
 * CodeList.tsx — Codes d'un produit, avec ce que vaut chacun (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-2, RG-12)
 *
 * « Modifier » change le nombre d'unités comptées à chaque scan du code ;
 * « Retirer » le détache du produit, sans toucher aux mouvements passés. Les
 * boutons nomment leur code pour un lecteur d'écran. Un produit archivé
 * montre ses codes sans les boutons.
 */
import { useRef, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import type { BarcodeEntry, Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { parseIntInRange } from '../domain/productDraft'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'

interface CodeListProps {
  product: Product
  barcodes: BarcodeEntry[]
  readOnly?: boolean
  onChanged: () => void
  onSessionExpired: () => void
}

const unitsLabel = (units: number) => `${units} ${units > 1 ? 'unités' : 'unité'}`

export default function CodeList({ product, barcodes, readOnly = false, onChanged, onSessionExpired }: CodeListProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [units, setUnits] = useState('')
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (thrown) {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') onSessionExpired()
      else setError(apiErrorMessage(kind))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function startEditing(barcode: BarcodeEntry) {
    setEditing(barcode.code)
    setUnits(String(barcode.units))
    setUnitsError(null)
    setError(null)
  }

  function saveUnits(code: string) {
    const value = parseIntInRange(units, 1, 999)
    if (value === null) {
      setUnitsError('Entre 1 et 999.')
      return
    }
    void run(async () => {
      const result = await api.attachBarcode({ code, productId: product.id, units: value, move: false })
      setEditing(null)
      // Déplacé depuis un autre téléphone entre-temps : il n'est plus à ce produit.
      if (result.status === 'already_attached') setError(`Ce code appartient maintenant à « ${result.productName} ».`)
      onChanged()
    })
  }

  function remove(code: string) {
    if (!window.confirm(`Retirer le code ${code} ? Les mouvements passés ne changent pas.`)) return
    void run(async () => {
      await api.detachBarcode(code)
      onChanged()
    })
  }

  return (
    <>
      <ul className="code-list" aria-label="Codes">
        {barcodes.map((barcode) => (
          <li key={barcode.code} className="code-row">
            <span className="code-label">
              {barcode.code} — {unitsLabel(barcode.units)}
            </span>
            {!readOnly && editing !== barcode.code && (
              <span className="code-actions">
                <button
                  type="button"
                  aria-label={`Modifier le code ${barcode.code}`}
                  disabled={busy}
                  onClick={() => startEditing(barcode)}
                >
                  Modifier
                </button>
                <button type="button" aria-label={`Retirer le code ${barcode.code}`} disabled={busy} onClick={() => remove(barcode.code)}>
                  Retirer
                </button>
              </span>
            )}
            {!readOnly && editing === barcode.code && (
              <div className="form code-edit">
                <HelpField
                  label="Ce code vaut (unités)"
                  help={FIELD_HELP.codeUnits}
                  error={unitsError ?? undefined}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={units}
                  disabled={busy}
                  onFocus={selectAllSoon}
                  onChange={(event) => {
                    setUnits(event.target.value)
                    setUnitsError(null)
                  }}
                />
                <div className="card-actions">
                  <button type="button" className="primary" disabled={busy} onClick={() => saveUnits(barcode.code)}>
                    Enregistrer
                  </button>
                  <button type="button" disabled={busy} onClick={() => setEditing(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
    </>
  )
}
