/**
 * formats.ts — Formats de codes-barres lus par ScanDrinks.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2)
 * Noms au sens de l'API standard BarcodeDetector.
 */

export const PRODUCT_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'] as const

export type ProductBarcodeFormat = (typeof PRODUCT_BARCODE_FORMATS)[number]

const FORMAT_LABELS: Record<string, string> = {
  ean_13: 'EAN-13',
  ean_8: 'EAN-8',
  upc_a: 'UPC-A',
  upc_e: 'UPC-E',
  itf: 'ITF-14',
  code_128: 'Code 128',
}

/** Libellé lisible d'un format ; un format inconnu est renvoyé tel quel. */
export function formatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format
}
