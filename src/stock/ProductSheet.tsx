/**
 * ProductSheet.tsx — Fiche produit : chiffres, codes et derniers mouvements (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-4, RG-7, RG-8, RG-11)
 *
 * Les codes et les 20 derniers mouvements sont relus à l'ouverture, quand le
 * stock change et après un changement de code. Depuis la fiche d'un produit
 * actif, on le modifie, on gère ses codes et on corrige son stock : chaque
 * formulaire prend la place de la fiche, puis y revient. Ce qui vient d'être
 * enregistré s'affiche tout de suite, sans attendre la relecture du catalogue,
 * même si elle échoue. On archive au lieu de supprimer : le produit disparaît
 * des listes, son historique reste, et il se réactive ici ou en scannant un
 * de ses codes. Un produit archivé se consulte sans se modifier.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product, ProductDetail } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { isLow } from '../domain/restock'
import { formatStock } from '../domain/stock'
import CorrectStockForm from '../inventory/CorrectStockForm'
import AddCodeForm from './AddCodeForm'
import CodeList from './CodeList'
import MovementList from './MovementList'
import ProductEditForm from './ProductEditForm'

type Panel = 'edit' | 'add_code' | 'correct_stock' | null

interface ProductSheetProps {
  product: Product
  employee: string
  onCatalogChanged: () => void
  onClose: () => void
  onSessionExpired: () => void
}

export default function ProductSheet({ product: fromCatalog, employee, onCatalogChanged, onClose, onSessionExpired }: ProductSheetProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [codesVersion, setCodesVersion] = useState(0)
  // Fiche renvoyée par le dernier enregistrement, valable tant que le catalogue n'a pas été relu.
  const [saved, setSaved] = useState<{ over: Product; product: Product } | null>(null)
  const catalogProduct = useRef(fromCatalog)
  useEffect(() => {
    catalogProduct.current = fromCatalog
  })
  const product = saved !== null && saved.over === fromCatalog ? saved.product : fromCatalog

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
  }, [product.id, product.stock, codesVersion, fail])

  function show(next: Product) {
    setSaved({ over: catalogProduct.current, product: next })
    onCatalogChanged()
  }

  function open(next: Panel) {
    setNotice(null)
    setError(null)
    setPanel(next)
  }

  async function changeArchived(archived: boolean) {
    if (archived && !window.confirm(`Archiver « ${product.name} » ? Il disparaîtra des listes ; son historique est gardé.`)) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      show(await api.setArchived(product.id, archived))
      if (archived) onClose()
    } catch (thrown) {
      fail(thrown)
    } finally {
      setBusy(false)
    }
  }

  if (panel === 'edit') {
    return (
      <ProductEditForm
        product={product}
        onSaved={(next) => {
          show(next)
          setPanel(null)
        }}
        onCancel={() => setPanel(null)}
        onSessionExpired={onSessionExpired}
      />
    )
  }
  if (panel === 'add_code') {
    return (
      <AddCodeForm
        product={product}
        onDone={() => {
          setCodesVersion((version) => version + 1)
          setPanel(null)
        }}
        onCancel={() => setPanel(null)}
        onSessionExpired={onSessionExpired}
      />
    )
  }
  if (panel === 'correct_stock') {
    return (
      <CorrectStockForm
        product={product}
        employee={employee}
        onDone={(stock) => {
          show({ ...product, stock })
          setNotice(`Stock corrigé : ${formatStock(stock, product.packSize)}`)
          setPanel(null)
        }}
        onCancel={() => setPanel(null)}
        onSessionExpired={onSessionExpired}
      />
    )
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
      {notice && (
        <p role="status" className="message message-ok">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
      {!product.archived && (
        <div className="sheet-actions">
          <button type="button" onClick={() => open('correct_stock')}>
            Corriger le stock
          </button>
          <button type="button" onClick={() => open('edit')}>
            Modifier
          </button>
        </div>
      )}

      <h3>Codes</h3>
      {detail === null && <p className="muted">Chargement…</p>}
      {detail !== null && detail.barcodes.length === 0 && <p className="muted">Aucun code : utilise « Saisie manuelle » au Scanner.</p>}
      {detail !== null && detail.barcodes.length > 0 && (
        <CodeList
          product={product}
          barcodes={detail.barcodes}
          readOnly={product.archived}
          onChanged={() => setCodesVersion((version) => version + 1)}
          onSessionExpired={onSessionExpired}
        />
      )}
      {!product.archived && (
        <button type="button" onClick={() => open('add_code')}>
          Ajouter un code
        </button>
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
