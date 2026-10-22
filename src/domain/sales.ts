/**
 * sales.ts — Fin de journée : les jours proposés, la lecture des cases et le total (RG-14).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.8, RG-14)
 *
 * On saisit les ventes d'aujourd'hui ou de l'un des 6 jours d'avant, à
 * l'heure de Paris. Les jours d'avant suivent le calendrier : le changement
 * d'heure ne fait ni sauter ni doubler un jour. Aucun jour n'est proposé
 * avant le premier jour de ventes : l'inventaire de la bascule (§9) compte
 * déjà les ventes d'avant. Une case vide ou à 0 ne compte pas ; sinon, de 1
 * à 999 unités vendues, en chiffres.
 */

export const SOLD_MAX = 999
const DAY_COUNT = 7

export const NOTHING_SOLD_MESSAGE = 'Tape le nombre de boissons vendues.'
export const SOLD_INVALID_MESSAGE = 'Vendus : un nombre de 1 à 999.'

export interface SalesDay {
  // AAAA-MM-JJ, un jour du calendrier de Paris.
  day: string
  // « Aujourd'hui, jeu. 22/10 », « Hier, mer. 21/10 », puis « mar. 20/10 ».
  label: string
  // « jeu. 22/10 ».
  short: string
}

export type SoldInput = { kind: 'empty' } | { kind: 'ok'; quantity: number } | { kind: 'invalid' }

export interface SalesDraft {
  lines: Array<{ productId: string; quantity: number }>
  invalidIds: string[]
  units: number
}

const parisDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
// Un jour du calendrier, posé à minuit UTC : son nom se lit en UTC.
const calendarDay = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' })

function partsOf(format: Intl.DateTimeFormat, date: Date): Record<string, string> {
  const parts: Record<string, string> = {}
  for (const part of format.formatToParts(date)) parts[part.type] = part.value
  return parts
}

// firstDay (AAAA-MM-JJ) : le premier jour de ventes ; les jours d'avant ne sont pas proposés.
export function salesDays(now: Date, firstDay: string | null = null): SalesDay[] {
  const today = partsOf(parisDate, now)
  const days: SalesDay[] = []
  for (let back = 0; back < DAY_COUNT; back += 1) {
    const date = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) - back))
    const day = date.toISOString().slice(0, 10)
    if (firstDay !== null && day < firstDay) break
    const parts = partsOf(calendarDay, date)
    const short = `${parts.weekday} ${parts.day}/${parts.month}`
    const label = back === 0 ? `Aujourd'hui, ${short}` : back === 1 ? `Hier, ${short}` : short
    days.push({ day, label, short })
  }
  return days
}

export function parseSold(text: string): SoldInput {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (!/^[0-9]+$/.test(trimmed)) return { kind: 'invalid' }
  const quantity = Number(trimmed)
  if (quantity === 0) return { kind: 'empty' }
  return quantity <= SOLD_MAX ? { kind: 'ok', quantity } : { kind: 'invalid' }
}

// Seuls comptent les produits encore à saisir : un produit archivé ou saisi ailleurs entre-temps n'est ni envoyé ni
// compté dans le total.
export function readEntries(entries: Readonly<Record<string, string>>, productIds: readonly string[]): SalesDraft {
  const draft: SalesDraft = { lines: [], invalidIds: [], units: 0 }
  for (const productId of productIds) {
    const sold = parseSold(entries[productId] ?? '')
    if (sold.kind === 'ok') {
      draft.lines.push({ productId, quantity: sold.quantity })
      draft.units += sold.quantity
    } else if (sold.kind === 'invalid') {
      draft.invalidIds.push(productId)
    }
  }
  return draft
}

// « 9 boissons » ; « boisson » au singulier pour 0 et 1.
export function formatDrinks(units: number): string {
  return `${units} ${units > 1 ? 'boissons' : 'boisson'}`
}

// « 22/10 », pour le jour des ventes AAAA-MM-JJ.
export function formatSaleDay(day: string): string {
  const [, month, date] = day.split('-')
  return `${date}/${month}`
}
