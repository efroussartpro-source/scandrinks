/**
 * restock.ts — Liste « À racheter » (RG-5, RG-6).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3, §5)
 *
 * Un produit actif est à racheter quand son stock est au seuil ou en dessous.
 * Il faut alors stock idéal − max(stock, 0), arrondi au pack Metro supérieur :
 * « Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24 ». Un stock négatif
 * compte pour 0 et la ligne porte « stock à vérifier ». Les ruptures (stock
 * ≤ 0) passent en premier.
 */
import type { Product } from '../data/api'
import { compareNames } from './names'
import { formatStock } from './stock'

export interface RestockLine {
  product: Product
  toBuy: number
  unit: 'pack' | 'unit'
  checkStock: boolean
}

export function isLow(p: Pick<Product, 'stock' | 'alertThreshold'>): boolean {
  return p.stock <= p.alertThreshold
}

export function restockLine(product: Product): RestockLine {
  const missing = product.targetStock - Math.max(product.stock, 0)
  const byPack = product.packSize > 1
  return {
    product,
    toBuy: byPack ? Math.ceil(missing / product.packSize) : missing,
    unit: byPack ? 'pack' : 'unit',
    checkStock: product.stock < 0,
  }
}

export function shoppingList(products: readonly Product[]): RestockLine[] {
  const outOfStock = (p: Product) => (p.stock <= 0 ? 0 : 1)
  return products
    .filter((p) => !p.archived && isLow(p))
    .sort((a, b) => outOfStock(a) - outOfStock(b) || compareNames(a.name, b.name))
    .map(restockLine)
}

export function describeShoppingLine(line: RestockLine): string {
  const { product, toBuy, unit, checkStock } = line
  const what =
    unit === 'pack'
      ? `${toBuy} ${toBuy > 1 ? 'packs' : 'pack'} de ${product.packSize}`
      : `${toBuy} ${toBuy > 1 ? 'unités' : 'unité'}`
  // Le reste se dit en unités seules, comme dans l'exemple de la spec.
  const parts = [product.name, `reste ${formatStock(product.stock, 1)}`, `prendre ${what}`]
  if (checkStock) parts.push('stock à vérifier')
  return parts.join(' — ')
}
