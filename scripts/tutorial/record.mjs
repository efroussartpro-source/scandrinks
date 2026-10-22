/**
 * record.mjs — Tournage de la vidéo tuto : un robot utilise la vraie app sur un iPhone simulé.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service », la vidéo tuto) ;
 * docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 5).
 *
 * Lance la version e2e (dist-e2e) avec la base simulée (catalogue
 * « tutoriel » : produits, prénoms et mot de passe fictifs), dans Chromium,
 * sur un iPhone simulé de 390 × 844 (échelle 2, écran tactile), l'horloge
 * fixée au lundi 26/10/2026 à 09:30, heure de Paris. Une fausse caméra
 * montre les codes-barres, un rond marque chaque toucher, la confirmation de
 * l'Historique est dessinée dans la page (page-helpers.js).
 *
 * Chaque geste attend l'écran prévu : si l'app a changé, le tournage
 * s'arrête au lieu de filmer un écran faux. Chaque titre et chaque
 * sous-titre du storyboard est noté avec son heure, puis reste le temps de
 * le lire.
 *
 * L'image vient de la capture CDP de la page (Page.startScreencast, JPEG
 * qualité 95), en 780 × 1688 : Chromium est lancé à l'échelle 2
 * (--force-device-scale-factor=2), sans quoi la capture reste en 390 × 844.
 * Chaque image est notée avec l'heure de sa capture, puis ffmpeg la fait
 * durer jusqu'à la suivante : la vidéo suit l'horloge du tournage.
 * L'enregistrement de Playwright (recordVideo) n'est pas utilisé : il
 * gardait l'app dans un quart de l'image et prenait du retard.
 *
 * Sorties : dist-tutorial/raw/app.webm (VP9) et dist-tutorial/raw/timeline.json
 * ({ start, end, events }, en millisecondes depuis l'ouverture de la page,
 * comme les heures de la vidéo).
 *
 * Usage : npm run tutorial:record (construit la version e2e, tourne, puis contrôle avec check.mjs --raw).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { ean13Modules } from '../../e2e/ean13.mjs'
import { GOOD_PASSWORD, TUTORIAL_CODES, TUTORIAL_PHOTOS, installFakeSupabase } from '../../e2e/fakeSupabase.mjs'
import { ffmpeg } from './hls.mjs'
import { PACK_STYLES, packSvg } from './packs.mjs'
import { installCamera, installConfirmDialog, installRepaintPulse, installTouchMarker } from './page-helpers.js'
import { CHAPTERS, readingTime } from './storyboard.mjs'

const PORT = 4174
const BASE = `http://localhost:${PORT}`
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const VITE_BIN = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url))
const RAW_DIR = join(ROOT, 'dist-tutorial', 'raw')
// Lundi 26/10/2026 à 19:00, heure de Paris (UTC+1 depuis le 25/10) : le soir, pour la fin de journée du chapitre 3.
const FILMED_AT = new Date('2026-10-26T18:00:00Z')
// Le pack d'Oasis Tropical, inconnu de l'app, montré à la caméra au chapitre 4.
const OASIS_COLOR = '#F07D1A'
const SCREEN_TIMEOUT = 20_000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Texte exact, pour un filtre hasText.
const exactly = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

async function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // pas encore prêt
    }
    await sleep(250)
  }
  throw new Error(`Le serveur ${url} ne répond pas`)
}

// Les photos de l'équipe du catalogue fictif : les illustrations de packs, rendues en JPEG de 480 × 360.
async function renderPackPhotos(browser) {
  const page = await browser.newPage({ viewport: { width: 480, height: 360 } })
  const photos = {}
  for (const [product, path] of Object.entries(TUTORIAL_PHOTOS)) {
    await page.setContent(`<body style="margin: 0">${packSvg(PACK_STYLES[product])}</body>`)
    photos[path] = await page.screenshot({ type: 'jpeg', quality: 88, scale: 'css' })
  }
  await page.close()
  return photos
}

// La caméra du tournage : chaque image de la capture CDP est écrite avec l'heure de sa capture (en ms depuis
// l'ouverture de la page). stop(end) en fait app.webm, chaque image durant jusqu'à la suivante ; la première part
// de 0, la dernière va une seconde au-delà de la fin du film.
async function startRecorder(context, page, origin) {
  const framesDir = join(RAW_DIR, 'frames')
  mkdirSync(framesDir, { recursive: true })
  const frames = []
  const cdp = await context.newCDPSession(page)
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = join(framesDir, `${String(frames.length).padStart(6, '0')}.jpg`)
    writeFileSync(file, Buffer.from(data, 'base64'))
    frames.push({ file, t: metadata.timestamp * 1000 - origin })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined)
  })
  // Une image sur deux : 30 images par seconde suffisent, avec l'écran redessiné en continu (installRepaintPulse).
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 780, maxHeight: 1688, everyNthFrame: 2 })
  return {
    async stop(end) {
      await cdp.send('Page.stopScreencast')
      if (frames.length === 0) throw new Error('Aucune image capturée pendant le tournage')
      const lines = ['ffconcat version 1.0']
      frames.forEach((frame, index) => {
        const from = index === 0 ? 0 : frame.t
        const to = index + 1 < frames.length ? frames[index + 1].t : Math.max(frame.t, end) + 1000
        lines.push(`file '${frame.file}'`, `duration ${Math.max(0.001, (to - from) / 1000).toFixed(3)}`)
      })
      // Le démultiplexeur concat ne tient la durée de la dernière image que si elle est citée une fois de plus.
      lines.push(`file '${frames.at(-1).file}'`)
      const list = join(RAW_DIR, 'frames.ffconcat')
      writeFileSync(list, `${lines.join('\n')}\n`)
      ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-fps_mode', 'vfr', '-c:v', 'libvpx-vp9', '-crf', '18', '-b:v', '0',
        '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-pix_fmt', 'yuv420p', join(RAW_DIR, 'app.webm')])
      rmSync(framesDir, { recursive: true, force: true })
      rmSync(list)
      return frames.length
    },
  }
}

// Le réalisateur : titres et sous-titres notés avec leur heure, gestes au rythme d'un humain, fausse caméra.
function director(page, origin) {
  const events = []
  const at = () => Date.now() - origin
  const chapterOf = (key) => {
    const found = CHAPTERS.find((chapter) => chapter.key === key)
    if (!found) throw new Error(`Chapitre inconnu du storyboard : ${key}`)
    return found
  }
  return {
    events,
    at,
    async chapter(key) {
      const { title } = chapterOf(key)
      events.push({ kind: 'chapter', key, text: title, t: at() })
      await sleep(readingTime(title))
    },
    async caption(chapterKey, captionKey) {
      const text = chapterOf(chapterKey).captions[captionKey]
      if (!text) throw new Error(`Sous-titre inconnu du storyboard : ${chapterKey}.${captionKey}`)
      events.push({ kind: 'caption', key: `${chapterKey}.${captionKey}`, text, t: at() })
      await sleep(readingTime(text))
    },
    async tap(locator) {
      await locator.tap({ timeout: SCREEN_TIMEOUT })
      await sleep(400)
    },
    async typeSlowly(locator, text) {
      await locator.pressSequentially(text, { delay: 110, timeout: SCREEN_TIMEOUT })
    },
    async showCode(code) {
      await page.evaluate(([modules, digits]) => window.__tutorialCamera.show(modules, digits), [ean13Modules(code), code])
    },
    async showPack(color, code) {
      await page.evaluate(([shade, modules, digits]) => window.__tutorialCamera.showPack(shade, modules, digits), [color, ean13Modules(code), code])
    },
    async hideCode() {
      await page.evaluate(() => window.__tutorialCamera.hide())
    },
  }
}

// Les neuf chapitres du storyboard. Chaque geste attend l'écran prévu (comme les scénarios e2e A, D, I, H et M) ;
// en règle générale, le sous-titre arrive avec l'écran qu'il décrit.
async function film(page, take) {
  const wait = { timeout: SCREEN_TIMEOUT }
  const button = (name) => page.getByRole('button', { name, exact: true })
  const card = page.getByRole('region', { name: 'Fiche de confirmation' })
  const waitForConfirmLine = async (line) => {
    const [what, delta] = line.split(' → ')
    await card.locator('.confirm-what').filter({ hasText: exactly(what) }).waitFor(wait)
    await card.locator('.confirm-delta').filter({ hasText: exactly(delta) }).waitFor(wait)
  }
  const waitForSaved = async (title, detail) => {
    const notice = page.getByRole('status').filter({ has: page.locator('.notice-title').filter({ hasText: exactly(title) }) })
    await notice.locator('.notice-detail').filter({ hasText: exactly(detail) }).waitFor(wait)
  }
  const waitForValue = async (locator, value) => {
    const element = await locator.elementHandle(wait)
    await page.waitForFunction(([input, expected]) => input.value === expected, [element, value], wait)
  }
  const waitForScanner = () =>
    page.waitForFunction(() => {
      const video = document.querySelector('.app video')
      return video?.srcObject instanceof MediaStream && video.readyState >= 2
    }, null, wait)

  // 1. Se connecter.
  await button('Se connecter').waitFor(wait)
  await take.chapter('connexion')
  await take.caption('connexion', 'icone')
  const password = page.getByLabel('Mot de passe')
  await take.tap(password)
  await take.typeSlowly(password, GOOD_PASSWORD)
  await take.caption('connexion', 'motDePasse')
  await take.tap(button('Se connecter'))
  await page.getByRole('heading', { name: 'Qui es-tu ?' }).waitFor(wait)
  await take.caption('connexion', 'prenom')
  await take.tap(button('Sam'))
  await waitForScanner()
  await take.caption('connexion', 'scanner')

  // 2. Une livraison Metro : Entrée +.
  await take.chapter('entree')
  await take.tap(button('Entrée +'))
  await take.caption('entree', 'mode')
  await take.showCode(TUTORIAL_CODES.coca)
  await waitForConfirmLine('Pack de 24 → +24')
  await take.caption('entree', 'scan')
  await take.tap(card.getByRole('button', { name: 'Plus' }))
  await waitForConfirmLine('Pack de 24 × 2 → +48')
  await take.caption('entree', 'quantite')
  await take.tap(card.getByRole('button', { name: 'Valider' }))
  // Le pack s'éloigne tout de suite : sinon, sa fiche revient 2 secondes plus tard.
  await take.hideCode()
  await waitForSaved('+48 Coca-Cola 33 cl', 'Stock : 72 (3 packs)')
  await take.caption('entree', 'valider')
  await take.caption('entree', 'annuler')
  await take.caption('entree', 'eloigner')

  // 3. Le soir : la fin de journée. Lipton n'est pas vendu : le chapitre 5 le compte à 10.
  await take.chapter('ventes')
  await take.caption('ventes', 'ouvrir')
  await take.tap(button('Ventes'))
  await page.getByRole('heading', { name: 'Fin de journée' }).waitFor(wait)
  await page.getByRole('list', { name: 'À saisir' }).waitFor(wait)
  await take.caption('ventes', 'caisse')
  for (const [name, sold] of [['Coca-Cola 33 cl', '12'], ['Évian 50 cl', '2'], ['Red Bull 25 cl', '4']]) {
    const box = page.getByLabel(`Vendus : ${name}`, { exact: true })
    await take.tap(box)
    await take.typeSlowly(box, sold)
  }
  await page.locator('.sales-total').filter({ hasText: exactly('Total du jour : 18 boissons') }).waitFor(wait)
  await take.caption('ventes', 'total')
  await take.tap(button('Valider'))
  await page.getByRole('heading', { name: 'Ventes du lun. 26/10' }).waitFor(wait)
  await take.caption('ventes', 'enregistrer')
  await take.tap(button('Enregistrer'))
  await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 18 boissons.') }).waitFor(wait)
  await take.caption('ventes', 'sortie')
  await take.tap(button('Scanner'))
  await waitForScanner()

  // 4. Un produit inconnu : créer sa fiche, avec la photo du pack.
  await take.chapter('nouveau')
  await take.tap(button('Entrée +'))
  await take.showCode(TUTORIAL_CODES.oasisPack)
  await page.getByText(`Code inconnu : ${TUTORIAL_CODES.oasisPack}`).waitFor(wait)
  await take.caption('nouveau', 'inconnu')
  await take.caption('nouveau', 'nouveau')
  await take.tap(button('Nouveau produit'))
  await button('Prendre la photo').waitFor(wait)
  await take.showPack(OASIS_COLOR, TUTORIAL_CODES.oasisPack)
  await take.caption('nouveau', 'photo')
  await take.tap(button('Prendre la photo'))
  await page.getByText('Photo prise', { exact: true }).waitFor(wait)
  await take.caption('nouveau', 'canette')
  await take.tap(button('Scanner une canette du pack'))
  await take.showCode(TUTORIAL_CODES.oasisCan)
  const name = page.getByLabel('Nom', { exact: true })
  await waitForValue(name, 'Oasis Tropical 33 cl')
  await take.hideCode()
  await name.scrollIntoViewIfNeeded(wait)
  await take.caption('nouveau', 'nom')
  const codeUnits = page.getByLabel('Ce code vaut (unités)')
  await take.tap(codeUnits)
  await take.typeSlowly(codeUnits, '24')
  await take.caption('nouveau', 'unites')
  const targetStock = page.getByLabel('Stock idéal (unités)')
  await waitForValue(page.getByLabel('Pack Metro (unités)'), '24')
  await waitForValue(page.getByLabel("Seuil d'alerte (unités)"), '24')
  await waitForValue(targetStock, '48')
  await targetStock.scrollIntoViewIfNeeded(wait)
  await take.caption('nouveau', 'seuils')
  await take.tap(button('Créer le produit'))
  await waitForConfirmLine('Pack de 24 → +24')
  await take.caption('nouveau', 'creer')
  await take.tap(card.getByRole('button', { name: 'Valider' }))
  await waitForSaved('+24 Oasis Tropical 33 cl', 'Stock : 24 (1 pack)')

  // 5. Compter : Inventaire.
  await take.chapter('inventaire')
  await take.tap(button('Inventaire ='))
  await take.caption('inventaire', 'mode')
  await take.showCode(TUTORIAL_CODES.lipton)
  await card.getByText('Stock connu : 10', { exact: true }).waitFor(wait)
  await take.caption('inventaire', 'scan')
  const extraUnits = card.getByLabel('Unités en plus')
  await take.tap(extraUnits)
  await take.typeSlowly(extraUnits, '9')
  await take.caption('inventaire', 'saisie')
  await card.locator('.count-total').filter({ hasText: exactly('= 9') }).waitFor(wait)
  await card.locator('.count-gap').filter({ hasText: exactly('écart : −1') }).waitFor(wait)
  await take.caption('inventaire', 'ecart')
  await take.tap(card.getByRole('button', { name: 'Valider' }))
  await take.hideCode()
  await waitForSaved('Inventaire : 9 comptés (−1) Lipton Pêche 50 cl', 'Stock : 9')
  await take.caption('inventaire', 'regle')

  // 6. Avant Metro : À racheter.
  await take.chapter('racheter')
  await take.caption('racheter', 'ouvrir')
  await take.tap(button('À racheter (3)'))
  const shopping = page.getByRole('list', { name: 'À racheter' })
  await shopping.waitFor(wait)
  const lines = await shopping.getByRole('button').evaluateAll((buttons) => buttons.map((line) => line.getAttribute('aria-label')))
  const expected = ['Évian 50 cl', 'Lipton Pêche 50 cl', 'Oasis Tropical 33 cl']
  if (lines.length !== 3 || !expected.every((product, index) => lines[index].startsWith(`${product} — `))) {
    throw new Error(`À racheter : ${JSON.stringify(lines)}, attendu ${expected.join(', ')}`)
  }
  await take.caption('racheter', 'packs')
  await take.caption('racheter', 'disparait')

  // 7. Le stock et la fiche d'un produit.
  await take.chapter('stock')
  await take.tap(button('Stock'))
  const products = page.getByRole('list', { name: 'Produits' })
  await products.waitFor(wait)
  await take.caption('stock', 'liste')
  await take.caption('stock', 'fiche')
  await take.tap(products.getByRole('button', { name: /^Évian 50 cl/ }))
  const sheet = page.getByRole('region', { name: 'Fiche produit' })
  await sheet.getByRole('list', { name: 'Derniers mouvements' }).waitFor(wait)
  await take.caption('stock', 'actions')
  await take.tap(sheet.getByRole('button', { name: 'Retour' }))
  await products.waitFor(wait)

  // 8. Corriger une erreur : Historique.
  await take.chapter('historique')
  await take.tap(button('Historique'))
  const history = page.getByRole('list', { name: 'Historique' })
  const mistake = history.getByRole('button', { name: 'Annuler : sam. 18:30 — Léa — Entrée +24 — Red Bull 25 cl' })
  await mistake.waitFor(wait)
  await take.caption('historique', 'liste')
  await take.caption('historique', 'erreur')
  await take.caption('historique', 'annuler')
  await take.tap(mistake)
  await history.locator('.history-meta').filter({ hasText: /annulé par Sam$/ }).waitFor(wait)
  await take.caption('historique', 'barree')

  // 9. Les Réglages et la suite.
  await take.chapter('reglages')
  await take.tap(page.getByRole('button', { name: 'Réglages' }))
  await page.getByRole('heading', { name: 'Réglages' }).waitFor(wait)
  await page.getByRole('button', { name: /^Tutoriel/ }).waitFor(wait)
  await take.caption('reglages', 'reglages')
}

rmSync(RAW_DIR, { recursive: true, force: true })
mkdirSync(RAW_DIR, { recursive: true })
const server = spawn(process.execPath, [VITE_BIN, 'preview', '--outDir', 'dist-e2e', '--port', String(PORT), '--strictPort'], {
  cwd: ROOT,
  stdio: 'ignore',
})
let browser
try {
  await waitForServer(`${BASE}/`)
  browser = await chromium.launch({ args: ['--force-device-scale-factor=2'] })
  const photos = await renderPackPhotos(browser)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })
  const page = await context.newPage()
  const origin = Date.now()
  const recorder = await startRecorder(context, page, origin)
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  // L'horloge de la page et celle de la base simulée partent du même instant.
  await page.clock.install({ time: FILMED_AT })
  await page.clock.resume()
  const clockStart = Date.now()
  const now = () => new Date(FILMED_AT.getTime() + (Date.now() - clockStart))
  await page.addInitScript(installCamera)
  await page.addInitScript(installTouchMarker)
  await page.addInitScript(installConfirmDialog)
  await page.addInitScript(installRepaintPulse)
  await installFakeSupabase(page, { catalogue: 'tutoriel', now, photos })
  // Après le « OK » dessiné (1,8 s), la ligne de l'Historique se barre : la réponse de l'annulation attend autant.
  await page.route('**/rest/v1/rpc/cancel_movement', async (route) => {
    await sleep(1800)
    await route.fallback()
  })
  await page.goto(`${BASE}/`)

  const take = director(page, origin)
  await film(page, take)
  const start = take.events[0].t
  const end = take.at()
  if (pageErrors.length > 0) throw new Error(`Erreurs dans la page pendant le tournage : ${pageErrors.join(' | ')}`)

  // Laisse arriver les dernières images, puis monte l'enregistrement.
  await sleep(600)
  const frameCount = await recorder.stop(end)
  await context.close()
  writeFileSync(join(RAW_DIR, 'timeline.json'), `${JSON.stringify({ start, end, events: take.events }, null, 2)}\n`)
  console.log(`Tournage enregistré : ${join(RAW_DIR, 'app.webm')} (${Math.round((end - start) / 1000)} s de film, ${frameCount} images)`)
} finally {
  await browser?.close()
  server.kill()
}
