/**
 * passwordRules.ts — Vérification du nouveau mot de passe du tabac, avant envoi.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.4)
 *
 * Un seul message à la fois, sur le premier champ à reprendre. Les mots de
 * passe ne sont jamais rognés : une espace tapée en fait partie.
 */

export const PASSWORD_MIN_LENGTH = 8

export type PasswordField = 'current' | 'next' | 'confirm'

export function validatePasswordChange(input: {
  current: string
  next: string
  confirm: string
}): { ok: true } | { ok: false; field: PasswordField; message: string } {
  if (input.current === '') return { ok: false, field: 'current', message: 'Tape le mot de passe actuel.' }
  if (input.next.length < PASSWORD_MIN_LENGTH) return { ok: false, field: 'next', message: `Au moins ${PASSWORD_MIN_LENGTH} caractères.` }
  if (input.next === input.current) {
    return { ok: false, field: 'next', message: "Le nouveau mot de passe doit être différent de l'actuel." }
  }
  if (input.confirm !== input.next) return { ok: false, field: 'confirm', message: 'Les deux saisies ne correspondent pas.' }
  return { ok: true }
}
