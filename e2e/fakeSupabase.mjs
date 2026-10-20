/**
 * fakeSupabase.mjs — Backend simulé pour le test de bout en bout (Playwright).
 *
 * Intercepte les appels de l'app vers le projet factice de .env.e2e et y
 * répond comme Supabase : connexion (Auth), fonctions SQL, vue product_stock
 * et tables barcodes et movements (PostgREST), avec les mêmes formes de
 * réponse que les migrations de supabase/migrations/. Intercepte aussi Open
 * Food Facts. Aucune requête ne sort vers Internet.
 */

export const SUPABASE_URL = 'https://e2e-scandrinks.supabase.co'
export const GOOD_PASSWORD = 'bon-mot-de-passe'
export const COCA_CODE = '5449000000996'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

const YEAR_SECONDS = 365 * 24 * 3600

function unsignedJwt(payload) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${part({ alg: 'none', typ: 'JWT' })}.${part(payload)}.signature`
}

// Seuil d'un pack Metro et stock idéal de deux packs, sauf valeurs données.
function productRow(id, name, packSize, extra = {}) {
  return { id, name, pack_size: packSize, alert_threshold: packSize, target_stock: 2 * packSize, archived: false,
    created_at: '2026-10-19T08:00:00Z', updated_at: '2026-10-19T08:00:00Z', ...extra }
}

function movementRow(productId, kind, delta, employee, createdAt, counted = null) {
  return { product_id: productId, kind, delta, counted, employee, created_at: createdAt, cancelled_at: null, cancelled_by: null }
}

const barcodeRow = (productId, units, createdAt = '2026-10-19T08:00:00Z') => ({ product_id: productId, units, created_at: createdAt })

function initialCatalogue(name) {
  const products = new Map()
  const barcodes = new Map()
  const movements = new Map()
  if (name === 'coca_with_code' || name === 'coca_without_code' || name === 'coca_archived') {
    products.set('p-coca', productRow('p-coca', 'Coca-Cola 33 cl', 24, { archived: name === 'coca_archived' }))
    movements.set('m-setup', movementRow('p-coca', 'in', 24, 'Sam', '2026-10-19T08:00:00Z'))
  }
  if (name === 'coca_with_code' || name === 'coca_archived') barcodes.set(COCA_CODE, barcodeRow('p-coca', 24))
  if (name === 'coca_without_code') products.set('p-lipton', productRow('p-lipton', 'Lipton Pêche 50 cl', 12))
  if (name === 'pilotage') {
    products.set('p-coca', productRow('p-coca', 'Coca-Cola 33 cl', 24))
    products.set('p-lipton', productRow('p-lipton', 'Lipton Pêche 50 cl', 12))
    products.set('p-redbull', productRow('p-redbull', 'Red Bull 25 cl', 24))
    products.set('p-evian', productRow('p-evian', 'Évian 1,5 L', 1, { alert_threshold: 6, target_stock: 12 }))
    products.set('p-oasis', productRow('p-oasis', 'Oasis Tropical 33 cl', 24, { archived: true }))
    barcodes.set(COCA_CODE, barcodeRow('p-coca', 24))
    barcodes.set('3502110123091', barcodeRow('p-lipton', 12))
    movements.set('m-c1', movementRow('p-coca', 'in', 48, 'Sam', '2026-10-18T08:00:00Z'))
    movements.set('m-c2', movementRow('p-coca', 'out', -38, 'Léa', '2026-10-19T15:00:00Z'))
    movements.set('m-l1', movementRow('p-lipton', 'in', 36, 'Sam', '2026-10-18T08:05:00Z'))
    movements.set('m-r1', movementRow('p-redbull', 'out', -3, 'Sam', '2026-10-19T16:00:00Z'))
    movements.set('m-e1', movementRow('p-evian', 'in', 4, 'Sam', '2026-10-18T09:00:00Z'))
    movements.set('m-o1', movementRow('p-oasis', 'in', 24, 'Sam', '2026-10-17T08:00:00Z'))
  }
  return { products, barcodes, movements }
}

const invalid = (field) => ({ status: 400, body: { code: 'P0001', message: `invalid_input:${field}`, details: null, hint: null } })

/**
 * Installe le faux backend sur une page.
 * options.catalogue : 'coca_with_code' (par défaut), 'coca_without_code', 'coca_archived', 'pilotage' ou 'empty'.
 * options.failNextRecord : coupe le premier record_movement (réseau perdu).
 * options.expireSessionOn : nom de la fonction SQL qui répond « jeton expiré » (401).
 * options.hangFirst : nom de la fonction SQL dont le premier appel ne reçoit jamais de réponse.
 * options.failLogout : coupe la déconnexion (/auth/v1/logout), comme sans réseau.
 * options.loseFirstCreate : le premier create_product est enregistré, mais sa réponse se perd.
 * Renvoie { calls, addMovement } : addMovement simule un mouvement fait sur un autre téléphone.
 */
export async function installFakeSupabase(page, options = {}) {
  const { catalogue = 'coca_with_code', failNextRecord = false, expireSessionOn = null, hangFirst = null, failLogout = false,
    loseFirstCreate = false } = options
  const db = initialCatalogue(catalogue)
  const calls = []
  let recordFailuresLeft = failNextRecord ? 1 : 0
  let hangLeft = hangFirst ? 1 : 0
  let lostCreatesLeft = loseFirstCreate ? 1 : 0
  let createdCount = 0
  let otherPhoneCount = 0

  const now = () => new Date().toISOString()
  const stockOf = (productId) =>
    [...db.movements.values()].filter((m) => m.product_id === productId && m.cancelled_at === null).reduce((sum, m) => sum + m.delta, 0)
  const withStock = (product) => ({ ...product, stock: stockOf(product.id) })
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr')

  const rpc = {
    lookup_barcode: ({ p_code }) => {
      const barcode = db.barcodes.get(p_code)
      return barcode ? { code: p_code, units: barcode.units, product: withStock(db.products.get(barcode.product_id)) } : null
    },
    create_product: ({ p_name, p_pack_size, p_alert_threshold, p_target_stock, p_barcodes, p_id = null }) => {
      // Même identifiant déjà reçu : la fiche créée est renvoyée (création rejouable).
      if (p_id !== null && db.products.has(p_id)) return withStock(db.products.get(p_id))
      const taken = p_barcodes.find((b) => db.barcodes.has(b.code))
      if (taken) return { status: 400, body: { code: 'P0001', message: `barcode_taken:${taken.code}`, details: null, hint: null } }
      const id = p_id ?? `p-new-${++createdCount}`
      db.products.set(id, productRow(id, p_name.trim(), p_pack_size, { alert_threshold: p_alert_threshold, target_stock: p_target_stock }))
      for (const b of p_barcodes) db.barcodes.set(b.code, barcodeRow(id, b.units, now()))
      return withStock(db.products.get(id))
    },
    update_product: ({ p_id, p_name, p_pack_size, p_alert_threshold, p_target_stock }) => {
      const product = db.products.get(p_id)
      if (!product) return invalid('product')
      Object.assign(product, { name: p_name.trim(), pack_size: p_pack_size, alert_threshold: p_alert_threshold,
        target_stock: p_target_stock, updated_at: now() })
      return withStock(product)
    },
    set_product_archived: ({ p_product_id, p_archived }) => {
      const product = db.products.get(p_product_id)
      if (!product) return invalid('product')
      Object.assign(product, { archived: p_archived, updated_at: now() })
      return withStock(product)
    },
    attach_barcode: ({ p_code, p_product_id, p_units, p_move }) => {
      const current = db.barcodes.get(p_code)
      if (current && current.product_id !== p_product_id && !p_move) {
        return { status: 'already_attached', product_id: current.product_id, product_name: db.products.get(current.product_id).name }
      }
      db.barcodes.set(p_code, barcodeRow(p_product_id, p_units, current?.created_at ?? now()))
      return { status: 'attached' }
    },
    detach_barcode: ({ p_code }) => {
      db.barcodes.delete(p_code)
      return { status: 'detached' }
    },
    record_movement: ({ p_id, p_product_id, p_kind, p_units, p_quantity, p_employee }) => {
      const existing = db.movements.get(p_id)
      if (existing) return { movement_id: p_id, delta: existing.delta, stock: stockOf(existing.product_id), duplicate: true }
      const delta = (p_kind === 'in' ? 1 : -1) * p_units * p_quantity
      db.movements.set(p_id, movementRow(p_product_id, p_kind, delta, p_employee.trim(), now()))
      return { movement_id: p_id, delta, stock: stockOf(p_product_id), duplicate: false }
    },
    record_inventory: ({ p_id, p_product_id, p_counted, p_employee }) => {
      const existing = db.movements.get(p_id)
      if (existing) {
        return { movement_id: p_id, delta: existing.delta, counted: existing.counted, stock: stockOf(existing.product_id), duplicate: true }
      }
      if (!db.products.has(p_product_id)) return invalid('product')
      const delta = p_counted - stockOf(p_product_id)
      db.movements.set(p_id, movementRow(p_product_id, 'inventory', delta, p_employee.trim(), now(), p_counted))
      return { movement_id: p_id, delta, counted: p_counted, stock: stockOf(p_product_id), duplicate: false }
    },
    cancel_movement: ({ p_movement_id, p_employee }) => {
      const movement = db.movements.get(p_movement_id)
      if (!movement) return invalid('movement')
      if (movement.cancelled_at === null) Object.assign(movement, { cancelled_at: now(), cancelled_by: p_employee.trim() })
      return { stock: stockOf(movement.product_id), product_id: movement.product_id }
    },
    list_employees: () => [],
  }

  // Lectures PostgREST : filtre product_id=eq.…, ordre et limite.
  const productIdOf = (url) => url.searchParams.get('product_id')?.replace(/^eq\./, '') ?? null

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const reply = (status, body) =>
      route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    if (url.pathname === '/auth/v1/token') {
      const { password } = request.postDataJSON()
      if (password !== GOOD_PASSWORD) return reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      const nowSeconds = Math.floor(Date.now() / 1000)
      const user = { id: '00000000-0000-4000-8000-0000000000a1', aud: 'authenticated', role: 'authenticated',
        email: 'tabac.e2e@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-19T08:00:00Z' }
      return reply(200, {
        access_token: unsignedJwt({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: nowSeconds + YEAR_SECONDS }),
        token_type: 'bearer',
        expires_in: YEAR_SECONDS,
        expires_at: nowSeconds + YEAR_SECONDS,
        refresh_token: 'refresh-e2e',
        user,
      })
    }
    if (url.pathname === '/auth/v1/logout') {
      return failLogout ? route.abort('internetdisconnected') : route.fulfill({ status: 204, headers: CORS })
    }

    if (url.pathname === '/rest/v1/product_stock') {
      const activeOnly = url.searchParams.get('archived') === 'eq.false'
      const rows = [...db.products.values()].filter((p) => !activeOnly || !p.archived).map(withStock).sort(byName)
      return reply(200, rows)
    }

    if (url.pathname === '/rest/v1/barcodes') {
      const productId = productIdOf(url)
      const rows = [...db.barcodes.entries()]
        .filter(([, b]) => b.product_id === productId)
        .sort(([, a], [, b]) => a.created_at.localeCompare(b.created_at))
        .map(([code, b]) => ({ code, units: b.units }))
      return reply(200, rows)
    }

    if (url.pathname === '/rest/v1/movements') {
      const productId = productIdOf(url)
      const limit = Number(url.searchParams.get('limit') ?? 1000)
      const rows = [...db.movements.entries()]
        .filter(([, m]) => m.product_id === productId)
        .sort(([, a], [, b]) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(([id, m]) => ({ id, kind: m.kind, delta: m.delta, counted: m.counted, employee: m.employee,
          created_at: m.created_at, cancelled_at: m.cancelled_at, cancelled_by: m.cancelled_by }))
      return reply(200, rows)
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length)
      const body = request.postDataJSON() ?? {}
      calls.push({ fn, body })
      if (fn === expireSessionOn) return reply(401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null })
      if (fn === hangFirst && hangLeft > 0) {
        // Réseau bloqué : la requête reste sans réponse, jusqu'à ce que l'app l'abandonne.
        hangLeft -= 1
        return
      }
      if (fn === 'record_movement' && recordFailuresLeft > 0) {
        recordFailuresLeft -= 1
        return route.abort('internetdisconnected')
      }
      const handler = rpc[fn]
      if (!handler) return reply(404, { code: 'PGRST202', message: `Could not find the function public.${fn}` })
      if (fn === 'create_product' && lostCreatesLeft > 0) {
        // La base enregistre la fiche, puis la réponse se perd (réseau coupé au retour).
        lostCreatesLeft -= 1
        handler(body)
        return route.abort('internetdisconnected')
      }
      const result = handler(body)
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) return reply(result.status, result.body)
      return reply(200, result)
    }

    return reply(404, { message: `Route simulée inconnue : ${url.pathname}` })
  })

  await page.route('https://world.openfoodfacts.org/**', (route) => {
    const found = route.request().url().includes(`/product/${COCA_CODE}.json`)
    return route.fulfill({
      status: found ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(found ? { status: 1, product: { product_name_fr: 'Coca-Cola', quantity: '330 ml' } } : { status: 0 }),
    })
  })

  const addMovement = ({ productId, kind, delta, employee }) => {
    db.movements.set(`m-other-${++otherPhoneCount}`, movementRow(productId, kind, delta, employee, now()))
  }

  return { calls, addMovement }
}
