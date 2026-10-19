/**
 * engine.ts — Choix du moteur de lecture des codes-barres.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2)
 * Le détecteur natif du navigateur n'est retenu que s'il lit les 6 formats ;
 * sinon (cas de Safari), on utilise ZXing en WebAssembly.
 */
import { PRODUCT_BARCODE_FORMATS } from './formats'

export type ScanEngine = 'native' | 'zxing'

export function chooseEngine(nativeFormats: readonly string[] | null): ScanEngine {
  if (nativeFormats === null) return 'zxing'
  return PRODUCT_BARCODE_FORMATS.every((format) => nativeFormats.includes(format)) ? 'native' : 'zxing'
}

const ENGINE_LABELS: Record<ScanEngine, string> = {
  native: 'natif (navigateur)',
  zxing: 'ZXing (WebAssembly)',
}

export function engineLabel(engine: ScanEngine): string {
  return ENGINE_LABELS[engine]
}
