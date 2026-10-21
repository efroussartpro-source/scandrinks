/**
 * ErrorBoundary.tsx — Filet de sécurité : une erreur d'affichage imprévue remplace l'écran par un message et « Recharger ».
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §7)
 *
 * Sans lui, React retire tout l'écran : une page blanche, sans moyen de
 * relancer dans l'app installée. L'écran a l'allure de celui du démarrage
 * impossible (main.tsx). « Recharger » relance la page : l'app repart sur le
 * Scanner. Rien ne recharge tout seul, donc rien ne boucle.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RENDER_ERROR_MESSAGE } from '../startup'

interface ErrorBoundaryState {
  failed: boolean
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="screen">
        <p role="alert" className="message message-error">
          {RENDER_ERROR_MESSAGE}
        </p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </main>
    )
  }
}
