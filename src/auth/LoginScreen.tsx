/**
 * LoginScreen.tsx — Connexion au compte du tabac (première ouverture, session expirée).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1, §6.4)
 *
 * L'adresse du compte est déjà remplie : on ne tape que le mot de passe.
 * Le champ e-mail en lecture seule permet au trousseau iCloud d'enregistrer
 * le mot de passe avec la bonne adresse. Le message d'accueil dit pourquoi
 * se reconnecter : en vert après un changement de mot de passe, en rouge
 * après une session perdue.
 */
import { useState, type FormEvent } from 'react'
import { SHOP_EMAIL, supabase } from '../data/supabaseClient'
import { loginErrorMessage } from './loginError'

export interface LoginNotice {
  text: string
  tone: 'error' | 'ok'
}

export default function LoginScreen({ notice }: { notice: LoginNotice | null }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting || password === '') return
    setSubmitting(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: SHOP_EMAIL, password })
      // En cas de réussite, AppShell change d'écran (événement SIGNED_IN).
      if (signInError) setError(loginErrorMessage(signInError))
    } catch (thrown) {
      setError(loginErrorMessage(thrown))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="screen">
      <h1>ScanDrinks</h1>
      {notice?.tone === 'ok' && (
        <p role="status" className="message message-ok">
          {notice.text}
        </p>
      )}
      {notice?.tone === 'error' && (
        <p role="alert" className="message message-error">
          {notice.text}
        </p>
      )}
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Compte du tabac</span>
          <input type="email" name="username" autoComplete="username" value={SHOP_EMAIL} readOnly />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="message message-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting || password === ''}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
