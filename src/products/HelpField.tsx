/**
 * HelpField.tsx — Champ de saisie avec son aide en dessous.
 *
 * L'aide et l'éventuelle erreur sont reliées au champ par aria-describedby.
 * Elles restent hors du libellé, qui garde ainsi son nom exact.
 */
import { useId, type InputHTMLAttributes } from 'react'

interface HelpFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  help: string
  error?: string
}

export default function HelpField({ label, help, error, ...inputProps }: HelpFieldProps) {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  return (
    <div className="field">
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
