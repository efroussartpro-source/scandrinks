/**
 * HelpField.tsx — Champ de saisie avec son aide en dessous.
 *
 * L'aide et l'éventuelle erreur sont reliées au champ par aria-describedby.
 * Elles restent hors du libellé, qui garde ainsi son nom exact.
 * En ligne (inline, pour les nombres d'une fiche, §6.7) : le libellé et
 * l'aide à gauche, la case à droite.
 */
import { useId, type InputHTMLAttributes } from 'react'

interface HelpFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  help: string
  error?: string
  inline?: boolean
}

export default function HelpField({ label, help, error, inline = false, ...inputProps }: HelpFieldProps) {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  return (
    <div className={inline ? 'field field-inline' : 'field'}>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={error ? `${helpId} ${errorId}` : helpId} {...inputProps} />
      <span id={helpId} className="field-help">
        {help}
      </span>
      {error && (
        <span id={errorId} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
