import { expect, test } from 'vitest'
import { PASSWORD_MIN_LENGTH, validatePasswordChange } from './passwordRules'

test('au moins 8 caractères', () => expect(PASSWORD_MIN_LENGTH).toBe(8))

test.each([
  [{ current: '', next: 'nouveau-mdp', confirm: 'nouveau-mdp' }, { ok: false, field: 'current', message: 'Tape le mot de passe actuel.' }],
  [{ current: 'ancien-mdp', next: 'court', confirm: 'court' }, { ok: false, field: 'next', message: 'Au moins 8 caractères.' }],
  [{ current: 'meme-mdp-1', next: 'meme-mdp-1', confirm: 'meme-mdp-1' },
    { ok: false, field: 'next', message: "Le nouveau mot de passe doit être différent de l'actuel." }],
  [{ current: 'ancien-mdp', next: 'nouveau-mdp', confirm: 'nouveau-mdP' }, { ok: false, field: 'confirm', message: 'Les deux saisies ne correspondent pas.' }],
  [{ current: 'ancien-mdp', next: ' nouveau-mdp ', confirm: ' nouveau-mdp ' }, { ok: true }],
])('validatePasswordChange(%j)', (input, expected) => expect(validatePasswordChange(input)).toEqual(expected))
