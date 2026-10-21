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
import { ean13Y4m } from './ean13.mjs'
import { COCA_CODE, GOOD_PASSWORD, SUPABASE_URL, installFakeSupabase } from './fakeSupabase.mjs'
import { signIn } from './helpers.mjs'

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
async function openApp(browser, fakeOptions, { initScript = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  if (initScript) await page.addInitScript(initScript)
  const fake = await installFakeSupabase(page, fakeOptions)
  await page.goto(`${BASE}/`)
  return { context, page, fake, pageErrors }
}

const confirmCard = (page) => page.getByRole('region', { name: 'Fiche de confirmation' })

// Texte exact, pour un filtre hasText.
const exactly = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

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
  const { context, page, fake, pageErrors } = await openApp(browser)
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
  await page.getByLabel('Mot de passe').fill('faux')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByText('Mot de passe incorrect.').waitFor()
  await signIn(page)

  // 3. Code connu : fiche en Entrée.
  const card = confirmCard(page)
  await waitForConfirmLine(card, 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
  await card.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()
  assert.equal(await card.getAttribute('data-mode'), 'in')
  // Le sélecteur de mode est au-dessus de la caméra.
  assert.ok(
    await page.evaluate(() =>
      Boolean(document.querySelector('[role="group"][aria-label="Mode"]').compareDocumentPosition(document.querySelector('.viewfinder')) &
        Node.DOCUMENT_POSITION_FOLLOWING),
    ),
    'le sélecteur de mode précède le viseur',
  )

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
    // La fiche d'Inventaire est longue : la caméra se réduit, et « Valider » est bleu.
    const viewfinderHeight = () => page.locator('.viewfinder').evaluate((el) => el.getBoundingClientRect().height)
    assert.ok((await viewfinderHeight()) <= 150, 'caméra réduite pendant le comptage')
    assert.equal(await card.getByRole('button', { name: 'Valider' }).evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(29, 78, 216)')
    await card.getByRole('button', { name: 'Valider' }).click()
    await waitForSaved(page, 'Inventaire : 53 comptés (+29) Coca-Cola 33 cl', 'Stock : 53 (2 packs + 5)')
    // De retour au scan (le code n'est pas relu pendant 2 s), la caméra reprend sa taille.
    const scanningHeight = await viewfinderHeight()
    assert.ok(scanningHeight > 150 && scanningHeight <= 300, `caméra de retour à sa taille : ${scanningHeight}`)
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

  // 1. Liste triée à la française : le stock en unités, l'état dessous (à racheter, ou les packs), en rouge à racheter.
  const list = page.getByRole('list', { name: 'Produits' })
  await list.waitFor()
  assert.deepEqual(await list.locator('.product-name').allTextContents(), ['Coca-Cola 33 cl', 'Évian 1,5 L', 'Lipton Pêche 50 cl', 'Red Bull 25 cl'])
  assert.deepEqual(await list.locator('.product-stock').allTextContents(), ['10', '4', '36', '−3'])
  assert.deepEqual(await list.locator('.product-state').allTextContents(),
    ['À racheter', 'À racheter', '3 packs', 'À racheter · stock à vérifier'])
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
  await sheet.locator('.sheet-stock-value').filter({ hasText: exactly('10') }).waitFor()
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

  // 5. Archivés, puis réactivation depuis la fiche.
  await page.getByRole('button', { name: 'Archivés' }).click()
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
  await page.getByRole('button', { name: 'Actifs' }).click()
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
    // Ce qui déborde : la page, plus large que l'écran, ou une ligne de liste, plus large qu'elle-même.
    const overflows = () =>
      page.evaluate(() => [
        ...(document.documentElement.scrollWidth > 320 ? [`page : ${document.documentElement.scrollWidth} px`] : []),
        ...[...document.querySelectorAll('.row')].filter((row) => row.scrollWidth > row.clientWidth).map((row) => `ligne : ${row.textContent}`),
      ])
    await signIn(page)
    await waitForConfirmLine(confirmCard(page), 'Pack de 24 → +24', { timeout: SCAN_TIMEOUT })
    await confirmCard(page).getByRole('heading', { name: 'Coca-Cola 33 cl — édition limitée, format familial' }).waitFor()
    assert.deepEqual(await overflows(), [], 'Scanner')
    await tab('À racheter (3)').click()
    await page.getByRole('list', { name: 'À racheter' }).waitFor()
    assert.deepEqual(await overflows(), [], 'À racheter')
    await tab('Stock').click()
    const list = page.getByRole('list', { name: 'Produits' })
    await list.waitFor()
    assert.deepEqual(await overflows(), [], 'Stock')
    await list.getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
    await page.getByRole('region', { name: 'Fiche produit' }).locator('.movement-line').first().waitFor()
    assert.deepEqual(await overflows(), [], 'fiche produit')
    await tab('Historique').click()
    await page.getByRole('list', { name: 'Historique' }).waitFor()
    assert.deepEqual(await overflows(), [], 'Historique')
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
    await page.getByRole('button', { name: 'Démarrer la caméra' }).waitFor()
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

  // 2. À 320 px : les quatre onglets tiennent sur une ligne sans texte coupé, et « Voir plus »,
  // en bas de page, reste au-dessus de la barre d'onglets.
  await page.setViewportSize({ width: 320, height: 640 })
  assert.ok(
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.tab-bar button')]
      return buttons.length === 4 && buttons.every((button) => {
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
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: {
      request: async (type) => {
        window.wakeLockLog.push(`request:${type}`)
        return {
          release: async () => {
            window.wakeLockLog.push('release')
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
    // 1. Écran allumé : demandé quand la caméra tourne, rendu hors du Scanner, redemandé au retour.
    const { context, page } = await openApp(browser, { catalogue: 'pilotage' }, { initScript: fakeWakeLock })
    await signIn(page)
    await waitForLog(page, ['request:screen'])
    await tab(page, 'Stock').click()
    await waitForLog(page, ['request:screen', 'release'])
    await tab(page, 'Scanner').click()
    await waitForLog(page, ['request:screen', 'release', 'request:screen'])
    assert.deepEqual(await wakeLockLog(page), ['request:screen', 'release', 'request:screen'])
    await context.close()
  }
  {
    // 2. Fiche produit (p2) : lecture coupée (le message vient après les relances de supabase-js),
    // puis le réseau revient et « Réessayer » relit la fiche.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', cutReads: 'movements' })
    await signIn(page)
    await tab(page, 'Stock').click()
    await page.getByRole('list', { name: 'Produits' }).getByRole('button', { name: /^Coca-Cola 33 cl/ }).click()
    const sheet = page.getByRole('region', { name: 'Fiche produit' })
    await sheet.getByText('Pas de connexion. Réessaie quand le réseau revient.').waitFor({ timeout: SCAN_TIMEOUT })
    fake.restoreReads()
    await sheet.getByRole('button', { name: 'Réessayer' }).click()
    await sheet.getByRole('list', { name: 'Derniers mouvements' }).waitFor()

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
  const DAY = { theme: null, background: 'rgb(242, 242, 247)', bar: '#F2F2F7' }
  const scannerTab = page.getByRole('button', { name: 'Scanner', exact: true })
  const appearance = page.getByRole('group', { name: 'Apparence' })
  const choice = (name) => appearance.getByRole('button', { name, exact: true })
  await signIn(page)
  await scannerTab.waitFor()

  // 1. Le jour par défaut, avec l'onglet actif en vert.
  assert.deepEqual(await look(), DAY)
  assert.equal(await scannerTab.evaluate((tab) => getComputedStyle(tab).color), 'rgb(31, 111, 63)')

  // 2. « Sombre » : la nuit, la barre d'état noire, « Se déconnecter » en rouge de nuit.
  await page.getByRole('button', { name: 'Réglages' }).click()
  assert.deepEqual(await appearance.getByRole('button').allTextContents(), ['Automatique', 'Clair', 'Sombre'])
  assert.equal(await choice('Automatique').getAttribute('aria-pressed'), 'true')
  await choice('Sombre').click()
  assert.equal(await choice('Sombre').getAttribute('aria-pressed'), 'true')
  assert.deepEqual(await look(), { theme: 'dark', background: 'rgb(0, 0, 0)', bar: '#000000' })
  assert.equal(await page.getByRole('button', { name: 'Se déconnecter' }).evaluate((button) => getComputedStyle(button).color), 'rgb(255, 105, 97)')

  // 3. Le choix est gardé par le téléphone.
  await page.reload()
  await scannerTab.waitFor()
  assert.deepEqual(await look(), { theme: 'dark', background: 'rgb(0, 0, 0)', bar: '#000000' })

  // 4. « Automatique » suit le réglage de l'iPhone, barre d'état comprise.
  await page.getByRole('button', { name: 'Réglages' }).click()
  await choice('Automatique').click()
  assert.deepEqual(await look(), DAY)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expectLook({ theme: null, background: 'rgb(0, 0, 0)', bar: '#000000' })
  await page.emulateMedia({ colorScheme: 'light' })
  await expectLook(DAY)

  // 5. « Clair » l'emporte sur un iPhone en mode sombre.
  await page.emulateMedia({ colorScheme: 'dark' })
  await choice('Clair').click()
  assert.deepEqual(await look(), { theme: 'light', background: 'rgb(242, 242, 247)', bar: '#F2F2F7' })

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

    // 2. Le Stock : l'image de chaque produit ; l'icône grise sans image (Évian) ou sans fichier (Lipton).
    // Un seul appel de liens pour la liste : celui du Coca est gardé depuis l'étape 1.
    const signsBefore = signedPaths(fake).length
    await tab('Stock').click()
    const list = page.getByRole('list', { name: 'Produits' })
    const productRow = (name) => list.getByRole('button', { name: new RegExp(`^${name}`) })
    await waitForImage(productRow('Coca-Cola 33 cl').locator('img.thumb'))
    await productRow('Évian 50 cl').locator('.thumb-empty').waitFor()
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
  console.log('Scénario S (images) : OK')
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
    ['R', scenarioAppearance],
    ['S', scenarioImages],
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
