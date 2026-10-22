/**
 * check.mjs — Contrôle de la feuille A4 de la réserve (docs/feuille-reserve.pdf).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service ») ;
 * docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 7).
 *
 * - pdfinfo : une seule page, au format A4 (595 × 842 points, à 1 point près) ;
 * - pdftoppm à 150 ppp : un seul QR code sur la page, relu par zxing-wasm,
 *   dont le texte est exactement l'adresse de la vidéo tuto ;
 * - pdftotext, espaces ramenées à une seule : les textes clés de la feuille.
 *
 * Usage : node scripts/sheet/check.mjs (npm run sheet imprime puis contrôle).
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const PDF = join(ROOT, 'docs', 'feuille-reserve.pdf')
const TUTORIAL_URL = 'https://scandrinks.pages.dev/tutoriel/'
const KEY_TEXTS = [
  'mémo de la réserve',
  'Entrée +',
  'Sortie −',
  'Inventaire =',
  'À racheter',
  'Historique',
  'Photo non enregistrée',
  "Installer l'app sur un iPhone",
  'iOS 16.4',
  'scandrinks.pages.dev',
  'Un souci ? Préviens la personne qui gère ScanDrinks.',
]

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

assert.ok(existsSync(PDF), `feuille absente : ${PDF} (lance npm run sheet)`)

// 1. Une page A4.
const info = run('pdfinfo', [PDF])
assert.match(info, /^Pages:\s+1$/m, 'la feuille doit tenir sur une seule page')
const size = info.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m)
assert.ok(size, `taille de page illisible :\n${info}`)
const [width, height] = [Number(size[1]), Number(size[2])]
assert.ok(Math.abs(width - 595) <= 1 && Math.abs(height - 842) <= 1, `page de ${width} × ${height} points, attendu A4 (595 × 842)`)

// 2. Le QR code, relu sur l'image de la page, avec le module WebAssembly du dépôt.
await prepareZXingModule({
  overrides: { wasmBinary: readFileSync(fileURLToPath(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm'))) },
  fireImmediately: true,
})
// pdftoppm écrit l'image dans un fichier (avec « - », il crée « -.png » au lieu d'écrire sur la sortie standard).
// -q : Chromium intègre Inter (OpenType CFF) en polices Type 3, des dessins vectoriels ; poppler signale alors le
// cadre vide de chaque espace, sans effet sur l'image ni sur le texte. Une vraie erreur arrête toujours la commande.
const scratch = mkdtempSync(join(tmpdir(), 'feuille-'))
let page
try {
  run('pdftoppm', ['-q', '-r', '150', '-png', '-singlefile', PDF, join(scratch, 'page')])
  page = readFileSync(join(scratch, 'page.png'))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
const codes = await readBarcodes(new Uint8Array(page), { formats: ['QRCode'], tryHarder: true })
// Une image illisible donne un résultat avec une erreur : ce n'est pas un QR code.
for (const code of codes) assert.equal(code.error, '', `lecture de l'image de la feuille : ${code.error}`)
assert.equal(codes.length, 1, `QR codes lus sur la feuille : ${codes.length}, attendu 1`)
assert.equal(codes[0].text, TUTORIAL_URL, 'adresse du QR code')

// 3. Les textes clés.
const text = run('pdftotext', ['-q', '-enc', 'UTF-8', PDF, '-']).replace(/\s+/g, ' ')
for (const key of KEY_TEXTS) assert.ok(text.includes(key), `texte absent de la feuille : « ${key} »`)

console.log('Feuille OK')
