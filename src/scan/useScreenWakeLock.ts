/**
 * useScreenWakeLock.ts — L'écran reste allumé pendant le scan.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * Branche createWakeLock sur navigator.wakeLock (Safari sur iOS 16.4 ou plus)
 * et sur la visibilité de la page. Sur un téléphone sans cette fonction,
 * l'écran s'éteint comme avant.
 */
import { useEffect, useRef } from 'react'
import { createWakeLock } from './wakeLock'

export function useScreenWakeLock(active: boolean): void {
  const lock = useRef<ReturnType<typeof createWakeLock> | null>(null)

  useEffect(() => {
    const created = createWakeLock({
      request: 'wakeLock' in navigator ? () => navigator.wakeLock.request('screen') : undefined,
      isVisible: () => document.visibilityState === 'visible',
      onVisibilityChange: (listener) => {
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
      },
    })
    lock.current = created
    return () => {
      created.dispose()
      lock.current = null
    }
  }, [])

  useEffect(() => {
    lock.current?.setActive(active)
  }, [active])
}
