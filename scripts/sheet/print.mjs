/**
 * print.mjs — Impression de la feuille A4 de la réserve, avec le QR code de la vidéo tuto.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service ») ;
 * docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 7).
 *
 * 1. dessine le QR code de l'adresse de la vidéo en SVG (zxing-wasm, avec le
 *    module WebAssembly du dépôt : rien n'est chargé d'Internet) ;
 * 2. le met dans sheet.html, à l'emplacement <!--QR--> (un carré de 40 mm) ;
 * 3. pose les espaces insécables de la typographie française : après « et
 *    avant » : ? ! ; ›, pour qu'aucune ligne ne commence par la ponctuation ;
 * 4. imprime la page en PDF A4 : docs/feuille-reserve.pdf, remis au porteur du projet.
 *
 * Usage : node scripts/sheet/print.mjs (npm run sheet imprime puis contrôle).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const HERE = fileURLToPath(new URL('.', import.meta.url))
const PDF = join(ROOT, 'docs', 'feuille-reserve.pdf')
const TUTORIAL_URL = 'https://scandrinks.pages.dev/tutoriel/'

// 1. Le QR code.
await prepareZXingModule({
  overrides: { wasmBinary: readFileSync(fileURLToPath(import.meta.resolve('zxing-wasm/writer/zxing_writer.wasm'))) },
  fireImmediately: true,
})
const qr = await writeBarcode(TUTORIAL_URL, { format: 'QRCode', ecLevel: 'M', scale: 0 })
if (qr.error || !qr.svg) throw new Error(`QR code non dessiné : ${qr.error}`)
// Le SVG de zxing donne sa taille en modules, sans viewBox : son dessin resterait à 37 px dans le coin du carré.
// Avec un viewBox, il remplit le carré de 40 mm ; l'en-tête XML, inutile dans une page HTML, est retiré.
const svgSize = qr.svg.match(/<svg width="(\d+)" height="(\d+)"/)
if (!svgSize) throw new Error(`SVG du QR code inattendu : ${qr.svg.slice(0, 200)}`)
const qrSvg = qr.svg.slice(qr.svg.indexOf('<svg')).replace(svgSize[0], `<svg viewBox="0 0 ${svgSize[1]} ${svgSize[2]}"`)

// 2. La page, avec son QR code.
const sheet = readFileSync(join(HERE, 'sheet.html'), 'utf8')
if (sheet.split('<!--QR-->').length !== 2) throw new Error('sheet.html doit avoir un seul emplacement <!--QR-->')

const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.setContent(sheet.replace('<!--QR-->', qrSvg), { waitUntil: 'load' })
  // 3. Les espaces insécables, dans le texte seulement.
  await page.evaluate(async () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      node.data = node.data.replace(/« /g, '«\u00a0').replace(/ ([»:?!;›])/g, '\u00a0$1')
    }
    await document.fonts.ready
  })
  // 4. Le PDF.
  await page.pdf({ path: PDF, format: 'A4', printBackground: true, preferCSSPageSize: true })
} finally {
  await browser.close()
}
console.log(`Feuille imprimée : ${PDF}`)
