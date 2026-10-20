/**
 * ProductEditForm.tsx — Modifier le nom, le pack Metro, le seuil et le stock idéal (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-5 à RG-7)
 *
 * Les champs partent de la fiche. Ici, le seuil et le stock idéal ne suivent
 * pas le pack Metro : ils ont déjà été choisis, on ne les écrase pas. Le
 * stock idéal doit dépasser le seuil, vérifié avant l'envoi. Renvoyer la même
 * modification après une réponse perdue ne change rien de plus.
 */
import { useRef, useState } from 'react'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { validateProductFields, type ProductFields } from '../domain/productDraft'
import ProductFieldInputs from './ProductFieldInputs'

interface ProductEditFormProps {
  product: Product
  onSaved: (product: Product) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function ProductEditForm({ product, onSaved, onCancel, onSessionExpired }: ProductEditFormProps) {
  const [fields, setFields] = useState<ProductFields>(() => ({
    name: product.name,
    packSize: String(product.packSize),
    alertThreshold: String(product.alertThreshold),
    targetStock: String(product.targetStock),
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFields, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  function change(field: keyof ProductFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function save() {
    if (submittingRef.current) return
    const checked = validateProductFields(fields)
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      onSaved(await api.updateProduct({ id: product.id, ...checked.product }))
    } catch (thrown) {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') onSessionExpired()
      else setFormError(apiErrorMessage(kind))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <section className="card" aria-label="Modifier le produit">
      <h2 className="card-title">Modifier le produit</h2>
      <div className="form">
        <ProductFieldInputs values={fields} errors={errors} disabled={submitting} onChange={change} />
        {formError && (
          <p role="alert" className="message message-error">
            {formError}
          </p>
        )}
        <div className="card-actions">
          <button type="button" className="primary" disabled={submitting} onClick={() => void save()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" disabled={submitting} onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </section>
  )
}
