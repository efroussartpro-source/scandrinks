/**
 * appearance.ts — Apparence de l'app : Automatique, Clair ou Sombre, au choix de chaque téléphone.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.7)
 *
 * Les couleurs vivent dans tokens.css. « Clair » et « Sombre » posent
 * data-theme sur <html> ; « Automatique » le retire, et le CSS suit le
 * réglage de l'iPhone (prefers-color-scheme). La barre d'état prend la
 * couleur du fond, et suit l'iPhone en « Automatique ». Le choix est gardé
 * comme le mode du Scanner : sans stockage possible, c'est « Automatique ».
 */
import { readStored, writeStored } from '../app/storage'

export type Appearance = 'auto' | 'light' | 'dark'

export const APPEARANCE_KEY = 'scandrinks.appearance'

export const APPEARANCE_CHOICES: ReadonlyArray<{ value: Appearance; label: string }> = [
  { value: 'auto', label: 'Automatique' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
]

// Couleur de la barre d'état : le fond (--bg de tokens.css), de jour et de nuit.
export const STATUS_BAR = { light: '#F7F7F5', dark: '#0F1110' } as const

export function loadAppearance(storage?: Storage | null): Appearance {
  const stored = readStored(APPEARANCE_KEY, storage)
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

export function saveAppearance(value: Appearance, storage?: Storage | null): void {
  writeStored(APPEARANCE_KEY, value, storage)
}

export function resolveAppearance(value: Appearance, systemDark: boolean): 'light' | 'dark' {
  if (value === 'auto') return systemDark ? 'dark' : 'light'
  return value
}

export function applyAppearance(value: Appearance, systemDark: boolean): void {
  const root = document.documentElement
  if (value === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', STATUS_BAR[resolveAppearance(value, systemDark)])
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

// Au démarrage, avant le premier rendu : le choix gardé, puis les changements de l'iPhone.
export function startAppearance(): void {
  const query = darkQuery()
  applyAppearance(loadAppearance(), query.matches)
  query.addEventListener('change', (event) => applyAppearance(loadAppearance(), event.matches))
}

export function chooseAppearance(value: Appearance): void {
  saveAppearance(value)
  applyAppearance(value, darkQuery().matches)
}
