import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createPhotoUrls } from './photoUrls'

const COCA = 'codes/5449000000996/a.jpg'
const LIPTON = 'codes/3502110123091/b.jpg'

type Sign = (paths: string[]) => Promise<Array<{ path: string; signedUrl: string | null }>>

// Faux service de liens : il note chaque appel et signe chaque chemin, avec le numéro de l'appel.
function fakeSign() {
  const calls: string[][] = []
  const sign = vi.fn<Sign>(async (paths) => {
    calls.push(paths)
    return paths.map((path) => ({ path, signedUrl: `https://liens.test/${path}?appel=${calls.length}` }))
  })
  return { sign, calls }
}

// Laisse partir les demandes du tour, puis attend les réponses.
async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return pending
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

test('trois demandes du même tour : un seul appel, sans chemin en double', async () => {
  const { sign, calls } = fakeSign()
  const urls = createPhotoUrls(sign, () => 0)
  const [coca, lipton, cocaAgain] = await settle(Promise.all([urls.get(COCA), urls.get(LIPTON), urls.get(COCA)]))
  expect(calls).toEqual([[COCA, LIPTON]])
  expect([coca, lipton, cocaAgain]).toEqual([`https://liens.test/${COCA}?appel=1`, `https://liens.test/${LIPTON}?appel=1`,
    `https://liens.test/${COCA}?appel=1`])
})

test("une demande faite pendant l'attente de la réponse attend la même réponse", async () => {
  let answer: (value: Array<{ path: string; signedUrl: string | null }>) => void = () => {}
  const sign = vi.fn<Sign>(() => new Promise((resolve) => { answer = resolve }))
  const urls = createPhotoUrls(sign, () => 0)
  const first = urls.get(COCA)
  await vi.runAllTimersAsync()
  const second = urls.get(COCA)
  await vi.runAllTimersAsync()
  answer([{ path: COCA, signedUrl: 'https://liens.test/coca' }])
  expect(await Promise.all([first, second])).toEqual(['https://liens.test/coca', 'https://liens.test/coca'])
  expect(sign).toHaveBeenCalledTimes(1)
})

test('un lien sert 50 minutes : réutilisé à 49, redemandé à 51', async () => {
  const { sign, calls } = fakeSign()
  let clock = 0
  const urls = createPhotoUrls(sign, () => clock)
  await settle(urls.get(COCA))
  clock = 49 * 60_000
  expect(await settle(urls.get(COCA))).toBe(`https://liens.test/${COCA}?appel=1`)
  clock = 51 * 60_000
  expect(await settle(urls.get(COCA))).toBe(`https://liens.test/${COCA}?appel=2`)
  expect(calls).toEqual([[COCA], [COCA]])
})

test("un échec, ou un lien vide, donne null sans être gardé : la demande suivante repart", async () => {
  const sign = vi.fn<Sign>()
    .mockRejectedValueOnce(new TypeError('Load failed'))
    .mockResolvedValueOnce([{ path: COCA, signedUrl: null }])
    .mockResolvedValueOnce([{ path: COCA, signedUrl: 'https://liens.test/coca' }])
  const urls = createPhotoUrls(sign, () => 0)
  expect(await settle(urls.get(COCA))).toBeNull()
  expect(await settle(urls.get(COCA))).toBeNull()
  expect(await settle(urls.get(COCA))).toBe('https://liens.test/coca')
  expect(sign).toHaveBeenCalledTimes(3)
})

test('remember : le lien retenu est servi sans appel', async () => {
  const { sign } = fakeSign()
  const urls = createPhotoUrls(sign, () => 0)
  urls.remember(COCA, 'blob:photo-envoyee')
  expect(await settle(urls.get(COCA))).toBe('blob:photo-envoyee')
  expect(sign).not.toHaveBeenCalled()
})
