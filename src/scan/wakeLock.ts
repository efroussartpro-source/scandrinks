/**
 * wakeLock.ts — Écran allumé pendant le scan.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2)
 *
 * L'écran est demandé tant que c'est actif et que l'app est au premier plan,
 * puis rendu. iOS le rend seul quand l'app passe en arrière-plan : on le
 * redemande au retour. Un téléphone sans cette fonction scanne comme avant ;
 * une demande refusée n'est retentée qu'à la prochaine activation.
 */

export interface WakeLockHandle {
  release(): Promise<void>
}

export interface WakeLockEnv {
  request?: () => Promise<WakeLockHandle>
  isVisible: () => boolean
  onVisibilityChange: (listener: () => void) => () => void
}

export function createWakeLock(env: WakeLockEnv): { setActive(active: boolean): void; dispose(): void } {
  let active = false
  let refused = false
  let disposed = false
  let held: WakeLockHandle | null = null
  let pending = false
  // L'app est passée en arrière-plan pendant la demande : le verrou reçu ne vaut plus.
  let stale = false

  const letGo = (lock: WakeLockHandle) => void lock.release().catch(() => undefined)

  function acquire() {
    if (!env.request || disposed || !active || refused || held !== null || pending || !env.isVisible()) return
    let request: Promise<WakeLockHandle>
    try {
      request = env.request()
    } catch {
      refused = true
      return
    }
    pending = true
    stale = false
    request.then(
      (lock) => {
        pending = false
        if (stale || disposed || !active) {
          letGo(lock)
          acquire()
        } else held = lock
      },
      () => {
        pending = false
        refused = true
      },
    )
  }

  const stopListening = env.onVisibilityChange(() => {
    if (env.isVisible()) acquire()
    else {
      held = null
      if (pending) stale = true
    }
  })

  function release() {
    if (held !== null) letGo(held)
    held = null
  }

  return {
    setActive(next) {
      if (next === active) return
      active = next
      if (active) acquire()
      else {
        refused = false
        release()
      }
    },
    dispose() {
      disposed = true
      active = false
      stopListening()
      release()
    },
  }
}
