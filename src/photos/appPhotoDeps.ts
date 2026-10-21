/**
 * appPhotoDeps.ts — Ce dont savePhoto a besoin dans l'app : réseau, canvas et stockage.
 *
 * À part de savePhoto.ts : ce fichier charge le client Supabase, que les
 * tests unitaires n'ont pas. Seules les images d'Open Food Facts sont
 * téléchargées (isOffImageUrl, vérifié à la lecture d'Open Food Facts).
 */
import { api } from '../data/supabaseClient'
import { blobToJpeg } from './jpeg'
import { PHOTO_TIMEOUT_MS } from './photos'
import type { PhotoDeps } from './savePhoto'
import { photoUrls, uploadPhoto } from './storage'

export const appPhotoDeps: PhotoDeps = {
  async fetchImage(url) {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`Image indisponible (${response.status})`)
    return response.blob()
  },
  toJpeg: blobToJpeg,
  upload: uploadPhoto,
  link: (input) => api.setBarcodePhoto(input),
  remember: (path, jpeg) => photoUrls.remember(path, URL.createObjectURL(jpeg)),
  newId: () => crypto.randomUUID(),
  timeoutMs: PHOTO_TIMEOUT_MS,
}
