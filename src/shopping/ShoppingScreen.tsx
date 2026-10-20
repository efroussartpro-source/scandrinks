/**
 * ShoppingScreen.tsx — Liste « À racheter » (RG-5, RG-6).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3)
 *
 * Une ligne par produit au seuil ou en dessous, avec le nombre de packs à
 * prendre chez Metro. Les ruptures passent en premier. L'heure de la dernière
 * lecture rassure avant de partir chez Metro.
 */
import type { Catalog } from '../app/useCatalog'
import { apiErrorMessage } from '../data/apiErrors'
import { formatClock } from '../domain/movements'
import { describeShoppingLine, shoppingList } from '../domain/restock'
import './Shopping.css'

interface ShoppingScreenProps {
  catalog: Catalog
}

export default function ShoppingScreen({ catalog }: ShoppingScreenProps) {
  const { products, errorKind, updatedAt, refresh } = catalog
  const lines = products ? shoppingList(products) : []

  return (
    <section className="shopping" aria-labelledby="shopping-title">
      <h1 id="shopping-title">À racheter</h1>
      {errorKind && (
        <div className="message message-error shopping-error">
          <p role="alert">{apiErrorMessage(errorKind)}</p>
          <button type="button" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}
      {products === null && errorKind === null && <p className="muted">Chargement…</p>}
      {products !== null && lines.length === 0 && <p className="muted">Rien à racheter pour l'instant.</p>}
      {lines.length > 0 && (
        <ul className="shopping-list" aria-label="À racheter">
          {lines.map((line) => (
            <li key={line.product.id} className={line.product.stock <= 0 ? 'out-of-stock' : undefined}>
              {describeShoppingLine(line)}
            </li>
          ))}
        </ul>
      )}
      {updatedAt && <p className="muted">Mis à jour à {formatClock(updatedAt)}</p>}
    </section>
  )
}
