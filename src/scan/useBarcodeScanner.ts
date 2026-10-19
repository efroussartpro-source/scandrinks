/**
 * useBarcodeScanner.ts — Hook React autour du contrôleur de lecture.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2)
 * La caméra se coupe quand la page passe en arrière-plan (état
 * `interrupted`) et repart au retour au premier plan ; elle s'arrête au
 * démontage. L'URL n'est jamais modifiée : iOS
 * redemanderait l'autorisation caméra.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  createScannerController,
  INITIAL_SCANNER_STATE,
  type ScannerController,
  type ScannerState,
} from './scannerController'

export interface BarcodeScanner extends ScannerState {
  start: () => Promise<void>
  stop: () => void
}

export function useBarcodeScanner(options: {
  videoRef: RefObject<HTMLVideoElement | null>
  onDetect: (code: string, format: string) => void
  intervalMs?: number
}): BarcodeScanner {
  const { videoRef, onDetect, intervalMs } = options
  const [state, setState] = useState<ScannerState>(INITIAL_SCANNER_STATE)
  const onDetectRef = useRef(onDetect)
  const controllerRef = useRef<ScannerController | null>(null)

  useEffect(() => {
    onDetectRef.current = onDetect
  }, [onDetect])

  const start = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    controllerRef.current ??= createScannerController({
      video,
      intervalMs,
      onState: setState,
      onDetect: (code, format) => onDetectRef.current(code, format),
    })
    await controllerRef.current.start()
  }, [videoRef, intervalMs])

  const stop = useCallback(() => {
    controllerRef.current?.stop()
  }, [])

  // Dernier état connu, lu au retour au premier plan.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    // En arrière-plan, la caméra est coupée ; au retour, elle repart si elle avait été interrompue.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') controllerRef.current?.interrupt()
      else if (stateRef.current.errorKind === 'interrupted') void start()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [start])

  useEffect(
    () => () => {
      controllerRef.current?.stop()
      controllerRef.current = null
    },
    [],
  )

  return { ...state, start, stop }
}
