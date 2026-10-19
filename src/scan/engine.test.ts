import { describe, expect, test } from 'vitest'
import { ZXING_WASM_VERSION } from 'barcode-detector/ponyfill'
import pkg from '../../package.json'
import { chooseEngine, engineLabel } from './engine'

const ALL = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128']

describe('chooseEngine', () => {
  test("ZXing quand le navigateur n'a pas de détecteur natif (Safari)", () => {
    expect(chooseEngine(null)).toBe('zxing')
  })
  test('natif quand les 6 formats sont pris en charge', () => {
    expect(chooseEngine([...ALL, 'qr_code'])).toBe('native')
  })
  test('ZXing si un seul format manque', () => {
    expect(chooseEngine(ALL.filter((f) => f !== 'itf'))).toBe('zxing')
  })
})

describe('engineLabel', () => {
  test('libellés affichés', () => {
    expect(engineLabel('zxing')).toBe('ZXing (WebAssembly)')
    expect(engineLabel('native')).toBe('natif (navigateur)')
  })
})

test('zxing-wasm installé = version embarquée par barcode-detector', () => {
  expect(pkg.dependencies['zxing-wasm']).toBe(ZXING_WASM_VERSION)
})
