/**
 * wakeLock.ts — Écran allumé pendant le scan.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §9 « Mise en service »)
 *
 * L'écran est demandé tant que c'est actif et que l'app est au premier plan,
 * puis rendu. iOS le rend seul quand l'app passe en arrière-plan : on le
 * redemande au retour. Le système peut aussi le rendre de lui-même alors que
 * la page est visible (économie d'énergie, par exemple, s7) : on le
 * redemande une fois. Un second relâchement par le système n'est suivi
 * d'aucune demande avant la prochaine activation ou le prochain retour au
 * premier plan : jamais de boucle. L'écran rendu par l'app elle-même n'est
 * pas un relâchement par le système. Un téléphone sans cette fonction scanne
 * comme avant ; une demande refusée n'est retentée qu'à la prochaine
 * activation.
 */

export interface WakeLockHandle {
  release(): Promise<void>
  // Écoute l'écran rendu (l'événement « release » du navigateur), une seule fois.
  onRelease?(listener: () => void): void
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
  // Déjà redemandé après un relâchement par le système, depuis la dernière activation ou le dernier retour au premier plan.
  let retriedAfterRelease = false

  const letGo = (lock: WakeLockHandle) => void lock.release().catch(() => undefined)

  // L'écran est rendu : par le système si l'app tenait encore ce verrou (sinon, c'est elle qui l'a rendu).
  function released(lock: WakeLockHandle) {
    if (held !== lock) return
    held = null
    if (retriedAfterRelease) return
    retriedAfterRelease = true
    acquire()
  }

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
        } else {
          held = lock
          lock.onRelease?.(() => released(lock))
        }
      },
      () => {
        pending = false
        refused = true
      },
    )
  }

  const stopListening = env.onVisibilityChange(() => {
    if (env.isVisible()) {
      retriedAfterRelease = false
      acquire()
    } else {
      held = null
      if (pending) stale = true
    }
  })

  function release() {
    const lock = held
    held = null
    if (lock !== null) letGo(lock)
  }

  return {
    setActive(next) {
      if (next === active) return
      active = next
      if (active) {
        retriedAfterRelease = false
        acquire()
      } else {
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
