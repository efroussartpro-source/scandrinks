/**
 * StockScreen.tsx — Le Stock, en grille de photos (§4.4, design « Vitrine »).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §6.7, RG-1, RG-8, RG-11)
 *
 * Les produits actifs par ordre alphabétique, en tuiles sur deux colonnes
 * (maquette C1-Stock) : la photo, avec la pastille « À racheter » pour un
 * produit au seuil et le stock en unités dans une pastille sombre (rouge s'il
 * est négatif) ; puis le nom, sur deux lignes au plus, et son état
 * (tileState : ce qu'il faut racheter, « Stock à vérifier », ou les packs).
 * Le bouton « Archivés », à côté de la recherche, montre les produits
 * archivés, que l'on réactive depuis leur fiche. Une tuile ouvre la fiche.
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
import { isLow, tileState } from '../domain/restock'
import { formatUnits } from '../domain/stock'
import Thumb from '../photos/Thumb'
import { filterProducts } from '../products/search'
import { IconArchive, IconPlus, IconSearch } from '../ui/icons'
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
      <div className="stock-tools">
        <label className="search">
          <span className="visually-hidden">Rechercher un produit</span>
          <IconSearch size={18} />
          <input type="search" placeholder="Rechercher un produit" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="button" className="toggle" aria-pressed={archived} onClick={() => setArchived(!archived)}>
          <IconArchive size={18} />
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
        <ul className="stock-list stock-grid" aria-label="Produits">
          {shown.map((product) => {
            const state = tileState(product)
            const low = !product.archived && isLow(product)
            // Le nom vient en premier : le nom de la tuile pour VoiceOver commence par lui. La grille pose la photo en haut.
            return (
              <li key={product.id}>
                <button
                  type="button"
                  className={low ? 'product-row stock-low' : 'product-row'}
                  onClick={() => {
                    setDeleted(null)
                    setOpenId(product.id)
                  }}
                >
                  <span className="tile-text">
                    <span className="product-name">{product.name}</span>
                    {state !== null && (
                      <span className="product-state" data-tone={state.tone}>
                        {state.text}
                      </span>
                    )}
                  </span>
                  <span className="product-stock stock-chip" data-negative={product.stock < 0 ? '' : undefined}>
                    {formatUnits(product.stock)}
                  </span>
                  <span className="tile-photo tile-plate" aria-hidden="true">
                    <Thumb path={product.photoPath} fill emptyLabel />
                    {low && <span className="photo-badge">À racheter</span>}
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
