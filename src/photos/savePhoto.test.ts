import { afterEach, expect, test, vi } from 'vitest'
import { savePhoto, type PhotoDeps } from './savePhoto'

const OFF_URL = 'https://images.openfoodfacts.org/images/products/544/900/000/0996/front_fr.4.400.jpg'
const fetched = new Blob(["image d'Open Food Facts"], { type: 'image/jpeg' })
const reduced = new Blob(['image réduite'], { type: 'image/jpeg' })
const taken = new Blob(['photo prise'], { type: 'image/jpeg' })
const PATH = 'codes/5449000000996/id-1.jpg'

// Dépendances simulées : chaque étape note son passage, dans l'ordre.
function fakeDeps(over: Partial<PhotoDeps> = {}) {
  const steps: string[] = []
  const deps: PhotoDeps = {
    fetchImage: vi.fn(async (url: string) => {
      steps.push(`fetchImage ${url}`)
      return fetched
    }),
    toJpeg: vi.fn(async () => {
      steps.push('toJpeg')
      return reduced
    }),
    upload: vi.fn(async (path: string) => {
      steps.push(`upload ${path}`)
    }),
    link: vi.fn(async (input: { source: string }) => {
      steps.push(`link ${input.source}`)
    }),
    remember: vi.fn((path: string) => {
      steps.push(`remember ${path}`)
    }),
    newId: () => 'id-1',
    timeoutMs: 15_000,
    ...over,
  }
  return { deps, steps }
}

afterEach(() => {
  vi.useRealTimers()
})

test("Open Food Facts : l'image est téléchargée, réduite, envoyée, puis rattachée au code", async () => {
  const { deps, steps } = fakeDeps()
  await expect(savePhoto('5449000000996', { source: 'off', url: OFF_URL }, deps)).resolves.toBe(PATH)
  expect(steps).toEqual([`fetchImage ${OFF_URL}`, 'toJpeg', `upload ${PATH}`, 'link off', `remember ${PATH}`])
  expect(deps.toJpeg).toHaveBeenCalledWith(fetched)
  expect(deps.upload).toHaveBeenCalledWith(PATH, reduced)
  expect(deps.link).toHaveBeenCalledWith({ code: '5449000000996', path: PATH, source: 'off' })
  expect(deps.remember).toHaveBeenCalledWith(PATH, reduced)
})

test("photo de l'équipe : déjà en JPEG, envoyée telle quelle", async () => {
  const { deps, steps } = fakeDeps()
  await expect(savePhoto('5449000000996', { source: 'equipe', jpeg: taken }, deps)).resolves.toBe(PATH)
  expect(steps).toEqual([`upload ${PATH}`, 'link equipe', `remember ${PATH}`])
  expect(deps.upload).toHaveBeenCalledWith(PATH, taken)
})

test("envoi raté : null, sans rattacher l'image au code", async () => {
  const { deps } = fakeDeps({ upload: vi.fn(async () => Promise.reject(new TypeError('Load failed'))) })
  await expect(savePhoto('5449000000996', { source: 'equipe', jpeg: taken }, deps)).resolves.toBeNull()
  expect(deps.link).not.toHaveBeenCalled()
  expect(deps.remember).not.toHaveBeenCalled()
})

test('rattachement raté : null', async () => {
  const { deps } = fakeDeps({ link: vi.fn(async () => Promise.reject(new Error('invalid_input:photo'))) })
  await expect(savePhoto('5449000000996', { source: 'off', url: OFF_URL }, deps)).resolves.toBeNull()
  expect(deps.remember).not.toHaveBeenCalled()
})

test('envoi sans réponse (réseau bloqué) : null au bout de timeoutMs, pas avant', async () => {
  vi.useFakeTimers()
  const { deps } = fakeDeps({ upload: vi.fn(() => new Promise<void>(() => {})) })
  let settled = false
  const pending = savePhoto('5449000000996', { source: 'equipe', jpeg: taken }, deps).finally(() => {
    settled = true
  })
  await vi.advanceTimersByTimeAsync(14_999)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  await expect(pending).resolves.toBeNull()
})

test("envoi qui répond après le délai : l'image n'est ni rattachée au code ni gardée, comme l'écran l'a dit", async () => {
  vi.useFakeTimers()
  const { deps } = fakeDeps({ upload: vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 20_000))) })
  const pending = savePhoto('5449000000996', { source: 'equipe', jpeg: taken }, deps)
  await vi.advanceTimersByTimeAsync(15_000)
  await expect(pending).resolves.toBeNull()
  await vi.advanceTimersByTimeAsync(5_000)
  expect(deps.link).not.toHaveBeenCalled()
  expect(deps.remember).not.toHaveBeenCalled()
})
