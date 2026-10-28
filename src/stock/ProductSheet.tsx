/**
 * ProductSheet.tsx — Fiche produit : chiffres, codes et derniers mouvements (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-4, RG-7, RG-8, RG-11)
 *
 * De haut en bas (maquette C1-Fiche) : « Retour », la grande photo, le nom,
 * le stock en très gros avec ce qu'il faut racheter, les packs et les trois
 * chiffres, les actions, les codes avec leur photo, les derniers mouvements,
 * puis « Archiver le produit » (ou « Réactiver ») et « Supprimer le produit »
 * dans une carte à part.
 * Les codes et les 20 derniers mouvements sont relus à l'ouverture, quand le
 * stock change et après un changement de code. Depuis la fiche d'un produit
 * actif, on le modifie, on gère ses codes et on corrige son stock : chaque
 * formulaire prend la place de la fiche, puis y revient. Ce qui vient d'être
 * enregistré s'affiche tout de suite, sans attendre la relecture du catalogue,
 * même si elle échoue. Une lecture impossible garde son message et
 * « Réessayer » jusqu'à une lecture réussie, même si un panneau s'ouvre puis
 * se ferme entre-temps (s3).
 * Archiver met le produit de côté : il disparaît des listes, son historique
 * reste, et il se réactive ici ou en scannant un de ses codes. Un produit
 * archivé se consulte sans se modifier. Supprimer, après confirmation, efface
 * pour de bon le produit, ses codes et tout son historique (RG-15, jalon 6) ;
 * la liste d'où la fiche avait été ouverte le dit ensuite.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Product, ProductDetail } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { isLow, tileState } from '../domain/restock'
import { formatPacks, formatStock, formatUnits } from '../domain/stock'
import CorrectStockForm from '../inventory/CorrectStockForm'
import Thumb from '../photos/Thumb'
import { IconChevronLeft } from '../ui/icons'
import AddCodeForm from './AddCodeForm'
import CodeList from './CodeList'
import { deleteConfirmMessage } from './deletion'
import MovementList from './MovementList'
import ProductEditForm from './ProductEditForm'

type Panel = 'edit' | 'add_code' | 'correct_stock' | null

interface ProductSheetProps {
  product: Product
  employee: string
  onCatalogChanged: () => void
  onClose: () => void
  // Le produit vient d'être supprimé (RG-15) : la liste se rouvre et le dit, à la place de onClose.
  onDeleted: (name: string) => void
  onSessionExpired: () => void
}

export default function ProductSheet({
  product: fromCatalog,
  employee,
  onCatalogChanged,
  onClose,
  onDeleted,
  onSessionExpired,
}: ProductSheetProps) {
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [codesVersion, setCodesVersion] = useState(0)
  // Lecture des codes et des mouvements impossible : son message, gardé jusqu'à une lecture réussie ; « Réessayer » la relance.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
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
        setLoadError(null)
      },
      (thrown: unknown) => {
        if (!active) return
        const kind = classifyApiError(thrown).kind
        if (kind === 'session') onSessionExpired()
        else setLoadError(apiErrorMessage(kind))
      },
    )
    return () => {
      active = false
    }
  }, [product.id, product.stock, codesVersion, loadAttempt, onSessionExpired])

  // Un nouvel essai efface aussi l'erreur d'une action : masquée tant qu'elle répétait celle de la lecture, elle
  // reparaîtrait seule sur la fiche relue.
  function retryLoad() {
    setLoadError(null)
    setError(null)
    setLoadAttempt((attempt) => attempt + 1)
  }

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

  // RG-15 : pour de bon, après confirmation. Une réponse perdue laisse la fiche ouverte : le nouvel essai répond pareil.
  async function remove() {
    if (!window.confirm(deleteConfirmMessage(product.name))) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await api.deleteProduct(product.id)
      onCatalogChanged()
      onDeleted(product.name)
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
  const packs = formatPacks(product.stock, product.packSize)
  const state = tileState(product)

  return (
    <section className="product-sheet" aria-label="Fiche produit">
      <button type="button" className="link back" onClick={onClose}>
        <IconChevronLeft size={22} strokeWidth={2.4} />
        Retour
      </button>
      <div className="sheet-head tile-plate" aria-hidden="true">
        <Thumb path={product.photoPath} fill emptyLabel />
        {low && <span className="photo-badge">À racheter</span>}
      </div>
      <h1 className="sheet-title">{product.name}</h1>
      <section className="card sheet-stock" aria-label="Stock du produit">
        <div className="sheet-stock-top">
          <span className="sheet-stock-label">Stock</span>
          {state?.tone === 'restock' && <span className="sheet-restock">{state.text}</span>}
          {product.stock < 0 && <span className="check-badge">Stock à vérifier</span>}
        </div>
        <span className="sheet-stock-line">
          <span className={low ? 'sheet-stock-value stock-low' : 'sheet-stock-value'}>{formatUnits(product.stock)}</span>
          <span className="sheet-stock-unit">{Math.abs(product.stock) > 1 ? 'unités' : 'unité'}</span>
        </span>
        {packs !== null && <span className="sheet-stock-packs">{packs}</span>}
        <dl className="sheet-figures">
          <div>
            <dt>Pack Metro</dt>
            <dd>{product.packSize}</dd>
          </div>
          <div>
            <dt>Seuil</dt>
            <dd>{product.alertThreshold}</dd>
          </div>
          <div>
            <dt>Stock idéal</dt>
            <dd>{product.targetStock}</dd>
          </div>
        </dl>
      </section>
      {notice && (
        <p role="status" className="message message-ok">
          {notice}
        </p>
      )}
      {error && error !== loadError && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
      {loadError && (
        <>
          <p role="alert" className="message message-error">
            {loadError}
          </p>
          <button type="button" onClick={retryLoad}>
            Réessayer
          </button>
        </>
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

      <h2 className="section-title">Codes</h2>
      {detail === null ? (
        <p className="muted">Chargement…</p>
      ) : (
        <CodeList
          product={product}
          barcodes={detail.barcodes}
          readOnly={product.archived}
          onAdd={product.archived ? undefined : () => open('add_code')}
          onChanged={() => setCodesVersion((version) => version + 1)}
          onPhotoChanged={() => {
            // L'image du produit vient peut-être de ce code : le catalogue est relu aussi.
            setCodesVersion((version) => version + 1)
            onCatalogChanged()
          }}
          onSessionExpired={onSessionExpired}
        />
      )}

      <h2 className="section-title">Derniers mouvements</h2>
      {detail !== null && <MovementList movements={detail.movements} />}

      {product.archived && (
        <>
          <p className="message message-warning">Ce produit est archivé.</p>
          <button type="button" className="primary" disabled={busy} onClick={() => void changeArchived(false)}>
            Réactiver
          </button>
        </>
      )}
      {/* Les actions rares, en rouge, dans une carte à part (spec §6.7). */}
      <div className="danger-group sheet-danger">
        {!product.archived && (
          <button type="button" disabled={busy} onClick={() => void changeArchived(true)}>
            Archiver le produit
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => void remove()}>
          Supprimer le produit
        </button>
      </div>
    </section>
  )
}
