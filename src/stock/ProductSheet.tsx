/**
 * ProductSheet.tsx — Fiche produit : chiffres, codes et derniers mouvements (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-8, RG-11)
 *
 * Les codes et les 20 derniers mouvements sont relus à l'ouverture et quand le
 * stock change. On archive au lieu de supprimer : le produit disparaît des
 * listes, son historique reste, et il se réactive ici ou en scannant un de ses
 * codes.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Product, ProductDetail } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { isLow } from '../domain/restock'
import { formatStock } from '../domain/stock'
import MovementList from './MovementList'

interface ProductSheetProps {
  product: Product
  employee: string
  onCatalogChanged: () => void
  onClose: () => void
  onSessionExpired: () => void
}

export default function ProductSheet({ product, onCatalogChanged, onClose, onSessionExpired }: ProductSheetProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = useCallback(
    (thrown: unknown) => {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') onSessionExpired()
      else setError(apiErrorMessage(kind))
    },
    [onSessionExpired],
  )

  useEffect(() => {
    let active = true
    api.getProductDetail(product.id).then(
      (loaded) => {
        if (!active) return
        setDetail(loaded)
        setError(null)
      },
      (thrown: unknown) => {
        if (active) fail(thrown)
      },
    )
    return () => {
      active = false
    }
  }, [product.id, product.stock, fail])

  async function changeArchived(archived: boolean) {
    if (archived && !window.confirm(`Archiver « ${product.name} » ? Il disparaîtra des listes ; son historique est gardé.`)) return
    setBusy(true)
    setError(null)
    try {
      await api.setArchived(product.id, archived)
      onCatalogChanged()
      if (archived) onClose()
    } catch (thrown) {
      fail(thrown)
    } finally {
      setBusy(false)
    }
  }

  const low = !product.archived && isLow(product)

  return (
    <section className="card product-sheet" aria-label="Fiche produit">
      <h2 className="card-title">{product.name}</h2>
      <p className={low ? 'sheet-stock stock-low' : 'sheet-stock'}>Stock : {formatStock(product.stock, product.packSize)}</p>
      <p className="muted sheet-figures">
        <span>Pack Metro : {product.packSize}</span> · <span>Seuil : {product.alertThreshold}</span> ·{' '}
        <span>Stock idéal : {product.targetStock}</span>
      </p>
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}

      <h3>Codes</h3>
      {detail === null && <p className="muted">Chargement…</p>}
      {detail !== null && detail.barcodes.length === 0 && <p className="muted">Aucun code : utilise « Saisie manuelle » au Scanner.</p>}
      {detail !== null && detail.barcodes.length > 0 && (
        <ul className="code-list" aria-label="Codes">
          {detail.barcodes.map((barcode) => (
            <li key={barcode.code}>
              {barcode.code} — {barcode.units} {barcode.units > 1 ? 'unités' : 'unité'}
            </li>
          ))}
        </ul>
      )}

      <h3>Derniers mouvements</h3>
      {detail !== null && <MovementList movements={detail.movements} />}

      {product.archived ? (
        <>
          <p className="message message-warning">Ce produit est archivé.</p>
          <button type="button" className="primary" disabled={busy} onClick={() => void changeArchived(false)}>
            Réactiver
          </button>
        </>
      ) : (
        <button type="button" disabled={busy} onClick={() => void changeArchived(true)}>
          Archiver
        </button>
      )}
      <button type="button" onClick={onClose}>
        Retour
      </button>
    </section>
  )
}
