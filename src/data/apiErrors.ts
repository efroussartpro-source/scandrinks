/**
 * apiErrors.ts — Classement des erreurs de la base et message affiché.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§7)
 *
 * Les erreurs arrivent sous des formes variées (exception de fetch, erreur
 * PostgREST, erreur de Supabase Auth) : on les ramène à six cas que l'écran
 * sait expliquer. L'ordre des règles compte : un refus sans jeton valide
 * (401) est une session expirée, pas un compte sans accès.
 */

export type ApiErrorKind = 'network' | 'session' | 'forbidden' | 'barcode_taken' | 'invalid' | 'unknown'

const MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Pas de connexion. Réessaie quand le réseau revient.',
  session: 'Ta session a expiré : reconnecte-toi.',
  forbidden: "Ce compte n'a pas accès au stock.",
  barcode_taken: 'Ce code appartient déjà à un autre produit.',
  invalid: 'Enregistrement refusé : vérifie la saisie ou scanne de nouveau.',
  unknown: 'Base injoignable. Réessaie dans un instant.',
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  // Code pris (barcode_taken) ou champ refusé (invalid), quand la base le donne.
  readonly detail: string | null

  constructor(kind: ApiErrorKind, detail: string | null = null, cause?: unknown) {
    super(MESSAGES[kind], { cause })
    this.name = 'ApiError'
    this.kind = kind
    this.detail = detail
  }
}

export function apiErrorMessage(kind: ApiErrorKind): string {
  return MESSAGES[kind]
}

// Après un échec d'enregistrement, la base a peut-être reçu l'envoi (réponse perdue) :
// on ne dit pas « rien n'a été enregistré ». « Réessayer » garde le même identifiant,
// donc ne crée jamais de doublon (décision du porteur du projet, 19/10/2026).
export const SAVE_NOT_CONFIRMED_MESSAGE = 'Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».'

export function saveErrorMessage(kind: ApiErrorKind): string {
  return kind === 'network' ? SAVE_NOT_CONFIRMED_MESSAGE : MESSAGES[kind]
}

const NETWORK_MESSAGE = /failed to fetch|load failed|networkerror/i
// PT401 : session fermée (mot de passe changé), voir private.is_allowed() dans supabase/migrations/.
const SESSION_CODES = ['PGRST301', 'PGRST302', 'PGRST303', 'PT401']
// 23503 : un enregistrement qui vise un produit supprimé entre-temps sur un autre téléphone (RG-15).
const INVALID_CODES = ['23514', '22003', '23502', '22P02', '23503']
const BARCODE_TAKEN = 'barcode_taken:'
const INVALID_INPUT = 'invalid_input:'

const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function classifyApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const fields = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
  const name = text(fields.name)
  const message = text(fields.message) || text(error)
  const code = text(fields.code)
  const status = typeof fields.status === 'number' ? fields.status : null

  if (error instanceof TypeError || name === 'AuthRetryableFetchError' || status === 0 || NETWORK_MESSAGE.test(message)) {
    return new ApiError('network', null, error)
  }
  if (status === 401 || SESSION_CODES.includes(code) || /jwt/i.test(message)) return new ApiError('session', null, error)
  if (code === '42501' || status === 403) return new ApiError('forbidden', null, error)
  if (code === 'P0001' && message.startsWith(BARCODE_TAKEN)) {
    return new ApiError('barcode_taken', message.slice(BARCODE_TAKEN.length) || null, error)
  }
  if (code === '23505') return new ApiError('barcode_taken', null, error)
  if (code === 'P0001' && message.startsWith(INVALID_INPUT)) {
    return new ApiError('invalid', message.slice(INVALID_INPUT.length) || null, error)
  }
  if (INVALID_CODES.includes(code)) return new ApiError('invalid', null, error)
  return new ApiError('unknown', null, error)
}
