/**
 * fakeSupabase.mjs — Backend simulé pour le test de bout en bout (Playwright).
 *
 * Intercepte les appels de l'app vers le projet factice de .env.e2e et y
 * répond comme Supabase : connexion (Auth), fonctions SQL et vue
 * product_stock (PostgREST), avec les mêmes formes de réponse que la
 * migration supabase/migrations/20261019130000_initial_schema.sql.
 * Intercepte aussi Open Food Facts. Aucune requête ne sort vers Internet.
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

function productRow(id, name, packSize) {
  return { id, name, pack_size: packSize, alert_threshold: packSize, target_stock: 2 * packSize, archived: false,
    created_at: '2026-10-19T08:00:00Z', updated_at: '2026-10-19T08:00:00Z' }
}

function initialCatalogue(name) {
  const products = new Map()
  const barcodes = new Map()
  const movements = new Map()
  if (name === 'coca_with_code' || name === 'coca_without_code') {
    products.set('p-coca', productRow('p-coca', 'Coca-Cola 33 cl', 24))
    movements.set('m-setup', { product_id: 'p-coca', delta: 24, cancelled: false })
  }
  if (name === 'coca_with_code') barcodes.set(COCA_CODE, { product_id: 'p-coca', units: 24 })
  if (name === 'coca_without_code') products.set('p-lipton', productRow('p-lipton', 'Lipton Pêche 50 cl', 12))
  return { products, barcodes, movements }
}

/**
 * Installe le faux backend sur une page.
 * options.catalogue : 'coca_with_code' (par défaut), 'coca_without_code' ou 'empty'.
 * options.failNextRecord : coupe le premier record_movement (réseau perdu).
 * options.expireSessionOn : nom de la fonction SQL qui répond « jeton expiré » (401).
 * options.hangFirst : nom de la fonction SQL dont le premier appel ne reçoit jamais de réponse.
 */
export async function installFakeSupabase(page, options = {}) {
  const { catalogue = 'coca_with_code', failNextRecord = false, expireSessionOn = null, hangFirst = null } = options
  const db = initialCatalogue(catalogue)
  const calls = []
  let recordFailuresLeft = failNextRecord ? 1 : 0
  let hangLeft = hangFirst ? 1 : 0
  let createdCount = 0

  const stockOf = (productId) =>
    [...db.movements.values()].filter((m) => m.product_id === productId && !m.cancelled).reduce((sum, m) => sum + m.delta, 0)
  const withStock = (product) => ({ ...product, stock: stockOf(product.id) })

  const rpc = {
    lookup_barcode: ({ p_code }) => {
      const barcode = db.barcodes.get(p_code)
      return barcode ? { code: p_code, units: barcode.units, product: withStock(db.products.get(barcode.product_id)) } : null
    },
    create_product: ({ p_name, p_pack_size, p_alert_threshold, p_target_stock, p_barcodes }) => {
      const taken = p_barcodes.find((b) => db.barcodes.has(b.code))
      if (taken) return { status: 400, body: { code: 'P0001', message: `barcode_taken:${taken.code}`, details: null, hint: null } }
      const id = `p-new-${++createdCount}`
      db.products.set(id, { ...productRow(id, p_name.trim(), p_pack_size), alert_threshold: p_alert_threshold, target_stock: p_target_stock })
      for (const b of p_barcodes) db.barcodes.set(b.code, { product_id: id, units: b.units })
      return withStock(db.products.get(id))
    },
    attach_barcode: ({ p_code, p_product_id, p_units, p_move }) => {
      const current = db.barcodes.get(p_code)
      if (current && current.product_id !== p_product_id && !p_move) {
        return { status: 'already_attached', product_id: current.product_id, product_name: db.products.get(current.product_id).name }
      }
      db.barcodes.set(p_code, { product_id: p_product_id, units: p_units })
      return { status: 'attached' }
    },
    record_movement: ({ p_id, p_product_id, p_kind, p_units, p_quantity }) => {
      const existing = db.movements.get(p_id)
      if (existing) return { movement_id: p_id, delta: existing.delta, stock: stockOf(existing.product_id), duplicate: true }
      const delta = (p_kind === 'in' ? 1 : -1) * p_units * p_quantity
      db.movements.set(p_id, { product_id: p_product_id, delta, cancelled: false })
      return { movement_id: p_id, delta, stock: stockOf(p_product_id), duplicate: false }
    },
    cancel_movement: ({ p_movement_id }) => {
      const movement = db.movements.get(p_movement_id)
      if (!movement) return { status: 400, body: { code: 'P0001', message: 'invalid_input:movement', details: null, hint: null } }
      movement.cancelled = true
      return { stock: stockOf(movement.product_id), product_id: movement.product_id }
    },
    list_employees: () => [],
  }

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const reply = (status, body) =>
      route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    if (url.pathname === '/auth/v1/token') {
      const { password } = request.postDataJSON()
      if (password !== GOOD_PASSWORD) return reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      const now = Math.floor(Date.now() / 1000)
      const user = { id: '00000000-0000-4000-8000-0000000000a1', aud: 'authenticated', role: 'authenticated',
        email: 'tabac.e2e@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-19T08:00:00Z' }
      return reply(200, {
        access_token: unsignedJwt({ sub: user.id, role: 'authenticated', aud: 'authenticated', exp: now + YEAR_SECONDS }),
        token_type: 'bearer',
        expires_in: YEAR_SECONDS,
        expires_at: now + YEAR_SECONDS,
        refresh_token: 'refresh-e2e',
        user,
      })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })

    if (url.pathname === '/rest/v1/product_stock') {
      const rows = [...db.products.values()].filter((p) => !p.archived).map(withStock).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
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

  return { calls }
}
