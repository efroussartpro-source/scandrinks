/**
 * employee.ts — Prénom de l'employé, mémorisé sur son téléphone.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1)
 *
 * Le prénom est enregistré sur chaque mouvement : il dit qui a fait quoi.
 */
import { readStored, writeStored } from '../app/storage'

export const EMPLOYEE_KEY = 'scandrinks.employee'
const NAME_MAX_LENGTH = 30
const INVALID_NAME = 'Le prénom doit faire entre 1 et 30 caractères.'

export function validateEmployeeName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.trim()
  const length = [...name].length
  return length >= 1 && length <= NAME_MAX_LENGTH ? { ok: true, name } : { ok: false, message: INVALID_NAME }
}

export function loadEmployeeName(storage?: Storage | null): string | null {
  const stored = readStored(EMPLOYEE_KEY, storage)
  if (stored === null) return null
  const checked = validateEmployeeName(stored)
  return checked.ok ? checked.name : null
}

export function saveEmployeeName(name: string, storage?: Storage | null): void {
  writeStored(EMPLOYEE_KEY, name, storage)
}
