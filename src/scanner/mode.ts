/**
 * mode.ts — Mode Entrée, Sortie ou Inventaire, gardé par chaque téléphone.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 */
import { readStored, writeStored } from '../app/storage'
import type { ScanMode } from '../domain/stock'

export const MODE_KEY = 'scandrinks.mode'

export function loadMode(storage?: Storage | null): ScanMode {
  const stored = readStored(MODE_KEY, storage)
  return stored === 'out' || stored === 'inventory' ? stored : 'in'
}

export function saveMode(mode: ScanMode, storage?: Storage | null): void {
  writeStored(MODE_KEY, mode, storage)
}
