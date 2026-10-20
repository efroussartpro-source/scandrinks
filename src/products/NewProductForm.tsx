/**
 * NewProductForm.tsx — Fiche créée au premier scan d'un code inconnu.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, RG-7)
 *
 * Le nom vient d'Open Food Facts quand il le connaît. « Scanner une canette
 * du pack » enregistre aussi le code de l'unité ; si cette canette a déjà sa
 * fiche, l'app propose d'y ajouter le pack plutôt que de créer un doublon. Un
 * carton (ITF-14) ou un code long n'est pas pris pour une canette (m8).
 * L'identifiant de la fiche est tiré à l'ouverture : une création rejouée
 * après une réponse perdue renvoie la fiche déjà créée (m10).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import { isUnitFormat, normalizeScannedCode } from '../codes/normalize'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { newDraft, updateDraft, validateDraft, type DraftField, type ProductDraft } from '../domain/productDraft'
import { lookupProduct, type OffLookupResult } from '../off/openFoodFacts'
import type { ConfirmTarget } from '../scanner/scanFlow'
import { FIELD_HELP } from './fieldHelp'
import HelpField from './HelpField'

type CaptureHandler = (rawValue: string, format: string) => void

const NOT_A_UNIT_MESSAGE = "Vise le code d'une canette ou d'une bouteille, pas celui d'un carton."

interface NewProductFormProps {
  code: string
  off: OffLookupResult | undefined
  setCapture: (handler: CaptureHandler | null) => void
  onReady: (target: ConfirmTarget) => void
  onAttachToExisting: (product: Product) => void
  onCancel: () => void
  onSessionExpired: () => void
}

const NUMBER_FIELDS: Array<{ field: DraftField; label: string; help: string }> = [
  { field: 'codeUnits', label: 'Ce code vaut (unités)', help: FIELD_HELP.codeUnits },
  { field: 'packSize', label: 'Pack Metro (unités)', help: FIELD_HELP.packSize },
  { field: 'alertThreshold', label: "Seuil d'alerte (unités)", help: FIELD_HELP.alertThreshold },
  { field: 'targetStock', label: 'Stock idéal (unités)', help: FIELD_HELP.targetStock },
]

export default function NewProductForm(props: NewProductFormProps) {
  const { code, off, setCapture, onReady, onAttachToExisting, onCancel, onSessionExpired } = props
  const [draft, setDraft] = useState<ProductDraft>(() => newDraft(off?.status === 'found' ? off.suggestedName : ''))
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [capture, setCaptureState] = useState<'idle' | 'capturing' | 'checking'>('idle')
  const [unitCode, setUnitCode] = useState<string | null>(null)
  const [knownUnit, setKnownUnit] = useState<Product | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const unitHelpId = useId()
  const [productId] = useState(() => crypto.randomUUID())

  // Le nom d'Open Food Facts peut arriver après l'ouverture du formulaire.
  useEffect(() => {
    if (off?.status === 'found') setDraft((current) => (current.name.trim() === '' ? updateDraft(current, 'name', off.suggestedName) : current))
  }, [off])

  // Les codes lus ne doivent plus arriver au formulaire une fois fermé.
  useEffect(() => () => setCapture(null), [setCapture])

  const fillNameFromUnit = useCallback((unit: string) => {
    void lookupProduct(unit).then((result) => {
      if (result.status === 'found') {
        setDraft((current) => (current.name.trim() === '' ? updateDraft(current, 'name', result.suggestedName) : current))
      }
    })
  }, [])

  const onCaptured = useCallback(
    (rawValue: string, format: string) => {
      const normalized = normalizeScannedCode(rawValue, format)
      if (normalized.kind !== 'product' || normalized.code === code) return
      if (!isUnitFormat(format)) {
        // La capture continue : l'employé vise ensuite une canette.
        setFormError(NOT_A_UNIT_MESSAGE)
        return
      }
      setFormError(null)
      setCapture(null)
      setCaptureState('checking')
      api.lookupBarcode(normalized.code).then(
        (result) => {
          setCaptureState('idle')
          if (result.found) {
            setKnownUnit(result.product)
            setUnitCode(null)
          } else {
            setKnownUnit(null)
            setUnitCode(normalized.code)
            fillNameFromUnit(normalized.code)
          }
        },
        (thrown: unknown) => {
          setCaptureState('idle')
          const kind = classifyApiError(thrown).kind
          if (kind === 'session') onSessionExpired()
          else setFormError(apiErrorMessage(kind))
        },
      )
    },
    [code, setCapture, fillNameFromUnit, onSessionExpired],
  )

  function startCapture() {
    setFormError(null)
    setKnownUnit(null)
    setCaptureState('capturing')
    setCapture(onCaptured)
  }

  function change(field: DraftField, value: string) {
    setDraft((current) => updateDraft(current, field, value))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function create() {
    if (submittingRef.current) return
    const checked = validateDraft(draft)
    if (!checked.ok) {
      setErrors(checked.errors)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setErrors({})
    setFormError(null)
    setCapture(null)
    setCaptureState('idle')
    const barcodes = [{ code, units: checked.codeUnits }, ...(unitCode ? [{ code: unitCode, units: 1 }] : [])]
    try {
      const product = await api.createProduct({ ...checked.product, barcodes, id: productId })
      onReady({ product, units: checked.codeUnits, code })
    } catch (thrown) {
      const error = classifyApiError(thrown)
      if (error.kind === 'session') {
        onSessionExpired()
        return
      }
      setFormError(apiErrorMessage(error.kind))
      if (error.kind === 'barcode_taken' && unitCode !== null && error.detail === unitCode) setUnitCode(null)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <section className="card" aria-label="Nouveau produit">
      <h2 className="card-title">Nouveau produit</h2>
      <p className="muted">Code : {code}</p>
      <div className="form">
        <HelpField
          label="Nom"
          help={FIELD_HELP.name}
          error={errors.name}
          type="text"
          maxLength={80}
          value={draft.name}
          onChange={(event) => change('name', event.target.value)}
        />

        <div className="field">
          <button type="button" aria-describedby={unitHelpId} disabled={capture !== 'idle'} onClick={startCapture}>
            Scanner une canette du pack
          </button>
          <span id={unitHelpId} className="field-help">
            {FIELD_HELP.unitCapture}
          </span>
        </div>
        {capture === 'capturing' && <p className="message">Vise une canette ou une bouteille du pack…</p>}
        {capture === 'checking' && <p className="muted">Recherche de la canette…</p>}
        {knownUnit && (
          <div className="message message-warning">
            <p>Cette canette appartient déjà à « {knownUnit.name} ».</p>
            <button type="button" className="primary" onClick={() => onAttachToExisting(knownUnit)}>
              Ajouter ce pack à « {knownUnit.name} »
            </button>
          </div>
        )}
        {unitCode && <p className="message">Canette : {unitCode} (1 unité)</p>}

        {NUMBER_FIELDS.map(({ field, label, help }) => (
          <HelpField
            key={field}
            label={label}
            help={help}
            error={errors[field]}
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft[field]}
            onFocus={selectAllSoon}
            onChange={(event) => change(field, event.target.value)}
          />
        ))}

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
