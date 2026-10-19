import { expect, test } from 'vitest'
import { apiErrorMessage, classifyApiError, type ApiErrorKind } from './apiErrors'

test.each([
  [new TypeError('Failed to fetch'), 'network'], [{ message: 'TypeError: Load failed', code: '', status: 0 }, 'network'],
  [{ name: 'AuthRetryableFetchError', message: 'Load failed', status: 0 }, 'network'],
  [{ message: 'JWT expired', code: 'PGRST303', status: 401 }, 'session'], [{ message: 'Invalid Refresh Token', status: 401 }, 'session'],
  [{ message: 'permission denied for function lookup_barcode', code: '42501', status: 401 }, 'session'],
  [{ message: 'new row violates row-level security policy', code: '42501', status: 403 }, 'forbidden'],
  [{ message: 'barcode_taken:3502110123091', code: 'P0001', status: 400 }, 'barcode_taken'],
  [{ message: 'duplicate key value violates unique constraint "barcodes_pkey"', code: '23505', status: 409 }, 'barcode_taken'],
  [{ message: 'invalid_input:quantity', code: 'P0001', status: 400 }, 'invalid'],
  [{ message: 'new row for relation "products" violates check constraint', code: '23514', status: 400 }, 'invalid'],
  [{ message: 'boom', status: 500 }, 'unknown'],
])('%o → %s', (raw, kind) => { expect(classifyApiError(raw).kind).toBe(kind) })

test('detail porte le code pris ou le champ refusé', () => {
  expect(classifyApiError({ message: 'barcode_taken:3502110123091', code: 'P0001' }).detail).toBe('3502110123091')
  expect(classifyApiError({ message: 'invalid_input:units', code: 'P0001' }).detail).toBe('units')
})

test.each([
  ['network', "Pas de connexion, rien n'a été enregistré."],
  ['session', 'Ta session a expiré : reconnecte-toi.'],
  ['forbidden', "Ce compte n'a pas accès au stock."],
  ['barcode_taken', 'Ce code appartient déjà à un autre produit.'],
  ['invalid', 'Enregistrement refusé : vérifie la saisie ou scanne de nouveau.'],
  ['unknown', 'Base injoignable. Réessaie dans un instant.'],
])('message %s', (kind, message) => { expect(apiErrorMessage(kind as ApiErrorKind)).toBe(message) })
