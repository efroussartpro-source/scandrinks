/**
 * ProductCreateForm.tsx — Nouveau produit sans code-barres, depuis le Stock (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-7)
 *
 * Pour une boisson sans code lisible, comptée ensuite en « Saisie manuelle ».
 * Le seuil et le stock idéal suivent le pack Metro tant qu'on ne les a pas
 * touchés, comme au Scanner. L'identifiant est tiré à l'ouverture : une
 * création rejouée après une réponse perdue renvoie la fiche déjà créée.
 */
import { useRef, useState } from 'react'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { newDraft, updateDraft, validateProductFields, type ProductDraft, type ProductFields } from '../domain/productDraft'
import ProductFieldInputs from './ProductFieldInputs'

interface ProductCreateFormProps {
  onCreated: (product: Product) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function ProductCreateForm({ onCreated, onCancel, onSessionExpired }: ProductCreateFormProps) {
  const [draft, setDraft] = useState<ProductDraft>(() => newDraft(''))
  const [errors, setErrors] = useState<Partial<Record<keyof ProductFields, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [productId] = useState(() => crypto.randomUUID())

  function change(field: keyof ProductFields, value: string) {
    setDraft((current) => updateDraft(current, field, value))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function create() {
    if (submittingRef.current) return
    const checked = validateProductFields(draft)
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    try {
      onCreated(await api.createProduct({ id: productId, ...checked.product, barcodes: [] }))
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
    <section className="card" aria-label="Nouveau produit">
      <h2 className="card-title">Nouveau produit</h2>
      <p className="muted">Pour un produit dont le code ne se lit pas. Tu pourras taper ses chiffres ensuite, avec « Ajouter un code ».</p>
      <div className="form">
        <ProductFieldInputs values={draft} errors={errors} disabled={submitting} onChange={change} />
        {formError && (
          <p role="alert" className="message message-error">
            {formError}
          </p>
        )}
        <div className="card-actions">
          <button type="button" className="primary" disabled={submitting} onClick={() => void create()}>
            {submitting ? 'Création…' : 'Créer le produit'}
          </button>
          <button type="button" disabled={submitting} onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </section>
  )
}
