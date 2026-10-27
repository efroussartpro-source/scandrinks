/**
 * StockScreen.tsx — Liste du stock (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-1, RG-8, RG-11)
 *
 * Les produits actifs par ordre alphabétique (maquette J-stock) : le stock
 * en unités à droite, et sous le nom « À racheter » ou les packs Metro ;
 * en rouge quand ils sont à racheter (stock au seuil ou en dessous, négatif
 * compris). Le filtre « Archivés » montre les produits archivés, que l'on
 * réactive depuis leur fiche. Une ligne ouvre la fiche du produit.
 * Après une suppression (RG-15), la liste revient avec « X a été supprimé. »,
 * jusqu'à l'ouverture d'une fiche ou « Nouveau produit ».
 * « Nouveau produit » crée une fiche sans scan, puis l'ouvre sans attendre
 * que le catalogue relu la contienne. « Annuler » relit aussi la liste : une
 * fiche créée malgré une réponse perdue y apparaît, et n'est pas refaite.
 */
import { useState } from 'react'
import type { Catalog } from '../app/useCatalog'
import type { Product } from '../data/api'
import { apiErrorMessage } from '../data/apiErrors'
import { formatClock } from '../domain/movements'
import { isLow, listState } from '../domain/restock'
import { formatUnits } from '../domain/stock'
import Thumb from '../photos/Thumb'
import { filterProducts } from '../products/search'
import { IconChevronRight, IconPlus, IconSearch } from '../ui/icons'
import { deletedMessage } from './deletion'
import ProductCreateForm from './ProductCreateForm'
import ProductSheet from './ProductSheet'
import './Stock.css'

interface StockScreenProps {
  catalog: Catalog
  employee: string
  onCatalogChanged: () => void
  onSessionExpired: () => void
}

export default function StockScreen({ catalog, employee, onCatalogChanged, onSessionExpired }: StockScreenProps) {
  const [query, setQuery] = useState('')
  const [archived, setArchived] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // Fiche tout juste créée : le catalogue ne la contient qu'après sa prochaine lecture.
  const [created, setCreated] = useState<Product | null>(null)
  // Nom du produit qui vient d'être supprimé : la liste le dit.
  const [deleted, setDeleted] = useState<string | null>(null)
  const { products, errorKind, updatedAt, refresh } = catalog

  if (creating) {
    return (
      <ProductCreateForm
        onCreated={(product) => {
          setCreated(product)
          setOpenId(product.id)
          setCreating(false)
          onCatalogChanged()
        }}
        onCancel={() => {
          setCreating(false)
          onCatalogChanged()
        }}
        onSessionExpired={onSessionExpired}
      />
    )
  }

  const opened =
    openId === null ? null : (products?.find((product) => product.id === openId) ?? (created?.id === openId ? created : null))
  if (opened) {
    return (
      <ProductSheet
        product={opened}
        employee={employee}
        onCatalogChanged={onCatalogChanged}
        onClose={() => setOpenId(null)}
        onDeleted={(name) => {
          setDeleted(name)
          setOpenId(null)
        }}
        onSessionExpired={onSessionExpired}
      />
    )
  }

  const inFilter = (products ?? []).filter((product) => product.archived === archived)
  const shown = filterProducts(inFilter, query)

  return (
    <section className="stock" aria-labelledby="stock-title">
      <div className="title-row">
        <h1 id="stock-title">Stock</h1>
        <button
          type="button"
          className="pill-button"
          onClick={() => {
            setDeleted(null)
            setCreating(true)
          }}
        >
          <IconPlus size={18} strokeWidth={2.4} />
          Nouveau produit
        </button>
      </div>
      {deleted && (
        <p role="status" className="message message-ok">
          {deletedMessage(deleted)}
        </p>
      )}
      <label className="search">
        <span className="visually-hidden">Rechercher un produit</span>
        <IconSearch size={18} />
        <input type="search" placeholder="Rechercher un produit" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="segmented" role="group" aria-label="Filtre">
        <button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>
          Actifs
        </button>
        <button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>
          Archivés
        </button>
      </div>
      {errorKind && (
        <div className="message message-error stock-error">
          <p role="alert">{apiErrorMessage(errorKind)}</p>
          <button type="button" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}
      {products === null && errorKind === null && <p className="muted">Chargement…</p>}
      {products !== null && inFilter.length === 0 && (
        <p className="muted">{archived ? 'Aucun produit archivé.' : "Aucun produit pour l'instant."}</p>
      )}
      {inFilter.length > 0 && shown.length === 0 && <p className="muted">Aucun produit ne correspond.</p>}
      {shown.length > 0 && (
        <ul className="group stock-list" aria-label="Produits">
          {shown.map((product) => {
            const state = listState(product)
            return (
              <li key={product.id}>
                <button
                  type="button"
                  className={!product.archived && isLow(product) ? 'row product-row stock-low' : 'row product-row'}
                  onClick={() => {
                    setDeleted(null)
                    setOpenId(product.id)
                  }}
                >
                  <Thumb path={product.photoPath} size={44} />
                  <span className="row-text">
                    <span className="product-name">{product.name}</span>
                    {state !== null && <span className="product-state">{state}</span>}
                  </span>
                  <span className="product-stock">{formatUnits(product.stock)}</span>
                  <span className="chevron">
                    <IconChevronRight size={18} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {updatedAt && <p className="note stock-updated">Mis à jour à {formatClock(updatedAt)}</p>}
    </section>
  )
}
