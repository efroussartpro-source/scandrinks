/**
 * app-smoke.mjs — Test de bout en bout de ScanDrinks (jalons 1 à 3).
 *
 * Lance la version construite avec .env.e2e (vite preview) et ouvre Chromium
 * avec une fausse caméra qui montre un vrai EAN-13 (5449000000996). Le
 * backend est simulé (fakeSupabase.mjs) : connexion, fonctions SQL et Open
 * Food Facts. Chaque scénario part d'un navigateur neuf (stockage vide).
 *
 * Prérequis : `npm run e2e` construit l'app puis lance ce fichier ; Chromium
 * est fourni par l'environnement (PLAYWRIGHT_BROWSERS_PATH).
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { installCamera } from '../scripts/tutorial/page-helpers.js'
import { ean13Modules, ean13Y4m } from './ean13.mjs'
import { COCA_CODE, GOOD_PASSWORD, OFF_COCA_IMAGE, SUPABASE_URL, TUTORIAL_CODES, installFakeSupabase } from './fakeSupabase.mjs'
import { signIn } from './helpers.mjs'
import { jpegSize, PHOTO_JPEG, withExifOrientation } from './jpeg.mjs'

const PORT = 4173
const BASE = `http://localhost:${PORT}`
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const VITE_BIN = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const SCAN_TIMEOUT = 20_000

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

// initScript : fonction lancée dans la page avant l'app (par exemple un faux navigator.wakeLock).
async function openApp(browser, fakeOptions, { initScript = null, clockAt = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  if (initScript) await page.addInitScript(initScript)
  let options = fakeOptions
  if (clockAt) {
    // L'horloge de la page et celle de la base simulée partent du même instant (comme pour la vidéo tuto).
    await page.clock.install({ time: clockAt })
    await page.clock.resume()
    const start = Date.now()
    options = { ...fakeOptions, now: () => new Date(clockAt.getTime() + (Date.now() - start)) }
  }
  const fake = await installFakeSupabase(page, options)
  await page.goto(`${BASE}/`)
  return { context, page, fake, pageErrors }
}

const confirmCard = (page) => page.getByRole('region', { name: 'Fiche de confirmation' })

// Texte exact, pour un filtre hasText.
const exactly = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

// Attend que chaque élément soit entièrement dans la fenêtre, sans que l'on fasse défiler : waitFor() le dit
// visible même quand il est sous le bas de l'écran.
async function waitInViewport(page, locators, what) {
  const elements = await Promise.all(locators.map((locator) => locator.elementHandle({ timeout: 5000 })))
  const inViewport = (nodes) =>
    nodes.every((node) => {
      const box = node.getBoundingClientRect()
      return box.top >= 0 && box.bottom <= window.innerHeight
    })
  await page.waitForFunction(inViewport, elements, { timeout: 5000 }).catch(() => {
    throw new Error(`hors de l'écran : ${what}`)
  })
}

// Ligne de la fiche de confirmation, écrite comme avant la refonte (« Pack de 24 → +24 ») :
// « Pack de 24 » sous le nom, « +24 » en grand.
async function waitForConfirmLine(card, line, options = {}) {
  const [what, delta] = line.split(' → ')
  await card.locator('.confirm-what').filter({ hasText: exactly(what) }).waitFor(options)
  await card.locator('.confirm-delta').filter({ hasText: exactly(delta) }).waitFor(options)
}

// Message du Scanner après un enregistrement : sa première ligne, puis « Stock : … ».
async function waitForSaved(page, title, detail) {
  const notice = page.getByRole('status').filter({ has: page.locator('.notice-title').filter({ hasText: exactly(title) }) })
  await notice.locator('.notice-detail').filter({ hasText: exactly(detail) }).waitFor()
}

// Les nombres d'une fiche (spec §6.7) : chacun a son aide à gauche et sa case à droite (classe field-inline).
async function assertInlineNumbers(scope, labels) {
  for (const label of labels) {
    const inline = await scope.getByLabel(label, { exact: true }).evaluate((input) => input.closest('.field')?.classList.contains('field-inline') ?? false)
    assert.ok(inline, `« ${label} » : l'aide à gauche, la case à droite`)
  }
}
const FICHE_NUMBERS = ['Pack Metro (unités)', "Seuil d'alerte (unités)", 'Stock idéal (unités)']

// Ce qui déborde à cette largeur de fenêtre : la page, plus large que l'écran ; une ligne de liste, une tuile, un bouton de
// mode ou d'un sélecteur, plus larges qu'eux-mêmes ; et les boutons visibles de moins de 44 px de haut (zones tactiles,
// spec §6.7).
const overflows = (page, width) =>
  page.evaluate(
    (viewport) => [
      ...(document.documentElement.scrollWidth > viewport ? [`page : ${document.documentElement.scrollWidth} px`] : []),
      ...[...document.querySelectorAll('.row, .product-row, .segmented button')]
        .filter((element) => element.scrollWidth > element.clientWidth)
        .map((element) => `déborde : ${element.textContent}`),
      ...[...document.querySelectorAll('button')]
        .filter((button) => button.checkVisibility() && button.getBoundingClientRect().height < 44)
        .map((button) => `moins de 44 px : ${button.textContent || button.getAttribute('aria-label')}`),
    ],
    width,
  )

// Total et écart d'un comptage d'inventaire.
async function waitForCount(scope, total, gap) {
  await scope.locator('.count-total').filter({ hasText: exactly(total) }).waitFor()
  await scope.locator('.count-gap').filter({ hasText: exactly(gap) }).waitFor()
}

// Noms donnés aux lecteurs d'écran (aria-label) des éléments trouvés, dans l'ordre.
const accessibleNames = (locator) => locator.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))

// Ligne d'un code dans la fiche produit : celle dont le code vaut exactement code.
const codeRow = (codes, code) =>
  codes.getByRole('listitem').filter({ has: codes.page().locator('.code-value').filter({ hasText: exactly(code) }) })

// Chiffres de la fiche produit, en paires [libellé, valeur] : [['Pack Metro', '24'], …].
const sheetFigures = (sheet) =>
  sheet.locator('.sheet-figures').evaluate((list) =>
    [...list.querySelectorAll('dt')].map((term) => [term.textContent.trim(), term.nextElementSibling.textContent.trim()]),
  )
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const recordCalls = (fake) => fake.calls.filter((call) => call.fn === 'record_movement')

// Aide affichée sous un champ : les textes visibles que le champ désigne par aria-describedby.
async function fieldHelp(locator) {
  return locator.evaluate((element) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((node) => node !== null && node.checkVisibility())
      .map((node) => node.textContent.trim())
      .join(' '),
  )
}

async function scenarioMain(browser) {
  const { context, page, fake, pageErrors } = await openApp(browser, { employees: ['Léa', 'Sam'] })
  const requests = []
  const wasmResponses = []
  page.on('request', (request) => requests.push(request.url()))
  page.on('response', (response) => {
    if (response.url().endsWith('.wasm')) {
      wasmResponses.push({ url: response.url(), status: response.status(), contentType: response.headers()['content-type'] ?? '' })
    }
  })
  const firstUrl = page.url()

  // 1-2. Connexion (mauvais puis bon mot de passe), prénom.
  // L'écran de connexion (spec §6.7) : une mosaïque de six dessins de boissons, décorative, au-dessus du formulaire.
  const mosaic = page.locator('.login-mosaic')
  await mosaic.waitFor()
  assert.equal(await mosaic.getAttribute('aria-hidden'), 'true')
  assert.equal(await mosaic.locator('img').count(), 6)
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Mot de passe incorrect.').waitFor()
  await page.getByLabel('Mot de passe').fill(GOOD_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { name: 'Qui es-tu ?' }).waitFor()
  // Les prénoms déjà utilisés, en cartes avec leur initiale (décorative : le nom du bouton reste le prénom). La liste
  // arrive après le titre : on attend la carte de Sam avant de compter.
  const sam = page.getByRole('button', { name: 'Sam', exact: true })
  await sam.waitFor()
  assert.equal(await page.locator('.choices button').count(), 2)
  assert.equal(await sam.locator('.name-initial').textContent(), 'S')
  assert.equal(await sam.locator('.name-initial').getAttribute('aria-hidden'), 'true')
  await sam.click()

  // 3. Code connu : fiche en Entrée.
  const card = confirmCard(page)
  await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
  await card.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()
  assert.equal(await card.getAttribute('data-mode'), 'in')
  // La caméra en haut (spec §6.7) : l'en-tête et le sélecteur de mode sont posés dessus ; la fiche ouverte, elle se
  // réduit de moitié. « Valider » reste large, à gauche d'« Annuler ».
  assert.ok(await page.evaluate(() => Boolean(document.querySelector('.viewfinder [role="group"][aria-label="Mode"]'))), 'le sélecteur de mode est dans le viseur')
  assert.equal(await page.locator('.viewfinder').getAttribute('data-size'), 'half')
  const headerBox = await page.locator('.app-header').boundingBox()
  const viewfinderBox = await page.locator('.viewfinder').boundingBox()
  assert.ok(headerBox.y < viewfinderBox.y + viewfinderBox.height, "l'en-tête est posé sur la caméra")
  const validateBox = await card.getByRole('button', { name: 'Valider' }).boundingBox()
  const cancelBox = await card.getByRole('button', { name: 'Annuler' }).boundingBox()
  assert.ok(validateBox.x < cancelBox.x && validateBox.width > cancelBox.width, '« Valider » large, à gauche d\'« Annuler »')

  // 4. La fiche suit le mode, en couleur et par le signe : la variation en grand et « Valider » prennent sa couleur.
  const colors = async () => ({
    delta: await card.locator('.confirm-delta').evaluate((el) => getComputedStyle(el).color),
    validate: await card.getByRole('button', { name: 'Valider' }).evaluate((el) => getComputedStyle(el).backgroundColor),
  })
  await page.getByRole('button', { name: 'Sortie −' }).click()
  await waitForConfirmLine(card, 'Pack de 24 → −24')
  assert.equal(await card.getAttribute('data-mode'), 'out')
  assert.deepEqual(await colors(), { delta: 'rgb(163, 74, 7)', validate: 'rgb(180, 83, 9)' })
  await page.getByRole('button', { name: 'Entrée +' }).click()
  await waitForConfirmLine(card, 'Pack de 24 → +24')
  assert.deepEqual(await colors(), { delta: 'rgb(31, 111, 63)', validate: 'rgb(31, 111, 63)' })

  // La quantité se tape au clavier : on efface le chiffre, puis on tape le nouveau.
  const quantity = card.getByLabel('Quantité')
  await quantity.click()
  await quantity.press('End')
  await quantity.press('Backspace')
  await quantity.pressSequentially('6')
  await waitForConfirmLine(card, 'Pack de 24 × 6 → +144')
  await quantity.press('Backspace')
  await quantity.pressSequentially('1')
  await waitForConfirmLine(card, 'Pack de 24 → +24')

  // Toute l'image analysée est visible : l'app ne lit pas un code que l'employé ne voit pas.
  const shown = await page.evaluate(() => {
    const video = document.querySelector('video')
    const box = video.getBoundingClientRect()
    const fit = getComputedStyle(video).objectFit
    const sx = box.width / video.videoWidth
    const sy = box.height / video.videoHeight
    const scale = fit === 'contain' ? Math.min(sx, sy) : fit === 'cover' ? Math.max(sx, sy) : Number.NaN
    return { fit, width: Math.min(1, box.width / (video.videoWidth * scale)), height: Math.min(1, box.height / (video.videoHeight * scale)) }
  })
  assert.ok(shown.width > 0.999 && shown.height > 0.999, `toute l'image analysée doit être visible : ${JSON.stringify(shown)}`)

  // 5. Valider : un seul mouvement, avec les bons paramètres.
  await card.getByRole('button', { name: 'Valider' }).click()
  await waitForSaved(page, '+24 Coca-Cola 33 cl', 'Stock : 48 (2 packs)')
  // De retour au scan, la caméra reprend toute sa taille.
  assert.equal(await page.locator('.viewfinder').getAttribute('data-size'), 'full')
  const records = recordCalls(fake)
  assert.equal(records.length, 1, 'un seul record_movement')
  assert.match(records[0].body.p_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'identifiant généré par le téléphone')
  assert.deepEqual(
    { ...records[0].body, p_id: undefined },
    { p_id: undefined, p_product_id: 'p-coca', p_code: COCA_CODE, p_kind: 'in', p_units: 24, p_quantity: 1, p_employee: 'Sam' },
  )

  // 6. Annuler pendant 5 s : même identifiant, stock rétabli.
  await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click()
  await page.getByText('Annulé — stock : 24 (1 pack)').waitFor()
  const cancel = fake.calls.find((call) => call.fn === 'cancel_movement')
  assert.equal(cancel?.body.p_movement_id, records[0].body.p_id, "l'annulation vise le mouvement enregistré")
  assert.equal(cancel?.body.p_employee, 'Sam')

  // 7. Saisie manuelle : produit, puis pack Metro.
  await page.getByRole('button', { name: 'Saisie manuelle' }).click()
  await page.getByRole('region', { name: 'Saisie manuelle' }).getByRole('button', { name: 'Coca-Cola 33 cl' }).click()
  await page.getByRole('button', { name: 'Par pack de 24' }).click()
  await waitForConfirmLine(card, 'Pack de 24 → +24')
  await card.getByRole('button', { name: 'Valider' }).click()
  await waitForSaved(page, '+24 Coca-Cola 33 cl', 'Stock : 48 (2 packs)')
  const manual = recordCalls(fake).at(-1)
  assert.equal(recordCalls(fake).length, 2)
  assert.equal(manual.body.p_code, null)
  assert.equal(manual.body.p_units, 24)

  // 8. Réglages puis Retour : la caméra repart, le code est relu.
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('heading', { name: 'Réglages' }).waitFor()
  await page.getByRole('button', { name: 'Retour' }).click()
  await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })

  // 9. Pendant tout le parcours.
  assert.equal(page.url(), firstUrl, "l'URL ne change jamais")
  assert.ok(
    wasmResponses.some((r) => r.url.startsWith(`${BASE}/assets/zxing_reader-`) && r.status === 200 && r.contentType.startsWith('application/wasm')),
    `wasm servi par l'app en application/wasm : ${JSON.stringify(wasmResponses)}`,
  )
  assert.ok(!requests.some((u) => /^https?:\/\/(cdn\.jsdelivr\.net|fastly\.jsdelivr\.net|unpkg\.com)\//.test(u)), 'aucune requête vers un CDN tiers')
  assert.deepEqual(pageErrors, [], 'aucune erreur dans la page')
  await context.close()
  console.log('Scénario A (parcours principal) : OK')
}

async function scenarioNetworkCut(browser) {
  const { context, page, fake } = await openApp(browser, { failNextRecord: true })
  await signIn(page)
  const card = confirmCard(page)
  await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
  await card.getByRole('button', { name: 'Valider' }).click()
  await card.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
  await card.getByRole('button', { name: 'Réessayer' }).click()
  await waitForSaved(page, '+24 Coca-Cola 33 cl', 'Stock : 48 (2 packs)')
  const records = recordCalls(fake)
  assert.equal(records.length, 2, 'deux tentatives')
  assert.equal(records[0].body.p_id, records[1].body.p_id, 'le nouvel essai garde le même identifiant')
  await context.close()
  console.log('Scénario B (coupure réseau) : OK')
}

async function scenarioSessionExpired(browser) {
  const { context, page } = await openApp(browser, { expireSessionOn: 'lookup_barcode' })
  await signIn(page)
  await page.getByText('Ta session a expiré : reconnecte-toi.').waitFor({ timeout: SCAN_TIMEOUT })
  await page.getByRole('button', { name: 'Se connecter' }).waitFor()
  await context.close()
  console.log('Scénario C (session expirée) : OK')
}

async function scenarioNewProduct(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'empty' })
  await signIn(page)
  await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })
  await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor()
  await page.getByRole('button', { name: 'Nouveau produit' }).click()
  assert.equal(await page.getByLabel('Nom').inputValue(), 'Coca-Cola 330 ml')
  await assertInlineNumbers(page, ['Ce code vaut (unités)', ...FICHE_NUMBERS])
  const helps = [
    await fieldHelp(page.getByLabel('Nom')),
    await fieldHelp(page.getByRole('button', { name: 'Scanner une canette du pack' })),
    await fieldHelp(page.getByLabel('Ce code vaut (unités)')),
    await fieldHelp(page.getByLabel('Pack Metro (unités)')),
    await fieldHelp(page.getByLabel("Seuil d'alerte (unités)")),
    await fieldHelp(page.getByLabel('Stock idéal (unités)')),
  ]
  assert.ok(
    helps.every((help) => help !== ''),
    `une aide visible sous chaque champ : ${JSON.stringify(helps)}`,
  )
  assert.equal(new Set(helps).size, helps.length, 'chaque champ a sa propre aide')
  await page.getByLabel('Ce code vaut (unités)').fill('24')
  assert.deepEqual(
    [
      await page.getByLabel('Pack Metro (unités)').inputValue(),
      await page.getByLabel("Seuil d'alerte (unités)").inputValue(),
      await page.getByLabel('Stock idéal (unités)').inputValue(),
    ],
    ['24', '24', '48'],
  )
  await page.getByRole('button', { name: 'Créer le produit' }).click()
  await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24')
  const create = fake.calls.find((call) => call.fn === 'create_product')
  assert.deepEqual(create?.body.p_barcodes, [{ code: COCA_CODE, units: 24 }])
  await context.close()
  {
    // Réponse perdue pendant la création (m10) : le nouvel essai garde l'identifiant, sans doublon.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', loseFirst: ['create_product'] })
    await signIn(page)
    await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor()
    await page.getByRole('button', { name: 'Nouveau produit' }).click()
    await page.getByLabel('Ce code vaut (unités)').fill('24')
    await page.getByRole('button', { name: 'Créer le produit' }).click()
    // La fiche est peut-être créée : les champs se figent, « Réessayer » renvoie exactement la même fiche.
    await page.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
    assert.ok(await page.getByLabel('Ce code vaut (unités)').isDisabled(), 'champs figés après une réponse perdue')
    assert.ok(await page.getByRole('button', { name: 'Scanner une canette du pack' }).isDisabled(), 'capture figée')
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24')
    const creates = fake.calls.filter((call) => call.fn === 'create_product')
    assert.equal(creates.length, 2, 'deux tentatives')
    assert.equal(creates[0].body.p_id, creates[1].body.p_id, 'le nouvel essai garde le même identifiant')
    await context.close()
  }
  console.log('Scénario D (nouveau produit) : OK')
}

async function scenarioAttach(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'coca_without_code' })
  await signIn(page)
  await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })
  await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor()
  await page.getByRole('button', { name: 'Ajouter à un produit existant' }).click()
  await page.getByRole('button', { name: 'Coca-Cola 33 cl' }).waitFor()
  assert.equal(await page.getByLabel('Rechercher un produit').inputValue(), 'Coca-Cola')
  assert.equal(await page.getByRole('button', { name: 'Lipton Pêche 50 cl' }).count(), 0, 'la liste est filtrée')
  await page.getByRole('button', { name: 'Coca-Cola 33 cl' }).click()
  assert.equal(await page.getByLabel('Ce code vaut (unités)').inputValue(), '1')
  assert.notEqual(await fieldHelp(page.getByLabel('Ce code vaut (unités)')), '', 'aide sous « Ce code vaut »')
  await page.getByRole('button', { name: 'Ajouter le code' }).click()
  await waitForConfirmLine(confirmCard(page), "À l'unité → +1")
  const attach = fake.calls.find((call) => call.fn === 'attach_barcode')
  assert.deepEqual(attach?.body, { p_code: COCA_CODE, p_product_id: 'p-coca', p_units: 1, p_move: false })
  await context.close()
  console.log('Scénario E (ajout à un produit existant) : OK')
}

// Onglets, catalogue partagé et liste À racheter (jalon 2).
async function scenarioTabs(browser) {
  const tab = (page, name) => page.getByRole('button', { name, exact: true })
  {
    // 1. Catalogue et badge.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage' })
    await signIn(page)
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await tab(page, 'À racheter (3)').waitFor()

    // 2. À racheter : ruptures en premier, heure de mise à jour, caméra arrêtée.
    await tab(page, 'À racheter (3)').click()
    const shopping = page.getByRole('list', { name: 'À racheter' })
    await shopping.waitFor()
    assert.deepEqual(await accessibleNames(shopping.getByRole('button')), [
      'Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier',
      'Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24',
      'Évian 1,5 L — reste 4 — prendre 8 unités',
    ])
    assert.deepEqual(await shopping.locator('.buy-amount').allTextContents(), ['2 packs', '2 packs', '8 unités'])
    assert.deepEqual(await shopping.locator('.buy-note').allTextContents(), ['de 24', 'de 24', "à l'unité"])
    await page.getByText(/^3 produits · mis à jour à \d{2}:\d{2}$/).waitFor()
    assert.ok(await page.evaluate(() => document.querySelector('video').srcObject === null), 'caméra arrêtée hors du Scanner')

    // 3. Une entrée faite sur un autre téléphone : le changement d'onglet relit le catalogue.
    fake.addMovement({ productId: 'p-evian', kind: 'in', delta: 8, employee: 'Léa' })
    await tab(page, 'Scanner').click()
    await tab(page, 'À racheter (2)').click()
    assert.deepEqual(await accessibleNames(shopping.getByRole('button')), [
      'Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier',
      'Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24',
    ])
    await page.getByText(/^2 produits · mis à jour à \d{2}:\d{2}$/).waitFor()

    // 4. La fiche du Scanner est gardée pendant le changement d'onglet.
    await tab(page, 'Scanner').click()
    await waitForConfirmLine(card, 'Pack de 24 → +24')
    await card.getByRole('button', { name: 'Plus' }).click()
    await waitForConfirmLine(card, 'Pack de 24 × 2 → +48')
    await card.getByRole('button', { name: 'Valider' }).click()
    await waitForSaved(page, '+48 Coca-Cola 33 cl', 'Stock : 58 (2 packs + 10)')
    await tab(page, 'À racheter (1)').waitFor()
    await context.close()
  }
  {
    // 5. Réglages ouverts après un échec (m9) : la fiche et son identifiant sont gardés.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', failNextRecord: true })
    await signIn(page)
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await card.getByRole('button', { name: 'Valider' }).click()
    await card.getByRole('button', { name: 'Réessayer' }).waitFor()
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByRole('heading', { name: 'Réglages' }).waitFor()
    await page.getByRole('button', { name: 'Retour' }).click()
    await card.getByRole('button', { name: 'Réessayer' }).click()
    await waitForSaved(page, '+24 Coca-Cola 33 cl', 'Stock : 34 (1 pack + 10)')
    const records = recordCalls(fake)
    assert.equal(records.length, 2, 'deux tentatives')
    assert.equal(records[0].body.p_id, records[1].body.p_id, 'le nouvel essai garde le même identifiant')
    await context.close()
  }
  {
    // 6. Déconnexion sans réseau (m5) : le téléphone est déconnecté, sans alerte trompeuse.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage', failLogout: true })
    const dialogs = []
    page.on('dialog', (dialog) => {
      dialogs.push(`${dialog.type()}: ${dialog.message()}`)
      void dialog.accept()
    })
    await signIn(page)
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await page.getByRole('button', { name: 'Se connecter' }).waitFor()
    // Laisse à une éventuelle alerte le temps de s'afficher.
    await page.waitForTimeout(500)
    assert.deepEqual(dialogs, ['confirm: Se déconnecter ? Il faudra retaper le mot de passe du tabac.'])
    await context.close()
  }
  console.log('Scénario H (onglets et À racheter) : OK')
}

// Mode Inventaire (jalon 2, RG-4).
async function scenarioInventory(browser) {
  {
    const { context, page, fake } = await openApp(browser)
    await signIn(page)
    await page.getByRole('button', { name: 'Inventaire =' }).click()
    const card = confirmCard(page)
    await card.getByText('Stock connu : 24 (1 pack)').waitFor({ timeout: SCAN_TIMEOUT })
    assert.equal(await card.getAttribute('data-mode'), 'inventory')
    await card.getByLabel('Packs de 24').fill('2')
    await card.getByLabel('Unités en plus').fill('5')
    await waitForCount(card, '= 53 (2 packs + 5)', 'écart : +29')
    // La fiche d'Inventaire est longue : la caméra se réduit (small), et « Valider » est bleu.
    const viewfinderHeight = () => page.locator('.viewfinder').evaluate((el) => el.getBoundingClientRect().height)
    assert.equal(await page.locator('.viewfinder').getAttribute('data-size'), 'small')
    const countingHeight = await viewfinderHeight()
    assert.equal(await card.getByRole('button', { name: 'Valider' }).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(29, 78, 216)')
    await card.getByRole('button', { name: 'Valider' }).click()
    await waitForSaved(page, 'Inventaire : 53 comptés (+29) Coca-Cola 33 cl', 'Stock : 53 (2 packs + 5)')
    // De retour au scan (le code n'est pas relu pendant 2 s), la caméra reprend sa taille.
    assert.equal(await page.locator('.viewfinder').getAttribute('data-size'), 'full')
    const scanningHeight = await viewfinderHeight()
    assert.ok(scanningHeight > countingHeight, `caméra de retour à sa taille : ${countingHeight} puis ${scanningHeight}`)
    const inventories = fake.calls.filter((call) => call.fn === 'record_inventory')
    assert.equal(inventories.length, 1, 'un seul record_inventory')
    assert.match(inventories[0].body.p_id, UUID, 'identifiant généré par le téléphone')
    assert.deepEqual({ ...inventories[0].body, p_id: undefined }, { p_id: undefined, p_product_id: 'p-coca', p_counted: 53, p_employee: 'Sam' })

    // Annuler : vise l'inventaire enregistré.
    await page.getByRole('status').getByRole('button', { name: 'Annuler' }).click()
    await page.getByText('Annulé — stock : 24 (1 pack)').waitFor()
    assert.equal(fake.calls.find((call) => call.fn === 'cancel_movement')?.body.p_movement_id, inventories[0].body.p_id)

    // Saisie manuelle en Inventaire : directement la saisie du comptage.
    await page.getByRole('button', { name: 'Saisie manuelle' }).click()
    await page.getByRole('region', { name: 'Saisie manuelle' }).getByRole('button', { name: 'Coca-Cola 33 cl' }).click()
    await card.getByText('Stock connu : 24 (1 pack)').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Par pack de 24' }).count(), 0)

    // Le mode est gardé par le téléphone.
    await page.reload()
    await page.getByRole('button', { name: 'Inventaire =' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Inventaire =' }).getAttribute('aria-pressed'), 'true')
    await context.close()
  }
  {
    // Premier jour (spec §4.2) : fiche créée en Inventaire, puis saisie du comptage.
    const { context, page } = await openApp(browser, { catalogue: 'empty' })
    await signIn(page)
    await page.getByRole('button', { name: 'Inventaire =' }).click()
    await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor()
    await page.getByRole('button', { name: 'Nouveau produit' }).click()
    await page.getByLabel('Ce code vaut (unités)').fill('24')
    await page.getByRole('button', { name: 'Créer le produit' }).click()
    await confirmCard(page).getByText('Stock connu : 0').waitFor()
    await context.close()
  }
  console.log('Scénario I (inventaire) : OK')
}

// Produit archivé scanné : proposition de réactivation (RG-11).
async function scenarioArchived(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'coca_archived' })
  await signIn(page)
  const archived = page.getByRole('region', { name: 'Produit archivé' })
  await archived.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor({ timeout: SCAN_TIMEOUT })
  await archived.getByRole('button', { name: 'Réactiver' }).click()
  await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24')
  assert.deepEqual(fake.calls.find((call) => call.fn === 'set_product_archived')?.body, { p_product_id: 'p-coca', p_archived: false })
  await context.close()
  console.log('Scénario J (produit archivé) : OK')
}

// Liste du stock et fiche produit (jalon 2, §4.4, RG-11).
async function scenarioStock(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage' })
  const dialogs = []
  let declineNext = false
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    if (declineNext) void dialog.dismiss()
    else void dialog.accept()
    declineNext = false
  })
  const tab = (name) => page.getByRole('button', { name, exact: true })
  await signIn(page)
  await tab('Stock').click()

  // 1. Grille triée à la française : le stock en unités sur la photo, l'état sous le nom (ce qu'il faut racheter,
  // « Stock à vérifier », ou les packs).
  const list = page.getByRole('list', { name: 'Produits' })
  await list.waitFor()
  assert.deepEqual(await list.locator('.product-name').allTextContents(), ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
  assert.deepEqual(await list.locator('.product-stock').allTextContents(), ['10', '4', '36', '−3'])
  assert.deepEqual(await list.locator('.product-stock').evaluateAll((chips) => chips.map((chip) => chip.hasAttribute('data-negative'))),
    [false, false, false, true])
  assert.deepEqual(await list.locator('.product-state').allTextContents(),
    ['2 packs à racheter', '8 unités à racheter', '3 packs', 'Stock à vérifier'])
  assert.deepEqual(await list.locator('.product-state').evaluateAll((states) => states.map((state) => state.dataset.tone)),
    ['restock', 'restock', 'neutral', 'check'])
  // Les photos (spec §6.7) : « Pas de photo » sans image ; la pastille « À racheter » sur celle d'un produit au seuil.
  assert.deepEqual(await list.locator('.thumb-empty-label').allTextContents(), Array(4).fill('Pas de photo'))
  assert.deepEqual(await list.locator('.photo-badge').allTextContents(), ['À racheter', 'À racheter', 'À racheter'])
  await page.getByText(/^Mis à jour à \d{2}:\d{2}$/).waitFor()
  assert.deepEqual(await list.locator('.product-row').evaluateAll((rows) => rows.map((row) => row.classList.contains('stock-low'))),
    [true, true, false, true])

  // 2. Recherche sans accents ni casse.
  const search = page.getByLabel('Rechercher un produit')
  await search.fill('evian')
  assert.deepEqual(await list.locator('.product-name').allTextContents(), ['Évian 1,5 L'])
  await search.fill('')

  // 3. Fiche du Coca : chiffres, codes et derniers mouvements (le plus récent d'abord).
  await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
  const sheet = page.getByRole('region', { name: 'Fiche produit' })
  await sheet.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()
  // La grande photo (ici absente : « Pas de photo »), puis ce qu'il faut racheter.
  assert.equal(await sheet.locator('.sheet-head .thumb-empty-label').textContent(), 'Pas de photo')
  assert.equal(await sheet.locator('.sheet-restock').textContent(), '2 packs à racheter')
  await sheet.locator('.sheet-stock-value').filter({ hasText: exactly('10') }).waitFor()
  // À racheter, le stock reste noir (la pastille orange le dit) ; seul un stock négatif passe en rouge.
  assert.equal(await sheet.locator('.sheet-stock-value').evaluate((value) => getComputedStyle(value).color), 'rgb(23, 26, 24)')
  assert.equal(await sheet.locator('.sheet-stock-packs').count(), 0, "moins d'un pack : pas de packs")
  assert.deepEqual(await sheetFigures(sheet), [['Pack Metro', '24'], ['Seuil', '24'], ['Stock idéal', '48']])
  const codes = sheet.getByRole('list', { name: 'Codes' })
  await codeRow(codes, '5449000000996').locator('.code-meta').filter({ hasText: exactly('24 unités') }).waitFor()
  const movements = sheet.getByRole('list', { name: 'Derniers mouvements' })
  await movements.locator('.movement-line').first().waitFor()
  const lines = await movements.locator('.movement-line').allTextContents()
  assert.equal(lines.length, 2)
  assert.match(lines[0], /— Léa — Sortie −38$/)
  assert.match(lines[1], /— Sam — Entrée \+48$/)

  // 4. Archivage refusé une première fois (p4) : aucun appel, la fiche reste ouverte.
  declineNext = true
  await sheet.getByRole('button', { name: 'Archiver le produit' }).click()
  await page.waitForTimeout(300)
  assert.deepEqual(dialogs, ['Archiver « Coca-Cola 33 cl » ? Il disparaîtra des listes ; son historique est gardé.'])
  assert.equal(fake.calls.filter((call) => call.fn === 'set_product_archived').length, 0, 'aucun archivage sans accord')
  await sheet.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()

  // Puis accepté : confirmation, retour à la liste, badge à jour.
  await sheet.getByRole('button', { name: 'Archiver le produit' }).click()
  await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).waitFor({ state: 'detached' })
  await tab('À racheter (2)').waitFor()

  // 5. Archivés (un bouton à bascule), puis réactivation depuis la fiche.
  const archivedToggle = page.getByRole('button', { name: 'Archivés' })
  assert.equal(await archivedToggle.getAttribute('aria-pressed'), 'false')
  await archivedToggle.click()
  assert.equal(await archivedToggle.getAttribute('aria-pressed'), 'true')
  await list.getByRole('button', { name: /^Oasis Tropical 33 cl/ }).waitFor()
  assert.deepEqual(await list.locator('.product-name').allTextContents(), ['Coca-Cola 33 cl', 'Oasis Tropical 33 cl'])
  await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
  await sheet.getByText('Ce produit est archivé.').waitFor()
  await sheet.getByRole('button', { name: 'Réactiver' }).click()
  await sheet.getByRole('button', { name: 'Archiver' }).waitFor()
  assert.deepEqual(fake.calls.filter((call) => call.fn === 'set_product_archived').map((call) => call.body), [
    { p_product_id: 'p-coca', p_archived: true },
    { p_product_id: 'p-coca', p_archived: false },
  ])
  await sheet.getByRole('button', { name: 'Retour' }).click()
  await archivedToggle.click()
  assert.equal(await archivedToggle.getAttribute('aria-pressed'), 'false')
  await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).waitFor()

  // 6. Depuis À racheter, une ligne ouvre la fiche du produit.
  await tab('À racheter (3)').click()
  await page.getByRole('list', { name: 'À racheter' }).getByRole('button', { name: /^Red Bull 25 cl/ }).click()
  await sheet.getByRole('heading', { name: 'Red Bull 25 cl' }).waitFor()
  await context.close()

  {
    // 7. Noms longs à 320 px : rien ne déborde sur le Scanner, À racheter, le Stock, la fiche et l'Historique.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage', longNames: true })
    await page.setViewportSize({ width: 320, height: 640 })
    const tab = (name) => page.getByRole('button', { name, exact: true })
    await signIn(page)
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await confirmCard(page).getByRole('heading', { name: 'Coca-Cola 33 cl — édition limitée, format familial' }).waitFor()
    assert.deepEqual(await overflows(page, 320), [], 'Scanner')
    // Le mode choisi passe en gras : « Inventaire = » doit tenir aussi.
    await page.getByRole('button', { name: 'Inventaire =' }).click()
    assert.deepEqual(await overflows(page, 320), [], 'Scanner en Inventaire')
    await page.getByRole('button', { name: 'Entrée +' }).click()
    await tab('À racheter (3)').click()
    await page.getByRole('list', { name: 'À racheter' }).waitFor()
    assert.deepEqual(await overflows(page, 320), [], 'À racheter')
    await tab('Stock').click()
    const list = page.getByRole('list', { name: 'Produits' })
    await list.waitFor()
    assert.deepEqual(await overflows(page, 320), [], 'Stock')
    // Un nom très long tient en deux lignes sur sa tuile, puis « … » (spec §6.7).
    const tooTall = await list.locator('.product-name').evaluateAll((names) =>
      names
        .filter((name) => name.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(name).lineHeight) + 1)
        .map((name) => name.textContent),
    )
    assert.deepEqual(tooTall, [], 'noms sur deux lignes au plus')
    await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
    await page.getByRole('region', { name: 'Fiche produit' }).locator('.movement-line').first().waitFor()
    assert.deepEqual(await overflows(page, 320), [], 'fiche produit')
    await tab('Historique').click()
    await page.getByRole('list', { name: 'Historique' }).waitFor()
    assert.deepEqual(await overflows(page, 320), [], 'Historique')
    await context.close()
  }
  console.log('Scénario K (stock et fiche produit) : OK')
}

// Modifications depuis la fiche : chiffres, codes, stock corrigé, nouveau produit sans scan.
async function scenarioSheetEdits(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', loseFirst: ['record_inventory', 'create_product'] })
  const dialogs = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.accept()
  })
  const tab = (name) => page.getByRole('button', { name, exact: true })
  const bodies = (fn) => fake.calls.filter((call) => call.fn === fn).map((call) => call.body)
  // Relecture du catalogue impossible (réseau perdu juste après un enregistrement).
  const isCatalogRead = (url) => url.pathname === '/rest/v1/product_stock'
  const cutCatalog = (route) => route.abort('internetdisconnected')
  await signIn(page)
  await tab('Stock').click()
  await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
  const sheet = page.getByRole('region', { name: 'Fiche produit' })
  const codes = sheet.getByRole('list', { name: 'Codes' })
  await codeRow(codes, '5449000000996').waitFor()

  // 1. Modifier : champs pré-remplis, le seuil ne suit pas le pack, RG-7 vérifiée avant l'envoi.
  await sheet.getByRole('button', { name: 'Modifier', exact: true }).click()
  const edit = page.getByRole('region', { name: 'Modifier le produit' })
  await assertInlineNumbers(edit, FICHE_NUMBERS)
  const editValues = async () => [
    await edit.getByLabel('Nom').inputValue(),
    await edit.getByLabel('Pack Metro (unités)').inputValue(),
    await edit.getByLabel("Seuil d'alerte (unités)").inputValue(),
    await edit.getByLabel('Stock idéal (unités)').inputValue(),
  ]
  assert.deepEqual(await editValues(), ['Coca-Cola 33 cl', '24', '24', '48'])
  await edit.getByLabel("Seuil d'alerte (unités)").fill('30')
  await edit.getByLabel('Stock idéal (unités)').fill('30')
  await edit.getByLabel('Pack Metro (unités)').fill('12')
  assert.deepEqual(await editValues(), ['Coca-Cola 33 cl', '12', '30', '30'])
  await edit.getByLabel('Pack Metro (unités)').fill('24')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()
  await edit.getByText('Le stock idéal doit être supérieur au seuil.').waitFor()
  assert.equal(bodies('update_product').length, 0, 'rien n’est envoyé')
  // La fiche montre ce qui vient d'être enregistré, même si le catalogue ne se relit pas.
  await page.route(isCatalogRead, cutCatalog)
  await edit.getByLabel('Stock idéal (unités)').fill('48')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()
  await sheet.locator('.sheet-figures').waitFor()
  assert.deepEqual(await sheetFigures(sheet), [['Pack Metro', '24'], ['Seuil', '30'], ['Stock idéal', '48']])
  await page.unroute(isCatalogRead, cutCatalog)
  assert.deepEqual(bodies('update_product'), [
    { p_id: 'p-coca', p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 30, p_target_stock: 48 },
  ])

  // 2. Unités d'un code.
  await codes.getByRole('button', { name: 'Modifier le code 5449000000996' }).click()
  assert.equal(await codes.getByLabel('Ce code vaut (unités)').inputValue(), '24')
  await codes.getByLabel('Ce code vaut (unités)').fill('12')
  await codes.getByRole('button', { name: 'Enregistrer' }).click()
  await codeRow(codes, '5449000000996').locator('.code-meta').filter({ hasText: exactly('12 unités') }).waitFor()
  assert.deepEqual(bodies('attach_barcode'), [{ p_code: '5449000000996', p_product_id: 'p-coca', p_units: 12, p_move: false }])

  // 3. Ajouter un code tapé à la main : la clé de contrôle est vérifiée.
  await sheet.getByRole('button', { name: 'Ajouter un code' }).click()
  const addCode = page.getByRole('region', { name: 'Ajouter un code' })
  assert.match(await fieldHelp(addCode.getByLabel('Code-barres')), /^Les chiffres sous les barres\./)
  await addCode.getByLabel('Code-barres').fill('4006381333932')
  await addCode.getByRole('button', { name: 'Continuer' }).click()
  await addCode.getByText('Code invalide : vérifie les chiffres.').waitFor()
  await addCode.getByLabel('Code-barres').fill('4006381333931')
  await addCode.getByRole('button', { name: 'Continuer' }).click()
  const attach = page.getByRole('region', { name: 'Ajouter à un produit existant' })
  await attach.getByLabel('Ce code vaut (unités)').fill('1')
  await attach.getByRole('button', { name: 'Ajouter le code' }).click()
  await codeRow(codes, '4006381333931').locator('.code-meta').filter({ hasText: exactly('1 unité') }).waitFor()
  assert.deepEqual(bodies('attach_barcode').at(-1), { p_code: '4006381333931', p_product_id: 'p-coca', p_units: 1, p_move: false })

  // 4. Retirer un code : confirmation, puis la ligne disparaît.
  await codes.getByRole('button', { name: 'Retirer le code 4006381333931' }).click()
  await codeRow(codes, '4006381333931').waitFor({ state: 'detached' })
  assert.deepEqual(bodies('detach_barcode'), [{ p_code: '4006381333931' }])
  assert.equal(dialogs.at(-1), 'Retirer le code 4006381333931 ? Les mouvements passés ne changent pas.')

  // 5. Corriger le stock : la première réponse se perd ; « Réessayer » renvoie le même comptage, même identifiant.
  await sheet.getByRole('button', { name: 'Corriger le stock' }).click()
  const correct = page.getByRole('region', { name: 'Corriger le stock' })
  await correct.getByLabel('Packs de 24').fill('1')
  await correct.getByLabel('Unités en plus').fill('2')
  await waitForCount(correct, '= 26 (1 pack + 2)', 'écart : +16')
  await correct.getByRole('button', { name: 'Valider' }).click()
  await correct.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
  assert.ok(await correct.getByLabel('Packs de 24').isDisabled(), 'comptage figé après un échec')
  await correct.getByRole('button', { name: 'Réessayer' }).click()
  await sheet.getByText('Stock corrigé : 26 (1 pack + 2)').waitFor()
  await sheet.locator('.sheet-stock-value').filter({ hasText: exactly('26') }).waitFor()
  await sheet.locator('.sheet-stock-packs').filter({ hasText: exactly('1 pack + 2') }).waitFor()
  const inventories = bodies('record_inventory')
  assert.equal(inventories.length, 2, 'deux tentatives')
  assert.match(inventories[0].p_id, UUID)
  assert.deepEqual(inventories[1], inventories[0], 'le nouvel essai renvoie le même comptage avec le même identifiant')
  assert.deepEqual({ ...inventories[0], p_id: undefined }, { p_id: undefined, p_product_id: 'p-coca', p_counted: 26, p_employee: 'Sam' })
  const movements = sheet.getByRole('list', { name: 'Derniers mouvements' }).getByRole('listitem')
  await movements.first().filter({ hasText: 'Inventaire' }).waitFor()
  assert.match(await movements.first().locator('.movement-line').textContent(), /— Sam — Inventaire : 26 comptés \(\+16\)$/)
  assert.equal(await movements.count(), 3, 'un seul inventaire enregistré')

  // 6. Nouveau produit sans scan : seuil et stock idéal suivent le pack ; création rejouée sans doublon ;
  //    la fiche créée s'ouvre même si le catalogue ne se relit pas.
  await sheet.getByRole('button', { name: 'Retour' }).click()
  await page.getByRole('region', { name: 'Stock', exact: true }).getByRole('button', { name: 'Nouveau produit' }).click()
  const create = page.getByRole('region', { name: 'Nouveau produit' })
  await assertInlineNumbers(create, FICHE_NUMBERS)
  const helps = [
    await fieldHelp(create.getByLabel('Nom')),
    await fieldHelp(create.getByLabel('Pack Metro (unités)')),
    await fieldHelp(create.getByLabel("Seuil d'alerte (unités)")),
    await fieldHelp(create.getByLabel('Stock idéal (unités)')),
  ]
  assert.ok(helps.every((help) => help !== ''), `une aide sous chaque champ : ${JSON.stringify(helps)}`)
  await create.getByLabel('Nom').fill('Schweppes Agrumes 33 cl')
  await create.getByLabel('Pack Metro (unités)').fill('24')
  assert.deepEqual(
    [await create.getByLabel("Seuil d'alerte (unités)").inputValue(), await create.getByLabel('Stock idéal (unités)').inputValue()],
    ['24', '48'],
  )
  await page.route(isCatalogRead, cutCatalog)
  await create.getByRole('button', { name: 'Créer le produit' }).click()
  await create.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
  assert.ok(await create.getByLabel('Pack Metro (unités)').isDisabled(), 'champs figés après une réponse perdue')
  await create.getByRole('button', { name: 'Réessayer' }).click()
  await sheet.getByRole('heading', { name: 'Schweppes Agrumes 33 cl' }).waitFor()
  await sheet.getByText('Aucun code : utilise « Saisie manuelle » au Scanner.').waitFor()
  await page.unroute(isCatalogRead, cutCatalog)
  const creates = bodies('create_product')
  assert.equal(creates.length, 2, 'deux tentatives')
  assert.deepEqual(creates[1], creates[0], 'le nouvel essai garde le même identifiant')
  const { p_id: createdId, ...created } = creates[0]
  assert.match(createdId, UUID)
  assert.deepEqual(created, { p_name: 'Schweppes Agrumes 33 cl', p_pack_size: 24, p_alert_threshold: 24, p_target_stock: 48, p_barcodes: [] })
  // Le catalogue relu au changement d'onglet : le nouveau produit est à racheter.
  await tab('À racheter (3)').click()
  await page.getByRole('list', { name: 'À racheter' }).getByRole('button', { name: /^Schweppes Agrumes 33 cl/ }).waitFor()
  await tab('À racheter (4)').waitFor()
  await context.close()
  {
    // « Annuler » après une réponse perdue : la liste est relue et montre la fiche créée, pour ne pas la refaire.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', loseFirst: ['create_product'] })
    await signIn(page)
    await page.getByRole('button', { name: 'Stock', exact: true }).click()
    await page.getByRole('region', { name: 'Stock', exact: true }).getByRole('button', { name: 'Nouveau produit' }).click()
    const create = page.getByRole('region', { name: 'Nouveau produit' })
    await create.getByLabel('Nom').fill('Schweppes Agrumes 33 cl')
    await create.getByLabel('Pack Metro (unités)').fill('24')
    await create.getByRole('button', { name: 'Créer le produit' }).click()
    await create.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
    await create.getByRole('button', { name: 'Annuler' }).click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Schweppes Agrumes 33 cl/ }).waitFor()
    assert.equal(fake.calls.filter((call) => call.fn === 'create_product').length, 1, 'une seule création')
    await context.close()
  }
  console.log('Scénario L (modifications depuis la fiche) : OK')
}

async function scenarioStalledDatabase(browser) {
  // Recherche bloquée : « Annuler » rend la main tout de suite.
  {
    const { context, page } = await openApp(browser, { hangFirst: 'lookup_barcode' })
    await signIn(page)
    await page.getByText('Recherche du code…').waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByRole('button', { name: 'Annuler' }).click()
    await page.getByRole('button', { name: 'Saisie manuelle' }).waitFor()
    await context.close()
  }
  // Enregistrement bloqué : au bout du délai, « Réessayer » avec le même identifiant.
  {
    const { context, page, fake } = await openApp(browser, { hangFirst: 'record_movement' })
    await signIn(page)
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await card.getByRole('button', { name: 'Valider' }).click()
    await card.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor({ timeout: 25_000 })
    await card.getByRole('button', { name: 'Réessayer' }).click()
    await waitForSaved(page, '+24 Coca-Cola 33 cl', 'Stock : 48 (2 packs)')
    const records = recordCalls(fake)
    assert.equal(records.length, 2, 'deux tentatives')
    assert.equal(records[0].body.p_id, records[1].body.p_id, 'le nouvel essai garde le même identifiant')
    await context.close()
  }
  console.log('Scénario G (base qui ne répond pas) : OK')
}

async function scenarioReaderAndCamera(browser) {
  // Lecteur indisponible : le wasm arrive sous un mauvais type.
  {
    const { context, page } = await openApp(browser)
    await page.route('**/*.wasm', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }))
    await signIn(page)
    await page.getByRole('alert').filter({ hasText: "Le lecteur de codes-barres n'a pas pu se charger" }).waitFor({ timeout: SCAN_TIMEOUT })
    // Sans lecteur, le Scanner reste au scan : la consigne est posée dans le viseur.
    await page.locator('.aim-hint').filter({ hasText: exactly('Vise le code-barres du pack ou de la bouteille.') }).waitFor()
    assert.ok(
      await page.evaluate(() => {
        const hint = document.querySelector('.aim-hint').getBoundingClientRect()
        const box = document.querySelector('.viewfinder').getBoundingClientRect()
        return hint.top >= box.top && hint.bottom <= box.bottom && hint.left >= box.left && hint.right <= box.right
      }),
      'la consigne est dans le viseur',
    )
    // Le message et « Démarrer la caméra » sont dans le panneau, sous la caméra, et rien ne les recouvre.
    const start = page.getByRole('button', { name: 'Démarrer la caméra' })
    await start.waitFor()
    assert.ok(await start.evaluate((button) => Boolean(button.closest('.panel'))), '« Démarrer la caméra » est dans le panneau')
    assert.ok(
      await start.evaluate((button) => {
        const box = button.getBoundingClientRect()
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
        return hit === button || button.contains(hit)
      }),
      '« Démarrer la caméra » est visible et rien ne le recouvre',
    )
    await context.close()
  }
  // App en arrière-plan puis de retour : la caméra s'arrête puis repart seule.
  {
    const { context, page } = await openApp(browser)
    await signIn(page)
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    const setVisibility = (state) =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
        document.dispatchEvent(new Event('visibilitychange'))
      }, state)
    await setVisibility('hidden')
    const stopped = page.getByRole('alert').filter({ hasText: "La caméra s'est arrêtée" })
    await stopped.waitFor()
    await setVisibility('visible')
    await stopped.waitFor({ state: 'detached', timeout: SCAN_TIMEOUT })
    await page.waitForFunction(() => document.querySelector('video')?.srcObject instanceof MediaStream, null, { timeout: SCAN_TIMEOUT })
    await context.close()
  }
  console.log('Scénario F (lecteur et caméra) : OK')
}

// Historique (jalon 3, §4.5) : pages, annulation, annulation faite ailleurs, retour dans l'app.
async function scenarioHistory(browser) {
  const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', extraMovements: 55 })
  const dialogs = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.accept()
  })
  let catalogReads = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/rest/v1/product_stock') catalogReads += 1
  })
  const tab = (name) => page.getByRole('button', { name, exact: true })
  const list = page.getByRole('list', { name: 'Historique' })
  const lineTexts = () => list.locator('.history-line').allTextContents()
  const row = (pattern) => list.getByRole('listitem').filter({ hasText: pattern })
  await signIn(page)
  await tab('À racheter (3)').waitFor()
  await tab('Historique').click()
  await page.getByRole('heading', { name: 'Historique' }).waitFor()

  // 1. La plus récente d'abord, tous produits confondus, produit archivé compris.
  await list.locator('.history-line').nth(49).waitFor()
  let texts = await lineTexts()
  assert.equal(texts.length, 50)
  assert.match(texts[0], /— Sam — Sortie −3 — Red Bull 25 cl$/)
  assert.match(texts[1], /— Léa — Sortie −38 — Coca-Cola 33 cl$/)
  assert.ok(texts.some((text) => /— Sam — Entrée \+24 — Oasis Tropical 33 cl$/.test(text)), "mouvement d'un produit archivé")
  // Telle qu'elle s'affiche : le produit, la quantité dans la couleur du type, puis le type, le moment et le prénom.
  const first = list.getByRole('listitem').first()
  assert.equal(await first.locator('.history-title').textContent(), 'Red Bull 25 cl')
  assert.equal(await first.locator('.history-amount').textContent(), '−3')
  assert.equal(await first.locator('.history-amount').evaluate((element) => getComputedStyle(element).color), 'rgb(163, 74, 7)')
  assert.match(await first.locator('.history-meta').textContent(), /^Sortie · \S+ \d{2}:\d{2} · Sam$/)

  // 2. À 320 px : les cinq onglets tiennent sur une ligne sans texte coupé, et « Voir plus »,
  // en bas de page, reste au-dessus de la barre d'onglets.
  await page.setViewportSize({ width: 320, height: 640 })
  assert.ok(
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.tab-bar button')]
      return buttons.length === 5 && buttons.every((button) => {
        const label = button.querySelector('.tab-label')
        return label.scrollWidth <= label.clientWidth && button.offsetTop === buttons[0].offsetTop
      })
    }),
    'onglets à 320 px',
  )
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  assert.ok(
    await page.evaluate(() => {
      const more = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Voir plus')
      return more.getBoundingClientRect().bottom <= document.querySelector('.tab-bar').getBoundingClientRect().top
    }),
    '« Voir plus » visible au-dessus des onglets',
  )
  await page.setViewportSize({ width: 390, height: 844 })

  // 3. « Voir plus » : la page suivante part de la 50e ligne, sans doublon, puis le bouton disparaît.
  await page.getByRole('button', { name: 'Voir plus' }).click()
  await list.locator('.history-line').nth(60).waitFor()
  texts = await lineTexts()
  assert.equal(texts.length, 61)
  assert.equal(new Set(texts).size, 61, 'aucune ligne en double')
  await page.getByRole('button', { name: 'Voir plus' }).waitFor({ state: 'detached' })
  assert.deepEqual(fake.calls.filter((call) => call.fn === 'list_history').map((call) => call.body), [
    { p_before_created_at: null, p_before_id: null, p_limit: 50 },
    { p_before_created_at: '2026-10-17T06:16:00Z', p_before_id: 'm-x44', p_limit: 50 },
  ])

  // 4. Annuler la sortie de Léa, après confirmation : le Coca remonte à 48 et quitte « À racheter ».
  await page.getByRole('button', { name: /^Annuler : .*— Léa — Sortie −38 — Coca-Cola 33 cl$/ }).click()
  const cancelled = row(/— Léa — Sortie −38 — Coca-Cola 33 cl — annulé par Sam$/)
  await cancelled.waitFor()
  assert.match(dialogs[0], /^Annuler ce mouvement \?\n.+— Léa — Sortie −38 — Coca-Cola 33 cl\nLe stock sera recalculé\.$/)
  assert.deepEqual(fake.calls.find((call) => call.fn === 'cancel_movement')?.body, { p_movement_id: 'm-c2', p_employee: 'Sam' })
  assert.equal(await cancelled.getAttribute('class'), 'cancelled')
  assert.match(await cancelled.locator('.history-meta').textContent(), /— annulé par Sam$/)
  assert.equal(await cancelled.locator('.history-title').evaluate((element) => getComputedStyle(element).textDecorationLine), 'line-through')
  assert.equal(await cancelled.locator('.thumb').count(), 1, 'une ligne annulée garde sa photo')
  assert.equal(await cancelled.getByRole('button').count(), 0, 'plus de bouton sur une ligne annulée')
  await tab('À racheter (2)').waitFor()

  // 5. Déjà annulée sur un autre téléphone : la ligne donne le prénom de celui qui l'a fait.
  fake.cancelElsewhere('m-r1', 'Léa')
  await page.getByRole('button', { name: /^Annuler : .*— Sam — Sortie −3 — Red Bull 25 cl$/ }).click()
  await row(/— Sam — Sortie −3 — Red Bull 25 cl — annulé par Léa$/).waitFor()
  assert.equal(dialogs.length, 2)

  // 6. Retour dans l'app : la première page et le catalogue sont relus.
  fake.addMovement({ productId: 'p-lipton', kind: 'in', delta: 12, employee: 'Zoé' })
  const readsBefore = catalogReads
  const setVisibility = (state) =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
      document.dispatchEvent(new Event('visibilitychange'))
    }, state)
  await setVisibility('hidden')
  await setVisibility('visible')
  await page.waitForFunction(() =>
    /— Zoé — Entrée \+12 — Lipton Pêche 50 cl$/.test(document.querySelector('.history-line')?.textContent ?? ''),
  )
  assert.ok(catalogReads > readsBefore, "catalogue relu au retour dans l'app")

  // 7. « Voir plus » touché pendant cette relecture : aucune ligne ne manque. Trois mouvements arrivent
  // d'un autre téléphone ; la relecture répond d'abord, la page demandée avec l'ancien curseur ensuite.
  for (const delta of [1, 2, 3]) fake.addMovement({ productId: 'p-lipton', kind: 'in', delta, employee: 'Yann' })
  let slowHistory = true
  await page.route(`${SUPABASE_URL}/rest/v1/rpc/list_history`, async (route) => {
    if (slowHistory) {
      const firstPage = route.request().postDataJSON()?.p_before_id === null
      await new Promise((resolve) => setTimeout(resolve, firstPage ? 400 : 1500))
    }
    return route.fallback()
  })
  await setVisibility('hidden')
  await setVisibility('visible')
  await page.getByRole('button', { name: 'Voir plus' }).click()
  await page.waitForTimeout(2500)
  slowHistory = false
  const more = page.getByRole('button', { name: 'Voir plus' })
  while ((await more.count()) > 0) {
    const shown = (await lineTexts()).length
    await more.click()
    await page.waitForFunction((count) => document.querySelectorAll('.history-line').length > count, shown)
  }
  texts = await lineTexts()
  assert.equal(texts.length, 65, 'les 65 mouvements, sans trou')
  assert.equal(new Set(texts).size, 65, 'aucune ligne en double')
  await context.close()
  console.log('Scénario M (historique) : OK')
}

// Changement du mot de passe du tabac (jalon 3, §4.6) : tous les téléphones sont déconnectés.
async function scenarioPassword(browser) {
  const NEW_PASSWORD = 'nouveau-mot-de-passe'
  const CHANGED = 'Mot de passe changé. Connecte-toi avec le nouveau mot de passe.'
  const LABELS = ['Mot de passe actuel', 'Nouveau mot de passe', 'Retape le nouveau mot de passe']
  const field = (page, label) => page.getByLabel(label, { exact: true })
  const openPasswordScreen = async (page) => {
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByRole('button', { name: 'Changer le mot de passe du tabac' }).click()
    await page.getByRole('heading', { name: 'Mot de passe du tabac' }).waitFor()
  }
  const submit = async (page, current, next, confirm) => {
    await field(page, LABELS[0]).fill(current)
    await field(page, LABELS[1]).fill(next)
    await field(page, LABELS[2]).fill(confirm)
    await page.getByRole('button', { name: 'Changer le mot de passe', exact: true }).click()
  }
  {
    // 1. Saisies refusées : erreur sous le champ sans appel, puis mot de passe actuel faux.
    const { context, page, fake } = await openApp(browser)
    await signIn(page)
    await openPasswordScreen(page)
    for (const label of LABELS) assert.ok(await fieldHelp(field(page, label)), `aide sous « ${label} »`)
    await submit(page, GOOD_PASSWORD, NEW_PASSWORD, `${NEW_PASSWORD}x`)
    await page.getByText('Les deux saisies ne correspondent pas.').waitFor()
    assert.deepEqual(fake.authCalls, ['token'], 'aucun appel pour une saisie refusée')
    await submit(page, 'pas-le-bon-mot-de-passe', NEW_PASSWORD, NEW_PASSWORD)
    await page.getByText('Mot de passe actuel incorrect.').waitFor()

    // 2. Changement réussi : vérification, changement, tous les téléphones puis celui-ci déconnectés.
    await submit(page, GOOD_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)
    await page.getByRole('status').filter({ hasText: CHANGED }).waitFor()
    assert.deepEqual(fake.authCalls.slice(2), ['token', 'user', 'logout:global', 'logout:local'])
    await page.getByLabel('Mot de passe').fill(GOOD_PASSWORD)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.getByText('Mot de passe incorrect.').waitFor()
    await page.getByLabel('Mot de passe').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.getByRole('button', { name: 'Historique', exact: true }).waitFor()
    await context.close()
  }
  {
    // 3. Autre téléphone : sa session est fermée, même avec un jeton encore valide ; rien n'est enregistré.
    const { context, page, fake } = await openApp(browser)
    await signIn(page)
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    fake.revokeAllSessions()
    const recorded = page.waitForResponse((response) => response.url().endsWith('/rest/v1/rpc/record_movement'))
    await card.getByRole('button', { name: 'Valider' }).click()
    assert.equal((await recorded).status(), 401, 'enregistrement refusé : session fermée')
    await page.getByText('Ta session a expiré : reconnecte-toi.').waitFor()
    await page.getByRole('button', { name: 'Se connecter' }).waitFor()
    await context.close()
  }
  {
    // 4. Réponse perdue au changement : champs figés, puis « Réessayer » finit le changement déjà fait.
    const { context, page, fake } = await openApp(browser, { loseFirst: ['auth:user'] })
    await signIn(page)
    await openPasswordScreen(page)
    await submit(page, GOOD_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)
    await page.getByText('Pas de connexion : changement non confirmé. Touche « Réessayer ».').waitFor()
    for (const label of LABELS) assert.ok(await field(page, label).isDisabled(), `« ${label} » figé`)
    const before = fake.authCalls.length
    await page.getByRole('button', { name: 'Réessayer' }).click()
    await page.getByRole('status').filter({ hasText: CHANGED }).waitFor()
    assert.deepEqual(fake.authCalls.slice(before), ['token', 'token', 'logout:global', 'logout:local'])
    await context.close()
  }
  console.log('Scénario N (mot de passe) : OK')
}

// Faux verrou d'écran (Wake Lock), installé avant l'app : il note chaque demande et chaque rendu.
function fakeWakeLock() {
  window.wakeLockLog = []
  // Écouteurs « release » du dernier verrou ; chacun ne sert qu'une fois (once), comme dans le navigateur.
  let releaseListeners = []
  const fireRelease = () => {
    const listeners = releaseListeners
    releaseListeners = []
    for (const listener of listeners) listener()
  }
  // Le système rend l'écran de lui-même, page visible (économie d'énergie, par exemple).
  window.wakeLockSystemRelease = () => {
    window.wakeLockLog.push('system-release')
    fireRelease()
  }
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async (type) => {
        window.wakeLockLog.push(`request:${type}`)
        releaseListeners = []
        return {
          addEventListener: (event, listener) => {
            if (event === 'release') releaseListeners.push(listener)
          },
          // Rendu par l'app : l'événement « release » part aussi.
          release: async () => {
            window.wakeLockLog.push('release')
            fireRelease()
          },
        }
      },
    },
  })
}

// Finitions (jalon 3) : écran allumé au Scanner, « Réessayer » dans la fiche (p2), champ « Code-barres » (p6),
// champ amené à l'écran au-dessus de la barre d'onglets (p8).
async function scenarioFinishing(browser) {
  const tab = (page, name) => page.getByRole('button', { name, exact: true })
  const wakeLockLog = (page) => page.evaluate(() => window.wakeLockLog)
  const waitForLog = (page, expected) =>
    page.waitForFunction((value) => JSON.stringify(window.wakeLockLog) === value, JSON.stringify(expected), { timeout: SCAN_TIMEOUT })
  {
    // 1. Écran allumé : demandé quand la caméra tourne ; relâché par le système, redemandé une fois, sans boucle (s7) ;
    // rendu hors du Scanner, redemandé au retour.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage' }, { initScript: fakeWakeLock })
    await signIn(page)
    await waitForLog(page, ['request:screen'])
    await page.evaluate(() => window.wakeLockSystemRelease())
    await waitForLog(page, ['request:screen', 'system-release', 'request:screen'])
    await page.evaluate(() => window.wakeLockSystemRelease())
    // Laisse à une éventuelle nouvelle demande le temps de partir.
    await page.waitForTimeout(500)
    const afterSecondRelease = ['request:screen', 'system-release', 'request:screen', 'system-release']
    assert.deepEqual(await wakeLockLog(page), afterSecondRelease, 'un second relâchement par le système ne redemande rien')
    await tab(page, 'Stock').click()
    await tab(page, 'Scanner').click()
    await waitForLog(page, [...afterSecondRelease, 'request:screen'])
    await tab(page, 'Stock').click()
    await waitForLog(page, [...afterSecondRelease, 'request:screen', 'release'])
    await tab(page, 'Scanner').click()
    await waitForLog(page, [...afterSecondRelease, 'request:screen', 'release', 'request:screen'])
    assert.deepEqual(await wakeLockLog(page), [...afterSecondRelease, 'request:screen', 'release', 'request:screen'])
    await context.close()
  }
  {
    // 2. Fiche produit (p2) : lecture coupée (le message vient après les relances de supabase-js) ; le message et
    // « Réessayer » restent après l'ouverture et la fermeture d'un panneau (s3) ; puis le réseau revient et
    // « Réessayer » relit la fiche.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', cutReads: 'movements' })
    await signIn(page)
    await tab(page, 'Stock').click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
    const sheet = page.getByRole('region', { name: 'Fiche produit' })
    await sheet.getByText('Pas de connexion. Réessaie quand le réseau revient.').waitFor({ timeout: SCAN_TIMEOUT })
    await sheet.getByRole('button', { name: 'Modifier' }).click()
    await page.getByRole('button', { name: 'Annuler' }).click()
    await sheet.getByText('Pas de connexion. Réessaie quand le réseau revient.').waitFor()
    await sheet.getByRole('button', { name: 'Réessayer' }).waitFor()
    // Un archivage tenté hors ligne échoue avec le même message, qui ne s'affiche pas deux fois ; après « Réessayer »,
    // la fiche relue ne le ressort pas.
    await page.route('**/rest/v1/rpc/set_product_archived', (route) => route.abort('internetdisconnected'))
    page.once('dialog', (dialog) => dialog.accept())
    const archiveFailed = page.waitForEvent('requestfailed', (request) => request.url().endsWith('/rest/v1/rpc/set_product_archived'))
    await sheet.getByRole('button', { name: 'Archiver le produit' }).click()
    await archiveFailed
    await sheet.getByRole('button', { name: 'Archiver le produit' }).and(page.locator(':enabled')).waitFor()
    assert.equal(await sheet.getByText('Pas de connexion. Réessaie quand le réseau revient.').count(), 1, 'le même message, une seule fois')
    await page.unroute('**/rest/v1/rpc/set_product_archived')
    fake.restoreReads()
    await sheet.getByRole('button', { name: 'Réessayer' }).click()
    await sheet.getByRole('list', { name: 'Derniers mouvements' }).waitFor()
    assert.equal(await sheet.getByText('Pas de connexion. Réessaie quand le réseau revient.').count(), 0, 'plus de message une fois la fiche relue')

    // 3. « Code-barres » (p6) : toucher le champ sélectionne tout son contenu.
    await sheet.getByRole('button', { name: 'Ajouter un code' }).click()
    const addCode = page.getByRole('region', { name: 'Ajouter un code' })
    await addCode.getByLabel('Code-barres').fill('12345')
    await addCode.getByRole('button', { name: 'Continuer' }).click()
    await addCode.getByText('Code invalide : vérifie les chiffres.').waitFor()
    await addCode.getByLabel('Code-barres').click()
    await page.waitForFunction(() => {
      const input = document.activeElement
      return input instanceof HTMLInputElement && input.value === '12345' && input.selectionStart === 0 && input.selectionEnd === 5
    })
    await context.close()
  }
  {
    // 4. Barre d'onglets (p8) : un champ amené à l'écran ne passe pas dessous.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage' })
    await signIn(page)
    await tab(page, 'Stock').click()
    await page.setViewportSize({ width: 390, height: 600 })
    await page.getByRole('button', { name: 'Nouveau produit' }).click()
    const fieldAboveTabBar = () =>
      page.evaluate(() => {
        const field = document.activeElement.getBoundingClientRect()
        return field.bottom <= document.querySelector('.tab-bar').getBoundingClientRect().top
      })
    await page.getByLabel('Stock idéal (unités)').focus()
    assert.ok(await fieldAboveTabBar(), "le champ reste au-dessus de la barre d'onglets")

    // Même chose dans l'app installée sur un iPhone à barre d'accueil : la barre d'onglets grandit de la zone du
    // geste (34 px). Le champ est placé à 80 px du bas, sous la barre : le navigateur ne le remonte que si la
    // marge réservée en bas couvre toute la barre.
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } })
    const stockField = page.getByLabel('Stock idéal (unités)')
    await page.evaluate(() => document.activeElement.blur())
    await stockField.evaluate((input) => window.scrollBy(0, input.getBoundingClientRect().bottom - (window.innerHeight - 80)))
    await stockField.focus()
    assert.ok(await fieldAboveTabBar(), "le champ reste au-dessus de la barre d'onglets, barre d'accueil comprise")
    await context.close()
  }
  {
    // 5. Démarrage impossible (réseau coupé pendant le chargement de l'app) : un message au lieu d'une page
    // blanche, et « Recharger », seul moyen de relancer dans l'app installée.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await installFakeSupabase(page)
    let cut = true
    await page.route('**/assets/App-*.js', (route) => (cut ? route.abort('internetdisconnected') : route.fallback()))
    await page.goto(`${BASE}/`)
    await page
      .getByText("L'app ne peut pas démarrer. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks.")
      .waitFor()
    cut = false
    await page.getByRole('button', { name: 'Recharger' }).click()
    await page.getByRole('button', { name: 'Se connecter' }).waitFor()
    await context.close()
  }
  console.log('Scénario O (finitions) : OK')
}

// Filet de sécurité (§6.2, §7) : une erreur d'affichage imprévue (une réponse abîmée que l'Historique ne sait pas
// afficher) donne un message et « Recharger », au lieu d'une page blanche ; « Recharger » relance l'app.
async function scenarioRenderError(browser) {
  const { context, page } = await openApp(browser, { corruptHistory: true })
  await signIn(page)
  await page.getByRole('button', { name: 'Historique', exact: true }).click()
  await page
    .getByRole('alert')
    .filter({ hasText: exactly("L'app a rencontré un problème. Touche « Recharger » ; si ça continue, préviens la personne qui gère ScanDrinks.") })
    .waitFor()
  await page.getByRole('button', { name: 'Recharger' }).click()
  await page.getByRole('button', { name: 'Entrée +' }).waitFor()
  await context.close()
  console.log('Scénario Q (filet de sécurité) : OK')
}

// Tutoriel (§4.6, §9 « Mise en service ») : la ligne des Réglages, l'écran sans rien charger avant le toucher,
// la vidéo injoignable, puis la page /tutoriel/ qu'ouvre le QR code de la feuille.
async function scenarioTutorial(browser) {
  {
    const { context, page, pageErrors } = await openApp(browser)
    const videoRequests = []
    page.on('request', (request) => {
      if (/\.(m3u8|m4s)$/.test(new URL(request.url()).pathname)) videoRequests.push(request.url())
    })
    await signIn(page)
    const settingsButton = page.getByRole('button', { name: 'Réglages' })
    const settings = page.locator('main.settings')
    const tutorial = page.locator('main.tutorial')
    const tutorialRow = settings.getByRole('button', { name: /^Tutoriel/ })
    await settingsButton.click()

    // 1. La ligne « Tutoriel » suit l'Apparence ; l'écran a son lecteur, et rien n'est chargé avant le toucher.
    await settings.getByRole('heading', { name: 'Réglages' }).waitFor()
    const labels = (await settings.getByRole('button').allTextContents()).map((text) => text.trim())
    const expected = ['Retour', 'Changer de prénom', 'Automatique', 'Clair', 'Sombre', 'Tutoriel', 'Changer le mot de passe du tabac', 'Se déconnecter']
    assert.equal(labels.length, expected.length, `boutons des Réglages : ${JSON.stringify(labels)}`)
    expected.forEach((label, index) => assert.ok(labels[index].startsWith(label), `bouton ${index + 1} : « ${labels[index]} », attendu « ${label} »`))
    await tutorialRow.getByText('Vidéo de 3 minutes', { exact: true }).waitFor()
    await tutorialRow.click()
    await tutorial.getByRole('heading', { name: 'Tutoriel', exact: true }).waitFor()
    await tutorial.getByText('Environ 3 minutes, sans le son : tout est écrit.', { exact: true }).waitFor()
    const video = await tutorial.getByLabel('Vidéo tuto').evaluate((element) => ({
      controls: element.controls,
      playsInline: element.playsInline,
      preload: element.preload,
      src: element.src,
      poster: element.poster,
    }))
    assert.equal(video.controls, true, 'commandes du lecteur')
    assert.equal(video.playsInline, true, 'lecture dans la page (playsinline)')
    assert.equal(video.preload, 'none', 'rien de chargé avant le toucher')
    assert.ok(video.src.endsWith('/tutoriel/video/tutoriel.m3u8'), `src : ${video.src}`)
    assert.ok(video.poster.endsWith('/tutoriel/video/poster.jpg'), `poster : ${video.poster}`)
    assert.deepEqual(videoRequests, [], 'aucune requête de la vidéo avant le toucher')
    await page.waitForFunction(() => document.querySelector('.app video').srcObject === null)

    // 2. « Retour » ramène aux Réglages, puis à l'app.
    await tutorial.getByRole('button', { name: 'Retour' }).click()
    await settings.getByRole('heading', { name: 'Réglages' }).waitFor()
    await settings.getByRole('button', { name: 'Retour' }).click()
    await settingsButton.waitFor()

    // 3. Vidéo injoignable, sur l'écran d'un iPhone SE (375 × 667) : le message sous le lecteur et « Réessayer »,
    // amenés à l'écran ; « Réessayer » relance le chargement quand le réseau revient. Le reste de l'app reste utilisable.
    await page.setViewportSize({ width: 375, height: 667 })
    await page.route('**/tutoriel/video/**', (route) => route.abort('internetdisconnected'))
    await settingsButton.click()
    await tutorialRow.click()
    await tutorial.getByLabel('Vidéo tuto').evaluate((element) => {
      element.play().catch(() => {})
    })
    const loadError = tutorial.getByRole('alert').filter({ hasText: exactly('La vidéo ne se charge pas. Vérifie la connexion, puis réessaie.') })
    const retry = tutorial.getByRole('button', { name: 'Réessayer', exact: true })
    await loadError.waitFor()
    await waitInViewport(page, [loadError, retry], 'le message de la vidéo et « Réessayer »')
    await page.unroute('**/tutoriel/video/**')
    const playlistAgain = page.waitForResponse((response) => new URL(response.url()).pathname === '/tutoriel/video/tutoriel.m3u8' && response.ok())
    await retry.click()
    await playlistAgain
    await tutorial.getByRole('button', { name: 'Retour' }).click()
    await settings.getByRole('button', { name: 'Retour' }).click()
    await settingsButton.waitFor()
    assert.deepEqual(pageErrors, [], 'aucune erreur dans la page')
    await context.close()
  }
  {
    // 4. La page /tutoriel/ : son titre, le message des navigateurs qui ne lisent pas le HLS, et le lien vers l'app.
    const { context, page } = await openApp(browser)
    await page.goto(`${BASE}/tutoriel/`)
    await page.getByRole('heading', { name: 'Tutoriel ScanDrinks' }).waitFor()
    const link = page.getByRole('link', { name: 'Ouvrir ScanDrinks' })
    assert.equal(await link.getAttribute('href'), '/')
    const withoutHls = await page.evaluate(() => document.querySelector('video').canPlayType('application/vnd.apple.mpegurl') === '')
    assert.equal(await page.getByText('Ouvre cette page sur un iPhone pour voir la vidéo.').isVisible(), withoutHls)
    await link.click()
    await page.getByRole('button', { name: 'Se connecter' }).waitFor()
    await context.close()
  }
  {
    // 5. La page /tutoriel/, vidéo injoignable, sur l'écran d'un iPhone SE : le message et « Réessayer » amenés à
    // l'écran ; « Réessayer » relance le chargement quand le réseau revient.
    const context = await browser.newContext({ viewport: { width: 375, height: 667 } })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.route('**/tutoriel/video/**', (route) => route.abort('internetdisconnected'))
    await page.goto(`${BASE}/tutoriel/`)
    await page.getByLabel('Vidéo tuto').evaluate((element) => {
      element.play().catch(() => {})
    })
    const loadError = page.getByRole('alert').filter({ hasText: exactly('La vidéo ne se charge pas. Vérifie la connexion, puis réessaie.') })
    const retry = page.getByRole('button', { name: 'Réessayer', exact: true })
    await loadError.waitFor()
    await waitInViewport(page, [loadError, retry], 'le message de la page /tutoriel/ et « Réessayer »')
    await page.unroute('**/tutoriel/video/**')
    const playlistAgain = page.waitForResponse((response) => new URL(response.url()).pathname === '/tutoriel/video/tutoriel.m3u8' && response.ok())
    await retry.click()
    await playlistAgain
    assert.deepEqual(pageErrors, [], 'aucune erreur dans la page /tutoriel/')
    await context.close()
  }
  console.log('Scénario P (tutoriel) : OK')
}

// Apparence (refonte, §4.6, §6.7) : jour par défaut, « Sombre » gardé par le téléphone, « Automatique » suit l'iPhone.
async function scenarioAppearance(browser) {
  const { context, page } = await openApp(browser)
  const look = () =>
    page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      background: getComputedStyle(document.body).backgroundColor,
      bar: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
    }))
  // Les changements de l'iPhone arrivent par un événement : on attend l'état voulu, puis on compare.
  const expectLook = async (expected) => {
    await page
      .waitForFunction(
        (wanted) =>
          JSON.stringify({
            theme: document.documentElement.getAttribute('data-theme'),
            background: getComputedStyle(document.body).backgroundColor,
            bar: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
          }) === wanted,
        JSON.stringify(expected),
        { timeout: 5000 },
      )
      .catch(() => {})
    assert.deepEqual(await look(), expected)
  }
  const DAY = { theme: null, background: 'rgb(247, 247, 245)', bar: '#F7F7F5' }
  const scannerTab = page.getByRole('button', { name: 'Scanner', exact: true })
  const appearance = page.getByRole('group', { name: 'Apparence' })
  const choice = (name) => appearance.getByRole('button', { name, exact: true })
  await signIn(page)
  await scannerTab.waitFor()

  // 1. Le jour par défaut, avec l'onglet actif en vert ; hors du Scanner, le prénom sur sa pastille vert pâle.
  assert.deepEqual(await look(), DAY)
  assert.equal(await scannerTab.evaluate((tab) => getComputedStyle(tab).color), 'rgb(31, 111, 63)')
  await page.getByRole('button', { name: 'Stock', exact: true }).click()
  assert.equal(await page.locator('.employee').evaluate((pill) => getComputedStyle(pill).backgroundColor), 'rgb(221, 240, 228)')
  // Le nom des onglets en 11 px à toutes les largeurs (spec §6.7).
  assert.equal(await page.locator('.tab-bar .tab-label', { hasText: 'Stock' }).evaluate((label) => getComputedStyle(label).fontSize), '11px')
  await scannerTab.click()

  // 2. « Sombre » : la nuit, la barre d'état noire, « Se déconnecter » en rouge de nuit.
  await page.getByRole('button', { name: 'Réglages' }).click()
  assert.deepEqual(await appearance.getByRole('button').allTextContents(), ['Automatique', 'Clair', 'Sombre'])
  assert.equal(await choice('Automatique').getAttribute('aria-pressed'), 'true')
  await choice('Sombre').click()
  assert.equal(await choice('Sombre').getAttribute('aria-pressed'), 'true')
  assert.deepEqual(await look(), { theme: 'dark', background: 'rgb(15, 17, 16)', bar: '#0F1110' })
  assert.equal(await page.getByRole('button', { name: 'Se déconnecter' }).evaluate((button) => getComputedStyle(button).color), 'rgb(255, 105, 97)')

  // 3. Le choix est gardé par le téléphone.
  await page.reload()
  await scannerTab.waitFor()
  assert.deepEqual(await look(), { theme: 'dark', background: 'rgb(15, 17, 16)', bar: '#0F1110' })

  // 4. « Automatique » suit le réglage de l'iPhone, barre d'état comprise.
  await page.getByRole('button', { name: 'Réglages' }).click()
  await choice('Automatique').click()
  assert.deepEqual(await look(), DAY)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectLook({ theme: null, background: 'rgb(15, 17, 16)', bar: '#0F1110' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expectLook(DAY)

  // 5. « Clair » l'emporte sur un iPhone en mode sombre.
  await page.emulateMedia({ colorScheme: 'dark' })
  await choice('Clair').click()
  assert.deepEqual(await look(), { theme: 'light', background: 'rgb(247, 247, 245)', bar: '#F7F7F5' })

  // 6. À 320 px : rien ne dépasse, et l'en-tête tient sur une ligne.
  await page.setViewportSize({ width: 320, height: 640 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'Réglages sans défilement horizontal à 320 px')
  await page.getByRole('button', { name: 'Retour' }).click()
  await scannerTab.waitFor()
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'Scanner sans défilement horizontal à 320 px')
  const centers = await page.evaluate(() =>
    ['.brand-tile', '.brand', '.employee', '.app-header .icon-button'].map((selector) => {
      const box = document.querySelector(selector).getBoundingClientRect()
      return box.top + box.height / 2
    }),
  )
  assert.ok(Math.max(...centers) - Math.min(...centers) <= 4, `en-tête sur une ligne : ${JSON.stringify(centers)}`)
  await context.close()
  console.log('Scénario R (apparence) : OK')
}

// Attend qu'une image soit chargée : complète, avec une largeur.
async function waitForImage(image) {
  await image.waitFor()
  await image.page().waitForFunction((element) => element.complete && element.naturalWidth > 0, await image.elementHandle())
}

// Images des codes (spec §4.7) : vignettes par liens signés, gardés ; l'icône grise sans image ou sans fichier.
async function scenarioImages(browser) {
  const signedPaths = (fake) => fake.storageCalls.filter((call) => call.kind === 'sign').map((call) => call.paths)
  {
    const { context, page, fake } = await openApp(browser, { catalogue: 'images' })
    const offRequests = []
    page.on('request', (request) => {
      if (new URL(request.url()).hostname === 'world.openfoodfacts.org') offRequests.push(request.url())
    })
    const tab = (name) => page.getByRole('button', { name, exact: true })
    await signIn(page)

    // 1. La fiche de confirmation : l'image du code scanné, par un lien signé.
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await waitForImage(card.locator('img.thumb'))
    assert.ok((await card.locator('img.thumb').getAttribute('src')).includes('/storage/v1/object/sign/photos/codes/5449000000996/11111111-'),
      "lien signé de l'image du Coca")
    // En Inventaire aussi (spec §4.7).
    await page.getByRole('button', { name: 'Inventaire =' }).click()
    await card.getByText('Stock connu', { exact: false }).waitFor()
    await waitForImage(card.locator('img.thumb'))
    await page.getByRole('button', { name: 'Entrée +' }).click()
    await waitForConfirmLine(card, 'Pack de 24 → +24')

    // 2. Le Stock : l'image de chaque produit ; l'icône grise sans image (Évian) ou sans fichier (Lipton).
    // Un seul appel de liens pour la liste : celui du Coca est gardé depuis l'étape 1.
    const signsBefore = signedPaths(fake).length
    await tab('Stock').click()
    const list = page.getByRole('list', { name: 'Produits' })
    const productRow = (name) => list.getByRole('button', { name: new RegExp(`^${name}`) })
    await waitForImage(productRow('Coca-Cola 33 cl').locator('img.thumb'))
    // L'image est toujours entière, posée sur sa plaque (spec §6.7) : jamais recadrée.
    assert.equal(await productRow('Coca-Cola 33 cl').locator('img.thumb').evaluate((image) => getComputedStyle(image).objectFit), 'contain')
    await productRow('Évian 50 cl').locator('.thumb-empty').waitFor()
    assert.equal(await productRow('Évian 50 cl').locator('.thumb-empty-label').textContent(), 'Pas de photo')
    await productRow('Lipton Pêche 50 cl').locator('.thumb-empty').waitFor()
    assert.deepEqual(signedPaths(fake).slice(signsBefore), [['codes/3502110123091/22222222-2222-4222-8222-222222222222.jpg']])

    // 3. La fiche du Coca : l'image du produit en tête, celle du code dans sa ligne, avec sa provenance.
    await productRow('Coca-Cola 33 cl').click()
    const sheet = page.getByRole('region', { name: 'Fiche produit' })
    await waitForImage(sheet.locator('.sheet-head img.thumb'))
    const codes = sheet.getByRole('list', { name: 'Codes' })
    await waitForImage(codeRow(codes, COCA_CODE).locator('img.thumb'))
    assert.equal(await codeRow(codes, COCA_CODE).locator('.code-meta').textContent(), "24 unités · photo de l'équipe")

    // 4. À racheter : l'image du Coca, l'icône grise du Lipton.
    await tab('À racheter (2)').click()
    const shopping = page.getByRole('list', { name: 'À racheter' })
    await waitForImage(shopping.getByRole('button', { name: /^Coca-Cola 33 cl/ }).locator('img.thumb'))
    await shopping.getByRole('button', { name: /^Lipton Pêche 50 cl/ }).locator('.thumb-empty').waitFor()

    // 4 bis. L'Historique (spec §4.7, §6.7) : la photo du produit en tête de chaque ligne, l'icône sans image.
    await tab('Historique').click()
    const history = page.getByRole('list', { name: 'Historique' })
    await waitForImage(history.getByRole('listitem').filter({ hasText: 'Coca-Cola 33 cl' }).first().locator('img.thumb'))
    await history.getByRole('listitem').filter({ hasText: 'Évian 50 cl' }).first().locator('.thumb-empty').waitFor()

    // 5. Tous les codes scannés sont connus : aucune question à Open Food Facts.
    assert.deepEqual(offRequests, [])
    await context.close()
  }
  {
    // 6. Image coupée (réseau perdu pendant son chargement) : l'icône grise, jamais l'image cassée du navigateur.
    const { context, page } = await openApp(browser, { catalogue: 'images' })
    await page.route('**/object/sign/photos/codes/5449000000996/**', (route) => route.abort('internetdisconnected'))
    await signIn(page)
    await page.getByRole('button', { name: 'Stock', exact: true }).click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).locator('.thumb-empty').waitFor()
    // Une image en échec laisse place à l'icône dès son erreur ; une image cassée qui resterait affichée bloquerait l'attente.
    await page.waitForFunction(() => [...document.querySelectorAll('img.thumb')].every((image) => image.naturalWidth > 0))
    await context.close()
  }

  const PHOTO_NOT_SAVED = 'Photo non enregistrée : réessaie depuis la fiche du produit.'
  const uploads = (fake) => fake.storageCalls.filter((call) => call.kind === 'upload')
  const photoLinks = (fake) => fake.calls.filter((call) => call.fn === 'set_barcode_photo').map((call) => call.body)
  const creates = (fake) => fake.calls.filter((call) => call.fn === 'create_product')
  // Code inconnu, puis « Nouveau produit » : le formulaire et son sélecteur de photo.
  const openNewProduct = async (page) => {
    await signIn(page)
    await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByRole('button', { name: 'Nouveau produit' }).click()
    const form = page.getByRole('region', { name: 'Nouveau produit' })
    return { form, picker: form.getByRole('group', { name: 'Photo du code' }) }
  }
  {
    // 7. Copie depuis Open Food Facts : l'image trouvée est réduite à 480 px, envoyée en JPEG, puis gardée avec le code.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty' })
    const { form, picker } = await openNewProduct(page)
    await picker.getByText('Image trouvée').waitFor()
    assert.equal(await picker.locator('img.thumb').getAttribute('src'), OFF_COCA_IMAGE)
    await picker.getByRole('button', { name: 'Prendre ma photo à la place' }).waitFor()
    await form.getByLabel('Ce code vaut (unités)').fill('24')
    await form.getByRole('button', { name: 'Créer le produit' }).click()
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24')
    assert.equal(uploads(fake).length, 1, 'un seul envoi')
    const [{ paths: [path], contentType }] = uploads(fake)
    assert.match(path, /^codes\/5449000000996\/[0-9a-f-]{36}\.jpg$/)
    assert.equal(contentType, 'image/jpeg')
    assert.equal(fake.photos.get(path).subarray(0, 2).toString('hex'), 'ffd8')
    assert.deepEqual(jpegSize(fake.photos.get(path)), { width: 480, height: 320 })
    assert.deepEqual(photoLinks(fake), [{ p_code: COCA_CODE, p_path: path, p_source: 'off' }])
    assert.match(await card.locator('img.thumb').getAttribute('src'), /^blob:/)
    await context.close()
  }
  {
    // 8. Photo de l'équipe, prise par la caméra du Scanner (1280 × 720) : réduite à 480 × 270.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', offImage: false })
    const { form, picker } = await openNewProduct(page)
    await picker.getByRole('button', { name: 'Prendre la photo' }).click()
    await picker.getByText('Photo prise').waitFor()
    await waitForImage(picker.locator('img.thumb'))
    await form.getByLabel('Ce code vaut (unités)').fill('24')
    await form.getByRole('button', { name: 'Créer le produit' }).click()
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24')
    const [{ paths: [path] }] = uploads(fake)
    assert.deepEqual(jpegSize(fake.photos.get(path)), { width: 480, height: 270 })
    assert.deepEqual(photoLinks(fake), [{ p_code: COCA_CODE, p_path: path, p_source: 'equipe' }])
    await context.close()
  }
  {
    // 9. Envoi raté : la fiche est créée une seule fois, la fiche de confirmation le dit, et « Valider » marche.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', failPhotoUpload: true })
    const { form, picker } = await openNewProduct(page)
    await picker.getByText('Image trouvée').waitFor()
    await form.getByLabel('Ce code vaut (unités)').fill('24')
    await form.getByRole('button', { name: 'Créer le produit' }).click()
    const card = confirmCard(page)
    await card.getByText(PHOTO_NOT_SAVED).waitFor()
    assert.equal(creates(fake).length, 1, 'une seule création')
    assert.deepEqual(photoLinks(fake), [])
    await card.getByRole('button', { name: 'Valider' }).click()
    await waitForSaved(page, '+24 Coca-Cola 330 ml', 'Stock : 24 (1 pack)')
    await context.close()
  }
  {
    // 10. Envoi bloqué (réseau de la réserve) : la fiche de confirmation et le message arrivent en moins de 20 s.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', hangPhotoUpload: true })
    const { form, picker } = await openNewProduct(page)
    await picker.getByText('Image trouvée').waitFor()
    await form.getByLabel('Ce code vaut (unités)').fill('24')
    const started = Date.now()
    await form.getByRole('button', { name: 'Créer le produit' }).click()
    await confirmCard(page).getByText(PHOTO_NOT_SAVED).waitFor({ timeout: 20_000 })
    assert.ok(Date.now() - started < 20_000, 'moins de 20 s')
    assert.equal(creates(fake).length, 1, 'une seule création')
    await context.close()
  }
  {
    // 11. Code ajouté à un produit existant, depuis le Scanner : l'image d'Open Food Facts est gardée avec lui.
    const { context, page, fake } = await openApp(browser, { catalogue: 'coca_without_code' })
    await signIn(page)
    await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByRole('button', { name: 'Ajouter à un produit existant' }).click()
    const attach = page.getByRole('region', { name: 'Ajouter à un produit existant' })
    await attach.getByRole('button', { name: 'Coca-Cola 33 cl' }).click()
    await attach.getByRole('group', { name: 'Photo du code' }).getByText('Image trouvée').waitFor()
    await attach.getByRole('button', { name: 'Ajouter le code' }).click()
    await waitForConfirmLine(confirmCard(page), "À l'unité → +1")
    assert.equal(uploads(fake).length, 1, 'un seul envoi')
    assert.deepEqual(photoLinks(fake), [{ p_code: COCA_CODE, p_path: uploads(fake)[0].paths[0], p_source: 'off' }])
    await context.close()
  }
  {
    // 12. Depuis la fiche : la photo du téléphone, prise en portrait (orientation EXIF 6), est redressée et remplace
    // l'image du code. L'ajout d'un code tapé n'a pas de sélecteur de photo.
    const { context, page, fake } = await openApp(browser, { catalogue: 'images' })
    await signIn(page)
    await page.getByRole('button', { name: 'Stock', exact: true }).click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
    const sheet = page.getByRole('region', { name: 'Fiche produit' })
    const chooser = page.waitForEvent('filechooser')
    await sheet.getByRole('button', { name: `Changer la photo du code ${COCA_CODE}` }).click()
    await (await chooser).setFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: withExifOrientation(PHOTO_JPEG, 6) })
    await page.waitForFunction(() => document.querySelector('.code-row img.thumb')?.getAttribute('src')?.startsWith('blob:'))
    const [{ paths: [path] }] = uploads(fake)
    assert.deepEqual(jpegSize(fake.photos.get(path)), { width: 320, height: 480 })
    assert.deepEqual(photoLinks(fake), [{ p_code: COCA_CODE, p_path: path, p_source: 'equipe' }])
    await sheet.getByRole('button', { name: 'Ajouter un code' }).click()
    const addCode = page.getByRole('region', { name: 'Ajouter un code' })
    await addCode.getByLabel('Code-barres').fill('4006381333931')
    await addCode.getByRole('button', { name: 'Continuer' }).click()
    const attach = page.getByRole('region', { name: 'Ajouter à un produit existant' })
    await attach.getByLabel('Ce code vaut (unités)').waitFor()
    assert.equal(await attach.getByRole('group', { name: 'Photo du code' }).count(), 0, 'pas de sélecteur de photo')
    await attach.getByRole('button', { name: 'Annuler' }).click()

    // 13. Retour au Scanner : la caméra repart.
    await page.getByRole('button', { name: 'Scanner', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('video')?.srcObject instanceof MediaStream)
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await context.close()
  }
  console.log('Scénario S (images) : OK')
}

// Fin de journée (jalon 5, §4.8, RG-14) : l'onglet « Ventes », un jeudi à 19:30 (heure de Paris).
async function scenarioSales(browser) {
  const EVENING = new Date('2026-10-22T17:30:00Z')
  // Un bouton, onglets compris, par son nom exact.
  const button = (page, name) => page.getByRole('button', { name, exact: true })
  const sold = (page, name) => page.getByLabel(`Vendus : ${name}`, { exact: true })
  const daySelect = (page) => page.getByLabel('Jour des ventes')
  const doneList = (page) => page.getByRole('list', { name: 'Déjà saisi' })
  const toEnter = (page) => page.getByRole('list', { name: 'À saisir' })
  const waitForTotal = (page, text) => page.locator('.sales-total').filter({ hasText: exactly(text) }).waitFor()
  // Noms affichés dans une liste de l'écran, dès qu'ils valent ceux attendus.
  const waitForList = (page, label, names) =>
    page.waitForFunction(([listLabel, want]) => {
      const list = document.querySelector(`ul[aria-label="${listLabel}"]`)
      const found = list ? [...list.querySelectorAll('.product-name')].map((element) => element.textContent) : []
      return JSON.stringify(found) === JSON.stringify(want)
    }, [label, names])
  // Stock affiché dans la liste du Stock, dans l'ordre alphabétique, dès qu'il vaut celui attendu.
  const waitForStock = async (page, values) => {
    await button(page, 'Stock').click()
    await page.waitForFunction((want) =>
      JSON.stringify([...document.querySelectorAll('.stock-list .product-stock')].map((element) => element.textContent)) ===
        JSON.stringify(want), values)
  }
  {
    const { context, page, fake, pageErrors } = await openApp(browser, { catalogue: 'pilotage', loseFirst: ['record_sales'] },
      { clockAt: EVENING })
    const dialogs = []
    let declineNext = false
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message())
      if (declineNext) void dialog.dismiss()
      else void dialog.accept()
      declineNext = false
    })
    const salesCalls = () => fake.calls.filter((call) => call.fn === 'record_sales')
    await signIn(page)
    await button(page, 'À racheter (3)').waitFor()

    // 1. Ouverture : le cinquième onglet, le jour, les produits actifs à saisir.
    assert.deepEqual(await page.locator('.tab-bar button').evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent)),
    ['Scanner', 'À racheter (3)', 'Stock', 'Ventes', 'Historique'])
    await button(page, 'Ventes').click()
    await page.getByRole('heading', { name: 'Fin de journée' }).waitFor()
    assert.ok(await page.evaluate(() => document.querySelector('video').srcObject === null), 'caméra arrêtée hors du Scanner')
    // Le premier jour de ventes de la version e2e est le 17/10 (.env.e2e) : le 16/10 n'est pas proposé.
    assert.deepEqual(await daySelect(page).locator('option').allTextContents(), ["Aujourd'hui, jeu. 22/10", 'Hier, mer. 21/10',
      'mar. 20/10', 'lun. 19/10', 'dim. 18/10', 'sam. 17/10'])
    assert.equal(await daySelect(page).inputValue(), '2026-10-22')
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    assert.equal(await doneList(page).count(), 0, 'rien de déjà saisi')
    await waitForTotal(page, 'Total du jour : 0 boisson')

    // 2. Saisies refusées : rien, puis une case hors limites.
    await button(page, 'Valider').click()
    await page.getByRole('alert').filter({ hasText: exactly('Tape le nombre de boissons vendues.') }).waitFor()
    await sold(page, 'Coca-Cola 33 cl').fill('1000')
    assert.equal(await sold(page, 'Coca-Cola 33 cl').getAttribute('aria-invalid'), 'true')
    await button(page, 'Valider').click()
    await page.getByRole('alert').filter({ hasText: exactly('Vendus : un nombre de 1 à 999.') }).waitFor()
    assert.equal(await page.getByRole('heading', { name: /^Ventes du / }).count(), 0, 'pas de récapitulatif')

    // 3. Saisie, avec la recherche : ce qui est tapé reste, même caché par la recherche.
    await sold(page, 'Coca-Cola 33 cl').fill('3')
    await sold(page, 'Évian 1,5 L').fill('2')
    await sold(page, 'Red Bull 25 cl').fill('0')
    await page.getByLabel('Rechercher un produit').fill('lip')
    await waitForList(page, 'À saisir', ['Lipton Pêche 50 cl'])
    await sold(page, 'Lipton Pêche 50 cl').fill('4')
    await page.getByLabel('Rechercher un produit').fill('')
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    assert.equal(await sold(page, 'Coca-Cola 33 cl').inputValue(), '3')
    await waitForTotal(page, 'Total du jour : 9 boissons')
    // Un tour par un autre onglet (« Une boisson manque ? « Stock » ») ne perd rien de la saisie.
    await button(page, 'Stock').click()
    await page.getByRole('list', { name: 'Produits' }).waitFor()
    await button(page, 'Ventes').click()
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    assert.deepEqual(await toEnter(page).getByRole('textbox').evaluateAll((boxes) => boxes.map((box) => box.value)), ['3', '2', '4', '0'])
    await waitForTotal(page, 'Total du jour : 9 boissons')

    // 4. Récapitulatif, puis « Revenir » : la saisie est intacte.
    await button(page, 'Valider').click()
    await page.getByRole('heading', { name: 'Ventes du jeu. 22/10' }).waitFor()
    assert.deepEqual(await page.getByRole('list', { name: 'Récapitulatif' }).getByRole('listitem').allTextContents(),
      ['Coca-Cola 33 cl : −3', 'Évian 1,5 L : −2', 'Lipton Pêche 50 cl : −4'])
    await waitForTotal(page, 'Total : 9 boissons')
    await button(page, 'Revenir').click()
    assert.equal(await sold(page, 'Coca-Cola 33 cl').inputValue(), '3')
    await button(page, 'Valider').click()
    await page.getByRole('heading', { name: 'Ventes du jeu. 22/10' }).waitFor()

    // 5. Réponse perdue : « Réessayer » renvoie les mêmes lignes ; chaque vente ne compte qu'une fois.
    await button(page, 'Enregistrer').click()
    await page.getByRole('alert').filter({ hasText: exactly('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».') }).waitFor()
    await button(page, 'Réessayer').click()
    await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 9 boissons.') }).waitFor()
    const [first, retry] = salesCalls()
    assert.equal(salesCalls().length, 2, 'deux envois')
    assert.deepEqual(retry.body, first.body, 'le nouvel essai renvoie les mêmes lignes')
    assert.equal(first.body.p_day, '2026-10-22')
    assert.ok(first.body.p_lines.every((line) => UUID.test(line.id)), 'un identifiant tiré par le téléphone pour chaque ligne')
    await waitForList(page, 'Déjà saisi', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl'])
    assert.deepEqual(await doneList(page).locator('.sales-amount').allTextContents(), ['−3', '−2', '−4'])
    for (const meta of await doneList(page).locator('.sales-meta').allTextContents()) assert.match(meta, /^Sam · 19:3\d$/)
    assert.match(await doneList(page).locator('.sales-line').first().textContent(), /^Coca-Cola 33 cl : 3 boissons, Sam, 19:3\d$/)
    await waitForList(page, 'À saisir', ['Red Bull 25 cl'])
    assert.equal(await sold(page, 'Red Bull 25 cl').inputValue(), '')
    await waitForTotal(page, 'Total du jour : 9 boissons')
    await waitForStock(page, ['7', '2', '32', '−3'])

    // 6. Saisi entre-temps sur un autre téléphone : rien n'est enregistré, la liste est relue.
    await button(page, 'Ventes').click()
    await waitForList(page, 'À saisir', ['Red Bull 25 cl'])
    fake.addMovement({ productId: 'p-redbull', kind: 'out', delta: -1, employee: 'Léa', saleDay: '2026-10-22' })
    await sold(page, 'Red Bull 25 cl').fill('2')
    await button(page, 'Valider').click()
    await button(page, 'Enregistrer').click()
    await page.getByRole('alert').filter({ hasText: exactly('Déjà saisi pour ce jour : Red Bull 25 cl. La liste est relue.') }).waitFor()
    await waitForList(page, 'Déjà saisi', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    assert.deepEqual(await doneList(page).locator('.sales-amount').allTextContents(), ['−3', '−2', '−4', '−1'])
    assert.match(await doneList(page).locator('.sales-meta').last().textContent(), /^Léa · 19:3\d$/)
    await page.getByText('Tout est saisi pour ce jour.', { exact: true }).waitFor()
    assert.equal(await button(page, 'Valider').count(), 0, 'plus rien à valider')
    await waitForTotal(page, 'Total du jour : 10 boissons')
    await waitForStock(page, ['7', '2', '32', '−4'])

    // 7. Une vente dans l'Historique : orange, annulable ; annulée, le produit se saisit de nouveau.
    await button(page, 'Historique').click()
    const history = page.getByRole('list', { name: 'Historique' })
    // La ligne active finit par son bouton « Annuler » : la phrase lue par VoiceOver est cherchée sans ancre de fin.
    const saleRow = history.getByRole('listitem').filter({ hasText: /— Sam — Vente −3 \(ventes du 22\/10\) — Coca-Cola 33 cl/ })
    await saleRow.waitFor()
    assert.match(await saleRow.locator('.history-meta').textContent(), /^Vente \(ventes du 22\/10\) · jeu\. 19:3\d · Sam$/)
    assert.equal(await saleRow.locator('.history-amount').textContent(), '−3')
    assert.equal(await saleRow.locator('.history-amount').evaluate((element) => getComputedStyle(element).color), 'rgb(163, 74, 7)')
    await saleRow.getByRole('button', { name: /^Annuler : / }).click()
    await history.getByRole('listitem').filter({ hasText: /— Vente −3 \(ventes du 22\/10\) — Coca-Cola 33 cl — annulé par Sam$/ }).waitFor()
    await button(page, 'Ventes').click()
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl'])
    await waitForTotal(page, 'Total du jour : 7 boissons')
    await sold(page, 'Coca-Cola 33 cl').fill('5')
    await button(page, 'Valider').click()
    await button(page, 'Enregistrer').click()
    await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 5 boissons.') }).waitFor()
    await waitForTotal(page, 'Total du jour : 12 boissons')

    // 8. La veille, avec une réponse lente pour aujourd'hui : elle arrive trop tard pour changer l'écran.
    await daySelect(page).selectOption('2026-10-21')
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    assert.equal(await doneList(page).count(), 0, 'rien de déjà saisi la veille')
    const slowToday = (url) => url.pathname === '/rest/v1/movements' && url.searchParams.get('sale_day') === 'eq.2026-10-22'
    await page.route(slowToday, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.fallback()
    })
    const lateToday = page.waitForResponse((response) => slowToday(new URL(response.url())))
    await daySelect(page).selectOption('2026-10-22')
    await daySelect(page).selectOption('2026-10-21')
    await lateToday
    await page.waitForTimeout(300)
    assert.equal(await doneList(page).count(), 0, 'la réponse en retard pour aujourd\'hui est ignorée')
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    await page.unroute(slowToday)
    await sold(page, 'Évian 1,5 L').fill('1')
    declineNext = true
    await daySelect(page).selectOption('2026-10-22')
    assert.equal(dialogs.at(-1), 'Changer de jour ? La saisie en cours sera effacée.')
    assert.equal(await daySelect(page).inputValue(), '2026-10-21')
    assert.equal(await sold(page, 'Évian 1,5 L').inputValue(), '1')
    await button(page, 'Valider').click()
    await page.getByRole('heading', { name: 'Ventes du mer. 21/10' }).waitFor()
    await button(page, 'Enregistrer').click()
    await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 1 boisson.') }).waitFor()
    assert.equal(salesCalls().at(-1).body.p_day, '2026-10-21')
    await sold(page, 'Lipton Pêche 50 cl').fill('2')
    await daySelect(page).selectOption('2026-10-22')
    assert.equal(dialogs.at(-1), 'Changer de jour ? La saisie en cours sera effacée.')
    await waitForTotal(page, 'Total du jour : 12 boissons')
    await daySelect(page).selectOption('2026-10-21')
    await waitForList(page, 'Déjà saisi', ['Évian 1,5 L'])
    assert.equal(await sold(page, 'Lipton Pêche 50 cl').inputValue(), '')

    // 9. La fiche produit montre la vente.
    await button(page, 'Stock').click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Évian 1,5 L/ }).click()
    const sheet = page.getByRole('region', { name: 'Fiche produit' })
    await sheet.getByRole('list', { name: 'Derniers mouvements' }).locator('.movement-title').first()
      .filter({ hasText: exactly('Vente −1 (ventes du 21/10)') }).waitFor()
    assert.deepEqual(pageErrors, [])
    await context.close()
  }
  {
    // 10 bis. Envoi coupé avant la base : le récapitulatif et son « Réessayer » survivent à un tour par un autre onglet,
    // et le nouvel essai renvoie les mêmes lignes.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', failFirst: ['record_sales'] }, { clockAt: EVENING })
    const notConfirmed = 'Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».'
    await signIn(page)
    await button(page, 'Ventes').click()
    await sold(page, 'Coca-Cola 33 cl').fill('3')
    await button(page, 'Valider').click()
    await button(page, 'Enregistrer').click()
    await page.getByRole('alert').filter({ hasText: exactly(notConfirmed) }).waitFor()
    await button(page, 'Historique').click()
    await page.getByRole('heading', { name: 'Historique' }).waitFor()
    await button(page, 'Ventes').click()
    await page.getByRole('heading', { name: 'Ventes du jeu. 22/10' }).waitFor()
    await page.getByRole('alert').filter({ hasText: exactly(notConfirmed) }).waitFor()
    await button(page, 'Réessayer').click()
    await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 3 boissons.') }).waitFor()
    const sent = fake.calls.filter((call) => call.fn === 'record_sales')
    assert.equal(sent.length, 2, 'deux envois')
    assert.deepEqual(sent[1].body, sent[0].body, 'le nouvel essai renvoie les mêmes lignes')
    await context.close()
  }
  {
    // 10 ter. L'app restée ouverte jusqu'au lendemain : au retour, « Aujourd'hui » est le nouveau jour ; une saisie en
    // cours garde le sien, devenu « Hier ».
    const { context, page } = await openApp(browser, { catalogue: 'pilotage' }, { clockAt: EVENING })
    const comeBack = async () => {
      for (const state of ['hidden', 'visible']) {
        await page.evaluate((value) => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
          document.dispatchEvent(new Event('visibilitychange'))
        }, state)
      }
    }
    const firstOption = () => page.locator('.sales-day option').first().textContent()
    await signIn(page)
    await button(page, 'Ventes').click()
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    await page.clock.fastForward('24:00:00')
    await comeBack()
    await page.waitForFunction(() => document.querySelector('.sales-day select')?.value === '2026-10-23')
    assert.equal(await firstOption(), "Aujourd'hui, ven. 23/10")
    await sold(page, 'Coca-Cola 33 cl').fill('3')
    await page.clock.fastForward('24:00:00')
    await comeBack()
    await page.waitForFunction(() => document.querySelector('.sales-day option')?.textContent === "Aujourd'hui, sam. 24/10")
    assert.equal(await daySelect(page).inputValue(), '2026-10-23')
    assert.equal(await page.locator('.sales-day option').nth(1).textContent(), 'Hier, ven. 23/10')
    assert.equal(await sold(page, 'Coca-Cola 33 cl').inputValue(), '3')
    await context.close()
  }
  {
    // 10 quater. Avant le premier jour de ventes (le 17/10 dans la version e2e) : rien à saisir.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage' }, { clockAt: new Date('2026-10-16T17:30:00Z') })
    await signIn(page)
    await button(page, 'Ventes').click()
    await page.getByText('La fin de journée commence le 17/10.', { exact: true }).waitFor()
    assert.equal(await daySelect(page).count(), 0, 'aucun jour à choisir')
    await context.close()
  }
  {
    // 10. Ventes du jour illisibles (réseau coupé) : le message et « Réessayer », sans liste à saisir.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', cutReads: 'movements' }, { clockAt: EVENING })
    await signIn(page)
    await button(page, 'Ventes').click()
    await page.getByRole('alert').filter({ hasText: exactly('Pas de connexion. Réessaie quand le réseau revient.') }).waitFor()
    assert.equal(await toEnter(page).count(), 0, 'pas de liste à saisir sans les ventes du jour')
    fake.restoreReads()
    await button(page, 'Réessayer').click()
    await waitForList(page, 'À saisir', ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    await context.close()
  }
  {
    // 11. À 320 px, avec des noms longs : rien ne déborde, « Valider » reste au-dessus des onglets.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage', longNames: true }, { clockAt: EVENING })
    await signIn(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await button(page, 'Ventes').click()
    const coca = 'Coca-Cola 33 cl — édition limitée, format familial'
    await sold(page, coca).fill('3')
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'saisie sans débordement à 320 px')
    assert.ok(
      await page.evaluate(() => {
        const validate = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Valider')
        return validate.getBoundingClientRect().bottom <= document.querySelector('.tab-bar').getBoundingClientRect().top
      }),
      '« Valider » au-dessus des onglets',
    )
    await button(page, 'Valider').click()
    await page.getByRole('heading', { name: /^Ventes du / }).waitFor()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'récapitulatif sans débordement à 320 px')
    assert.ok(
      await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.tab-bar button')]
        return buttons.length === 5 && buttons.every((button) => {
          const label = button.querySelector('.tab-label')
          return label.scrollWidth <= label.clientWidth && button.offsetTop === buttons[0].offsetTop
        })
      }),
      'onglets à 320 px',
    )
    await context.close()
  }
  console.log('Scénario T (ventes) : OK')
}

// U. Supprimer un produit pour de bon (RG-15, jalon 6) : la confirmation refusée puis acceptée, le message de la liste,
// le produit absent de partout ; un produit supprimé sur un autre téléphone pendant un scan, une fin de journée ou une
// fiche ouverte ; une réponse perdue.
async function scenarioDelete(browser) {
  const EVENING = new Date('2026-10-22T17:30:00Z')
  const button = (page, name) => page.getByRole('button', { name, exact: true })
  const shoppingTab = (page) => page.getByRole('button', { name: /^À racheter/ })
  const productList = (page) => page.getByRole('list', { name: 'Produits' })
  const productRow = (page, name) => productList(page).getByRole('button', { name: new RegExp(`^${name}`) })
  const sheet = (page) => page.getByRole('region', { name: 'Fiche produit' })
  const deleteCalls = (fake) => fake.calls.filter((call) => call.fn === 'delete_product')
  // Le message qui suit une suppression, en tête de la liste d'où la fiche avait été ouverte.
  const deletedNotice = (page, name) => page.getByRole('status').filter({ hasText: exactly(`${name} a été supprimé.`) })
  const confirmText = (name) =>
    `Supprimer « ${name} » pour de bon ? Ses codes et tout son historique (entrées, sorties, ventes, inventaires) seront effacés. ` +
    'Impossible de revenir en arrière.'
  // Les confirmations : chaque message est noté ; acceptée, sauf si la suivante doit être refusée.
  const watchDialogs = (page) => {
    const dialogs = { messages: [], declineNext: false }
    page.on('dialog', (dialog) => {
      dialogs.messages.push(dialog.message())
      if (dialogs.declineNext) void dialog.dismiss()
      else void dialog.accept()
      dialogs.declineNext = false
    })
    return dialogs
  }
  const waitForProducts = (page, names) =>
    page.waitForFunction((want) =>
      JSON.stringify([...document.querySelectorAll('ul[aria-label="Produits"] .product-name')].map((element) => element.textContent)) ===
        JSON.stringify(want), names)
  {
    const { context, page, fake, pageErrors } = await openApp(browser, { catalogue: 'pilotage' }, { clockAt: EVENING })
    const dialogs = watchDialogs(page)
    await signIn(page)

    // 1. Un scan validé sur un produit supprimé ailleurs : refusé, sans rien enregistrer ; relu, son code est inconnu. Un
    // code qui reste devant la caméra n'est pas relu (§7) : on quitte le Scanner, puis on y revient (caméra rouverte).
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    fake.deleteElsewhere('p-coca')
    await card.getByRole('button', { name: 'Valider' }).click()
    await card.getByRole('alert').filter({ hasText: exactly('Enregistrement refusé : vérifie la saisie ou scanne de nouveau.') }).waitFor()
    await card.getByRole('button', { name: 'Annuler' }).click()
    await button(page, 'Historique').click()
    await button(page, 'Scanner').click()
    await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })

    // 2. La confirmation refusée : rien n'est envoyé, la fiche reste ouverte.
    await button(page, 'Stock').click()
    await waitForProducts(page, ['Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
    await productRow(page, 'Lipton Pêche 50 cl').click()
    await sheet(page).getByRole('heading', { name: 'Lipton Pêche 50 cl' }).waitFor()
    dialogs.declineNext = true
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await page.waitForTimeout(300)
    assert.deepEqual(dialogs.messages, [confirmText('Lipton Pêche 50 cl')])
    assert.equal(deleteCalls(fake).length, 0, 'aucune suppression sans accord')
    await sheet(page).getByRole('heading', { name: 'Lipton Pêche 50 cl' }).waitFor()

    // 3. La confirmation acceptée : retour à la liste, avec le message ; le produit n'est plus nulle part.
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await deletedNotice(page, 'Lipton Pêche 50 cl').waitFor()
    await waitForProducts(page, ['Évian 1,5 L', 'Red Bull 25 cl'])
    assert.deepEqual(deleteCalls(fake).map((call) => call.body), [{ p_product_id: 'p-lipton' }])
    await button(page, 'Historique').click()
    const history = page.getByRole('list', { name: 'Historique' })
    await history.locator('.history-line').first().waitFor()
    const historyText = (await history.locator('.history-line').allTextContents()).join('\n')
    assert.ok(!historyText.includes('Lipton') && !historyText.includes('Coca'), `plus de ligne des produits supprimés : ${historyText}`)

    // 4. Un produit archivé se supprime aussi, depuis sa fiche.
    await button(page, 'Stock').click()
    await button(page, 'Archivés').click()
    await productRow(page, 'Oasis Tropical 33 cl').click()
    await sheet(page).getByRole('button', { name: 'Réactiver' }).waitFor()
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await deletedNotice(page, 'Oasis Tropical 33 cl').waitFor()
    await page.getByText('Aucun produit archivé.').waitFor()
    // Le message s'efface quand on ouvre une autre fiche.
    await button(page, 'Archivés').click()
    await productRow(page, 'Évian 1,5 L').click()
    await sheet(page).getByRole('heading', { name: 'Évian 1,5 L' }).waitFor()
    await sheet(page).getByRole('button', { name: 'Retour' }).click()
    await productList(page).waitFor()
    assert.equal(await page.getByText('a été supprimé.').count(), 0, 'le message ne revient pas')

    // 5. Une fin de journée qui contient un produit supprimé entre-temps : refusée une fois, puis relue sans lui.
    await button(page, 'Ventes').click()
    await page.getByRole('heading', { name: 'Fin de journée' }).waitFor()
    await page.getByLabel('Vendus : Red Bull 25 cl', { exact: true }).fill('2')
    await page.getByLabel('Vendus : Évian 1,5 L', { exact: true }).fill('3')
    await button(page, 'Valider').click()
    const recap = page.getByRole('list', { name: 'Récapitulatif' })
    await recap.waitFor()
    assert.deepEqual(await recap.getByRole('listitem').allTextContents(), ['Évian 1,5 L : −3', 'Red Bull 25 cl : −2'])
    fake.deleteElsewhere('p-evian')
    await button(page, 'Enregistrer').click()
    await page.getByRole('alert').filter({ hasText: exactly('Enregistrement refusé : vérifie le jour et les quantités.') }).waitFor()
    await page.waitForFunction(() =>
      JSON.stringify([...document.querySelectorAll('ul[aria-label="Récapitulatif"] li')].map((item) => item.textContent)) ===
        JSON.stringify(['Red Bull 25 cl : −2']))
    await button(page, 'Réessayer').click()
    await page.getByRole('status').filter({ hasText: exactly('Fin de journée enregistrée : 2 boissons.') }).waitFor()
    const sales = fake.calls.filter((call) => call.fn === 'record_sales')
    assert.equal(sales.length, 2, 'un refus, puis un enregistrement')
    assert.deepEqual(sales[1].body.p_lines.map((line) => [line.product_id, line.quantity]), [['p-redbull', 2]])
    assert.equal(sales[1].body.p_lines[0].id, sales[0].body.p_lines.find((line) => line.product_id === 'p-redbull').id,
      'la ligne gardée garde son identifiant')

    // 6. Depuis À racheter : la fiche se ferme sur À racheter, avec le message.
    await shoppingTab(page).click()
    await page.getByRole('list', { name: 'À racheter' }).getByRole('button', { name: /Red Bull 25 cl/ }).click()
    await sheet(page).getByRole('heading', { name: 'Red Bull 25 cl' }).waitFor()
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await deletedNotice(page, 'Red Bull 25 cl').waitFor()
    await page.getByRole('heading', { name: 'À racheter' }).waitFor()
    assert.equal(deleteCalls(fake).length, 3)
    assert.deepEqual(pageErrors, [], "pas d'erreur dans la page")
    await context.close()
  }
  {
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', loseFirst: ['delete_product'] })
    watchDialogs(page)
    await signIn(page)

    // 7. Une réponse perdue : la fiche reste ouverte avec le message ; le nouvel essai aboutit, sans rien effacer d'autre.
    await button(page, 'Stock').click()
    await productRow(page, 'Lipton Pêche 50 cl').click()
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await sheet(page).getByRole('alert').filter({ hasText: exactly('Pas de connexion. Réessaie quand le réseau revient.') }).waitFor()
    await sheet(page).getByRole('heading', { name: 'Lipton Pêche 50 cl' }).waitFor()
    await sheet(page).getByRole('button', { name: 'Supprimer le produit' }).click()
    await deletedNotice(page, 'Lipton Pêche 50 cl').waitFor()
    await waitForProducts(page, ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Red Bull 25 cl'])
    assert.deepEqual(deleteCalls(fake).map((call) => call.body), [{ p_product_id: 'p-lipton' }, { p_product_id: 'p-lipton' }])

    // 8. Une fiche ouverte pendant qu'un autre téléphone supprime le produit : elle se ferme à la relecture suivante.
    await productRow(page, 'Coca-Cola 33 cl').click()
    await sheet(page).getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()
    fake.deleteElsewhere('p-coca')
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await sheet(page).waitFor({ state: 'detached' })
    await waitForProducts(page, ['Évian 1,5 L', 'Red Bull 25 cl'])
    await context.close()
  }
  console.log('Scénario U (suppression) : OK')
}

// Le design « Vitrine » (spec §6.7, §8 jalon 7) : de jour et de nuit, à 390 et à 320 px de large, rien ne déborde sur les
// écrans principaux, avec des noms de produits très longs ; la police Plus Jakarta Sans est servie avec l'app.
async function scenarioDesign(browser) {
  for (const colorScheme of ['light', 'dark']) {
    for (const [width, height] of [
      [390, 844],
      [320, 640],
    ]) {
      const label = `${colorScheme === 'dark' ? 'nuit' : 'jour'}, ${width} px`
      const { context, page } = await openApp(browser, { catalogue: 'pilotage', longNames: true })
      await page.emulateMedia({ colorScheme })
      await page.setViewportSize({ width, height })
      const tab = (name) => page.getByRole('button', { name, exact: true })
      await signIn(page)
      await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
      assert.deepEqual(await overflows(page, width), [], `Scanner (${label})`)
      // Le geste le plus fréquent : scanner puis « Valider », sans faire défiler, même sur un petit iPhone.
      const validateBox = await confirmCard(page).getByRole('button', { name: 'Valider' }).boundingBox()
      const tabBarBox = await page.locator('.tab-bar').boundingBox()
      assert.ok(
        validateBox.y + validateBox.height <= tabBarBox.y,
        `« Valider » au-dessus de la barre d'onglets (${label}) : bas à ${validateBox.y + validateBox.height}, barre à ${tabBarBox.y}`,
      )
      await tab('À racheter (3)').click()
      await page.getByRole('list', { name: 'À racheter' }).waitFor()
      assert.deepEqual(await overflows(page, width), [], `À racheter (${label})`)
      await tab('Stock').click()
      const list = page.getByRole('list', { name: 'Produits' })
      await list.waitFor()
      assert.deepEqual(await overflows(page, width), [], `Stock (${label})`)
      await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
      await page.getByRole('region', { name: 'Fiche produit' }).locator('.movement-line').first().waitFor()
      assert.deepEqual(await overflows(page, width), [], `fiche produit (${label})`)
      await tab('Ventes').click()
      await page.getByRole('heading', { name: 'Fin de journée' }).waitFor()
      assert.deepEqual(await overflows(page, width), [], `Ventes (${label})`)
      await tab('Historique').click()
      await page.getByRole('list', { name: 'Historique' }).waitFor()
      assert.deepEqual(await overflows(page, width), [], `Historique (${label})`)
      await page.getByRole('button', { name: 'Réglages' }).click()
      await page.getByRole('heading', { name: 'Réglages' }).waitFor()
      assert.deepEqual(await overflows(page, width), [], `Réglages (${label})`)

      if (colorScheme === 'light' && width === 390) {
        // La police est servie avec l'app (pas de Google Fonts), chargée, et c'est elle que la page utilise.
        await page.evaluate(() => document.fonts.ready)
        const fontUrls = await page.evaluate(() =>
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.endsWith('.woff2')),
        )
        assert.equal(fontUrls.length, 1, `un seul fichier de police : ${JSON.stringify(fontUrls)}`)
        assert.equal(new URL(fontUrls[0]).origin, new URL(BASE).origin, "la police vient de l'app")
        assert.equal((await page.request.get(fontUrls[0])).status(), 200)
        assert.ok(await page.evaluate(() => document.fonts.check('600 17px "Plus Jakarta Sans"')), 'police chargée')
        assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /^"Plus Jakarta Sans"/)
      }
      await context.close()
    }
  }
  console.log('Scénario W (design) : OK')
}


// V. La photo de la canette à la création depuis un pack (§4.2, §4.7, jalon 6) : un cadre par code, une image qui ne sert
// que pour son code, les deux envois après la création, puis une photo qui n'arrive pas. La caméra est celle du tournage
// de la vidéo (un canvas) : elle montre le code voulu au moment voulu.
async function scenarioUnitPhoto(browser) {
  const PACK = TUTORIAL_CODES.oasisPack
  const CAN = TUTORIAL_CODES.oasisCan
  const show = (page, code) => page.evaluate(([modules, digits]) => window.__tutorialCamera.show(modules, digits), [ean13Modules(code), code])
  const form = (page) => page.getByRole('region', { name: 'Nouveau produit' })
  const group = (page, name) => form(page).getByRole('group', { name, exact: true })
  const button = (scope, name) => scope.getByRole('button', { name, exact: true })
  const photoLinks = (fake) =>
    fake.calls.filter((call) => call.fn === 'set_barcode_photo').map((call) => call.body).sort((a, b) => a.p_code.localeCompare(b.p_code))
  const waitForValue = async (page, locator, value) => {
    const element = await locator.elementHandle()
    await page.waitForFunction(([input, expected]) => input.value === expected, [element, value])
  }
  // Le pack scanné et sa photo prise ; puis la canette Oasis, scannée pour le nom, et sa photo.
  const packThenCan = async (page) => {
    await signIn(page)
    await show(page, PACK)
    await page.getByText(`Code inconnu : ${PACK}`).waitFor({ timeout: SCAN_TIMEOUT })
    await button(page, 'Nouveau produit').click()
    await group(page, 'Photo du code').waitFor()
    assert.equal(await group(page, 'Photo de la canette').count(), 0, 'pas de cadre de la canette avant son scan')
    await button(group(page, 'Photo du code'), 'Prendre la photo').click()
    await group(page, 'Photo du code').getByText('Photo prise').waitFor()
    await button(form(page), 'Scanner une canette du pack').click()
    await show(page, CAN)
    await form(page).getByText(`Canette : ${CAN} (1 unité)`).waitFor({ timeout: SCAN_TIMEOUT })
    await waitForValue(page, form(page).getByLabel('Nom'), 'Oasis Tropical 33 cl')
    await group(page, 'Photo du pack').getByText('Photo prise').waitFor()
    // Le texte que cite le guide d'essai (docs/jalon-6-test.md, étape 6).
    await group(page, 'Photo du pack').getByText('Elle sera gardée avec le code du pack.', { exact: true }).waitFor()
    await group(page, 'Photo de la canette').getByText('Photo de la canette', { exact: true }).waitFor()
    await button(group(page, 'Photo de la canette'), 'Prendre la photo').click()
    await group(page, 'Photo de la canette').getByText('Photo prise').waitFor()
    await group(page, 'Photo de la canette').getByText('Elle sera gardée avec le code de la canette.', { exact: true }).waitFor()
  }
  {
    const { context, page, fake, pageErrors } = await openApp(browser, { catalogue: 'empty' }, { initScript: installCamera })

    // 1-2. Le pack, puis sa canette : le premier cadre devient « Photo du pack », le second appartient à la canette.
    await packThenCan(page)

    // 3. Une autre canette : la photo de la première ne la suit pas ; le cadre propose l'image d'Open Food Facts du Coca.
    await button(form(page), 'Scanner une canette du pack').click()
    await show(page, COCA_CODE)
    await form(page).getByText(`Canette : ${COCA_CODE} (1 unité)`).waitFor({ timeout: SCAN_TIMEOUT })
    await group(page, 'Photo de la canette').getByText('Image trouvée').waitFor()
    assert.equal(await group(page, 'Photo de la canette').getByText('Photo prise').count(), 0, "la photo de l'autre canette ne suit pas")
    assert.equal(await form(page).getByLabel('Nom').inputValue(), 'Oasis Tropical 33 cl')

    // 4. Les deux cadres tiennent à 320 px de large.
    await page.setViewportSize({ width: 320, height: 800 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'deux cadres sans débordement à 320 px')
    await page.setViewportSize({ width: 390, height: 844 })

    // 5. La création : les deux codes, puis une image par code, chacune sous son propre code.
    await form(page).getByLabel('Ce code vaut (unités)').fill('24')
    await button(form(page), 'Créer le produit').click()
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24')
    assert.deepEqual(fake.calls.find((call) => call.fn === 'create_product')?.body.p_barcodes,
      [{ code: PACK, units: 24 }, { code: COCA_CODE, units: 1 }])
    const links = photoLinks(fake)
    assert.deepEqual(links.map((link) => [link.p_code, link.p_source]), [[PACK, 'equipe'], [COCA_CODE, 'off']])
    for (const link of links) assert.ok(link.p_path.startsWith(`codes/${link.p_code}/`), `chemin sous son code : ${link.p_path}`)
    assert.deepEqual(pageErrors, [], "pas d'erreur dans la page")
    await context.close()
  }
  {
    // 6. Une des deux photos n'arrive pas : le produit est créé, l'autre photo enregistrée, et l'écran le dit une fois.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', failPhotoUpload: true }, { initScript: installCamera })
    await packThenCan(page)
    await form(page).getByLabel('Ce code vaut (unités)').fill('24')
    await button(form(page), 'Créer le produit').click()
    const card = confirmCard(page)
    await waitForConfirmLine(card, 'Pack de 24 → +24')
    await card.getByText('Photo non enregistrée : réessaie depuis la fiche du produit.', { exact: true }).waitFor()
    assert.equal(photoLinks(fake).length, 1, 'une seule image rattachée')
    await context.close()
  }
  console.log('Scénario V (photo de la canette) : OK')
}

const tmp = mkdtempSync(join(tmpdir(), 'scandrinks-e2e-'))
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
  // E2E_ONLY=A,G lance seulement les scénarios cités (mise au point).
  const only = process.env.E2E_ONLY?.split(',')
  const scenarios = [
    ['A', scenarioMain],
    ['B', scenarioNetworkCut],
    ['C', scenarioSessionExpired],
    ['D', scenarioNewProduct],
    ['E', scenarioAttach],
    ['F', scenarioReaderAndCamera],
    ['G', scenarioStalledDatabase],
    ['H', scenarioTabs],
    ['I', scenarioInventory],
    ['J', scenarioArchived],
    ['K', scenarioStock],
    ['L', scenarioSheetEdits],
    ['M', scenarioHistory],
    ['N', scenarioPassword],
    ['O', scenarioFinishing],
    ['P', scenarioTutorial],
    ['Q', scenarioRenderError],
    ['R', scenarioAppearance],
    ['S', scenarioImages],
    ['T', scenarioSales],
    ['U', scenarioDelete],
    ['V', scenarioUnitPhoto],
    ['W', scenarioDesign],
  ]
  for (const [letter, scenario] of scenarios) {
    if (!only || only.includes(letter)) await scenario(browser)
  }
  console.log('E2E OK')
} finally {
  await browser?.close()
  server.kill()
  rmSync(tmp, { recursive: true, force: true })
}
