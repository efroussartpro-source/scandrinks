// L'app entière : connexion, prénom, puis l'écran Scanner (voir app/AppShell.tsx), sous le filet de sécurité (app/ErrorBoundary.tsx).
import AppShell from './app/AppShell'
import ErrorBoundary from './app/ErrorBoundary'

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}
