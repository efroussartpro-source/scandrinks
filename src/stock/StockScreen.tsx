/**
 * StockScreen.tsx — Liste du stock (§4.4).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, RG-1, RG-8, RG-11)
 *
 * Les produits actifs par ordre alphabétique, avec le stock en packs Metro ;
 * en rouge quand ils sont à racheter (stock au seuil ou en dessous, négatif
 * compris). Le filtre « Archivés » montre les produits archivés, que l'on
 * réactive depuis leur fiche. Une ligne ouvre la fiche du produit.
 * « Nouveau produit » crée une fiche sans scan, puis l'ouvre sans attendre
 * que le catalogue relu la contienne.
 */
import { useState } from 'react'
import type { Catalog } from '../app/useCatalog'
import type { Product } from '../data/api'
import { apiErrorMessage } from '../data/apiErrors'
import { isLow } from '../domain/restock'
import { formatStock } from '../domain/stock'
import { filterProducts } from '../products/search'
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
  const { products, errorKind, refresh } = catalog

  if (creating) {
    return (
      <ProductCreateForm
        onCreated={(product) => {
          setCreated(product)
          setOpenId(product.id)
          setCreating(false)
          onCatalogChanged()
        }}
        onCancel={() => setCreating(false)}
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
        onSessionExpired={onSessionExpired}
      />
    )
  }

  const inFilter = (products ?? []).filter((product) => product.archived === archived)
  const shown = filterProducts(inFilter, query)

  return (
    <section className="stock" aria-labelledby="stock-title">
      <h1 id="stock-title">Stock</h1>
      <label className="field">
        <span>Rechercher un produit</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button type="button" onClick={() => setCreating(true)}>
        Nouveau produit
      </button>
      <div className="choices" role="group" aria-label="Filtre">
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
        <ul className="stock-list" aria-label="Produits">
          {shown.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                className={!product.archived && isLow(product) ? 'product-row stock-low' : 'product-row'}
                onClick={() => setOpenId(product.id)}
              >
                <span className="product-name">{product.name}</span>
                <span className="product-stock">{formatStock(product.stock, product.packSize)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
