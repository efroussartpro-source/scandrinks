/**
 * scannerErrors.ts — Classement des erreurs de scan et messages affichés.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 * Chaque message dit quoi faire, en français simple.
 */

export type ScannerErrorKind = 'denied' | 'unavailable' | 'insecure' | 'engine' | 'interrupted' | 'unknown'

const KIND_BY_ERROR_NAME: Record<string, ScannerErrorKind> = {
  NotAllowedError: 'denied',
  SecurityError: 'denied',
  NotFoundError: 'unavailable',
  NotReadableError: 'unavailable',
  OverconstrainedError: 'unavailable',
  AbortError: 'unavailable',
  InsecureContextError: 'insecure',
  ScannerEngineError: 'engine',
}

export function classifyScannerError(error: unknown): ScannerErrorKind {
  if (typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string') {
    return KIND_BY_ERROR_NAME[error.name] ?? 'unknown'
  }
  return 'unknown'
}

const MESSAGES: Record<ScannerErrorKind, string> = {
  denied:
    "L'accès à la caméra a été refusé. Sur iPhone : Réglages › Safari › Caméra (iOS 18 et plus : Réglages › Apps › Safari › Caméra) › Autoriser, puis recharge la page (ou, depuis l'icône de l'écran d'accueil, ferme l'app et rouvre-la).",
  unavailable: 'Aucune caméra disponible. Elle est peut-être utilisée par une autre app : ferme-la puis réessaie.',
  insecure: 'La caméra ne fonctionne que sur une adresse sécurisée (https).',
  engine: "Le lecteur de codes-barres n'a pas pu se charger. Vérifie la connexion puis réessaie.",
  interrupted: "La caméra s'est arrêtée (app en arrière-plan ou écran verrouillé). Touche « Démarrer la caméra » pour reprendre.",
  unknown: 'Impossible de démarrer la caméra. Réessaie.',
}

export function scannerErrorMessage(kind: ScannerErrorKind): string {
  return MESSAGES[kind]
}
