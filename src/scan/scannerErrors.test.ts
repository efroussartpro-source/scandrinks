import { describe, expect, test } from 'vitest'
import { classifyScannerError, scannerErrorMessage } from './scannerErrors'

const named = (name: string) => Object.assign(new Error(name), { name })

describe('classifyScannerError', () => {
  test.each([
    ['NotAllowedError', 'denied'], ['SecurityError', 'denied'],
    ['NotFoundError', 'unavailable'], ['NotReadableError', 'unavailable'],
    ['OverconstrainedError', 'unavailable'], ['AbortError', 'unavailable'],
    ['InsecureContextError', 'insecure'], ['ScannerEngineError', 'engine'],
    ['TypeError', 'unknown'],
  ])('%s → %s', (name, kind) => {
    expect(classifyScannerError(named(name))).toBe(kind)
  })
  test("une valeur qui n'est pas une erreur → unknown", () => {
    expect(classifyScannerError('oups')).toBe('unknown')
  })
  test('un objet { name } (DOMException) est classé', () => {
    expect(classifyScannerError({ name: 'NotAllowedError' })).toBe('denied')
  })
})

describe('scannerErrorMessage', () => {
  test.each([
    ['denied', "L'accès à la caméra a été refusé. Sur iPhone : Réglages › Apps › Safari › Caméra › Autoriser, puis recharge la page."],
    ['unavailable', 'Aucune caméra disponible. Elle est peut-être utilisée par une autre app : ferme-la puis réessaie.'],
    ['insecure', 'La caméra ne fonctionne que sur une adresse sécurisée (https).'],
    ['engine', "Le lecteur de codes-barres n'a pas pu se charger. Vérifie la connexion puis réessaie."],
    ['interrupted', "La caméra s'est arrêtée (app en arrière-plan ou écran verrouillé). Touche « Démarrer la caméra » pour reprendre."],
    ['unknown', 'Impossible de démarrer la caméra. Réessaie.'],
  ] as const)('%s', (kind, message) => {
    expect(scannerErrorMessage(kind)).toBe(message)
  })
})
