/**
 * search.ts — Recherche d'un produit dans la liste, et terme proposé.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * Sert surtout à éviter les doublons : quand on scanne une canette d'un pack
 * déjà créé, la liste s'ouvre filtrée sur le premier mot du nom donné par
 * Open Food Facts (« Coca-Cola 330 ml » → « Coca-Cola »).
 */
import type { Product } from '../data/api'

// Sans casse ni accents, et la ponctuation vaut un espace : « Coca-Cola » trouve « Coca Cola ».
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function suggestSearchTerm(offName: string | null): string {
  if (!offName) return ''
  for (const word of offName.trim().split(/\s+/)) {
    if ((word.match(/\p{L}/gu) ?? []).length >= 3) return word
  }
  return ''
}

export function filterProducts(products: Product[], query: string): Product[] {
  const wanted = fold(query)
  if (wanted === '') return products
  return products.filter((product) => fold(product.name).includes(wanted))
}

// Une recherche pré-remplie qui ne trouve rien ne doit pas cacher la bonne fiche : le
// nom donné par Open Food Facts diffère souvent de celui tapé pour le pack. On montre
// alors toute la liste (moins de 30 produits), avec un avertissement.
export function productsForSearch(
  products: Product[],
  query: string,
  suggested: string,
): { products: Product[]; widened: boolean } {
  const found = filterProducts(products, query)
  if (found.length === 0 && suggested !== '' && query === suggested) return { products, widened: true }
  return { products: found, widened: false }
}
