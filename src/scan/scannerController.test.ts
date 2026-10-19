import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createScanDeduper } from './deduper'
import type { DetectedCode } from './detector'
import { createScannerController, type ScannerState } from './scannerController'

class FakeTrack extends EventTarget {
  stop = vi.fn()
}

const named = (name: string) => Object.assign(new Error(name), { name })
const COCA: DetectedCode = { rawValue: '5449000000996', format: 'ean_13' }

interface SetupOptions {
  detect?: () => Promise<DetectedCode[]>
  createDetector?: () => Promise<{ detector: { detect: () => Promise<DetectedCode[]> }; engine: 'zxing' | 'native' }>
  startCamera?: () => Promise<{ stream: MediaStream; width: number; height: number }>
  readyState?: number
  now?: () => number
}

function setup(options: SetupOptions = {}) {
  const track = new FakeTrack()
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  const video = { readyState: options.readyState ?? 4 } as unknown as HTMLVideoElement
  const detect = vi.fn(options.detect ?? (async () => [] as DetectedCode[]))
  const deps = {
    createDetector: vi.fn(options.createDetector ?? (async () => ({ detector: { detect }, engine: 'zxing' as const }))),
    startCamera: vi.fn(options.startCamera ?? (async () => ({ stream, width: 1280, height: 720 }))),
    stopCamera: vi.fn(),
    createDeduper: () => createScanDeduper(),
    now: options.now ?? (() => Date.now()),
  }
  const states: ScannerState[] = []
  const detected: Array<[string, string]> = []
  const controller = createScannerController({
    video,
    onDetect: (code, format) => detected.push([code, format]),
    onState: (state) => states.push(state),
    deps,
  })
  const last = () => states[states.length - 1]
  return { controller, deps, detect, track, stream, video, states, detected, last }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createScannerController', () => {
  test('démarre : starting puis running, avec le moteur et la résolution', async () => {
    const s = setup()
    await s.controller.start()
    expect(s.states[0]).toMatchObject({ status: 'starting', errorKind: null })
    expect(s.last()).toMatchObject({ status: 'running', engine: 'zxing', resolution: { width: 1280, height: 720 }, errorKind: null })
    expect(s.deps.startCamera).toHaveBeenCalledWith(s.video)
  })

  test('un second démarrage pendant la lecture ne rouvre pas la caméra', async () => {
    const s = setup()
    await s.controller.start()
    await s.controller.start()
    expect(s.deps.startCamera).toHaveBeenCalledTimes(1)
  })

  test("transmet un code une seule fois tant qu'il reste visible", async () => {
    const s = setup({ detect: async () => [COCA] })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1500)
    expect(s.detect.mock.calls.length).toBeGreaterThan(5)
    expect(s.detected).toEqual([['5449000000996', 'ean_13']])
  })

  test("n'analyse pas tant que la vidéo n'a pas d'image", async () => {
    const s = setup({ readyState: 1 })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.detect).not.toHaveBeenCalled()
    expect(s.last().status).toBe('running')
  })

  test('caméra refusée → erreur denied, sans analyse', async () => {
    const s = setup({ startCamera: async () => { throw named('NotAllowedError') } })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'denied' })
    expect(s.detect).not.toHaveBeenCalled()
  })

  test('lecteur impossible à charger → erreur engine, caméra jamais ouverte', async () => {
    const s = setup({ createDetector: async () => { throw named('ScannerEngineError') } })
    await s.controller.start()
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'engine' })
    expect(s.deps.startCamera).not.toHaveBeenCalled()
  })

  test('fin de la piste vidéo → erreur interrupted, caméra arrêtée, analyse stoppée', async () => {
    const s = setup()
    await s.controller.start()
    s.track.dispatchEvent(new Event('ended'))
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'interrupted' })
    expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream)
    const calls = s.detect.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.detect.mock.calls.length).toBe(calls)
  })

  test("erreur pendant l'analyse → erreur engine, caméra arrêtée", async () => {
    const s = setup({ detect: async () => { throw new Error('wasm') } })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'engine' })
    expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream)
  })

  test('arrêt → idle, caméra arrêtée, plus aucune analyse', async () => {
    const s = setup()
    await s.controller.start()
    s.controller.stop()
    expect(s.last()).toMatchObject({ status: 'idle', errorKind: null })
    expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream)
    const calls = s.detect.mock.calls.length
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.detect.mock.calls.length).toBe(calls)
  })

  test("interruption : sans effet à l'arrêt, interrupted pendant la lecture", async () => {
    const s = setup()
    s.controller.interrupt()
    expect(s.states).toEqual([])
    await s.controller.start()
    s.controller.interrupt()
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'interrupted' })
  })

  test('arrêt pendant le démarrage : la caméra ouverte ensuite est refermée', async () => {
    let openCamera: (value: { stream: MediaStream; width: number; height: number }) => void = () => {}
    const s = setup({ startCamera: () => new Promise((resolve) => { openCamera = resolve }) })
    const starting = s.controller.start()
    await vi.advanceTimersByTimeAsync(0)
    s.controller.stop()
    openCamera({ stream: s.stream, width: 1280, height: 720 })
    await starting
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream)
    expect(s.last()).toMatchObject({ status: 'idle' })
    expect(s.detect).not.toHaveBeenCalled()
  })

  test("mesure la durée d'analyse, au plus une mise à jour par seconde", async () => {
    let t = 0
    const s = setup({ now: () => t, detect: async () => { t += 40; return [] } })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1500)
    expect(s.last().lastDecodeMs).toBe(40)
    expect(s.states.filter((state) => state.lastDecodeMs !== null)).toHaveLength(1)
  })
})
