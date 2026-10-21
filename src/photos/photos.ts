/**
 * photos.ts — Images des codes : réglages, textes et règles, sans réseau.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.3, §6.4, §6.6, §7)
 *
 * Chaque code peut avoir une image : celle d'Open Food Facts (« off »),
 * recopiée chez nous, ou une photo de l'équipe (« equipe »). Les fichiers
 * vont dans le compartiment privé « photos », sous codes/<code>/<uuid>.jpg,
 * en JPEG de 480 px de côté au plus. Ils se lisent par des liens signés d'une
 * heure, réutilisés 50 minutes au plus.
 */

export const PHOTO_BUCKET = 'photos'
export const PHOTO_MAX_SIDE = 480
export const PHOTO_QUALITY = 0.8
export const PHOTO_URL_SECONDS = 3600
export const PHOTO_URL_REUSE_MS = 50 * 60_000
export const PHOTO_TIMEOUT_MS = 15_000

export const PHOTO_NOT_SAVED_MESSAGE = 'Photo non enregistrée : réessaie depuis la fiche du produit.'
export const PHOTO_RETRY_MESSAGE = 'Photo non enregistrée : réessaie.'

export type PhotoSource = 'off' | 'equipe'

const OFF_IMAGES = 'https://images.openfoodfacts.org/'

export function photoPath(code: string, id: string): string {
  return `codes/${code}/${id}.jpg`
}

// Réduit sans jamais agrandir, en gardant les proportions ; chaque côté vaut 1 px au moins.
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// L'app ne télécharge que des images d'Open Food Facts, en https.
export function isOffImageUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(OFF_IMAGES)
}

// Sous le code, dans la fiche produit : « 1 unité · Image : Open Food Facts » (licence CC BY-SA, spec §6.6).
export function photoSourceLabel(source: PhotoSource): string {
  return source === 'off' ? 'Image : Open Food Facts' : "photo de l'équipe"
}
