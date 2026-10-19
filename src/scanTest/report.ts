/**
 * report.ts — Libellés et rapport texte de la page de test du scan (jalon 0).
 *
 * Le rapport est copié par le porteur du projet puis collé dans la
 * conversation : il doit être lisible tel quel. Les dates sont assemblées
 * pièce par pièce pour ne pas dépendre des séparateurs propres à chaque
 * navigateur.
 */
import type { OffLookupResult } from '../off/openFoodFacts'
import { engineLabel, type ScanEngine } from '../scan/engine'
import { formatLabel } from '../scan/formats'

export interface ScanEntry {
  id: number
  code: string
  format: string
  at: Date
  lookup: OffLookupResult | 'pending'
}

export interface ReportMeta {
  now: Date
  engine: ScanEngine | null
  width: number | null
  height: number | null
  decodeMs: number | null
  standalone: boolean
  userAgent: string
}

export function lookupLabel(lookup: OffLookupResult | 'pending'): string {
  if (lookup === 'pending') return 'recherche…'
  switch (lookup.status) {
    case 'found':
      return lookup.suggestedName
    case 'not_found':
      return "inconnu d'Open Food Facts"
    case 'error':
      return 'Open Food Facts injoignable'
  }
}

export function codesCountLabel(count: number): string {
  return count <= 1 ? `${count} code lu` : `${count} codes lus`
}

const PARIS_PARTS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function parisParts(date: Date): Record<'day' | 'month' | 'year' | 'hour' | 'minute' | 'second', string> {
  const parts = Object.fromEntries(PARIS_PARTS.formatToParts(date).map((part) => [part.type, part.value]))
  return { day: parts.day, month: parts.month, year: parts.year, hour: parts.hour, minute: parts.minute, second: parts.second }
}

/** « 14:32:05 », heure de Paris. */
export function formatTime(date: Date): string {
  const p = parisParts(date)
  return `${p.hour}:${p.minute}:${p.second}`
}

function formatDateTime(date: Date): string {
  const p = parisParts(date)
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

function readerLine(meta: ReportMeta): string {
  if (!meta.engine) return 'Lecteur : non démarré'
  let line = `Lecteur : ${engineLabel(meta.engine)}`
  if (meta.width && meta.height) line += ` — caméra ${meta.width}×${meta.height}`
  if (meta.decodeMs !== null) line += ` — analyse ${meta.decodeMs} ms/image`
  return line
}

export function formatScanReport(entries: readonly ScanEntry[], meta: ReportMeta): string {
  const chronological = [...entries].reverse()
  return [
    'ScanDrinks — test du scan (jalon 0)',
    `Date : ${formatDateTime(meta.now)}`,
    readerLine(meta),
    `Mode : ${meta.standalone ? "écran d'accueil" : 'Safari'}`,
    `Appareil : ${meta.userAgent}`,
    `Codes lus : ${entries.length}`,
    ...chronological.map(
      (entry, index) =>
        `${index + 1}. ${formatTime(entry.at)} — ${entry.code} (${formatLabel(entry.format)}) — ${lookupLabel(entry.lookup)}`,
    ),
  ].join('\n')
}
