import { expect, test } from 'vitest'
import { nextSessionState } from './authState'

test('session : transitions, dont TOKEN_REFRESHED (m6)', () => {
  expect(nextSessionState('INITIAL_SESSION', false)).toBe('signed_out')
  expect(nextSessionState('INITIAL_SESSION', true)).toBe('signed_in')
  expect(nextSessionState('TOKEN_REFRESHED', true)).toBe('signed_in')
  expect(nextSessionState('TOKEN_REFRESHED', false)).toBeNull()
  expect(nextSessionState('SIGNED_OUT', false)).toBe('signed_out')
  expect(nextSessionState('USER_UPDATED', true)).toBeNull()
})
