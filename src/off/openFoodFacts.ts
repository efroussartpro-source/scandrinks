/**
 * openFoodFacts.ts — Recherche du nom d'un produit dans Open Food Facts.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.6)
 *
 * Appelé seulement pour un code inconnu, pour pré-remplir le nom et proposer
 * l'image du produit (seulement une adresse d'Open Food Facts). Jamais
 * bloquant : au bout de OFF_TIMEOUT_MS, ou en cas de problème, on renvoie
 * `error` et le nom se tape à la main. Aucun en-tête ajouté : la requête
 * reste « simple » au sens CORS (pas de requête préalable) et n'envoie
 * aucune donnée personnelle.
 */
import { isOffImageUrl } from '../photos/photos'

export type OffLookupResult =
  | { status: 'found'; name: string; quantity: string | null; suggestedName: string; imageUrl: string | null }
  | { status: 'not_found' }
  | { status: 'error' }

export const OFF_TIMEOUT_MS = 3000

export function offProductUrl(code: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_fr,brands,quantity,image_front_url`
}

/** Nom proposé : le nom suivi de la contenance, sans la répéter si elle y figure déjà. */
export function formatSuggestedName(name: string, quantity: string | null): string {
  if (!quantity || name.toLowerCase().includes(quantity.toLowerCase())) return name
  return `${name} ${quantity}`
}

interface OffProduct {
  product_name?: unknown
  product_name_fr?: unknown
  quantity?: unknown
  image_front_url?: unknown
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export async function lookupProduct(
  code: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<OffLookupResult> {
  const { timeoutMs = OFF_TIMEOUT_MS, fetchImpl = globalThis.fetch.bind(globalThis) } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(offProductUrl(code), { signal: controller.signal })
    if (response.status === 404) return { status: 'not_found' }
    if (!response.ok) return { status: 'error' }
    const body = (await response.json()) as { status?: unknown; product?: OffProduct }
    if (body.status !== 1 || !body.product) return { status: 'not_found' }
    const name = text(body.product.product_name_fr) || text(body.product.product_name)
    if (!name) return { status: 'not_found' }
    const quantity = text(body.product.quantity) || null
    const imageUrl = isOffImageUrl(body.product.image_front_url) ? body.product.image_front_url : null
    return { status: 'found', name, quantity, suggestedName: formatSuggestedName(name, quantity), imageUrl }
  } catch {
    return { status: 'error' }
  } finally {
    clearTimeout(timer)
  }
}
