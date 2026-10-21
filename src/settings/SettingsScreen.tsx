/**
 * SettingsScreen.tsx — Réglages : changer de prénom, l'Apparence, changer le mot de passe du tabac, se déconnecter.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.7)
 *
 * Listes groupées, comme les réglages de l'iPhone (maquette
 * docs/maquettes/J-reglages.dc.html). L'Apparence ne vaut que pour ce
 * téléphone et s'applique tout de suite. « Se déconnecter », action rare,
 * est à part, en rouge.
 */
import { useState } from 'react'
import { APPEARANCE_CHOICES, chooseAppearance, loadAppearance, type Appearance } from '../theme/appearance'
import { IconChevronLeft, IconChevronRight, IconLock, IconUser } from '../ui/icons'
import './Settings.css'

interface SettingsScreenProps {
  employee: string
  onChangeName: () => void
  onChangePassword: () => void
  onSignOut: () => void
  onBack: () => void
}

export default function SettingsScreen({ employee, onChangeName, onChangePassword, onSignOut, onBack }: SettingsScreenProps) {
  const [appearance, setAppearance] = useState<Appearance>(() => loadAppearance())

  function choose(value: Appearance) {
    chooseAppearance(value)
    setAppearance(value)
  }

  function signOut() {
    if (window.confirm('Se déconnecter ? Il faudra retaper le mot de passe du tabac.')) onSignOut()
  }

  return (
    <main className="screen settings">
      <button type="button" className="link back" onClick={onBack}>
        <IconChevronLeft />
        Retour
      </button>
      <h1>Réglages</h1>
      <div className="group">
        <button type="button" className="row" onClick={onChangeName}>
          <span className="tile tile-indigo">
            <IconUser size={18} />
          </span>
          <span className="row-text">Changer de prénom</span>
          <span className="row-value">{employee}</span>
          <span className="chevron">
            <IconChevronRight size={18} />
          </span>
        </button>
      </div>
      <h2 className="section-label">Apparence</h2>
      <div className="card appearance">
        <div className="segmented" role="group" aria-label="Apparence">
          {APPEARANCE_CHOICES.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={appearance === value} onClick={() => choose(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="note settings-note">« Automatique » suit le réglage de l'iPhone. Ce choix ne vaut que pour ce téléphone.</p>
      <div className="group">
        <button type="button" className="row" onClick={onChangePassword}>
          <span className="tile tile-gray">
            <IconLock size={18} />
          </span>
          <span className="row-text">Changer le mot de passe du tabac</span>
          <span className="chevron">
            <IconChevronRight size={18} />
          </span>
        </button>
      </div>
      <button type="button" className="danger block" onClick={signOut}>
        Se déconnecter
      </button>
    </main>
  )
}
