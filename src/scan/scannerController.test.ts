import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createScanDeduper } from './deduper'
import type { DetectedCode } from './detector'
import { createScannerController, type ScannerState } from './scannerController'

class FakeTrack extends EventTarget {
  stop = vi.fn()
}

const named = (name: string) => Object.assign(new Error(name), { name })
const streamOf = (track: FakeTrack) => ({ getTracks: () => [track], getVideoTracks: () => [track] }) as unknown as MediaStream
const COCA: DetectedCode = { rawValue: '5449000000996', format: 'ean_13' }

interface SetupOptions {
  detect?: () => Promise<DetectedCode[]>
  createDetector?: () => Promise<{ detector: { detect: () => Promise<DetectedCode[]> }; engine: 'zxing' | 'native' }>
  openCamera?: () => Promise<MediaStream>
  attachCamera?: (video: HTMLVideoElement, stream: MediaStream) => Promise<{ width: number; height: number }>
  onDetect?: (code: string, format: string) => void
  readyState?: number
  now?: () => number
}

function setup(options: SetupOptions = {}) {
  const track = new FakeTrack()
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
  const video = { readyState: options.readyState ?? 4, srcObject: null } as unknown as HTMLVideoElement
  const detect = vi.fn(options.detect ?? (async () => [] as DetectedCode[]))
  const deps = {
    createDetector: vi.fn(options.createDetector ?? (async () => ({ detector: { detect }, engine: 'zxing' as const }))),
    openCamera: vi.fn(options.openCamera ?? (async () => stream)),
    attachCamera: vi.fn(
      options.attachCamera ??
        (async (target: HTMLVideoElement, opened: MediaStream) => {
          target.srcObject = opened
          return { width: 1280, height: 720 }
        }),
    ),
    stopCamera: vi.fn(),
    createDeduper: () => createScanDeduper(),
    now: options.now ?? (() => Date.now()),
  }
  const states: ScannerState[] = []
  const detected: Array<[string, string]> = []
  const controller = createScannerController({
    video,
    onDetect: options.onDetect ?? ((code, format) => detected.push([code, format])),
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
  vi.restoreAllMocks()
})

describe('createScannerController', () => {
  test('démarre : starting puis running, avec le moteur et la résolution', async () => {
    const s = setup()
    await s.controller.start()
    expect(s.states[0]).toMatchObject({ status: 'starting', errorKind: null })
    expect(s.last()).toMatchObject({ status: 'running', engine: 'zxing', resolution: { width: 1280, height: 720 }, errorKind: null })
    expect(s.deps.attachCamera).toHaveBeenCalledWith(s.video, s.stream)
  })

  test('un second démarrage pendant la lecture ne rouvre pas la caméra', async () => {
    const s = setup()
    await s.controller.start()
    await s.controller.start()
    expect(s.deps.openCamera).toHaveBeenCalledTimes(1)
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
    const s = setup({ openCamera: async () => { throw named('NotAllowedError') } })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'denied' })
    expect(s.detect).not.toHaveBeenCalled()
  })

  test('lecteur impossible à charger → erreur engine, caméra jamais ouverte', async () => {
    const s = setup({ createDetector: async () => { throw named('ScannerEngineError') } })
    await s.controller.start()
    expect(s.last()).toMatchObject({ status: 'error', errorKind: 'engine' })
    expect(s.deps.openCamera).not.toHaveBeenCalled()
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
    let openCamera: (stream: MediaStream) => void = () => {}
    const s = setup({ openCamera: () => new Promise((resolve) => { openCamera = resolve }) })
    const starting = s.controller.start()
    await vi.advanceTimersByTimeAsync(0)
    s.controller.stop()
    openCamera(s.stream)
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

  test('un démarrage périmé ne branche jamais son flux sur la vidéo', async () => {
    const [late, fresh] = [streamOf(new FakeTrack()), streamOf(new FakeTrack())]
    let openLate: (stream: MediaStream) => void = () => {}
    let calls = 0
    const s = setup({
      openCamera: () => (calls++ === 0 ? new Promise<MediaStream>((resolve) => { openLate = resolve }) : Promise.resolve(fresh)),
    })
    const first = s.controller.start()
    await vi.advanceTimersByTimeAsync(0)
    s.controller.stop()
    await s.controller.start()
    openLate(late)
    await first
    expect(s.deps.attachCamera).toHaveBeenCalledTimes(1)
    expect(s.deps.attachCamera).toHaveBeenCalledWith(s.video, fresh)
    expect(s.deps.stopCamera).toHaveBeenCalledWith(late)
  })

  test('arrêt pendant le branchement de la vidéo : le flux est refermé et la vidéo détachée', async () => {
    let finishAttach: () => void = () => {}
    const s = setup({
      attachCamera: (video, stream) =>
        new Promise((resolve) => {
          video.srcObject = stream
          finishAttach = () => resolve({ width: 1280, height: 720 })
        }),
    })
    const pending = s.controller.start()
    await vi.advanceTimersByTimeAsync(0)
    s.controller.stop()
    expect(s.deps.stopCamera).toHaveBeenCalledWith(s.stream) // rendue aussitôt, sans attendre la fin du branchement
    finishAttach()
    await pending
    await vi.advanceTimersByTimeAsync(1000)
    expect(s.video.srcObject).toBeNull()
    expect(s.last()).toMatchObject({ status: 'idle' })
    expect(s.detect).not.toHaveBeenCalled()
  })

  test("à l'arrêt, la vidéo est détachée", async () => {
    const s = setup()
    await s.controller.start()
    s.controller.stop()
    expect(s.video.srcObject).toBeNull()
  })

  test("une erreur dans onDetect n'arrête pas la lecture", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let n = 0
    const s = setup({
      detect: async () => [{ rawValue: `CODE-${n++}`, format: 'ean_13' }],
      onDetect: () => { throw new Error('boom') },
    })
    await s.controller.start()
    await vi.advanceTimersByTimeAsync(1500)
    expect(s.detect.mock.calls.length).toBeGreaterThan(5)
    expect(s.last().status).toBe('running')
  })
})
