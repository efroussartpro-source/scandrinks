/**
 * storage.ts — Le stockage des images de l'app : liens signés et envoi d'une photo.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.3, §6.4)
 *
 * Le compartiment « photos » est privé : chaque image se lit par un lien
 * signé d'une heure (photoUrls), demandé avec le jeton du téléphone. Une photo
 * s'envoie en octets bruts (un Blob partirait en formulaire), sous un nom
 * neuf : jamais de remplacement.
 */
import { classifyApiError } from '../data/apiErrors'
import { supabase } from '../data/supabaseClient'
import { createPhotoUrls } from './photoUrls'
import { PHOTO_BUCKET, PHOTO_URL_SECONDS } from './photos'

export const photoUrls = createPhotoUrls(async (paths) => {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_URL_SECONDS)
  if (error) throw error
  return data.map((item) => ({ path: item.path ?? '', signedUrl: item.signedUrl || null }))
})

export async function uploadPhoto(path: string, jpeg: Blob): Promise<void> {
  let failure: unknown = null
  try {
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, await jpeg.arrayBuffer(), { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
    failure = error
  } catch (thrown) {
    failure = thrown
  }
  if (failure) throw classifyApiError(failure)
}
