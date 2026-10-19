/**
 * scannerController.ts — Pilotage de la lecture : caméra + boucle d'analyse.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §7)
 *
 * Indépendant de React pour être testable et réutilisable (jalon 1) ; le hook
 * useBarcodeScanner n'en est qu'une fine enveloppe. Chaque arrêt change de
 * « session » : les suites d'un démarrage devenu périmé (arrêt pendant la
 * demande d'autorisation, par exemple) referment la caméra au lieu de la
 * laisser allumée.
 */
import { attachCamera, detachVideo, openCamera, stopCamera } from './camera'
import { createScanDeduper } from './deduper'
import { createBarcodeDetector, type CodeDetector, type DetectedCode } from './detector'
import type { ScanEngine } from './engine'
import { classifyScannerError, type ScannerErrorKind } from './scannerErrors'

export type ScannerStatus = 'idle' | 'starting' | 'running' | 'error'

export interface ScannerState {
  status: ScannerStatus
  errorKind: ScannerErrorKind | null
  engine: ScanEngine | null
  resolution: { width: number; height: number } | null
  lastDecodeMs: number | null
}

export const INITIAL_SCANNER_STATE: ScannerState = {
  status: 'idle',
  errorKind: null,
  engine: null,
  resolution: null,
  lastDecodeMs: null,
}

export const SCAN_INTERVAL_MS = 150
const HAVE_CURRENT_DATA = 2 // HTMLMediaElement.HAVE_CURRENT_DATA
const DECODE_REPORT_INTERVAL_MS = 1000

export interface ScannerDeps {
  createDetector: () => Promise<{ detector: CodeDetector; engine: ScanEngine }>
  openCamera: () => Promise<MediaStream>
  attachCamera: (video: HTMLVideoElement, stream: MediaStream) => Promise<{ width: number; height: number }>
  stopCamera: (stream: MediaStream | null) => void
  createDeduper: () => (code: string) => boolean
  now: () => number
}

const DEFAULT_DEPS: ScannerDeps = {
  createDetector: createBarcodeDetector,
  openCamera,
  attachCamera,
  stopCamera,
  createDeduper: () => createScanDeduper(),
  now: () => performance.now(),
}

export interface ScannerController {
  start(): Promise<void>
  stop(): void
  interrupt(): void
}

export function createScannerController(options: {
  video: HTMLVideoElement
  onDetect: (code: string, format: string) => void
  onState: (state: ScannerState) => void
  intervalMs?: number
  deps?: Partial<ScannerDeps>
}): ScannerController {
  const { video, onDetect, onState, intervalMs = SCAN_INTERVAL_MS } = options
  const deps: ScannerDeps = { ...DEFAULT_DEPS, ...options.deps }

  let state = INITIAL_SCANNER_STATE
  let session = 0
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastDecodeReport: number | null = null

  function setState(patch: Partial<ScannerState>) {
    state = { ...state, ...patch }
    onState(state)
  }

  function release() {
    session += 1
    if (timer !== null) clearTimeout(timer)
    timer = null
    deps.stopCamera(stream)
    stream = null
    detachVideo(video)
  }

  function halt(kind: ScannerErrorKind) {
    release()
    setState({ status: 'error', errorKind: kind })
  }

  async function start() {
    if (state.status === 'starting' || state.status === 'running') return
    const current = ++session
    setState({ status: 'starting', errorKind: null })
    try {
      const { detector, engine } = await deps.createDetector()
      if (current !== session) return
      const opened = await deps.openCamera()
      if (current !== session) {
        deps.stopCamera(opened)
        return
      }
      // Retenu avant le branchement : un arrêt pendant attachCamera le referme aussitôt.
      stream = opened
      const size = await deps.attachCamera(video, opened)
      if (current !== session) {
        deps.stopCamera(opened)
        detachVideo(video)
        return
      }
      opened.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (current === session) halt('interrupted')
      })
      const accept = deps.createDeduper()
      lastDecodeReport = null
      setState({
        status: 'running',
        engine,
        resolution: size,
        lastDecodeMs: null,
      })
      void tick(current, detector, accept)
    } catch (error) {
      if (current === session) halt(classifyScannerError(error))
    }
  }

  async function tick(current: number, detector: CodeDetector, accept: (code: string) => boolean) {
    if (current !== session) return
    if (video.readyState >= HAVE_CURRENT_DATA) {
      const startedAt = deps.now()
      let codes: DetectedCode[]
      try {
        codes = await detector.detect(video)
      } catch {
        if (current === session) halt('engine')
        return
      }
      if (current !== session) return
      const finishedAt = deps.now()
      if (lastDecodeReport === null || finishedAt - lastDecodeReport >= DECODE_REPORT_INTERVAL_MS) {
        lastDecodeReport = finishedAt
        setState({ lastDecodeMs: Math.round(finishedAt - startedAt) })
      }
      for (const code of codes) {
        if (!accept(code.rawValue)) continue
        try {
          onDetect(code.rawValue, code.format)
        } catch (error) {
          // Une erreur de l'écran ne doit pas couper la lecture des codes suivants.
          console.error(error)
        }
      }
    }
    timer = setTimeout(() => void tick(current, detector, accept), intervalMs)
  }

  return {
    start,
    stop() {
      release()
      setState({ status: 'idle', errorKind: null })
    },
    interrupt() {
      if (state.status === 'starting' || state.status === 'running') halt('interrupted')
    },
  }
}
