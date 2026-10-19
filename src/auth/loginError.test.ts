import { expect, test } from 'vitest'
import { loginErrorMessage } from './loginError'

test.each([
  [{ name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' }, 'Mot de passe incorrect.'],
  [{ name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 }, 'Pas de connexion. Réessaie quand le réseau revient.'],
  [new TypeError('Failed to fetch'), 'Pas de connexion. Réessaie quand le réseau revient.'],
  [{ message: '???', status: 500 }, 'Connexion impossible. Réessaie.'],
])('loginErrorMessage(%o)', (error, message) => { expect(loginErrorMessage(error)).toBe(message) })
