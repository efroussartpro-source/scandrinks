import { expect, test } from 'vitest'
import { changePassword, classifyPasswordError, type PasswordAuth } from './changePassword'

// Erreurs telles que supabase-js les rend.
const REFUSED = { name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }
const WEAK = { name: 'AuthWeakPasswordError', status: 422, code: 'weak_password', message: 'Password should be at least 8 characters.' }
const SAME = { name: 'AuthApiError', status: 422, code: 'same_password', message: 'New password should be different from the old password.' }
const NETWORK = { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }

// Une erreur levée au lieu d'être renvoyée.
class Thrown {
  constructor(readonly error: unknown) {}
}

const answer = (value: unknown) => {
  if (value instanceof Thrown) throw value.error
  return { error: value ?? null }
}

interface Script {
  signIn?: Record<string, unknown> // mot de passe → erreur ; absent : accepté
  update?: unknown
  everywhere?: unknown
}

function fakeAuth(script: Script) {
  const calls: string[] = []
  const auth: PasswordAuth = {
    async signIn(password) {
      calls.push(`signIn:${password}`)
      return answer(script.signIn?.[password])
    },
    async updatePassword(password) {
      calls.push(`update:${password}`)
      return answer(script.update)
    },
    async signOutEverywhere() {
      calls.push('everywhere')
      return answer(script.everywhere)
    },
    async signOutLocal() {
      calls.push('local')
    },
  }
  return { auth, calls }
}

const input = { current: 'ancien', next: 'nouveau' }

test.each<[string, Script, boolean, string[], unknown]>([
  ['tout passe', {}, false, ['signIn:ancien', 'update:nouveau', 'everywhere', 'local'], { ok: true }],
  ['mot de passe actuel faux', { signIn: { ancien: REFUSED } }, false, ['signIn:ancien'], { ok: false, step: 'verify', kind: 'wrong_current' }],
  ['réseau coupé à la vérification', { signIn: { ancien: NETWORK } }, false, ['signIn:ancien'], { ok: false, step: 'verify', kind: 'network' }],
  ['nouveau mot de passe trop simple', { update: WEAK }, false, ['signIn:ancien', 'update:nouveau'], { ok: false, step: 'update', kind: 'weak' }],
  ['réponse perdue au changement', { update: NETWORK }, false, ['signIn:ancien', 'update:nouveau'], { ok: false, step: 'update', kind: 'network' }],
  ['déconnexion générale impossible', { everywhere: NETWORK }, false, ['signIn:ancien', 'update:nouveau', 'everywhere'],
    { ok: false, step: 'sign_out_everywhere', kind: 'network' }],
  ['« Réessayer » après un changement passé', { signIn: { ancien: REFUSED } }, true, ['signIn:ancien', 'signIn:nouveau', 'everywhere', 'local'], { ok: true }],
  ['« Réessayer » après un changement qui n\'était pas passé', {}, true, ['signIn:ancien', 'update:nouveau', 'everywhere', 'local'], { ok: true }],
  ['« Réessayer », les deux mots de passe refusés', { signIn: { ancien: REFUSED, nouveau: REFUSED } }, true, ['signIn:ancien', 'signIn:nouveau'],
    { ok: false, step: 'verify', kind: 'wrong_current' }],
  ['« Réessayer », réseau coupé en essayant le nouveau', { signIn: { ancien: REFUSED, nouveau: NETWORK } }, true, ['signIn:ancien', 'signIn:nouveau'],
    { ok: false, step: 'verify', kind: 'network' }],
  ['changement qui lève une erreur au lieu de la renvoyer', { update: new Thrown(new TypeError('Failed to fetch')) }, false,
    ['signIn:ancien', 'update:nouveau'], { ok: false, step: 'update', kind: 'network' }],
  ['mot de passe actuel faux, sans échec incertain avant', { signIn: { ancien: REFUSED, nouveau: REFUSED } }, false, ['signIn:ancien'],
    { ok: false, step: 'verify', kind: 'wrong_current' }],
])('%s', async (_label, script, afterUncertainFailure, expectedCalls, expected) => {
  const { auth, calls } = fakeAuth(script)
  expect(await changePassword(auth, input, { afterUncertainFailure })).toEqual(expected)
  expect(calls).toEqual(expectedCalls)
})

test.each<[unknown, string]>([
  [REFUSED, 'wrong_current'],
  [{ status: 400, message: 'Invalid login credentials' }, 'wrong_current'],
  [WEAK, 'weak'],
  [SAME, 'same'],
  [NETWORK, 'network'],
  [new TypeError('Failed to fetch'), 'network'],
  [new Error('boom'), 'unknown'],
])('classifyPasswordError(%#) = %s', (error, kind) => expect(classifyPasswordError(error)).toBe(kind))
