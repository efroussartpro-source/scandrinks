/**
 * main.tsx — Point d'entrée de ScanDrinks.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 *
 * L'app se charge à part : si elle ne peut pas démarrer (configuration
 * manquante, fichier introuvable pendant une mise à jour), un message
 * s'affiche au lieu d'une page blanche (m13).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { startupErrorMessage } from './startup'
import './styles.css'

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
    const message = document.createElement('p')
    message.setAttribute('role', 'alert')
    message.className = 'message message-error'
    message.textContent = startupErrorMessage(error)
    root.replaceChildren(message)
  },
)
