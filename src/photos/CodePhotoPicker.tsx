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
 * Le sujet nomme le cadre : un code seul, ou, à la création depuis un pack,
 * le pack et sa canette, chacun dans son cadre (jalon 6).
 */
import { useEffect, useState } from 'react'
import { IconCamera } from '../ui/icons'
import Thumb from './Thumb'

const CAMERA_NOT_READY_MESSAGE = "La caméra n'est pas prête : réessaie dans un instant."

export type PhotoSubject = 'code' | 'pack' | 'canette'

// Les textes de chaque cadre : son nom (lu par VoiceOver), son titre sans image, puis l'aide sans image, après la photo
// et avec l'image d'Open Food Facts.
const SUBJECTS: Record<PhotoSubject, { group: string; title: string; help: string; taken: string; found: string }> = {
  code: {
    group: 'Photo du code',
    title: 'Photo',
    help: "Facultatif : vise le pack ou la canette, sans personne dans l'image, puis touche le bouton.",
    taken: 'Elle sera gardée avec ce code.',
    found: 'Image : Open Food Facts. Elle sera gardée avec ce code.',
  },
  pack: {
    group: 'Photo du pack',
    title: 'Photo du pack',
    help: "Facultatif : vise le pack, sans personne dans l'image, puis touche le bouton.",
    taken: 'Elle sera gardée avec le code du pack.',
    found: 'Image : Open Food Facts. Elle sera gardée avec le code du pack.',
  },
  canette: {
    group: 'Photo de la canette',
    title: 'Photo de la canette',
    help: "Facultatif : vise la canette, sans personne dans l'image, puis touche le bouton.",
    taken: 'Elle sera gardée avec le code de la canette.',
    found: 'Image : Open Food Facts. Elle sera gardée avec le code de la canette.',
  },
}

interface CodePhotoPickerProps {
  // 'code' par défaut : un code seul.
  subject?: PhotoSubject
  offImageUrl: string | null
  teamPhoto: Blob | null
  onTeamPhoto: (jpeg: Blob | null) => void
  takeFrame: () => Promise<Blob | null>
  disabled: boolean
  // L'image d'Open Food Facts ne se charge pas : le formulaire ne l'enregistrera pas.
  onOffImageError?: () => void
}

export default function CodePhotoPicker({
  subject = 'code',
  offImageUrl,
  teamPhoto,
  onTeamPhoto,
  takeFrame,
  disabled,
  onOffImageError,
}: CodePhotoPickerProps) {
  const texts = SUBJECTS[subject]
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
          <span className="photo-picker-help">{texts.taken}</span>
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
          <span className="photo-picker-help">{texts.found}</span>
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
          <span className="photo-picker-title">{texts.title}</span>
          <span className="photo-picker-help">{texts.help}</span>
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
      <div className="photo-picker" role="group" aria-label={texts.group} data-empty={(teamPhoto === null && offImage === null) || undefined}>
        {content}
      </div>
      {cameraError && <p className="field-error">{CAMERA_NOT_READY_MESSAGE}</p>}
    </>
  )
}
