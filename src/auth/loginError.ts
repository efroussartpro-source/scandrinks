/**
 * loginError.ts — Message affiché quand la connexion au compte du tabac échoue.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1, §7)
 */

export function loginErrorMessage(error: unknown): string {
  const fields = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
  const status = typeof fields.status === 'number' ? fields.status : null
  const code = typeof fields.code === 'string' ? fields.code : ''
  const message = typeof fields.message === 'string' ? fields.message : ''
  const name = typeof fields.name === 'string' ? fields.name : ''

  if (status === 400 && (code === 'invalid_credentials' || /invalid login credentials/i.test(message))) {
    return 'Mot de passe incorrect.'
  }
  if (name === 'AuthRetryableFetchError' || error instanceof TypeError || status === 0) {
    return 'Pas de connexion. Réessaie quand le réseau revient.'
  }
  return 'Connexion impossible. Réessaie.'
}
