/**
 * scan-smoke.mjs — Test de bout en bout de la page de test du scan (jalon 0).
 *
 * Lance la version de production (vite preview) et ouvre Chromium avec une
 * fausse caméra qui montre un vrai EAN-13 (5449000000996, Coca-Cola 33 cl).
 * Vérifie : la lecture et le nom, l'anti-doublon, le wasm servi par l'app
 * (aucun CDN), la copie du rapport, l'interruption de la caméra, l'absence de
 * changement d'URL, et la zone de secours quand la copie est refusée.
 *
 * Prérequis : `npm run build` (le script npm `e2e` le fait) et Chromium
 * (présent dans l'environnement Claude Code via PLAYWRIGHT_BROWSERS_PATH).
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { ean13Y4m } from './ean13.mjs'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const CODE = '5449000000996'
const OFF_BODY = JSON.stringify({
  status: 1,
  product: { product_name_fr: 'Coca-Cola', product_name: 'Coca-Cola Original', quantity: '330 ml' },
})
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // pas encore prêt
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Le serveur ${url} ne répond pas`)
}

async function scenarioFullScan(browser) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    navigator.clipboard.writeText = async (text) => {
      window.__copied = text
    }
  })
  const page = await context.newPage()
  const requests = []
  const wasmResponses = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('response', (response) => {
    if (response.url().endsWith('.wasm')) {
      wasmResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] ?? '' })
    }
  })
  await page.route('https://world.openfoodfacts.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: OFF_BODY }),
  )

  await page.goto(`${BASE}/`)
  const firstUrl = page.url()
  await page.getByRole('button', { name: 'Démarrer la caméra' }).click()

  const items = page.getByRole('list', { name: 'Codes lus' }).getByRole('listitem').filter({ hasText: CODE })
  await items.first().waitFor({ timeout: 20_000 })
  await page.getByText('Coca-Cola 330 ml').waitFor({ timeout: 5_000 })
  assert.match(await items.first().innerText(), /EAN-13/)
  assert.match(await page.getByRole('status').first().innerText(), /ZXing \(WebAssembly\)/)

  await page.waitForTimeout(3_000)
  assert.equal(await items.count(), 1, 'le même pack reste dans le champ : une seule ligne')

  assert.ok(
    wasmResponses.some(
      (r) => r.url.startsWith(`${BASE}/assets/zxing_reader-`) && r.status === 200 && r.contentType.startsWith('application/wasm'),
    ),
    `wasm servi par l'app en application/wasm : ${JSON.stringify(wasmResponses)}`,
  )
  assert.ok(
    !requests.some((u) => /^https?:\/\/(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\//.test(u)),
    'aucune requête vers un CDN tiers',
  )

  await page.getByRole('button', { name: 'Copier le rapport' }).click()
  const copied = await page.evaluate(() => window.__copied)
  assert.ok(copied.startsWith('ScanDrinks — test du scan (jalon 0)'), copied)
  assert.ok(copied.includes(`${CODE} (EAN-13) — Coca-Cola 330 ml`), copied)

  await page.evaluate(() => {
    document.querySelector('video').srcObject.getVideoTracks()[0].dispatchEvent(new Event('ended'))
  })
  await page.getByRole('alert').filter({ hasText: "La caméra s'est arrêtée" }).waitFor({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Démarrer la caméra' }).waitFor()

  assert.equal(page.url(), firstUrl, "aucune modification d'URL")
  await context.close()
  console.log('Scénario A (lecture complète) : OK')
}

async function scenarioCopyRefused(browser) {
  const context = await browser.newContext()
  await context.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('refusé', 'NotAllowedError'))
  })
  const page = await context.newPage()
  await page.goto(`${BASE}/`)
  await page.getByRole('button', { name: 'Copier le rapport' }).click()
  const box = page.getByRole('textbox', { name: 'Rapport à copier' })
  await box.waitFor({ timeout: 5_000 })
  assert.ok((await box.inputValue()).startsWith('ScanDrinks — test du scan (jalon 0)'))
  await context.close()
  console.log('Scénario B (copie refusée) : OK')
}

const tmp = mkdtempSync(join(tmpdir(), 'scandrinks-e2e-'))
const y4m = join(tmp, 'ean13.y4m')
writeFileSync(y4m, ean13Y4m(CODE))
const server = spawn(process.execPath, [VITE_BIN, 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
})
let browser
try {
  await waitForServer(`${BASE}/`)
  browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  })
  await scenarioFullScan(browser)
  await scenarioCopyRefused(browser)
  console.log('E2E OK')
} finally {
  await browser?.close()
  server.kill()
  rmSync(tmp, { recursive: true, force: true })
}
