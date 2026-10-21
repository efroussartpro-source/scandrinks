/**
 * CodePhotoPicker.tsx — Photo d'un code, dans les formulaires du Scanner.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.6)
 *
 * Trois états (maquettes I-photo et I-off) : la photo prise par l'équipe,
 * sinon l'image trouvée par Open Food Facts, sinon rien. La photo se prend
 * avec la caméra du Scanner, ouverte au-dessus du formulaire : on vise le
 * pack, puis on touche le bouton. Une image d'Open Food Facts qui ne se
 * charge pas compte comme absente. Facultative : sans photo, rien ne change.
 */
import { useEffect, useState } from 'react'
import { IconCamera } from '../ui/icons'
import Thumb from './Thumb'

const CAMERA_NOT_READY_MESSAGE = "La caméra n'est pas prête : réessaie dans un instant."

interface CodePhotoPickerProps {
  offImageUrl: string | null
  teamPhoto: Blob | null
  onTeamPhoto: (jpeg: Blob | null) => void
  takeFrame: () => Promise<Blob | null>
  disabled: boolean
  // L'image d'Open Food Facts ne se charge pas : le formulaire ne l'enregistrera pas.
  onOffImageError?: () => void
}

export default function CodePhotoPicker({ offImageUrl, teamPhoto, onTeamPhoto, takeFrame, disabled, onOffImageError }: CodePhotoPickerProps) {
  const [failedOffImage, setFailedOffImage] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [taking, setTaking] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  // Aperçu de la photo prise : une adresse locale, libérée quand la photo change.
  useEffect(() => {
    if (teamPhoto === null) return
    const url = URL.createObjectURL(teamPhoto)
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [teamPhoto])

  async function take() {
    setTaking(true)
    setCameraError(false)
    try {
      const jpeg = await takeFrame()
      if (jpeg) onTeamPhoto(jpeg)
      else setCameraError(true)
    } catch {
      setCameraError(true)
    } finally {
      setTaking(false)
    }
  }

  const busy = disabled || taking
  const offImage = offImageUrl !== null && failedOffImage !== offImageUrl ? offImageUrl : null

  let content
  if (teamPhoto !== null) {
    content = (
      <>
        <Thumb src={preview} size={72} />
        <span className="photo-picker-text">
          <span className="photo-picker-title">Photo prise</span>
          <span className="photo-picker-help">Elle sera gardée avec ce code.</span>
          <span className="photo-picker-actions">
            <button type="button" className="link" disabled={busy} onClick={() => void take()}>
              Reprendre
            </button>
            <button type="button" className="link" disabled={busy} onClick={() => onTeamPhoto(null)}>
              Retirer
            </button>
          </span>
        </span>
      </>
    )
  } else if (offImage !== null) {
    content = (
      <>
        <Thumb
          src={offImage}
          size={72}
          onError={() => {
            setFailedOffImage(offImage)
            onOffImageError?.()
          }}
        />
        <span className="photo-picker-text">
          <span className="photo-picker-title">Image trouvée</span>
          <span className="photo-picker-help">Image : Open Food Facts. Elle sera gardée avec ce code.</span>
          <span className="photo-picker-actions">
            <button type="button" className="link" disabled={busy} onClick={() => void take()}>
              <IconCamera size={18} />
              Prendre ma photo à la place
            </button>
          </span>
        </span>
      </>
    )
  } else {
    content = (
      <>
        <span className="thumb thumb-empty" aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 12 }}>
          <IconCamera size={30} strokeWidth={1.8} />
        </span>
        <span className="photo-picker-text">
          <span className="photo-picker-title">Photo</span>
          <span className="photo-picker-help">Facultatif : vise le pack ou la canette, sans personne dans l'image, puis touche le bouton.</span>
          <button type="button" className="photo-take" disabled={busy} onClick={() => void take()}>
            <IconCamera size={18} />
            Prendre la photo
          </button>
        </span>
      </>
    )
  }

  return (
    <>
      <div className="photo-picker" role="group" aria-label="Photo du code" data-empty={(teamPhoto === null && offImage === null) || undefined}>
        {content}
      </div>
      {cameraError && <p className="field-error">{CAMERA_NOT_READY_MESSAGE}</p>}
    </>
  )
}
