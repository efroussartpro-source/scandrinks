/**
 * AttachForm.tsx — Ajouter le code scanné à un produit existant.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §7, RG-2, RG-12)
 *
 * Exemple : le code d'une canette seule, pour une fiche créée depuis le pack.
 * La liste s'ouvre filtrée sur le nom donné par Open Food Facts. Si le code
 * appartient déjà à un autre produit, on le laisse ou on le déplace ici.
 * Depuis le Scanner (prop photo), une photo du code est proposée, comme pour
 * un nouveau produit ; elle part une fois le code ajouté.
 */
import { useRef, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { parseIntInRange } from '../domain/productDraft'
import { appPhotoDeps } from '../photos/appPhotoDeps'
import CodePhotoPicker from '../photos/CodePhotoPicker'
import { choosePhoto, savePhoto } from '../photos/savePhoto'
import type { ConfirmTarget } from '../scanner/scanFlow'
import { FIELD_HELP } from './fieldHelp'
import HelpField from './HelpField'
import ProductPicker from './ProductPicker'
import { suggestSearchTerm } from './search'

interface AttachFormProps {
  code: string
  preselected: Product | null
  offName: string | null
  // Depuis le Scanner : l'image d'Open Food Facts du code et la caméra, pour sa photo.
  photo?: { offImageUrl: string | null; takeFrame: () => Promise<Blob | null> }
  onReady: (target: ConfirmTarget) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function AttachForm({ code, preselected, offName, photo, onReady, onCancel, onSessionExpired }: AttachFormProps) {
  const [product, setProduct] = useState<Product | null>(preselected)
  // Un pack ajouté depuis sa canette : ses unités sont à saisir. Sinon, le plus souvent une canette : 1.
  const [units, setUnits] = useState(preselected ? '' : '1')
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [teamPhoto, setTeamPhoto] = useState<Blob | null>(null)
  const [offImageFailed, setOffImageFailed] = useState(false)
  const [sendingPhoto, setSendingPhoto] = useState(false)
  const submittingRef = useRef(false)

  const offImageUrl = photo && !offImageFailed ? photo.offImageUrl : null
  const photoChoice = choosePhoto(teamPhoto, offImageUrl)
  const addLabel = (label: string) => (sendingPhoto ? 'Envoi de la photo…' : label)

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
      if (result.status !== 'attached') {
        setConflict(result.productName)
      } else if (photoChoice === null) {
        onReady({ product, units: value, code, photoPath: null })
      } else {
        setSendingPhoto(true)
        const photoPath = await savePhoto(code, photoChoice, appPhotoDeps)
        onReady({ product, units: value, code, photoPath, ...(photoPath === null ? { photoWarning: true as const } : {}) })
      }
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
        <button type="button" className="link" onClick={onCancel}>
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
          <HelpField
            label="Ce code vaut (unités)"
            help={FIELD_HELP.codeUnits}
            error={unitsError ?? undefined}
            inputMode="numeric"
            pattern="[0-9]*"
            value={units}
            onFocus={selectAllSoon}
            onChange={(event) => {
              setUnits(event.target.value)
              setUnitsError(null)
            }}
          />
          {photo && (
            <CodePhotoPicker
              offImageUrl={offImageUrl}
              teamPhoto={teamPhoto}
              onTeamPhoto={setTeamPhoto}
              takeFrame={photo.takeFrame}
              disabled={submitting}
              onOffImageError={() => setOffImageFailed(true)}
            />
          )}
          {formError && (
            <p role="alert" className="message message-error">
              {formError}
            </p>
          )}
          <div className="card-actions">
            <button type="button" className="primary" disabled={submitting} onClick={() => void attach(false)}>
              {addLabel('Ajouter le code')}
            </button>
            <button type="button" disabled={submitting} onClick={onCancel}>
              Annuler
            </button>
          </div>
          {preselected === null && (
            <button type="button" className="link" disabled={submitting} onClick={() => setProduct(null)}>
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
              {addLabel('Le déplacer ici')}
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
