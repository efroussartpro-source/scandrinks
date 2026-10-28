/**
 * NameScreen.tsx — Choix du prénom de la personne qui utilise ce téléphone.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1, §4.6)
 *
 * Les prénoms déjà utilisés s'affichent en grandes cartes, avec leur initiale
 * dans un rond de couleur (maquette C4-Prenom, §6.7) ; sinon on en tape un.
 * Si la liste ne se charge pas, seul le champ reste : l'app reste utilisable.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { IconChevronLeft } from '../ui/icons'
import { validateEmployeeName } from './employee'
import { initialOf, nameTone } from './nameTone'

interface NameScreenProps {
  onChosen: (name: string) => void
  onSessionExpired: () => void
  onCancel?: () => void
}

export default function NameScreen({ onChosen, onSessionExpired, onCancel }: NameScreenProps) {
  const [names, setNames] = useState<string[] | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .listEmployees()
      .then((list) => {
        if (active) setNames(list)
      })
      .catch((thrown: unknown) => {
        if (classifyApiError(thrown).kind === 'session') onSessionExpired()
        else if (active) setNames([])
      })
    return () => {
      active = false
    }
  }, [onSessionExpired])

  function choose(raw: string) {
    const checked = validateEmployeeName(raw)
    if (!checked.ok) {
      setError(checked.message)
      return
    }
    onChosen(checked.name)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    choose(draft)
  }

  return (
    <main className="screen">
      {onCancel && (
        <button type="button" className="link back" onClick={onCancel}>
          <IconChevronLeft />
          Retour
        </button>
      )}
      <h1>Qui es-tu ?</h1>
      {names === null && <p className="muted">Chargement…</p>}
      {names !== null && names.length > 0 && (
        <div className="choices">
          {names.map((name) => (
            <button key={name} type="button" className="name-card" onClick={() => choose(name)}>
              <span className={`name-initial tone-${nameTone(name)}`} aria-hidden="true">
                {initialOf(name)}
              </span>
              <span className="name-label">{name}</span>
            </button>
          ))}
        </div>
      )}
      <form className="card form" onSubmit={submit}>
        <label className="field">
          <span>Nouveau prénom</span>
          <input
            type="text"
            name="given-name"
            autoComplete="given-name"
            autoCapitalize="words"
            maxLength={30}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
            }}
          />
        </label>
        {error && (
          <p role="alert" className="message message-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          C'est moi
        </button>
      </form>
    </main>
  )
}
