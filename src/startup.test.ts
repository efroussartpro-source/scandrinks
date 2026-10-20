import { expect, test } from 'vitest'
import { startupErrorMessage } from './startup'

test("démarrage impossible : configuration manquante ou autre cause", () => {
  expect(startupErrorMessage(new Error('Configuration manquante : VITE_SUPABASE_URL (voir .env.production).'))).toBe(
    "L'app ne peut pas démarrer : configuration manquante. Préviens la personne qui gère ScanDrinks.",
  )
  expect(startupErrorMessage(new Error('Failed to fetch dynamically imported module'))).toBe(
    "L'app ne peut pas démarrer. Recharge la page ; si ça continue, préviens la personne qui gère ScanDrinks.",
  )
})
