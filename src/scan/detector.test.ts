import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const ALL = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128']
const WASM_URL_MODULE = 'zxing-wasm/reader/zxing_reader.wasm?url'

// Remplace l'API BarcodeDetector du navigateur (seule dépendance externe).
class FakeNativeDetector {
  static formatsAsked: string[] | null = null
  static async getSupportedFormats() {
    return [...ALL, 'qr_code']
  }
  constructor(options: { formats: string[] }) {
    FakeNativeDetector.formatsAsked = options.formats
  }
  async detect() {
    return []
  }
}

function wasmUnreachable() {
  vi.doMock(WASM_URL_MODULE, () => ({ default: '/introuvable/zxing_reader.wasm' }))
}

beforeEach(() => {
  vi.resetModules()
  FakeNativeDetector.formatsAsked = null
})

afterEach(() => {
  vi.doUnmock(WASM_URL_MODULE)
  vi.doUnmock('barcode-detector/ponyfill')
  vi.unstubAllGlobals()
})

describe('createBarcodeDetector', () => {
  test('utilise le détecteur natif quand il lit les 6 formats', async () => {
    vi.stubGlobal('BarcodeDetector', FakeNativeDetector)
    const { createBarcodeDetector } = await import('./detector')
    const { detector, engine } = await createBarcodeDetector()
    expect(engine).toBe('native')
    expect(detector).toBeInstanceOf(FakeNativeDetector)
    expect(FakeNativeDetector.formatsAsked).toEqual(ALL)
  })

  test('rejette avec ScannerEngineError quand le wasm de ZXing ne se charge pas', async () => {
    wasmUnreachable()
    const { createBarcodeDetector } = await import('./detector')
    await expect(createBarcodeDetector()).rejects.toMatchObject({ name: 'ScannerEngineError' })
  })

  test('après un échec, un nouvel essai est possible', async () => {
    wasmUnreachable()
    const { createBarcodeDetector } = await import('./detector')
    await expect(createBarcodeDetector()).rejects.toMatchObject({ name: 'ScannerEngineError' })
    vi.stubGlobal('BarcodeDetector', FakeNativeDetector)
    await expect(createBarcodeDetector()).resolves.toMatchObject({ engine: 'native' })
  })

  test('après un échec de ZXing, le module est purgé, et le nouvel essai le recharge', async () => {
    const purge = vi.fn()
    let attempt = 0
    vi.doMock('barcode-detector/ponyfill', () => ({
      BarcodeDetector: class {
        async detect() {
          return []
        }
      },
      prepareZXingModule: async () => {
        if (attempt++ === 0) throw new Error('wasm')
      },
      purgeZXingModule: purge,
    }))
    const { createBarcodeDetector } = await import('./detector')
    await expect(createBarcodeDetector()).rejects.toMatchObject({ name: 'ScannerEngineError' })
    expect(purge).toHaveBeenCalledTimes(1)
    await expect(createBarcodeDetector()).resolves.toMatchObject({ engine: 'zxing' })
  })
})
