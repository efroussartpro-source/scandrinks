/**
 * changePassword.ts — Changement du mot de passe du tabac, étape par étape.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.4, §7)
 *
 * 1. Le mot de passe actuel est vérifié par une connexion.
 * 2. Le nouveau est enregistré.
 * 3. Tous les téléphones sont déconnectés, puis celui-ci.
 * Si la réponse du changement s'est perdue, « Réessayer » ne peut pas savoir
 * s'il a eu lieu : quand l'ancien mot de passe est refusé, on essaie le
 * nouveau, et s'il passe, on reprend à l'étape 3. Les mots de passe ne sont
 * ni gardés ni journalisés ici.
 */
import { classifyApiError } from '../data/apiErrors'

export interface PasswordAuth {
  signIn(password: string): Promise<{ error: unknown }>
  updatePassword(password: string): Promise<{ error: unknown }>
  signOutEverywhere(): Promise<{ error: unknown }>
  signOutLocal(): Promise<void>
}

export type PasswordFailureKind = 'wrong_current' | 'weak' | 'same' | 'network' | 'unknown'

export type PasswordStep = 'verify' | 'update' | 'sign_out_everywhere'

export type ChangePasswordResult = { ok: true } | { ok: false; step: PasswordStep; kind: PasswordFailureKind }

export function classifyPasswordError(error: unknown): PasswordFailureKind {
  if (classifyApiError(error).kind === 'network') return 'network'
  const fields = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
  const code = typeof fields.code === 'string' ? fields.code : ''
  const message = typeof fields.message === 'string' ? fields.message : ''
  if (code === 'invalid_credentials' || (fields.status === 400 && /invalid login credentials/i.test(message))) return 'wrong_current'
  if (code === 'weak_password') return 'weak'
  if (code === 'same_password') return 'same'
  return 'unknown'
}

// Une erreur levée compte comme une erreur renvoyée : l'étape reste connue.
async function attempt(call: () => Promise<{ error: unknown }>): Promise<unknown> {
  try {
    return (await call()).error
  } catch (thrown) {
    return thrown
  }
}

export async function changePassword(
  auth: PasswordAuth,
  input: { current: string; next: string },
  options: { afterUncertainFailure: boolean },
): Promise<ChangePasswordResult> {
  const refused = await attempt(() => auth.signIn(input.current))
  if (refused) {
    const kind = classifyPasswordError(refused)
    if (kind !== 'wrong_current' || !options.afterUncertainFailure) return { ok: false, step: 'verify', kind }
    // L'ancien est refusé après un échec incertain : le changement a peut-être déjà eu lieu.
    const alsoRefused = await attempt(() => auth.signIn(input.next))
    if (alsoRefused) return { ok: false, step: 'verify', kind: classifyPasswordError(alsoRefused) }
  } else {
    const failed = await attempt(() => auth.updatePassword(input.next))
    if (failed) return { ok: false, step: 'update', kind: classifyPasswordError(failed) }
  }
  const notSignedOut = await attempt(() => auth.signOutEverywhere())
  if (notSignedOut) return { ok: false, step: 'sign_out_everywhere', kind: classifyPasswordError(notSignedOut) }
  await auth.signOutLocal()
  return { ok: true }
}
