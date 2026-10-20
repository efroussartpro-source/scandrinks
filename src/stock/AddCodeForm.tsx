/**
 * AddCodeForm.tsx — Ajouter un code tapé à la main, depuis la fiche produit (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-2, RG-13)
 *
 * Pour un code que la caméra ne lit pas. Les chiffres sont contrôlés (clé de
 * contrôle), puis ramenés à la forme d'un code scanné. La suite est celle du
 * Scanner : ce que vaut le code, puis l'ajout, ou le déplacement s'il
 * appartient déjà à un autre produit.
 */
import { useState } from 'react'
import { normalizeTypedCode } from '../codes/normalize'
import type { Product } from '../data/api'
import AttachForm from '../products/AttachForm'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'

const INVALID_CODE = 'Code invalide : vérifie les chiffres.'

interface AddCodeFormProps {
  product: Product
  onDone: () => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function AddCodeForm({ product, onDone, onCancel, onSessionExpired }: AddCodeFormProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)

  function next() {
    const normalized = normalizeTypedCode(text)
    if (normalized.kind === 'product') setCode(normalized.code)
    else setError(INVALID_CODE)
  }

  if (code !== null) {
    return <AttachForm code={code} preselected={product} offName={null} onReady={onDone} onCancel={onCancel} onSessionExpired={onSessionExpired} />
  }

  return (
    <section className="card" aria-label="Ajouter un code">
      <h2 className="card-title">Ajouter un code</h2>
      <p className="muted">{product.name}</p>
      <div className="form">
        <HelpField
          label="Code-barres"
          help={FIELD_HELP.barcode}
          error={error ?? undefined}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
        />
        <div className="card-actions">
          <button type="button" className="primary" onClick={next}>
            Continuer
          </button>
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </section>
  )
}
