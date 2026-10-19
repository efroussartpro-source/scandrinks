/**
 * AttachForm.tsx — Ajouter le code scanné à un produit existant.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §7, RG-2, RG-12)
 *
 * Exemple : le code d'une canette seule, pour une fiche créée depuis le pack.
 * La liste s'ouvre filtrée sur le nom donné par Open Food Facts. Si le code
 * appartient déjà à un autre produit, on le laisse ou on le déplace ici.
 */
import { useRef, useState } from 'react'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { parseIntInRange } from '../domain/productDraft'
import type { ConfirmTarget } from '../scanner/scanFlow'
import ProductPicker from './ProductPicker'
import { suggestSearchTerm } from './search'

interface AttachFormProps {
  code: string
  preselected: Product | null
  offName: string | null
  onReady: (target: ConfirmTarget) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function AttachForm({ code, preselected, offName, onReady, onCancel, onSessionExpired }: AttachFormProps) {
  const [product, setProduct] = useState<Product | null>(preselected)
  // Un pack ajouté depuis sa canette : ses unités sont à saisir. Sinon, le plus souvent une canette : 1.
  const [units, setUnits] = useState(preselected ? '' : '1')
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  async function attach(move: boolean) {
    if (product === null || submittingRef.current) return
    const value = parseIntInRange(units, 1, 999)
    if (value === null) {
      setUnitsError('Entre 1 et 999.')
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    try {
      const result = await api.attachBarcode({ code, productId: product.id, units: value, move })
      if (result.status === 'attached') onReady({ product, units: value, code })
      else setConflict(result.productName)
    } catch (thrown) {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') onSessionExpired()
      else setFormError(apiErrorMessage(kind))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (product === null) {
    return (
      <section className="card" aria-label="Ajouter à un produit existant">
        <h2 className="card-title">Ajouter le code {code}</h2>
        <ProductPicker
          initialQuery={suggestSearchTerm(offName)}
          onPick={(picked) => {
            setProduct(picked)
            setUnits('1')
          }}
          onSessionExpired={onSessionExpired}
        />
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </section>
    )
  }

  return (
    <section className="card" aria-label="Ajouter à un produit existant">
      <h2 className="card-title">{product.name}</h2>
      <p className="muted">Code : {code}</p>
      {conflict === null ? (
        <div className="form">
          <label className="field">
            <span>Ce code vaut (unités)</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={units}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                setUnits(event.target.value)
                setUnitsError(null)
              }}
            />
            {unitsError && <span className="field-error">{unitsError}</span>}
          </label>
          {formError && (
            <p role="alert" className="message message-error">
              {formError}
            </p>
          )}
          <div className="card-actions">
            <button type="button" className="primary" disabled={submitting} onClick={() => void attach(false)}>
              Ajouter le code
            </button>
            <button type="button" disabled={submitting} onClick={onCancel}>
              Annuler
            </button>
          </div>
          {preselected === null && (
            <button type="button" disabled={submitting} onClick={() => setProduct(null)}>
              Choisir un autre produit
            </button>
          )}
        </div>
      ) : (
        <div className="form">
          <p className="message message-warning">Ce code appartient déjà à « {conflict} ».</p>
          {formError && (
            <p role="alert" className="message message-error">
              {formError}
            </p>
          )}
          <div className="card-actions">
            <button type="button" className="primary" disabled={submitting} onClick={() => void attach(true)}>
              Le déplacer ici
            </button>
            <button type="button" disabled={submitting} onClick={onCancel}>
              Le laisser
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
