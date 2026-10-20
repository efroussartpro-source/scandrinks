/**
 * CorrectStockForm.tsx — « Corriger le stock » depuis la fiche produit (RG-4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §7, RG-4, RG-8)
 *
 * L'inventaire de ce seul produit, avec la saisie du mode Inventaire : on
 * compte en packs Metro + unités, et la base enregistre l'écart avec le stock
 * du moment. L'identifiant est tiré à l'ouverture. Pendant l'envoi et après
 * un échec, les champs ne changent plus : « Réessayer » renvoie le même
 * comptage avec le même identifiant, sans doublon si la réponse s'était
 * perdue.
 */
import { useRef, useState } from 'react'
import type { Product } from '../data/api'
import { classifyApiError, saveErrorMessage, type ApiErrorKind } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { parseCount } from '../domain/inventory'
import CountFields from './CountFields'

type Status = 'idle' | 'saving' | 'failed'

interface CorrectStockFormProps {
  product: Product
  employee: string
  onDone: (stock: number) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function CorrectStockForm({ product, employee, onDone, onCancel, onSessionExpired }: CorrectStockFormProps) {
  const [movementId] = useState(() => crypto.randomUUID())
  const [packsText, setPacksText] = useState('')
  const [unitsText, setUnitsText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorKind, setErrorKind] = useState<ApiErrorKind | null>(null)
  const sendingRef = useRef(false)
  const parsed = parseCount(packsText, unitsText, product.packSize)

  async function validate() {
    if (sendingRef.current || !parsed.ok) return
    sendingRef.current = true
    setStatus('saving')
    setErrorKind(null)
    try {
      const result = await api.recordInventory({ id: movementId, productId: product.id, counted: parsed.counted, employee })
      onDone(result.stock)
    } catch (thrown) {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') {
        onSessionExpired()
        return
      }
      setErrorKind(kind)
      setStatus('failed')
    } finally {
      sendingRef.current = false
    }
  }

  return (
    <section className="card correct-stock" aria-label="Corriger le stock">
      <h2 className="card-title">Corriger le stock</h2>
      <p className="muted">{product.name}</p>
      <CountFields
        packSize={product.packSize}
        knownStock={product.stock}
        packsText={packsText}
        unitsText={unitsText}
        disabled={status !== 'idle'}
        onChange={(packs, units) => {
          setPacksText(packs)
          setUnitsText(units)
        }}
      />
      {status === 'failed' && errorKind && (
        <p role="alert" className="message message-error">
          {saveErrorMessage(errorKind)}
        </p>
      )}
      <div className="card-actions">
        <button type="button" className="primary" disabled={status === 'saving' || !parsed.ok} onClick={() => void validate()}>
          {status === 'saving' ? 'Enregistrement…' : status === 'failed' ? 'Réessayer' : 'Valider'}
        </button>
        <button type="button" disabled={status === 'saving'} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </section>
  )
}
