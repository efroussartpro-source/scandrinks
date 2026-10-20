import { expect, test } from 'vitest'
import { createWakeLock, type WakeLockEnv } from './wakeLock'

function fakeEnv(options: { supported?: boolean; refuse?: boolean } = {}) {
  const log: string[] = []
  let visible = true
  let listener: (() => void) | null = null
  const env: WakeLockEnv = {
    request:
      options.supported === false
        ? undefined
        : async () => {
            log.push('request')
            if (options.refuse) throw new Error('NotAllowedError')
            return {
              release: async () => {
                log.push('release')
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
  return { env, log, setVisible, listening: () => listener !== null }
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
