import { describe, expect, test } from 'vitest'
import { codesCountLabel, formatScanReport, lookupLabel, type ScanEntry } from './report'

describe('lookupLabel', () => {
  test.each([
    ['pending', 'recherche…'],
    [{ status: 'not_found' }, "inconnu d'Open Food Facts"],
    [{ status: 'error' }, 'Open Food Facts injoignable'],
    [{ status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' }, 'Coca-Cola 330 ml'],
  ] as const)('%o', (lookup, label) => {
    expect(lookupLabel(lookup)).toBe(label)
  })
})

describe('codesCountLabel', () => {
  test.each([[0, '0 code lu'], [1, '1 code lu'], [2, '2 codes lus']])('%i → %s', (n, label) => {
    expect(codesCountLabel(n)).toBe(label)
  })
})

describe('formatScanReport', () => {
  const entries: ScanEntry[] = [
    { id: 2, code: '15449000000993', format: 'itf', at: new Date('2026-10-19T12:33:10Z'), lookup: { status: 'not_found' } },
    { id: 1, code: '5449000000996', format: 'ean_13', at: new Date('2026-10-19T12:32:05Z'),
      lookup: { status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' } },
  ]
  test('rapport complet : ordre chronologique, heure de Paris', () => {
    expect(formatScanReport(entries, { now: new Date('2026-10-19T12:40:00Z'), engine: 'zxing', width: 1280, height: 720,
      decodeMs: 48, standalone: false, userAgent: 'TestAgent/1.0' })).toBe([
      'ScanDrinks — test du scan (jalon 0)',
      'Date : 19/10/2026 14:40',
      'Lecteur : ZXing (WebAssembly) — caméra 1280×720 — analyse 48 ms/image',
      'Mode : Safari',
      'Appareil : TestAgent/1.0',
      'Codes lus : 2',
      '1. 14:32:05 — 5449000000996 (EAN-13) — Coca-Cola 330 ml',
      "2. 14:33:10 — 15449000000993 (ITF-14) — inconnu d'Open Food Facts",
    ].join('\n'))
  })
  test("avant démarrage, en mode écran d'accueil", () => {
    expect(formatScanReport([], { now: new Date('2026-10-19T12:40:00Z'), engine: null, width: null, height: null,
      decodeMs: null, standalone: true, userAgent: 'TestAgent/1.0' })).toBe([
      'ScanDrinks — test du scan (jalon 0)',
      'Date : 19/10/2026 14:40',
      'Lecteur : non démarré',
      "Mode : écran d'accueil",
      'Appareil : TestAgent/1.0',
      'Codes lus : 0',
    ].join('\n'))
  })
})
