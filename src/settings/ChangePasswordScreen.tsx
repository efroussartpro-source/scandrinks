/**
 * ChangePasswordScreen.tsx — Changer le mot de passe du tabac, par-dessus l'app.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.4, §7)
 *
 * Le mot de passe actuel est vérifié, le nouveau enregistré, puis tous les
 * téléphones sont déconnectés, celui-ci compris. Les mots de passe restent
 * dans ces champs : jamais enregistrés ni journalisés. Si le nouveau est
 * peut-être déjà enregistré (réponse perdue), les champs se figent :
 * « Réessayer » reprend les mêmes saisies et sait finir le changement.
 */
import { useRef, useState, type FormEvent } from 'react'
import { changePassword, isUncertainFailure, passwordFailureMessage } from '../auth/changePassword'
import { createPasswordAuth } from '../auth/passwordAuth'
import { validatePasswordChange, type PasswordField } from '../auth/passwordRules'
import { SHOP_EMAIL, supabase } from '../data/supabaseClient'
import { FIELD_HELP } from '../products/fieldHelp'
import HelpField from '../products/HelpField'

interface ChangePasswordScreenProps {
  onDone: () => void
  onCancel: () => void
  beforeLocalSignOut: () => void
}

export default function ChangePasswordScreen({ onDone, onCancel, beforeLocalSignOut }: ChangePasswordScreenProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldError, setFieldError] = useState<{ field: PasswordField; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Le nouveau mot de passe est peut-être déjà enregistré : les saisies ne changent plus.
  const [uncertain, setUncertain] = useState(false)
  const submittingRef = useRef(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    const checked = validatePasswordChange({ current, next, confirm })
    if (!checked.ok) {
      setFieldError({ field: checked.field, message: checked.message })
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setFieldError(null)
    setError(null)
    const auth = createPasswordAuth(supabase, SHOP_EMAIL, beforeLocalSignOut)
    const result = await changePassword(auth, { current, next }, { afterUncertainFailure: uncertain })
    submittingRef.current = false
    if (result.ok) {
      onDone()
      return
    }
    setSubmitting(false)
    if (isUncertainFailure(result.step, result.kind)) setUncertain(true)
    setError(passwordFailureMessage(result.step, result.kind))
  }

  const locked = submitting || uncertain
  const errorFor = (field: PasswordField) => (fieldError?.field === field ? fieldError.message : undefined)

  return (
    <main className="screen">
      <h1>Mot de passe du tabac</h1>
      <p>Tous les téléphones seront déconnectés, celui-ci compris : chacun devra retaper le nouveau mot de passe.</p>
      <form className="form" onSubmit={(event) => void submit(event)}>
        <input
          className="visually-hidden"
          type="email"
          name="username"
          autoComplete="username"
          value={SHOP_EMAIL}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
        />
        <HelpField
          label="Mot de passe actuel"
          help={FIELD_HELP.passwordCurrent}
          error={errorFor('current')}
          type="password"
          autoComplete="current-password"
          value={current}
          disabled={locked}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <HelpField
          label="Nouveau mot de passe"
          help={FIELD_HELP.passwordNew}
          error={errorFor('next')}
          type="password"
          autoComplete="new-password"
          value={next}
          disabled={locked}
          onChange={(event) => setNext(event.target.value)}
        />
        <HelpField
          label="Retape le nouveau mot de passe"
          help={FIELD_HELP.passwordConfirm}
          error={errorFor('confirm')}
          type="password"
          autoComplete="new-password"
          value={confirm}
          disabled={locked}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {error && (
          <p role="alert" className="message message-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Changement…' : uncertain ? 'Réessayer' : 'Changer le mot de passe'}
        </button>
        <button type="button" disabled={submitting} onClick={onCancel}>
          Annuler
        </button>
      </form>
    </main>
  )
}
