/**
 * usePhotoUrl.ts — Lien signé de l'image d'un chemin, pour une balise <img>.
 *
 * null sans chemin, pendant le chargement, ou quand le lien n'a pas pu être
 * obtenu (fichier absent, réseau coupé) : l'écran montre alors l'icône grise.
 */
import { useEffect, useState } from 'react'
import { photoUrls } from './storage'

export function usePhotoUrl(path: string | null): string | null {
  const [found, setFound] = useState<{ path: string; url: string | null } | null>(null)
  useEffect(() => {
    if (path === null) return
    let active = true
    void photoUrls.get(path).then((url) => {
      if (active) setFound({ path, url })
    })
    return () => {
      active = false
    }
  }, [path])
  return path !== null && found?.path === path ? found.url : null
}
