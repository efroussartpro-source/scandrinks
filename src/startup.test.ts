import { expect, test } from 'vitest'
import { isConfigurationMissing, startupErrorMessage } from './startup'

const MISSING_CONFIGURATION = new Error('Configuration manquante : VITE_SUPABASE_URL (voir .env.production).')
const LOAD_FAILED = new TypeError('Failed to fetch dynamically imported module')

test("démarrage impossible : configuration manquante ou autre cause", () => {
  expect(startupErrorMessage(MISSING_CONFIGURATION)).toBe(
    "L'app ne peut pas démarrer : configuration manquante. Préviens la personne qui gère ScanDrinks.",
  )
  // Dans l'app installée, il n'y a ni barre ni geste pour recharger : l'écran porte le bouton « Recharger ».
  expect(startupErrorMessage(LOAD_FAILED)).toBe(
    "L'app ne peut pas démarrer. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks.",
  )
})

test('recharger ne sert que si la configuration est là', () => {
  expect(isConfigurationMissing(MISSING_CONFIGURATION)).toBe(true)
  expect(isConfigurationMissing(LOAD_FAILED)).toBe(false)
})
