/**
 * normalize.ts — Normalisation des codes lus, avant toute recherche (RG-13).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§5, RG-13)
 *
 * Le code court (EAN-13) et le code long GS1 (Code 128) d'une même étiquette
 * de pack désignent le même produit. Un UPC-A devient son EAN-13, un GTIN-14
 * qui commence par 0 est ramené à 13 chiffres. Un code sans identifiant
 * produit (lot, date) est ignoré avec un message ; une lecture dont la clé de
 * contrôle est fausse est une lecture parasite, ignorée sans message. Un code
 * tapé à la main (fiche produit) est ramené aux mêmes formes, clé de contrôle
 * comprise.
 */

export type IgnoredReason = 'not_a_product' | 'invalid_check_digit'

export type NormalizedCode = { kind: 'product'; code: string } | { kind: 'ignored'; reason: IgnoredReason }

const GTIN_LENGTHS = [8, 12, 13, 14]
// Formats imprimés sur une canette ou une bouteille ; un carton porte un ITF-14, un pack un code long.
const UNIT_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const EXPECTED_LENGTH: Record<string, number> = { ean_13: 13, ean_8: 8, upc_a: 12, upc_e: 8 }

// Préfixe d'identifiant de symbologie (« ]C1 » pour un GS1-128) et séparateurs GS.
const SYMBOLOGY_PREFIX = /^\][A-Za-z]\d/
const GROUP_SEPARATORS = /^\u001d+|\u001d+$/g
// Identifiant produit GS1 (01) en tête, avec ou sans parenthèses, suivi du GTIN-14.
const GS1_PRODUCT_ID = /^(?:\(01\)|01)(\d{14})/

export function isValidGtin(digits: string): boolean {
  if (!/^\d+$/.test(digits) || !GTIN_LENGTHS.includes(digits.length)) return false
  const body = digits.slice(0, -1)
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    // Pondération 3, 1, 3… en partant du chiffre le plus à droite avant la clé.
    const fromRight = body.length - 1 - i
    sum += Number(body[i]) * (fromRight % 2 === 0 ? 3 : 1)
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

export function isUnitFormat(format: string): boolean {
  return UNIT_FORMATS.includes(format)
}

const product = (code: string): NormalizedCode => ({ kind: 'product', code })
const ignored = (reason: IgnoredReason): NormalizedCode => ({ kind: 'ignored', reason })

const dropLeadingZero = (gtin14: string) => (gtin14.startsWith('0') ? gtin14.slice(1) : gtin14)

export function normalizeScannedCode(rawValue: string, format: string): NormalizedCode {
  const value = rawValue.trim().replace(SYMBOLOGY_PREFIX, '').replace(GROUP_SEPARATORS, '')

  switch (format) {
    case 'ean_13':
    case 'ean_8':
    case 'upc_a': {
      if (value.length !== EXPECTED_LENGTH[format] || !isValidGtin(value)) return ignored('invalid_check_digit')
      return product(format === 'upc_a' ? '0' + value : value)
    }
    case 'upc_e':
      // ZXing contrôle déjà la clé d'un UPC-E : le code est gardé tel quel.
      return /^\d{8}$/.test(value) ? product(value) : ignored('invalid_check_digit')
    case 'itf': {
      // Un ITF qui n'a pas 14 chiffres (ITF-6, ITF-10…) n'est pas un code produit.
      if (!/^\d{14}$/.test(value)) return ignored('not_a_product')
      return isValidGtin(value) ? product(dropLeadingZero(value)) : ignored('invalid_check_digit')
    }
    case 'code_128': {
      const match = GS1_PRODUCT_ID.exec(value)
      if (!match) return ignored('not_a_product')
      return isValidGtin(match[1]) ? product(dropLeadingZero(match[1])) : ignored('invalid_check_digit')
    }
    default:
      return ignored('not_a_product')
  }
}

export function normalizeTypedCode(text: string): NormalizedCode {
  const digits = text.replace(/\s+/g, '')
  if (!isValidGtin(digits)) return ignored('invalid_check_digit')
  if (digits.length === 12) return product('0' + digits)
  if (digits.length === 14) return product(dropLeadingZero(digits))
  return product(digits)
}
