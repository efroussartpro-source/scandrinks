/**
 * restock.ts — Liste « À racheter » (RG-5, RG-6).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.3, §5)
 *
 * Un produit actif est à racheter quand son stock est au seuil ou en dessous.
 * Il faut alors stock idéal − max(stock, 0), arrondi au pack Metro supérieur :
 * « Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24 ». Un stock négatif
 * compte pour 0 et la ligne porte « stock à vérifier ». Les ruptures (stock
 * ≤ 0) passent en premier. À l'écran, la ligne se lit en morceaux : le reste
 * sous le nom, « 2 packs » dans une pastille, « de 24 » dessous ; la phrase
 * entière reste le nom de la ligne pour VoiceOver.
 */
import type { Product } from '../data/api'
import { compareNames } from './names'
import { formatPacks, formatUnits } from './stock'

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

const buyAmount = ({ toBuy, unit }: RestockLine) =>
  unit === 'pack' ? `${toBuy} ${toBuy > 1 ? 'packs' : 'pack'}` : `${toBuy} ${toBuy > 1 ? 'unités' : 'unité'}`

export function describeShoppingLine(line: RestockLine): string {
  const { product, unit, checkStock } = line
  const what = unit === 'pack' ? `${buyAmount(line)} de ${product.packSize}` : buyAmount(line)
  // Le reste se dit en unités seules, comme dans l'exemple de la spec.
  const parts = [product.name, `reste ${formatUnits(product.stock)}`, `prendre ${what}`]
  if (checkStock) parts.push('stock à vérifier')
  return parts.join(' — ')
}

// Ligne d'À racheter : « Reste 10 », « 2 packs » et « de 24 ».
export function shoppingParts(line: RestockLine): { rest: string; amount: string; note: string } {
  const { product, unit, checkStock } = line
  return {
    rest: `Reste ${formatUnits(product.stock)}${checkStock ? ' · stock à vérifier' : ''}`,
    amount: buyAmount(line),
    note: unit === 'pack' ? `de ${product.packSize}` : "à l'unité",
  }
}

// Sous le titre d'À racheter : « 3 produits · mis à jour à 12:03 ».
export function shoppingSummary(count: number, clock: string): string {
  if (count === 0) return `Mis à jour à ${clock}`
  return `${count} ${count > 1 ? 'produits' : 'produit'} · mis à jour à ${clock}`
}

// Sous le nom, dans la liste du Stock : « À racheter » pour un produit actif au seuil, sinon ses packs.
export function listState(product: Product): string | null {
  if (!product.archived && isLow(product)) return product.stock < 0 ? 'À racheter · stock à vérifier' : 'À racheter'
  return formatPacks(product.stock, product.packSize)
}
