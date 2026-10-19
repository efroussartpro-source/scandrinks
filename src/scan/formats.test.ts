import { describe, expect, test } from 'vitest'
import { PRODUCT_BARCODE_FORMATS, formatLabel } from './formats'

describe('PRODUCT_BARCODE_FORMATS', () => {
  test('contient exactement les 6 formats du cahier des charges', () => {
    expect(PRODUCT_BARCODE_FORMATS).toEqual(['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'])
  })
})

describe('formatLabel', () => {
  test.each([
    ['ean_13', 'EAN-13'], ['ean_8', 'EAN-8'], ['upc_a', 'UPC-A'],
    ['upc_e', 'UPC-E'], ['itf', 'ITF-14'], ['code_128', 'Code 128'],
  ])('%s → %s', (format, label) => {
    expect(formatLabel(format)).toBe(label)
  })
  test('renvoie tel quel un format inconnu', () => {
    expect(formatLabel('qr_code')).toBe('qr_code')
  })
})
