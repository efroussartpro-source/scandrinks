/**
 * productDraft.ts — Brouillon de fiche produit : valeurs par défaut et validation (RG-7).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §5)
 *
 * Les champs restent des chaînes, comme dans le formulaire. Le pack Metro suit
 * les unités du code quand elles dépassent 1 ; le seuil et le stock idéal
 * valent 1 et 2 packs Metro. Chacun cesse de suivre dès qu'on le modifie à la
 * main.
 */

export type DraftField = 'name' | 'codeUnits' | 'packSize' | 'alertThreshold' | 'targetStock'

export interface ProductDraft {
  name: string
  codeUnits: string
  packSize: string
  alertThreshold: string
  targetStock: string
  packSizeEdited: boolean
  thresholdsEdited: boolean
}

export interface NewProductInput {
  name: string
  packSize: number
  alertThreshold: number
  targetStock: number
  barcodes: Array<{ code: string; units: number }>
}

export type DraftValidation =
  | { ok: true; codeUnits: number; product: Omit<NewProductInput, 'barcodes'> }
  | { ok: false; errors: Partial<Record<DraftField, string>> }

export const NAME_MAX_LENGTH = 80

const MESSAGES = {
  name: 'Le nom est obligatoire (80 caractères au plus).',
  units: 'Entre 1 et 999.',
  alertThreshold: 'Entre 0 et 9 999.',
  targetStock: 'Entre 1 et 99 999.',
  targetAboveThreshold: 'Le stock idéal doit être supérieur au seuil.',
}

export function parseIntInRange(raw: string, min: number, max: number): number | null {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  const n = Number(value)
  return n >= min && n <= max ? n : null
}

export function newDraft(name: string): ProductDraft {
  return {
    name,
    codeUnits: '',
    packSize: '',
    alertThreshold: '',
    targetStock: '',
    packSizeEdited: false,
    thresholdsEdited: false,
  }
}

function applyDefaults(draft: ProductDraft): ProductDraft {
  const next = { ...draft }
  if (!next.packSizeEdited) {
    const units = parseIntInRange(next.codeUnits, 1, 999)
    next.packSize = units !== null && units > 1 ? String(units) : ''
  }
  if (!next.thresholdsEdited) {
    const pack = parseIntInRange(next.packSize, 1, 999)
    next.alertThreshold = pack !== null ? String(pack) : ''
    next.targetStock = pack !== null ? String(2 * pack) : ''
  }
  return next
}

export function updateDraft(draft: ProductDraft, field: DraftField, value: string): ProductDraft {
  const next: ProductDraft = { ...draft, [field]: value }
  if (field === 'packSize') next.packSizeEdited = true
  if (field === 'alertThreshold' || field === 'targetStock') next.thresholdsEdited = true
  return applyDefaults(next)
}

export function validateDraft(draft: ProductDraft): DraftValidation {
  const errors: Partial<Record<DraftField, string>> = {}

  const name = draft.name.trim()
  // Longueur en caractères, comme char_length côté base.
  const nameLength = [...name].length
  if (nameLength < 1 || nameLength > NAME_MAX_LENGTH) errors.name = MESSAGES.name

  const codeUnits = parseIntInRange(draft.codeUnits, 1, 999)
  if (codeUnits === null) errors.codeUnits = MESSAGES.units
  const packSize = parseIntInRange(draft.packSize, 1, 999)
  if (packSize === null) errors.packSize = MESSAGES.units
  const alertThreshold = parseIntInRange(draft.alertThreshold, 0, 9999)
  if (alertThreshold === null) errors.alertThreshold = MESSAGES.alertThreshold
  const targetStock = parseIntInRange(draft.targetStock, 1, 99999)
  if (targetStock === null) errors.targetStock = MESSAGES.targetStock
  else if (alertThreshold !== null && targetStock <= alertThreshold) errors.targetStock = MESSAGES.targetAboveThreshold

  if (Object.keys(errors).length > 0 || codeUnits === null || packSize === null || alertThreshold === null || targetStock === null) {
    return { ok: false, errors }
  }
  return { ok: true, codeUnits, product: { name, packSize, alertThreshold, targetStock } }
}
