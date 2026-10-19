/**
 * SettingsScreen.tsx — Réglages : changer de prénom, se déconnecter.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6)
 *
 * Le changement du mot de passe du tabac arrive au jalon 3.
 */

interface SettingsScreenProps {
  employee: string
  onChangeName: () => void
  onSignOut: () => void
  onBack: () => void
}

export default function SettingsScreen({ employee, onChangeName, onSignOut, onBack }: SettingsScreenProps) {
  function signOut() {
    if (window.confirm('Se déconnecter ? Il faudra retaper le mot de passe du tabac.')) onSignOut()
  }

  return (
    <main className="screen">
      <h1>Réglages</h1>
      <p>
        Prénom sur ce téléphone : <strong>{employee}</strong>
      </p>
      <button type="button" onClick={onChangeName}>
        Changer de prénom
      </button>
      <button type="button" onClick={signOut}>
        Se déconnecter
      </button>
      <button type="button" className="primary" onClick={onBack}>
        Retour
      </button>
    </main>
  )
}
