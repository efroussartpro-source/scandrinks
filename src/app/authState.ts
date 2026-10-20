/**
 * authState.ts — État de la session selon les événements de Supabase Auth.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.1, §7)
 *
 * Un jeton renouvelé (TOKEN_REFRESHED) rétablit la session : ouverte hors
 * réseau après plus d'une heure, l'app quitte seule l'écran de connexion quand
 * le réseau revient (m6). Les autres événements ne changent rien.
 */

export type SessionState = 'checking' | 'signed_out' | 'signed_in'

export function nextSessionState(event: string, hasSession: boolean): SessionState | null {
  switch (event) {
    case 'INITIAL_SESSION':
      return hasSession ? 'signed_in' : 'signed_out'
    case 'SIGNED_IN':
    case 'TOKEN_REFRESHED':
      return hasSession ? 'signed_in' : null
    case 'SIGNED_OUT':
      return 'signed_out'
    default:
      return null
  }
}
