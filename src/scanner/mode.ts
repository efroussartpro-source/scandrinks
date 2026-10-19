/**
 * mode.ts — Mode Entrée/Sortie, gardé par chaque téléphone.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 */
import { readStored, writeStored } from '../app/storage'
import type { ScanMode } from '../domain/stock'

export const MODE_KEY = 'scandrinks.mode'

export function loadMode(storage?: Storage | null): ScanMode {
  return readStored(MODE_KEY, storage) === 'out' ? 'out' : 'in'
}

export function saveMode(mode: ScanMode, storage?: Storage | null): void {
  writeStored(MODE_KEY, mode, storage)
}
