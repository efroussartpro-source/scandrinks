/**
 * photoUrls.ts — Liens signés des images, demandés ensemble et gardés 50 minutes.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.4)
 *
 * Une liste affiche plusieurs images à la fois : les demandes faites pendant
 * un même tour partent en un seul appel. Un lien vaut une heure ; il est
 * réutilisé 50 minutes au plus, pour ne jamais servir un lien près d'expirer.
 * Un échec, ou un fichier absent (lien vide), donne null, sans être gardé :
 * la demande suivante repart. Une image qui vient d'être envoyée se montre par
 * son adresse locale (remember), sans attendre un lien.
 */
import { PHOTO_URL_REUSE_MS } from './photos'

export type SignPhotos = (paths: string[]) => Promise<Array<{ path: string; signedUrl: string | null }>>

export function createPhotoUrls(sign: SignPhotos, now: () => number = Date.now) {
  const known = new Map<string, { url: string; at: number }>()
  // Réponses attendues, par chemin : un même chemin ne part qu'une fois.
  const pending = new Map<string, Promise<string | null>>()
  // Chemins demandés pendant ce tour, envoyés ensemble au tour suivant.
  let queued: Map<string, (url: string | null) => void> | null = null

  async function send(batch: Map<string, (url: string | null) => void>) {
    const paths = [...batch.keys()]
    let answers: Awaited<ReturnType<SignPhotos>> = []
    try {
      answers = await sign(paths)
    } catch {
      // Réseau coupé : chaque image affiche l'icône grise.
    }
    const at = now()
    for (const path of paths) {
      const url = answers.find((answer) => answer.path === path)?.signedUrl || null
      if (url) known.set(path, { url, at })
      pending.delete(path)
      batch.get(path)?.(url)
    }
  }

  return {
    get(path: string): Promise<string | null> {
      const hit = known.get(path)
      if (hit && now() - hit.at < PHOTO_URL_REUSE_MS) return Promise.resolve(hit.url)
      const waiting = pending.get(path)
      if (waiting) return waiting
      if (queued === null) {
        const batch = new Map<string, (url: string | null) => void>()
        queued = batch
        setTimeout(() => {
          queued = null
          void send(batch)
        }, 0)
      }
      const batch = queued
      const answer = new Promise<string | null>((resolve) => batch.set(path, resolve))
      pending.set(path, answer)
      return answer
    },

    remember(path: string, url: string): void {
      known.set(path, { url, at: now() })
    },
  }
}

export type PhotoUrls = ReturnType<typeof createPhotoUrls>
