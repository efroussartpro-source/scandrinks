import { expect, test, vi } from 'vitest'
import { createApi, HISTORY_PAGE_SIZE } from './api'

// Faux client supabase-js : il enregistre les appels et renvoie des réponses
// de la même forme que PostgREST ({ data, error, status }).
const ok = (data: unknown) => ({ data, error: null, status: 200 })
const SQL_COCA = { id: 'p9', name: 'Coca-Cola 33 cl', pack_size: 24, alert_threshold: 24, target_stock: 48, archived: false,
  created_at: '2026-10-19T12:00:00Z', updated_at: '2026-10-19T12:00:00Z', stock: 0, photo_path: null }
const COCA = { id: 'p9', name: 'Coca-Cola 33 cl', packSize: 24, alertThreshold: 24, targetStock: 48, archived: false, stock: 0, photoPath: null }
const COCA_PHOTO = 'codes/5449000000996/11111111-1111-4111-8111-111111111111.jpg'
const NEW_COCA = { id: 'p-new', name: 'Coca-Cola 33 cl', packSize: 24, alertThreshold: 24, targetStock: 48, barcodes: [{ code: '5449000000996', units: 24 }] }
// Lignes de product_stock reçues dans l'ordre du serveur (tri différent du tri français).
const SERVER_ORDER = ['Red Bull 25 cl', 'Évian 1,5 L', 'Coca-Cola 33 cl'].map((name, i) => ({ ...SQL_COCA, id: `p${i}`, name }))

// Constructeur de requête supabase-js : chaque méthode note l'appel ; attendu, il renvoie les lignes.
function queryBuilder(rows: unknown, calls: unknown[][]) {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(ok(rows)).then(resolve, reject),
  }
  for (const method of ['select', 'eq', 'order', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args])
      return builder
    }
  }
  return builder
}

test('recordMovement appelle record_movement avec les paramètres SQL exacts', async () => {
  const rpc = vi.fn(async () => ({ data: { movement_id: 'm1', delta: 48, stock: 48, duplicate: false }, error: null, status: 200 }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  await expect(api.recordMovement({ id: 'm1', productId: 'p1', code: '3502110123091', mode: 'in', units: 24, quantity: 2, employee: 'Sam' }))
    .resolves.toEqual({ delta: 48, stock: 48, duplicate: false })
  expect(rpc).toHaveBeenCalledWith('record_movement', { p_id: 'm1', p_product_id: 'p1', p_code: '3502110123091', p_kind: 'in', p_units: 24, p_quantity: 2, p_employee: 'Sam' })
})

test('recordMovement en Sortie et en saisie manuelle (sans code)', async () => {
  const rpc = vi.fn(async () => ok({ movement_id: 'm2', delta: -24, stock: 0, duplicate: false }))
  await createApi({ rpc, from: vi.fn() } as never).recordMovement({ id: 'm2', productId: 'p1', code: null, mode: 'out', units: 24, quantity: 1, employee: 'Sam' })
  expect(rpc).toHaveBeenCalledWith('record_movement', { p_id: 'm2', p_product_id: 'p1', p_code: null, p_kind: 'out', p_units: 24, p_quantity: 1, p_employee: 'Sam' })
})

test("lookupBarcode transforme le JSON SQL en Product, avec l'image du code et celle du produit", async () => {
  const rpc = vi.fn(async () => ({ data: { code: '3502110123091', units: 1, photo_path: 'codes/3502110123091/l.jpg', photo_source: 'off',
    product: { id: 'p1', name: 'Lipton Pêche 50 cl', pack_size: 12, alert_threshold: 12, target_stock: 24, archived: false, stock: 0,
      photo_path: 'codes/3502110123092/p.jpg' } }, error: null, status: 200 }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  expect(await api.lookupBarcode('3502110123091')).toEqual({ found: true, units: 1, photoPath: 'codes/3502110123091/l.jpg',
    product: { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0,
      photoPath: 'codes/3502110123092/p.jpg' } })
  expect(rpc).toHaveBeenCalledWith('lookup_barcode', { p_code: '3502110123091' })
})

test('lookupBarcode : null → found false', async () => {
  const api = createApi({ rpc: vi.fn(async () => ({ data: null, error: null, status: 200 })), from: vi.fn() } as never)
  expect(await api.lookupBarcode('1')).toEqual({ found: false })
})

test('une coupure réseau (erreur renvoyée par supabase-js) devient ApiError network', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' }, status: 0 }))
  await expect(createApi({ rpc, from: vi.fn() } as never).cancelMovement('m1', 'Sam')).rejects.toMatchObject({ kind: 'network' })
})

test('une exception levée par le client est classée de la même façon', async () => {
  const rpc = vi.fn(async () => { throw new TypeError('Load failed') })
  await expect(createApi({ rpc, from: vi.fn() } as never).listEmployees()).rejects.toMatchObject({ kind: 'network' })
})

test('le statut HTTP de la réponse sert au classement : jeton refusé → session', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: 'permission denied for function lookup_barcode', code: '42501' }, status: 401 }))
  await expect(createApi({ rpc, from: vi.fn() } as never).lookupBarcode('1')).rejects.toMatchObject({ kind: 'session' })
})

test("createProduct envoie l'identifiant du téléphone et les codes en tableau", async () => {
  const rpc = vi.fn(async () => ok(SQL_COCA))
  await expect(createApi({ rpc, from: vi.fn() } as never).createProduct(NEW_COCA)).resolves.toEqual(COCA)
  expect(rpc).toHaveBeenCalledWith('create_product', { p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 24, p_target_stock: 48,
    p_barcodes: [{ code: '5449000000996', units: 24 }], p_id: 'p-new' })
})

test('createProduct : code déjà pris → ApiError barcode_taken avec le code', async () => {
  const rpc = vi.fn(async () => ({ data: null, error: { message: 'barcode_taken:5449000000996', code: 'P0001', details: null, hint: null }, status: 400 }))
  await expect(createApi({ rpc, from: vi.fn() } as never).createProduct(NEW_COCA)).rejects.toMatchObject({ kind: 'barcode_taken', detail: '5449000000996' })
})

test('attachBarcode : code rattaché, ou déjà rattaché à un autre produit', async () => {
  const rpc = vi.fn()
    .mockResolvedValueOnce(ok({ status: 'attached' }))
    .mockResolvedValueOnce(ok({ status: 'already_attached', product_id: 'p2', product_name: 'Coca-Cola 33 cl' }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  await expect(api.attachBarcode({ code: '5449000000996', productId: 'p1', units: 1, move: false })).resolves.toEqual({ status: 'attached' })
  await expect(api.attachBarcode({ code: '5449000000996', productId: 'p1', units: 6, move: true }))
    .resolves.toEqual({ status: 'already_attached', productId: 'p2', productName: 'Coca-Cola 33 cl' })
  expect(rpc).toHaveBeenNthCalledWith(1, 'attach_barcode', { p_code: '5449000000996', p_product_id: 'p1', p_units: 1, p_move: false })
  expect(rpc).toHaveBeenNthCalledWith(2, 'attach_barcode', { p_code: '5449000000996', p_product_id: 'p1', p_units: 6, p_move: true })
})

test("cancelMovement appelle cancel_movement et renvoie le stock, l'heure et l'auteur de l'annulation", async () => {
  // Déjà annulé par Léa sur un autre téléphone : la base garde le premier auteur.
  const rpc = vi.fn(async () => ok({ stock: 24, product_id: 'p1', cancelled_at: '2026-10-19T13:00:00+00:00', cancelled_by: 'Léa' }))
  await expect(createApi({ rpc, from: vi.fn() } as never).cancelMovement('m1', 'Sam'))
    .resolves.toEqual({ stock: 24, cancelledAt: '2026-10-19T13:00:00+00:00', cancelledBy: 'Léa' })
  expect(rpc).toHaveBeenCalledWith('cancel_movement', { p_movement_id: 'm1', p_employee: 'Sam' })
})

// Ligne de list_history : la date garde ses microsecondes, comme la base l'envoie.
const historyRow = (n: number) => ({ id: `m${n}`, kind: 'in', delta: 1, counted: null, employee: 'Sam',
  created_at: `2026-10-19T12:00:00.${String(n).padStart(6, '0')}+00:00`, cancelled_at: null, cancelled_by: null,
  product_id: 'p1', product_name: 'Lipton Pêche 50 cl' })

test('listHistory lit la première page ; pleine, elle donne le curseur de sa dernière ligne', async () => {
  const rows = Array.from({ length: 50 }, (_, i) => historyRow(50 - i))
  const rpc = vi.fn(async () => ok(rows))
  const page = await createApi({ rpc, from: vi.fn() } as never).listHistory(null)
  expect(HISTORY_PAGE_SIZE).toBe(50)
  expect(rpc).toHaveBeenCalledWith('list_history', { p_before_created_at: null, p_before_id: null, p_limit: 50 })
  expect(page.movements).toHaveLength(50)
  expect(page.movements[0]).toEqual({ id: 'm50', kind: 'in', delta: 1, counted: null, employee: 'Sam',
    createdAt: '2026-10-19T12:00:00.000050+00:00', cancelledAt: null, cancelledBy: null, saleDay: null, productId: 'p1',
    productName: 'Lipton Pêche 50 cl' })
  // Le texte exact de la date : arrondie à la milliseconde, elle ferait sauter des lignes.
  expect(page.next).toEqual({ createdAt: '2026-10-19T12:00:00.000001+00:00', id: 'm1' })
})

test("listHistory passe le curseur tel quel ; une page incomplète n'a pas de suite", async () => {
  const rpc = vi.fn(async () => ok([historyRow(3), historyRow(2), historyRow(1)]))
  const page = await createApi({ rpc, from: vi.fn() } as never).listHistory({ createdAt: '2026-10-19T12:00:00+00:00', id: 'm9' })
  expect(rpc).toHaveBeenCalledWith('list_history', { p_before_created_at: '2026-10-19T12:00:00+00:00', p_before_id: 'm9', p_limit: 50 })
  expect(page.movements.map((m) => m.id)).toEqual(['m3', 'm2', 'm1'])
  expect(page.next).toBeNull()
})

test('listHistory : aucune ligne, ni page suivante', async () => {
  const rpc = vi.fn(async () => ok([]))
  await expect(createApi({ rpc, from: vi.fn() } as never).listHistory(null)).resolves.toEqual({ movements: [], next: null })
})

test('listEmployees renvoie les prénoms', async () => {
  const rpc = vi.fn(async () => ok(['Léa', 'Sam']))
  await expect(createApi({ rpc, from: vi.fn() } as never).listEmployees()).resolves.toEqual(['Léa', 'Sam'])
  expect(rpc).toHaveBeenCalledWith('list_employees')
})

test('listProducts lit les produits actifs de product_stock et les trie à la française', async () => {
  const calls: unknown[][] = []
  const from = vi.fn(() => queryBuilder(SERVER_ORDER, calls))
  const list = await createApi({ rpc: vi.fn(), from } as never).listProducts()
  expect(list.map((p) => p.name)).toEqual(['Coca-Cola 33 cl', 'Évian 1,5 L', 'Red Bull 25 cl'])
  expect(list[0]).toEqual({ ...COCA, id: 'p2' })
  expect(from).toHaveBeenCalledWith('product_stock')
  expect(calls).toEqual([['select', '*'], ['eq', 'archived', false], ['order', 'name']])
})

test("listCatalog lit tous les produits, archivés compris, triés à la française, avec l'image du produit", async () => {
  const calls: unknown[][] = []
  const rows = SERVER_ORDER.map((row) => (row.name === 'Coca-Cola 33 cl' ? { ...row, photo_path: COCA_PHOTO } : row))
  const from = vi.fn(() => queryBuilder(rows, calls))
  const list = await createApi({ rpc: vi.fn(), from } as never).listCatalog()
  expect(list.map((p) => p.name)).toEqual(['Coca-Cola 33 cl', 'Évian 1,5 L', 'Red Bull 25 cl'])
  expect(list.map((p) => p.photoPath)).toEqual([COCA_PHOTO, null, null])
  expect(from).toHaveBeenCalledWith('product_stock')
  expect(calls).toEqual([['select', '*'], ['order', 'name']])
})

test('getProductDetail lit les codes, avec leur image, et les 20 derniers mouvements', async () => {
  const barcodeCalls: unknown[][] = []
  const movementCalls: unknown[][] = []
  const from = vi.fn((table: string) =>
    table === 'barcodes'
      ? queryBuilder([{ code: '5449000000996', units: 24, photo_path: COCA_PHOTO, photo_source: 'equipe' },
          { code: '2000000000015', units: 1, photo_path: null, photo_source: null }], barcodeCalls)
      : queryBuilder([{ id: 'm1', kind: 'inventory', delta: -3, counted: 53, employee: 'Sam', created_at: '2026-10-19T12:32:00Z',
          cancelled_at: null, cancelled_by: null }], movementCalls),
  )
  await expect(createApi({ rpc: vi.fn(), from } as never).getProductDetail('p9')).resolves.toEqual({
    barcodes: [{ code: '5449000000996', units: 24, photoPath: COCA_PHOTO, photoSource: 'equipe' },
      { code: '2000000000015', units: 1, photoPath: null, photoSource: null }],
    movements: [{ id: 'm1', kind: 'inventory', delta: -3, counted: 53, employee: 'Sam', createdAt: '2026-10-19T12:32:00Z',
      cancelledAt: null, cancelledBy: null, saleDay: null }],
  })
  expect(from).toHaveBeenCalledWith('barcodes')
  expect(from).toHaveBeenCalledWith('movements')
  expect(barcodeCalls).toEqual([['select', 'code, units, photo_path, photo_source'], ['eq', 'product_id', 'p9'], ['order', 'created_at']])
  expect(movementCalls).toEqual([['select', 'id, kind, delta, counted, employee, created_at, cancelled_at, cancelled_by'],
    ['eq', 'product_id', 'p9'], ['order', 'created_at', { ascending: false }], ['limit', 20]])
})

test('updateProduct appelle update_product', async () => {
  const rpc = vi.fn(async () => ok({ ...SQL_COCA, alert_threshold: 30 }))
  await expect(createApi({ rpc, from: vi.fn() } as never).updateProduct({ id: 'p9', name: 'Coca-Cola 33 cl', packSize: 24, alertThreshold: 30, targetStock: 48 }))
    .resolves.toEqual({ ...COCA, alertThreshold: 30 })
  expect(rpc).toHaveBeenCalledWith('update_product', { p_id: 'p9', p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 30, p_target_stock: 48 })
})

test('setArchived appelle set_product_archived', async () => {
  const rpc = vi.fn(async () => ok({ ...SQL_COCA, archived: true }))
  await expect(createApi({ rpc, from: vi.fn() } as never).setArchived('p9', true)).resolves.toEqual({ ...COCA, archived: true })
  expect(rpc).toHaveBeenCalledWith('set_product_archived', { p_product_id: 'p9', p_archived: true })
})

test("setBarcodePhoto appelle set_barcode_photo avec le code, le chemin et la provenance", async () => {
  const rpc = vi.fn(async () => ok({ code: '5449000000996', photo_path: COCA_PHOTO, photo_source: 'equipe' }))
  await expect(createApi({ rpc, from: vi.fn() } as never).setBarcodePhoto({ code: '5449000000996', path: COCA_PHOTO, source: 'equipe' }))
    .resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledWith('set_barcode_photo', { p_code: '5449000000996', p_path: COCA_PHOTO, p_source: 'equipe' })
})

test('detachBarcode appelle detach_barcode', async () => {
  const rpc = vi.fn(async () => ok({ status: 'detached' }))
  await expect(createApi({ rpc, from: vi.fn() } as never).detachBarcode('2000000000015')).resolves.toBeUndefined()
  expect(rpc).toHaveBeenCalledWith('detach_barcode', { p_code: '2000000000015' })
})

test("recordInventory renvoie l'écart et le stock", async () => {
  const rpc = vi.fn(async () => ok({ movement_id: 'i1', delta: -3, stock: 53, counted: 53, duplicate: false }))
  await expect(createApi({ rpc, from: vi.fn() } as never).recordInventory({ id: 'i1', productId: 'p9', counted: 53, employee: 'Sam' }))
    .resolves.toEqual({ delta: -3, stock: 53, counted: 53, duplicate: false })
  expect(rpc).toHaveBeenCalledWith('record_inventory', { p_id: 'i1', p_product_id: 'p9', p_counted: 53, p_employee: 'Sam' })
})
