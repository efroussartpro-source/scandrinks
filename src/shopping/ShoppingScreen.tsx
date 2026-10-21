/**
 * ShoppingScreen.tsx — Liste « À racheter » (RG-5, RG-6).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3)
 *
 * Une ligne par produit au seuil ou en dessous, avec le nombre de packs à
 * prendre chez Metro dans une pastille (maquettes A-racheter, N-racheter).
 * Les ruptures passent en premier, en rouge. Le nombre de produits et
 * l'heure de la dernière lecture, sous le titre, rassurent avant de partir
 * chez Metro. Une ligne ouvre la fiche du produit (pour « Corriger le
 * stock » quand il est à vérifier) ; VoiceOver la lit en une phrase.
 */
import { useState } from 'react'
import type { Catalog } from '../app/useCatalog'
import { apiErrorMessage } from '../data/apiErrors'
import { formatClock } from '../domain/movements'
import { describeShoppingLine, shoppingList, shoppingParts, shoppingSummary } from '../domain/restock'
import ProductSheet from '../stock/ProductSheet'
import { IconChevronRight, IconTriangleAlert } from '../ui/icons'
import './Shopping.css'

interface ShoppingScreenProps {
  catalog: Catalog
  employee: string
  onCatalogChanged: () => void
  onSessionExpired: () => void
}

export default function ShoppingScreen({ catalog, employee, onCatalogChanged, onSessionExpired }: ShoppingScreenProps) {
  const { products, errorKind, updatedAt, refresh } = catalog
  const [openId, setOpenId] = useState<string | null>(null)

  const opened = openId === null ? null : (products?.find((product) => product.id === openId) ?? null)
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

  const lines = products ? shoppingList(products) : []

  return (
    <section className="shopping" aria-labelledby="shopping-title">
      <div className="shopping-head">
        <h1 id="shopping-title">À racheter</h1>
        {updatedAt && <p className="subtitle">{shoppingSummary(lines.length, formatClock(updatedAt))}</p>}
      </div>
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
        <>
          <ul className="group shopping-list" aria-label="À racheter">
            {lines.map((line) => {
              const { rest, amount, note } = shoppingParts(line)
              const outOfStock = line.product.stock <= 0
              return (
                <li key={line.product.id}>
                  <button
                    type="button"
                    className={outOfStock ? 'row out-of-stock' : 'row'}
                    aria-label={describeShoppingLine(line)}
                    onClick={() => setOpenId(line.product.id)}
                  >
                    <span className="row-text">
                      <span className="row-title">{line.product.name}</span>
                      <span className="row-sub">
                        {outOfStock && <IconTriangleAlert size={15} strokeWidth={2.2} />}
                        <span>{rest}</span>
                      </span>
                    </span>
                    <span className="buy">
                      <span className="buy-amount">{amount}</span>
                      <span className="buy-note">{note}</span>
                    </span>
                    <span className="chevron">
                      <IconChevronRight size={18} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="note">Touche un produit pour ouvrir sa fiche.</p>
        </>
      )}
    </section>
  )
}
