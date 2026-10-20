/**
 * app-smoke.mjs — Test de bout en bout de ScanDrinks (jalon 1).
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
import { COCA_CODE, GOOD_PASSWORD, installFakeSupabase } from './fakeSupabase.mjs'

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

async function openApp(browser, fakeOptions) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const fake = await installFakeSupabase(page, fakeOptions)
  await page.goto(`${BASE}/`)
  return { context, page, fake, pageErrors }
}

async function signIn(page) {
  await page.getByLabel('Mot de passe').fill(GOOD_PASSWORD)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.getByRole('heading', { name: 'Qui es-tu ?' }).waitFor()
  await page.getByLabel('Nouveau prénom').fill('Sam')
  await page.getByRole('button', { name: "C'est moi" }).click()
}

const confirmCard = (page) => page.getByRole('region', { name: 'Fiche de confirmation' })
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
  await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
  await card.getByRole('heading', { name: 'Coca-Cola 33 cl' }).waitFor()
  assert.equal(await card.getAttribute('data-mode'), 'in')

  // 4. La fiche suit le mode, en couleur et par le signe.
  await page.getByRole('button', { name: 'Sortie −' }).click()
  await card.getByText('Pack de 24 → −24').waitFor()
  assert.equal(await card.getAttribute('data-mode'), 'out')
  assert.equal(await card.locator('.confirm-line').evaluate((el) => getComputedStyle(el).color), 'rgb(180, 83, 9)')
  await page.getByRole('button', { name: 'Entrée +' }).click()
  await card.getByText('Pack de 24 → +24').waitFor()

  // La quantité se tape au clavier : on efface le chiffre, puis on tape le nouveau.
  const quantity = card.getByLabel('Quantité')
  await quantity.click()
  await quantity.press('End')
  await quantity.press('Backspace')
  await quantity.pressSequentially('6')
  await card.getByText('Pack de 24 × 6 → +144').waitFor()
  await quantity.press('Backspace')
  await quantity.pressSequentially('1')
  await card.getByText('Pack de 24 → +24').waitFor()

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
  await page.getByText('✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs)').waitFor()
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
  await card.getByText('Pack de 24 → +24').waitFor()
  await card.getByRole('button', { name: 'Valider' }).click()
  await page.getByText('✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs)').waitFor()
  const manual = recordCalls(fake).at(-1)
  assert.equal(recordCalls(fake).length, 2)
  assert.equal(manual.body.p_code, null)
  assert.equal(manual.body.p_units, 24)

  // 8. Réglages puis Retour : la caméra repart, le code est relu.
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByRole('heading', { name: 'Réglages' }).waitFor()
  await page.getByRole('button', { name: 'Retour' }).click()
  await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })

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
  await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
  await card.getByRole('button', { name: 'Valider' }).click()
  await card.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor()
  await card.getByRole('button', { name: 'Réessayer' }).click()
  await page.getByText('✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs)').waitFor()
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
  await confirmCard(page).getByText('Pack de 24 → +24').waitFor()
  const create = fake.calls.find((call) => call.fn === 'create_product')
  assert.deepEqual(create?.body.p_barcodes, [{ code: COCA_CODE, units: 24 }])
  await context.close()
  {
    // Réponse perdue pendant la création (m10) : le nouvel essai garde l'identifiant, sans doublon.
    const { context, page, fake } = await openApp(browser, { catalogue: 'empty', loseFirstCreate: true })
    await signIn(page)
    await page.getByText(`Code inconnu : ${COCA_CODE}`).waitFor({ timeout: SCAN_TIMEOUT })
    await page.getByText('Open Food Facts : Coca-Cola 330 ml').waitFor()
    await page.getByRole('button', { name: 'Nouveau produit' }).click()
    await page.getByLabel('Ce code vaut (unités)').fill('24')
    await page.getByRole('button', { name: 'Créer le produit' }).click()
    await page.getByText('Pas de connexion. Réessaie quand le réseau revient.').waitFor()
    await page.getByRole('button', { name: 'Créer le produit' }).click()
    await confirmCard(page).getByText('Pack de 24 → +24').waitFor()
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
  await confirmCard(page).getByText("À l'unité → +1").waitFor()
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
    await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
    await tab(page, 'À racheter (3)').waitFor()

    // 2. À racheter : ruptures en premier, heure de mise à jour, caméra arrêtée.
    await tab(page, 'À racheter (3)').click()
    const shopping = page.getByRole('list', { name: 'À racheter' })
    await shopping.waitFor()
    assert.deepEqual(await shopping.getByRole('listitem').allTextContents(), [
      'Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier',
      'Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24',
      'Évian 1,5 L — reste 4 — prendre 8 unités',
    ])
    await page.getByText(/^Mis à jour à \d{2}:\d{2}$/).waitFor()
    assert.ok(await page.evaluate(() => document.querySelector('video').srcObject === null), 'caméra arrêtée hors du Scanner')

    // 3. Une entrée faite sur un autre téléphone : le changement d'onglet relit le catalogue.
    fake.addMovement({ productId: 'p-evian', kind: 'in', delta: 8, employee: 'Léa' })
    await tab(page, 'Scanner').click()
    await tab(page, 'À racheter (2)').click()
    assert.deepEqual(await shopping.getByRole('listitem').allTextContents(), [
      'Red Bull 25 cl — reste −3 — prendre 2 packs de 24 — stock à vérifier',
      'Coca-Cola 33 cl — reste 10 — prendre 2 packs de 24',
    ])

    // 4. La fiche du Scanner est gardée pendant le changement d'onglet.
    await tab(page, 'Scanner').click()
    await card.getByText('Pack de 24 → +24').waitFor()
    await card.getByRole('button', { name: 'Plus' }).click()
    await card.getByText('Pack de 24 × 2 → +48').waitFor()
    await card.getByRole('button', { name: 'Valider' }).click()
    await page.getByText('✓ +48 Coca-Cola 33 cl — stock : 58 (2 packs + 10)').waitFor()
    await tab(page, 'À racheter (1)').waitFor()
    await context.close()
  }
  {
    // 5. Réglages ouverts après un échec (m9) : la fiche et son identifiant sont gardés.
    const { context, page, fake } = await openApp(browser, { catalogue: 'pilotage', failNextRecord: true })
    await signIn(page)
    const card = confirmCard(page)
    await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
    await card.getByRole('button', { name: 'Valider' }).click()
    await card.getByRole('button', { name: 'Réessayer' }).waitFor()
    await page.getByRole('button', { name: 'Réglages' }).click()
    await page.getByRole('heading', { name: 'Réglages' }).waitFor()
    await page.getByRole('button', { name: 'Retour' }).click()
    await card.getByRole('button', { name: 'Réessayer' }).click()
    await page.getByText('✓ +24 Coca-Cola 33 cl — stock : 34 (1 pack + 10)').waitFor()
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
    await card.getByText('= 53 (2 packs + 5) — écart : +29').waitFor()
    await card.getByRole('button', { name: 'Valider' }).click()
    await page.getByText('✓ Inventaire : 53 comptés (+29) Coca-Cola 33 cl — stock : 53 (2 packs + 5)').waitFor()
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
  await confirmCard(page).getByText('Pack de 24 → +24').waitFor()
  assert.deepEqual(fake.calls.find((call) => call.fn === 'set_product_archived')?.body, { p_product_id: 'p-coca', p_archived: false })
  await context.close()
  console.log('Scénario J (produit archivé) : OK')
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
    await card.getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
    await card.getByRole('button', { name: 'Valider' }).click()
    await card.getByText('Pas de connexion : enregistrement non confirmé. Touche « Réessayer ».').waitFor({ timeout: 25_000 })
    await card.getByRole('button', { name: 'Réessayer' }).click()
    await page.getByText('✓ +24 Coca-Cola 33 cl — stock : 48 (2 packs)').waitFor()
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
    await page.getByRole('button', { name: 'Démarrer la caméra' }).waitFor()
    await context.close()
  }
  // App en arrière-plan puis de retour : la caméra s'arrête puis repart seule.
  {
    const { context, page } = await openApp(browser)
    await signIn(page)
    await confirmCard(page).getByText('Pack de 24 → +24').waitFor({ timeout: SCAN_TIMEOUT })
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
