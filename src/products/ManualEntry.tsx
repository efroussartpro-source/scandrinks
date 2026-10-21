/**
 * ManualEntry.tsx — Saisie manuelle, quand le code est illisible ou absent.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * On choisit le produit, puis un pack Metro ou une unité ; la suite est la
 * même fiche de confirmation qu'après un scan. En Inventaire, on compte tout
 * le produit : le choix mène directement à la saisie du comptage.
 */
import { useState } from 'react'
import type { Product } from '../data/api'
import type { ScanMode } from '../domain/stock'
import type { ConfirmTarget } from '../scanner/scanFlow'
import ProductPicker from './ProductPicker'

interface ManualEntryProps {
  mode: ScanMode
  onReady: (target: ConfirmTarget) => void
  onCancel: () => void
  onSessionExpired: () => void
}

export default function ManualEntry({ mode, onReady, onCancel, onSessionExpired }: ManualEntryProps) {
  const [product, setProduct] = useState<Product | null>(null)

  function pick(picked: Product) {
    if (mode === 'inventory') onReady({ product: picked, units: picked.packSize, code: null, photoPath: picked.photoPath })
    else setProduct(picked)
  }

  if (product === null) {
    return (
      <section className="card" aria-label="Saisie manuelle">
        <h2 className="card-title">Saisie manuelle</h2>
        <ProductPicker initialQuery="" onPick={pick} onSessionExpired={onSessionExpired} />
        <button type="button" className="link" onClick={onCancel}>
          Annuler
        </button>
      </section>
    )
  }

  return (
    <section className="card" aria-label="Saisie manuelle">
      <h2 className="card-title">{product.name}</h2>
      {product.packSize > 1 && (
        <button type="button" className="primary" onClick={() => onReady({ product, units: product.packSize, code: null, photoPath: product.photoPath })}>
          Par pack de {product.packSize}
        </button>
      )}
      <button type="button" onClick={() => onReady({ product, units: 1, code: null, photoPath: product.photoPath })}>
        À l'unité
      </button>
      <div className="card-actions">
        <button type="button" onClick={() => setProduct(null)}>
          Autre produit
        </button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </section>
  )
}
