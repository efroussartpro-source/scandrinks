/**
 * render-icons.mjs — Rend public/icon.svg en PNG pour l'écran d'accueil.
 *
 * Référence : docs/superpowers/plans/2026-10-20-jalon-3-suivi.md (Tâche 6)
 *
 * 180 px pour l'iPhone (apple-touch-icon.png), 192 et 512 px pour le
 * manifeste. Utilise le Chromium de Playwright. À relancer après chaque
 * changement de l'icône : node scripts/render-icons.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const publicFile = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))
const svg = readFileSync(publicFile('icon.svg'), 'utf8')

const browser = await chromium.launch()
try {
  for (const [size, name] of [[180, 'apple-touch-icon.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
    await page.screenshot({ path: publicFile(name) })
    await page.close()
    console.log(`${name} : ${size} × ${size}`)
  }
} finally {
  await browser.close()
}
