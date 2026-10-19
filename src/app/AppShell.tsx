/**
 * AppShell.tsx — Enchaînement des écrans : connexion, prénom, puis l'app.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1, §4.6, §7)
 *
 * Navigation en mémoire, sans jamais changer l'URL : une web app installée
 * sur iOS redemanderait l'autorisation caméra. Une session perdue (jeton
 * refusé, mot de passe changé) ramène à la connexion avec une explication.
 * Les déconnexions sont toujours locales : jamais celle de toute l'équipe.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import LoginScreen from '../auth/LoginScreen'
import NameScreen from '../auth/NameScreen'
import { loadEmployeeName, saveEmployeeName } from '../auth/employee'
import { apiErrorMessage } from '../data/apiErrors'
import { supabase } from '../data/supabaseClient'
import SettingsScreen from '../settings/SettingsScreen'
import './AppShell.css'

type SessionState = 'checking' | 'signed_out' | 'signed_in'
type View = 'scanner' | 'settings' | 'name'

const SESSION_EXPIRED = apiErrorMessage('session')

export default function AppShell() {
  const [session, setSession] = useState<SessionState>('checking')
  const [employee, setEmployee] = useState<string | null>(() => loadEmployeeName())
  const [view, setView] = useState<View>('scanner')
  const [loginNotice, setLoginNotice] = useState<string | null>(null)
  // Vrai pendant une déconnexion demandée : l'événement SIGNED_OUT n'est alors pas une session perdue.
  const signingOut = useRef(false)

  useEffect(() => {
    // Le rappel se contente de mettre à jour l'état : un appel Supabase ici peut bloquer supabase-js.
    const { data } = supabase.auth.onAuthStateChange((event, current) => {
      if (event === 'INITIAL_SESSION') {
        setSession(current ? 'signed_in' : 'signed_out')
      } else if (event === 'SIGNED_IN') {
        setSession('signed_in')
        setLoginNotice(null)
      } else if (event === 'SIGNED_OUT') {
        setSession('signed_out')
        setView('scanner')
        if (!signingOut.current) setLoginNotice(SESSION_EXPIRED)
        signingOut.current = false
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const onSessionExpired = useCallback(() => {
    setLoginNotice(SESSION_EXPIRED)
    setSession('signed_out')
    setView('scanner')
    void supabase.auth.signOut({ scope: 'local' })
  }, [])

  const signOut = useCallback(async () => {
    signingOut.current = true
    setLoginNotice(null)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      signingOut.current = false
      window.alert('Déconnexion impossible sans réseau. Réessaie quand le réseau revient.')
    }
  }, [])

  const chooseEmployee = useCallback((name: string) => {
    saveEmployeeName(name)
    setEmployee(name)
    setView('scanner')
  }, [])

  if (session === 'checking') {
    return (
      <main className="screen">
        <p className="muted">Chargement…</p>
      </main>
    )
  }
  if (session === 'signed_out') return <LoginScreen notice={loginNotice} />
  if (employee === null || view === 'name') {
    return (
      <NameScreen
        onChosen={chooseEmployee}
        onSessionExpired={onSessionExpired}
        onCancel={employee === null ? undefined : () => setView('settings')}
      />
    )
  }
  if (view === 'settings') {
    return (
      <SettingsScreen
        employee={employee}
        onChangeName={() => setView('name')}
        onSignOut={() => void signOut()}
        onBack={() => setView('scanner')}
      />
    )
  }
  return (
    <div className="app">
      <header className="app-header">
        <span className="brand">ScanDrinks</span>
        <span className="employee">{employee}</span>
        <button type="button" className="icon-button" aria-label="Réglages" onClick={() => setView('settings')}>
          ⚙
        </button>
      </header>
      <section className="placeholder">
        <p className="muted">Écran Scanner (bientôt).</p>
      </section>
    </div>
  )
}
