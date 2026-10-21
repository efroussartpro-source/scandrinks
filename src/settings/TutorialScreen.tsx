/**
 * TutorialScreen.tsx — Écran « Tutoriel » des Réglages : la vidéo tuto, lue sans quitter l'app.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.2, §7, §9 « Mise en service »)
 *
 * Le lecteur natif de l'iPhone lit la liste HLS ; rien n'est chargé avant le
 * toucher de lecture. Comme pour tous les Réglages, la caméra du Scanner est
 * arrêtée pendant ce temps (AppShell). Si la vidéo ne se charge pas, un
 * message s'affiche sous le lecteur. Aucun lien vers la page /tutoriel/ : il
 * ferait sortir l'app installée, sans moyen d'y revenir.
 */
import { useState } from 'react'
import { IconChevronLeft } from '../ui/icons'
import { TUTORIAL_LENGTH_NOTE, TUTORIAL_LOAD_ERROR, TUTORIAL_PLAYLIST, TUTORIAL_POSTER } from './tutorial'
import './Tutorial.css'

export default function TutorialScreen({ onBack }: { onBack: () => void }) {
  const [failed, setFailed] = useState(false)

  return (
    <main className="screen tutorial">
      <button type="button" className="link back" onClick={onBack}>
        <IconChevronLeft />
        Retour
      </button>
      <h1>Tutoriel</h1>
      <p className="subtitle">{TUTORIAL_LENGTH_NOTE}</p>
      <video
        controls
        playsInline
        preload="none"
        poster={TUTORIAL_POSTER}
        src={TUTORIAL_PLAYLIST}
        aria-label="Vidéo tuto"
        onError={() => setFailed(true)}
      />
      {failed && (
        <p role="alert" className="message message-error">
          {TUTORIAL_LOAD_ERROR}
        </p>
      )}
    </main>
  )
}
