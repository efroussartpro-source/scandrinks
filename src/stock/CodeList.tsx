/**
 * CodeList.tsx — Codes d'un produit, avec ce que vaut chacun (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-2, RG-12)
 *
 * « Modifier » change le nombre d'unités comptées à chaque scan du code ;
 * « Retirer » le détache du produit, sans toucher aux mouvements passés. Les
 * boutons nomment leur code pour un lecteur d'écran. Un produit archivé
 * montre ses codes sans les boutons. Une liste groupée (maquette J-fiche) :
 * le code, ce qu'il vaut dessous, les liens à droite ; « Ajouter un code »
 * en dernière ligne. Toucher l'image d'un code ouvre l'appareil photo de
 * l'iPhone : la photo, réduite, remplace son image (maquette I-fiche).
 */
import { useRef, useState } from 'react'
import { selectAllSoon } from '../app/selectAll'
import type { BarcodeEntry, Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { parseIntInRange } from '../domain/productDraft'
import { appPhotoDeps } from '../photos/appPhotoDeps'
import { blobToJpeg } from '../photos/jpeg'
import { PHOTO_RETRY_MESSAGE, photoSourceLabel } from '../photos/photos'
import { savePhoto } from '../photos/savePhoto'
import Thumb from '../photos/Thumb'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'
import { IconPlus } from '../ui/icons'

interface CodeListProps {
  product: Product
  barcodes: BarcodeEntry[]
  readOnly?: boolean
  onAdd?: () => void
  onChanged: () => void
  // Une photo vient de remplacer l'image d'un code.
  onPhotoChanged: () => void
  onSessionExpired: () => void
}

const unitsLabel = (units: number) => `${units} ${units > 1 ? 'unités' : 'unité'}`

// Ce que vaut le code, puis d'où vient son image : « 24 unités · photo de l'équipe ».
const codeMeta = (barcode: BarcodeEntry) =>
  barcode.photoSource ? `${unitsLabel(barcode.units)} · ${photoSourceLabel(barcode.photoSource)}` : unitsLabel(barcode.units)

export default function CodeList({ product, barcodes, readOnly = false, onAdd, onChanged, onPhotoChanged, onSessionExpired }: CodeListProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [units, setUnits] = useState('')
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [sendingPhoto, setSendingPhoto] = useState(false)
  // Un seul champ « fichier » pour tous les codes : le code touché attend sa photo.
  const fileInput = useRef<HTMLInputElement>(null)
  const photoCode = useRef<string | null>(null)

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

  function choosePhoto(code: string) {
    photoCode.current = code
    setError(null)
    fileInput.current?.click()
  }

  async function sendPhoto(file: File | undefined) {
    const code = photoCode.current
    if (file === undefined || code === null || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setSendingPhoto(true)
    setError(null)
    try {
      const path = await savePhoto(code, { source: 'equipe', jpeg: await blobToJpeg(file) }, appPhotoDeps)
      if (path === null) setError(PHOTO_RETRY_MESSAGE)
      else onPhotoChanged()
    } catch {
      // Image illisible.
      setError(PHOTO_RETRY_MESSAGE)
    } finally {
      busyRef.current = false
      setBusy(false)
      setSendingPhoto(false)
    }
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
      <ul className="group code-list" aria-label="Codes">
        {barcodes.length === 0 && (
          <li className="code-empty">
            <p className="muted">Aucun code : utilise « Saisie manuelle » au Scanner.</p>
          </li>
        )}
        {barcodes.map((barcode) => (
          <li key={barcode.code} className="code-row">
            {readOnly ? (
              <Thumb path={barcode.photoPath} size={48} />
            ) : (
              <button
                type="button"
                className="thumb-button"
                aria-label={`Changer la photo du code ${barcode.code}`}
                disabled={busy}
                onClick={() => choosePhoto(barcode.code)}
              >
                <Thumb path={barcode.photoPath} size={48} />
              </button>
            )}
            <span className="row-text">
              <span className="code-value">{barcode.code}</span>
              <span className="code-meta">{codeMeta(barcode)}</span>
            </span>
            {!readOnly && editing !== barcode.code && (
              <span className="code-actions">
                <button
                  type="button"
                  className="link"
                  aria-label={`Modifier le code ${barcode.code}`}
                  disabled={busy}
                  onClick={() => startEditing(barcode)}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  className="link danger"
                  aria-label={`Retirer le code ${barcode.code}`}
                  disabled={busy}
                  onClick={() => remove(barcode.code)}
                >
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
        {onAdd && (
          <li>
            <button type="button" className="row add-row" onClick={onAdd}>
              <IconPlus size={20} strokeWidth={2.4} />
              Ajouter un code
            </button>
          </li>
        )}
      </ul>
      {!readOnly && (
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Vidé : la même photo peut être choisie de nouveau.
            event.target.value = ''
            void sendPhoto(file)
          }}
        />
      )}
      {sendingPhoto && <p className="muted">Envoi de la photo…</p>}
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
    </>
  )
}
