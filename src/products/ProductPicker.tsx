/**
 * ProductPicker.tsx — Liste des produits actifs, avec recherche.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * Utilisée pour ajouter un code à un produit existant et pour la saisie
 * manuelle. La recherche peut démarrer pré-remplie (nom Open Food Facts).
 */
import { useEffect, useState } from 'react'
import type { Product } from '../data/api'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { productsForSearch } from './search'

interface ProductPickerProps {
  initialQuery: string
  onPick: (product: Product) => void
  onSessionExpired: () => void
}

export default function ProductPicker({ initialQuery, onPick, onSessionExpired }: ProductPickerProps) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    let active = true
    api.listProducts().then(
      (list) => {
        if (active) setProducts(list)
      },
      (thrown: unknown) => {
        const kind = classifyApiError(thrown).kind
        if (kind === 'session') onSessionExpired()
        else if (active) setError(apiErrorMessage(kind))
      },
    )
    return () => {
      active = false
    }
  }, [onSessionExpired])

  const { products: shown, widened } = products ? productsForSearch(products, query, initialQuery) : { products: [], widened: false }

  return (
    <div className="picker">
      <label className="field">
        <span>Rechercher un produit</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
      {!error && products === null && <p className="muted">Chargement…</p>}
      {products !== null && products.length === 0 && (
        <p className="muted">Aucun produit pour l'instant : crée d'abord la fiche avec « Nouveau produit ».</p>
      )}
      {widened && <p className="muted">Aucun produit ne contient « {initialQuery} » : voici tous les produits.</p>}
      {products !== null && products.length > 0 && shown.length === 0 && <p className="muted">Aucun produit ne correspond.</p>}
      {shown.length > 0 && (
        <ul className="product-list">
          {shown.map((product) => (
            <li key={product.id}>
              <button type="button" onClick={() => onPick(product)}>
                {product.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
