/**
 * main.tsx — Point d'entrée de ScanDrinks.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 *
 * L'app se charge à part : si elle ne peut pas démarrer (configuration
 * manquante, réseau coupé pendant le chargement, mise à jour en cours), un
 * message s'affiche au lieu d'une page blanche (m13), avec « Recharger »
 * quand recharger peut aider.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isConfigurationMissing, startupErrorMessage } from './startup'
import { startAppearance } from './theme/appearance'
import './theme/tokens.css'
import './styles.css'
// Les composants communs avant les feuilles des écrans (chargées avec l'app), qui peuvent les préciser.
// L'écran « l'app ne peut pas démarrer » en a besoin aussi.
import './app/AppShell.css'

// Le thème du téléphone est posé avant le premier rendu : pas d'éclair blanc la nuit.
startAppearance()

const root = document.getElementById('root')!

import('./App').then(
  ({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  },
  (error: unknown) => {
    console.error(error)
    const screen = document.createElement('main')
    screen.className = 'screen'
    const message = document.createElement('p')
    message.setAttribute('role', 'alert')
    message.className = 'message message-error'
    message.textContent = startupErrorMessage(error)
    screen.append(message)
    if (!isConfigurationMissing(error)) {
      const reload = document.createElement('button')
      reload.type = 'button'
      reload.className = 'primary'
      reload.textContent = 'Recharger'
      reload.addEventListener('click', () => window.location.reload())
      screen.append(reload)
    }
    root.replaceChildren(screen)
  },
)
