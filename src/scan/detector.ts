/**
 * detector.ts — Création du détecteur de codes-barres.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2)
 *
 * Détecteur natif du navigateur s'il lit les 6 formats, sinon ZXing-C++ en
 * WebAssembly (barcode-detector/ponyfill). Le fichier .wasm est servi par
 * l'app elle-même : aucun appel à un CDN tiers.
 */
import { BarcodeDetector as ZXingBarcodeDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import zxingWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import { chooseEngine, type ScanEngine } from './engine'
import { PRODUCT_BARCODE_FORMATS } from './formats'

export interface DetectedCode {
  rawValue: string
  format: string
}

export interface CodeDetector {
  detect(source: HTMLVideoElement): Promise<DetectedCode[]>
}

interface NativeBarcodeDetectorConstructor {
  new (options: { formats: string[] }): CodeDetector
  getSupportedFormats(): Promise<string[]>
}

type DetectorResult = { detector: CodeDetector; engine: ScanEngine }

// Mémorisé pour ne charger le wasm qu'une fois par page ; oublié en cas d'échec.
let detectorPromise: Promise<DetectorResult> | null = null

export function createBarcodeDetector(): Promise<DetectorResult> {
  if (!detectorPromise) {
    detectorPromise = buildDetector().catch((error: unknown) => {
      detectorPromise = null
      throw error
    })
  }
  return detectorPromise
}

async function buildDetector(): Promise<DetectorResult> {
  const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector
  let nativeFormats: string[] | null = null
  if (Native) {
    try {
      nativeFormats = await Native.getSupportedFormats()
    } catch {
      nativeFormats = null
    }
  }

  if (Native && chooseEngine(nativeFormats) === 'native') {
    return { detector: new Native({ formats: [...PRODUCT_BARCODE_FORMATS] }), engine: 'native' }
  }

  try {
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? zxingWasmUrl : prefix + path),
      },
      fireImmediately: true,
    })
  } catch (cause) {
    const error = new Error("Le lecteur de codes-barres n'a pas pu se charger.", { cause })
    error.name = 'ScannerEngineError'
    throw error
  }
  return { detector: new ZXingBarcodeDetector({ formats: [...PRODUCT_BARCODE_FORMATS] }), engine: 'zxing' }
}
