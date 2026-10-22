/**
 * AppShell.tsx — Enchaînement des écrans : connexion, prénom, puis l'app à onglets.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4, §4.1, §4.6, §7)
 *
 * Navigation en mémoire, sans jamais changer l'URL : une web app installée
 * sur iOS redemanderait l'autorisation caméra. Le Scanner reste monté quand on
 * change d'onglet ou qu'on ouvre les Réglages (affichés par-dessus l'app) : la
 * caméra s'arrête puis repart, mais une fiche en cours garde son identifiant
 * (m9). Une session perdue (jeton refusé, mot de passe changé) ramène à la
 * connexion avec une explication. Se déconnecter ne ferme que la session de
 * ce téléphone ; seul un changement de mot de passe ferme celles de toute
 * l'équipe.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import LoginScreen, { type LoginNotice } from '../auth/LoginScreen'
import NameScreen from '../auth/NameScreen'
import { loadEmployeeName, saveEmployeeName } from '../auth/employee'
import { apiErrorMessage } from '../data/apiErrors'
import { supabase } from '../data/supabaseClient'
import { shoppingList } from '../domain/restock'
import HistoryScreen from '../history/HistoryScreen'
import SalesScreen, { type SalesDraftState } from '../sales/SalesScreen'
import ScannerScreen from '../scanner/ScannerScreen'
import ChangePasswordScreen from '../settings/ChangePasswordScreen'
import SettingsScreen from '../settings/SettingsScreen'
import TutorialScreen from '../settings/TutorialScreen'
import ShoppingScreen from '../shopping/ShoppingScreen'
import StockScreen from '../stock/StockScreen'
import { IconBarcode, IconSettings } from '../ui/icons'
import { nextSessionState, type SessionState } from './authState'
import TabBar, { type Tab } from './TabBar'
import { useCatalog } from './useCatalog'

type Overlay = 'settings' | 'name' | 'tutorial' | 'password' | null

const SESSION_EXPIRED: LoginNotice = { text: apiErrorMessage('session'), tone: 'error' }
const PASSWORD_CHANGED: LoginNotice = { text: 'Mot de passe changé. Connecte-toi avec le nouveau mot de passe.', tone: 'ok' }

export default function AppShell() {
  const [session, setSession] = useState<SessionState>('checking')
  const [employee, setEmployee] = useState<string | null>(() => loadEmployeeName())
  const [tab, setTab] = useState<Tab>('scanner')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [loginNotice, setLoginNotice] = useState<LoginNotice | null>(null)
  // Vrai pendant une déconnexion demandée : l'événement SIGNED_OUT n'est alors pas une session perdue.
  const signingOut = useRef(false)
  // Saisie de l'onglet « Ventes » en cours : un autre onglet démonte l'écran, elle reste ici.
  const salesDraft = useRef<SalesDraftState | null>(null)

  useEffect(() => {
    // Le rappel se contente de mettre à jour l'état : un appel Supabase ici peut bloquer supabase-js.
    const { data } = supabase.auth.onAuthStateChange((event, current) => {
      const next = nextSessionState(event, current !== null)
      if (next === null) return
      setSession(next)
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setLoginNotice(null)
      if (event === 'SIGNED_OUT') {
        setTab('scanner')
        setOverlay(null)
        if (!signingOut.current) setLoginNotice(SESSION_EXPIRED)
        signingOut.current = false
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const onSessionExpired = useCallback(() => {
    setLoginNotice(SESSION_EXPIRED)
    setSession('signed_out')
    setTab('scanner')
    setOverlay(null)
    void supabase.auth.signOut({ scope: 'local' })
  }, [])

  const catalog = useCatalog({ enabled: session === 'signed_in' && employee !== null, onSessionExpired })

  const signOut = useCallback(async () => {
    signingOut.current = true
    setLoginNotice(null)
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (!error) return
    // supabase-js retire la session locale même quand l'appel échoue : on ne prévient que si elle est restée (m5).
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      signingOut.current = false
      window.alert('Déconnexion impossible sans réseau. Réessaie quand le réseau revient.')
    }
  }, [])

  // Mot de passe changé : la déconnexion qui suit est voulue, et l'écran de connexion le dit.
  const beforePasswordSignOut = useCallback(() => {
    signingOut.current = true
    setLoginNotice(PASSWORD_CHANGED)
  }, [])

  const chooseEmployee = useCallback((name: string) => {
    saveEmployeeName(name)
    setEmployee(name)
    setOverlay(null)
  }, [])

  function changeTab(next: Tab) {
    setTab(next)
    catalog.refresh()
  }

  if (session === 'checking') {
    return (
      <main className="screen">
        <p className="muted">Chargement…</p>
      </main>
    )
  }
  if (session === 'signed_out') return <LoginScreen notice={loginNotice} />
  if (employee === null) return <NameScreen onChosen={chooseEmployee} onSessionExpired={onSessionExpired} />

  const shoppingCount = catalog.products ? shoppingList(catalog.products).length : null

  return (
    <>
      <div className="app" hidden={overlay !== null}>
        <header className="app-header">
          <span className="brand-tile" aria-hidden="true">
            <IconBarcode size={18} strokeWidth={2.2} />
          </span>
          <span className="brand">ScanDrinks</span>
          <span className="employee">{employee}</span>
          <button type="button" className="icon-button" aria-label="Réglages" onClick={() => setOverlay('settings')}>
            <IconSettings strokeWidth={1.8} />
          </button>
        </header>
        <div hidden={tab !== 'scanner'}>
          <ScannerScreen
            employee={employee}
            active={overlay === null && tab === 'scanner'}
            onSessionExpired={onSessionExpired}
            onCatalogChanged={catalog.refresh}
          />
        </div>
        {tab === 'shopping' && (
          <ShoppingScreen catalog={catalog} employee={employee} onCatalogChanged={catalog.refresh} onSessionExpired={onSessionExpired} />
        )}
        {tab === 'stock' && (
          <StockScreen catalog={catalog} employee={employee} onCatalogChanged={catalog.refresh} onSessionExpired={onSessionExpired} />
        )}
        {tab === 'sales' && (
          <SalesScreen
            catalog={catalog}
            employee={employee}
            keep={salesDraft}
            onCatalogChanged={catalog.refresh}
            onSessionExpired={onSessionExpired}
          />
        )}
        {tab === 'history' && (
          <HistoryScreen employee={employee} onCatalogChanged={catalog.refresh} onSessionExpired={onSessionExpired} />
        )}
        <TabBar tab={tab} shoppingCount={shoppingCount} onChange={changeTab} />
      </div>
      {overlay === 'settings' && (
        <SettingsScreen
          employee={employee}
          onChangeName={() => setOverlay('name')}
          onTutorial={() => setOverlay('tutorial')}
          onChangePassword={() => setOverlay('password')}
          onSignOut={() => void signOut()}
          onBack={() => setOverlay(null)}
        />
      )}
      {overlay === 'name' && (
        <NameScreen onChosen={chooseEmployee} onSessionExpired={onSessionExpired} onCancel={() => setOverlay('settings')} />
      )}
      {overlay === 'tutorial' && <TutorialScreen onBack={() => setOverlay('settings')} />}
      {overlay === 'password' && (
        <ChangePasswordScreen
          onDone={() => setOverlay(null)}
          onCancel={() => setOverlay('settings')}
          beforeLocalSignOut={beforePasswordSignOut}
        />
      )}
    </>
  )
}
