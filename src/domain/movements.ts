/**
 * movements.ts — Lignes de mouvements, à l'heure de Paris.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.4, §4.5)
 *
 * « lun. 14:32 — Sam — Entrée +24 », « … — Inventaire : 53 comptés (−3) ».
 * Le jour de la semaine suffit pendant 7 jours ; au-delà, la date s'affiche,
 * avec l'année si elle diffère. Une ligne annulée porte « annulé par … ».
 * Sert à la fiche produit (jalon 2) et à l'Historique (jalon 3).
 */
import { describeInventory } from './inventory'
import { formatDelta } from './stock'

export type MovementKind = 'in' | 'out' | 'inventory'

export interface Movement {
  id: string
  kind: MovementKind
  delta: number
  counted: number | null
  employee: string
  createdAt: string
  cancelledAt: string | null
  cancelledBy: string | null
}

const DAY_MS = 86_400_000

const parisFormat = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function parisParts(date: Date) {
  const parts: Record<string, string> = {}
  for (const part of parisFormat.formatToParts(date)) parts[part.type] = part.value
  return parts
}

// Numéro du jour du calendrier de Paris, pour compter les jours écoulés.
const dayNumber = (parts: Record<string, string>) => Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS

export function formatClock(date: Date): string {
  const parts = parisParts(date)
  return `${parts.hour}:${parts.minute}`
}

export function formatWhen(iso: string, now: Date): string {
  const at = parisParts(new Date(iso))
  const today = parisParts(now)
  const clock = `${at.hour}:${at.minute}`
  const days = dayNumber(today) - dayNumber(at)
  if (days >= 0 && days <= 6) return `${at.weekday} ${clock}`
  const date = at.year === today.year ? `${at.day}/${at.month}` : `${at.day}/${at.month}/${at.year}`
  return `${date} ${clock}`
}

export function describeMovement(m: Movement): string {
  switch (m.kind) {
    case 'in':
      return `Entrée ${formatDelta(m.delta)}`
    case 'out':
      return `Sortie ${formatDelta(m.delta)}`
    case 'inventory':
      return describeInventory(m.counted ?? 0, m.delta)
  }
}

export function movementLine(m: Movement, now: Date): string {
  const line = `${formatWhen(m.createdAt, now)} — ${m.employee} — ${describeMovement(m)}`
  if (m.cancelledAt === null) return line
  return m.cancelledBy ? `${line} — annulé par ${m.cancelledBy}` : `${line} — annulé`
}
