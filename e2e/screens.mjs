/**
 * screens.mjs — Captures des écrans de l'app, de jour et de nuit, à comparer aux maquettes (docs/maquettes/).
 *
 * Outil de mise au point, sans assertion. Lance la version e2e (dist-e2e)
 * avec la base simulée et la fausse caméra du test de bout en bout, puis
 * enregistre <dossier>/<jour|nuit>/<nom>.png en 390 × 844, et
 * <dossier>/<jour-320|nuit-320>/<nom>.png en 320 × 640 (échelle 2).
 *
 * Usage : npm run screens (dossier dist-screens/), ou node e2e/screens.mjs <dossier> après un build e2e.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { ean13Y4m } from './ean13.mjs'
import { COCA_CODE, GOOD_PASSWORD, installFakeSupabase } from './fakeSupabase.mjs'
import { signIn } from './helpers.mjs'

const PORT = 4175
const BASE = `http://localhost:${PORT}`
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const OUT = resolve(process.argv[2] ?? join(ROOT, 'dist-screens'))
const SCAN_TIMEOUT = 20_000

const confirmCard = (page) => page.getByRole('region', { name: 'Fiche de confirmation' })

// Chaque capture : les options de la base simulée, puis les gestes qui mènent à l'écran (avec la base simulée, pour
// les changements faits « sur un autre téléphone »).
const SHOTS = [
  { name: 'connexion', fake: {}, go: async (page) => page.getByRole('button', { name: 'Se connecter' }).waitFor() },
  {
    name: 'prenom',
    // Quatre prénoms déjà utilisés : les quatre teintes des cartes.
    fake: { employees: ['Hugo', 'Karim', 'Léa', 'Sam'] },
    go: async (page) => {
      await page.getByLabel('Mot de passe').fill(GOOD_PASSWORD)
      await page.getByRole('button', { name: 'Se connecter' }).click()
      await page.getByRole('heading', { name: 'Qui es-tu ?' }).waitFor()
    },
  },
  {
    name: 'scanner-entree',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await confirmCard(page).waitFor({ timeout: SCAN_TIMEOUT })
    },
  },
  {
    name: 'scanner-sortie',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await confirmCard(page).waitFor({ timeout: SCAN_TIMEOUT })
      await page.getByRole('button', { name: 'Sortie −' }).click()
      await confirmCard(page).locator('.confirm-delta', { hasText: '−24' }).waitFor()
    },
  },
  {
    name: 'scanner-message',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await confirmCard(page).waitFor({ timeout: SCAN_TIMEOUT })
      await confirmCard(page).getByRole('button', { name: 'Valider' }).click()
      await page.getByRole('status').waitFor()
    },
  },
  {
    name: 'scanner-inventaire',
    fake: { catalogue: 'coca_with_code' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Inventaire =' }).click()
      await confirmCard(page).getByText('Stock connu').waitFor({ timeout: SCAN_TIMEOUT })
      await confirmCard(page).getByLabel('Packs de 24').fill('2')
      await confirmCard(page).getByLabel('Unités en plus').fill('5')
      await page.evaluate(() => document.activeElement?.blur())
    },
  },
  {
    name: 'nouveau-produit',
    fake: { catalogue: 'empty' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Nouveau produit' }).click({ timeout: SCAN_TIMEOUT })
      await page.getByLabel('Ce code vaut (unités)').fill('24')
      await page.evaluate(() => document.activeElement?.blur())
    },
  },
  {
    name: 'racheter',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'À racheter (3)', exact: true }).click()
      await page.getByRole('list', { name: 'À racheter' }).waitFor()
    },
  },
  {
    name: 'stock',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Stock', exact: true }).click()
      await page.getByRole('list', { name: 'Produits' }).waitFor()
    },
  },
  {
    name: 'fiche',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Stock', exact: true }).click()
      await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
      await page.getByRole('region', { name: 'Fiche produit' }).locator('.movement-line').first().waitFor()
    },
  },
  {
    name: 'historique',
    fake: { catalogue: 'pilotage' },
    go: async (page, fake) => {
      // Une ligne annulée, pour voir le texte barré.
      fake.cancelElsewhere('m-o1', 'Léa')
      await signIn(page)
      await page.getByRole('button', { name: 'Historique', exact: true }).click()
      await page.locator('.history-line').first().waitFor()
    },
  },
  {
    name: 'historique-images',
    fake: { catalogue: 'images' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Historique', exact: true }).click()
      await page.getByRole('list', { name: 'Historique' }).locator('img.thumb').first().waitFor()
    },
  },
  {
    name: 'images-scanner',
    fake: { catalogue: 'images' },
    go: async (page) => {
      await signIn(page)
      await confirmCard(page).locator('img.thumb').waitFor({ timeout: SCAN_TIMEOUT })
    },
  },
  {
    name: 'images-stock',
    fake: { catalogue: 'images' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Stock', exact: true }).click()
      await page.getByRole('list', { name: 'Produits' }).locator('img.thumb').first().waitFor()
    },
  },
  {
    name: 'images-fiche',
    fake: { catalogue: 'images' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Stock', exact: true }).click()
      await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
      await page.getByRole('region', { name: 'Fiche produit' }).locator('.code-row img.thumb').waitFor()
    },
  },
  {
    name: 'photo-off',
    fake: { catalogue: 'empty' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Nouveau produit' }).click({ timeout: SCAN_TIMEOUT })
      await page.getByRole('group', { name: 'Photo du code' }).locator('img.thumb').waitFor()
    },
  },
  {
    name: 'photo-prise',
    fake: { catalogue: 'empty', offImage: false },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Nouveau produit' }).click({ timeout: SCAN_TIMEOUT })
      await page.getByRole('button', { name: 'Prendre la photo' }).click()
      await page.getByRole('group', { name: 'Photo du code' }).getByText('Photo prise').waitFor()
    },
  },
  {
    name: 'ventes',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Ventes', exact: true }).click()
      await page.getByRole('list', { name: 'À saisir' }).waitFor()
      await page.getByLabel('Vendus : Coca-Cola 33 cl', { exact: true }).fill('3')
      await page.getByLabel('Vendus : Évian 1,5 L', { exact: true }).fill('2')
      await page.getByLabel('Vendus : Évian 1,5 L', { exact: true }).blur()
    },
  },
  {
    name: 'ventes-recap',
    fake: { catalogue: 'pilotage' },
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Ventes', exact: true }).click()
      await page.getByLabel('Vendus : Coca-Cola 33 cl', { exact: true }).fill('3')
      await page.getByLabel('Vendus : Évian 1,5 L', { exact: true }).fill('2')
      await page.getByRole('button', { name: 'Valider', exact: true }).click()
      await page.getByRole('list', { name: 'Récapitulatif' }).waitFor()
    },
  },
  {
    name: 'reglages',
    fake: {},
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Réglages' }).click()
      await page.getByRole('heading', { name: 'Réglages' }).waitFor()
    },
  },
  {
    name: 'tutoriel',
    fake: {},
    go: async (page) => {
      await signIn(page)
      await page.getByRole('button', { name: 'Réglages' }).click()
      await page.getByRole('button', { name: /^Tutoriel/ }).click()
      await page.getByRole('heading', { name: 'Tutoriel', exact: true }).waitFor()
      // L'image d'attente est chargée avant la capture.
      await page.waitForLoadState('networkidle')
    },
  },
]

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // pas encore prêt
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(`Le serveur ${url} ne répond pas`)
}

const tmp = mkdtempSync(join(tmpdir(), 'scandrinks-screens-'))
const y4m = join(tmp, 'ean13.y4m')
writeFileSync(y4m, ean13Y4m(COCA_CODE))
const server = spawn(process.execPath, [VITE_BIN, 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
})
let browser
try {
  await waitForServer(`${BASE}/`)
  browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  })
  const sizes = [
    ['', { width: 390, height: 844 }],
    ['-320', { width: 320, height: 640 }],
  ]
  for (const [suffix, viewport] of sizes) for (const [name, colorScheme] of [['jour', 'light'], ['nuit', 'dark']]) {
    const theme = `${name}${suffix}`
    mkdirSync(join(OUT, theme), { recursive: true })
    for (const shot of SHOTS) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme })
      const page = await context.newPage()
      const fake = await installFakeSupabase(page, shot.fake)
      await page.goto(`${BASE}/`)
      await shot.go(page, fake)
      // Laisse finir les images et les polices.
      await page.waitForTimeout(400)
      await page.screenshot({ path: join(OUT, theme, `${shot.name}.png`) })
      await context.close()
    }
  }
  console.log(`Captures : ${OUT}`)
} finally {
  await browser?.close()
  server.kill()
  rmSync(tmp, { recursive: true, force: true })
}
