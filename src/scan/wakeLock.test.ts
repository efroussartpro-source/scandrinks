import { expect, test } from 'vitest'
import { createWakeLock, type WakeLockEnv } from './wakeLock'

function fakeEnv(options: { supported?: boolean; refuse?: boolean } = {}) {
  const log: string[] = []
  let visible = true
  let listener: (() => void) | null = null
  // Prévient l'écouteur onRelease du dernier verrou, une seule fois, comme l'événement « release » du navigateur.
  let releaseLast: () => void = () => undefined
  const env: WakeLockEnv = {
    request:
      options.supported === false
        ? undefined
        : async () => {
            log.push('request')
            if (options.refuse) throw new Error('NotAllowedError')
            let onReleased: (() => void) | null = null
            const fire = () => {
              const released = onReleased
              onReleased = null
              released?.()
            }
            releaseLast = fire
            return {
              // Rendu par l'app : le navigateur envoie aussi l'événement « release ».
              release: async () => {
                log.push('release')
                fire()
              },
              onRelease: (fn: () => void) => {
                onReleased = fn
              },
            }
          },
    isVisible: () => visible,
    onVisibilityChange: (fn) => {
      listener = fn
      return () => {
        listener = null
      }
    },
  }
  const setVisible = (value: boolean) => {
    visible = value
    listener?.()
  }
  // Le système rend l'écran de lui-même (économie d'énergie, par exemple), page visible.
  const systemRelease = () => releaseLast()
  return { env, log, setVisible, systemRelease, listening: () => listener !== null }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test('actif et visible : écran demandé une fois ; plus actif : rendu une fois', async () => {
  const { env, log } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  lock.setActive(true)
  await flush()
  expect(log).toEqual(['request'])
  lock.setActive(false)
  lock.setActive(false)
  await flush()
  expect(log).toEqual(['request', 'release'])
})

test("arrière-plan puis retour : l'écran est redemandé", async () => {
  const { env, log, setVisible } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  setVisible(false)
  await flush()
  setVisible(true)
  await flush()
  expect(log).toEqual(['request', 'request'])
})

test('rendu même si la réponse arrive après la fin', async () => {
  const { env, log } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  lock.setActive(false)
  await flush()
  expect(log).toEqual(['request', 'release'])
})

test('sans Wake Lock : rien ne casse', async () => {
  const { env, log } = fakeEnv({ supported: false })
  const lock = createWakeLock(env)
  expect(() => lock.setActive(true)).not.toThrow()
  await flush()
  expect(log).toEqual([])
})

test('demande refusée : pas de nouvel essai en boucle', async () => {
  const { env, log, setVisible } = fakeEnv({ refuse: true })
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  lock.setActive(true)
  setVisible(false)
  setVisible(true)
  await flush()
  expect(log).toEqual(['request'])
  lock.setActive(false)
  lock.setActive(true)
  await flush()
  expect(log).toEqual(['request', 'request'])
})

test('relâché par le système, page visible : redemandé une fois', async () => {
  const { env, log, systemRelease } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  systemRelease()
  await flush()
  expect(log).toEqual(['request', 'request'])
})

test('relâché deux fois de suite par le système : pas de boucle', async () => {
  const { env, log, systemRelease } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  systemRelease()
  await flush()
  systemRelease()
  await flush()
  expect(log).toEqual(['request', 'request'])
})

test("rendu par l'app (plus actif) : rien n'est redemandé", async () => {
  const { env, log, systemRelease } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  lock.setActive(false)
  await flush()
  systemRelease()
  await flush()
  expect(log).toEqual(['request', 'release'])
})

test("après un retour au premier plan, un nouveau relâchement est suivi d'une demande", async () => {
  const { env, log, setVisible, systemRelease } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  systemRelease()
  await flush()
  systemRelease()
  await flush()
  expect(log).toEqual(['request', 'request'])
  setVisible(false)
  setVisible(true)
  await flush()
  systemRelease()
  await flush()
  expect(log).toEqual(['request', 'request', 'request', 'request'])
})

test("dispose : écran rendu, plus d'écoute", async () => {
  const { env, log, listening } = fakeEnv()
  const lock = createWakeLock(env)
  lock.setActive(true)
  await flush()
  lock.dispose()
  await flush()
  expect(log).toEqual(['request', 'release'])
  expect(listening()).toBe(false)
})
