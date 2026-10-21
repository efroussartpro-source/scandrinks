/**
 * savePhoto.ts — Enregistre l'image d'un code : le fichier au stockage, puis son chemin en base.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.3, §7)
 *
 * L'image vient d'Open Food Facts (téléchargée, puis réduite) ou de l'équipe
 * (déjà réduite). Elle part sous un nom neuf, codes/<code>/<uuid>.jpg, puis
 * devient l'image du code. Jamais bloquant : un échec, ou 15 s sans réponse
 * (réseau bloqué dans la réserve), donne null, et l'écran le dit ; la fiche
 * et le mouvement ne dépendent pas de la photo. Les dépendances sont passées
 * en paramètre (appPhotoDeps.ts pour l'app) : les tests les simulent.
 */
import { photoPath, type PhotoSource } from './photos'

export type PhotoChoice = { source: 'off'; url: string } | { source: 'equipe'; jpeg: Blob }

export interface PhotoDeps {
  fetchImage(url: string): Promise<Blob>
  toJpeg(blob: Blob): Promise<Blob>
  upload(path: string, jpeg: Blob): Promise<void>
  link(input: { code: string; path: string; source: PhotoSource }): Promise<void>
  // Garde une adresse locale de l'image : elle s'affiche sans attendre un lien signé.
  remember(path: string, jpeg: Blob): void
  newId(): string
  timeoutMs: number
}

// Le chemin enregistré, ou null.
export async function savePhoto(code: string, choice: PhotoChoice, deps: PhotoDeps): Promise<string | null> {
  const work = (async () => {
    const jpeg = choice.source === 'off' ? await deps.toJpeg(await deps.fetchImage(choice.url)) : choice.jpeg
    const path = photoPath(code, deps.newId())
    await deps.upload(path, jpeg)
    await deps.link({ code, path, source: choice.source })
    deps.remember(path, jpeg)
    return path
  })().catch(() => null)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), deps.timeoutMs)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}
