import { describe, expect, test } from 'vitest'
import { isUnitFormat, isValidGtin, normalizeScannedCode } from './normalize'

const product = (code: string) => ({ kind: 'product', code })
const ignored = (reason: string) => ({ kind: 'ignored', reason })

describe('normalizeScannedCode', () => {
  test.each([
    ['ean_13', '3502110123091', product('3502110123091')],                       // pack Lipton (code court)
    ['ean_13', '9002490274658', product('9002490274658')],                       // pack Red Bull
    ['upc_a', '049000028911', product('0049000028911')],                         // UPC-A → EAN-13
    ['ean_8', '96385074', product('96385074')],
    ['upc_e', '01234565', product('01234565')],
    ['code_128', '0103502110123091152706202000100000208663', product('3502110123091')], // code long Lipton, tel que l'app le lit
    ['code_128', '(01)03502110123091(15)270620(20)00(10)0000208663', product('3502110123091')],
    ['code_128', ']C10103502110123091', product('3502110123091')],
    ['code_128', '\u001d0103502110123091\u001d10ABC', product('3502110123091')],
    ['code_128', '902602365', ignored('not_a_product')],                         // lot Red Bull « (90)2602365 »
    ['code_128', 'ABC-123', ignored('not_a_product')],
    ['code_128', '0103502110123092', ignored('invalid_check_digit')],
    ['itf', '05449000000996', product('5449000000996')],                         // GTIN-14 commençant par 0 → 13 chiffres
    ['itf', '15449000000993', product('15449000000993')],                        // carton : GTIN-14 gardé
    ['itf', '15449000000994', ignored('invalid_check_digit')],
    ['itf', '1234567890', ignored('not_a_product')],
    ['ean_13', '3502110123092', ignored('invalid_check_digit')],
    ['qr_code', 'https://example.org', ignored('not_a_product')],
  ])('%s %s', (format, raw, expected) => {
    expect(normalizeScannedCode(raw, format)).toEqual(expected)
  })
})

test.each([['3502110123091', true], ['3502110123092', false], ['96385074', true], ['03502110123091', true], ['12a4', false]])(
  'isValidGtin(%s) = %s', (digits, valid) => { expect(isValidGtin(digits)).toBe(valid) })

test("isUnitFormat : seuls les formats d'une canette ou d'une bouteille", () => {
  expect(['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'].map(isUnitFormat)).toEqual([true, true, true, true, false, false])
})
