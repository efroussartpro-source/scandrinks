import { expect, test, vi } from 'vitest'
import { createApi } from './api'

// Faux client supabase-js : il enregistre les appels et renvoie des réponses
// de la même forme que PostgREST ({ data, error, status }).
const ok = (data: unknown) => ({ data, error: null, status: 200 })
const SQL_COCA = { id: 'p9', name: 'Coca-Cola 33 cl', pack_size: 24, alert_threshold: 24, target_stock: 48, archived: false,
  created_at: '2026-10-19T12:00:00Z', updated_at: '2026-10-19T12:00:00Z', stock: 0 }
const COCA = { id: 'p9', name: 'Coca-Cola 33 cl', packSize: 24, alertThreshold: 24, targetStock: 48, archived: false, stock: 0 }
const NEW_COCA = { name: 'Coca-Cola 33 cl', packSize: 24, alertThreshold: 24, targetStock: 48, barcodes: [{ code: '5449000000996', units: 24 }] }

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

test('lookupBarcode transforme le JSON SQL en Product', async () => {
  const rpc = vi.fn(async () => ({ data: { code: '3502110123091', units: 12, product: { id: 'p1', name: 'Lipton Pêche 50 cl', pack_size: 12, alert_threshold: 12, target_stock: 24, archived: false, stock: 0 } }, error: null, status: 200 }))
  const api = createApi({ rpc, from: vi.fn() } as never)
  expect(await api.lookupBarcode('3502110123091')).toEqual({ found: true, units: 12, product: { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0 } })
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

test('createProduct envoie les codes en tableau et renvoie le Product', async () => {
  const rpc = vi.fn(async () => ok(SQL_COCA))
  await expect(createApi({ rpc, from: vi.fn() } as never).createProduct(NEW_COCA)).resolves.toEqual(COCA)
  expect(rpc).toHaveBeenCalledWith('create_product', { p_name: 'Coca-Cola 33 cl', p_pack_size: 24, p_alert_threshold: 24, p_target_stock: 48,
    p_barcodes: [{ code: '5449000000996', units: 24 }] })
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

test('cancelMovement appelle cancel_movement et renvoie le stock', async () => {
  const rpc = vi.fn(async () => ok({ stock: 24, product_id: 'p1' }))
  await expect(createApi({ rpc, from: vi.fn() } as never).cancelMovement('m1', 'Sam')).resolves.toEqual({ stock: 24 })
  expect(rpc).toHaveBeenCalledWith('cancel_movement', { p_movement_id: 'm1', p_employee: 'Sam' })
})

test('listEmployees renvoie les prénoms', async () => {
  const rpc = vi.fn(async () => ok(['Léa', 'Sam']))
  await expect(createApi({ rpc, from: vi.fn() } as never).listEmployees()).resolves.toEqual(['Léa', 'Sam'])
  expect(rpc).toHaveBeenCalledWith('list_employees')
})

test('listProducts lit product_stock : produits actifs, par nom', async () => {
  const calls: unknown[][] = []
  const builder = {
    select: (...args: unknown[]) => { calls.push(['select', ...args]); return builder },
    eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return builder },
    order: (...args: unknown[]) => { calls.push(['order', ...args]); return Promise.resolve(ok([{ ...SQL_COCA, stock: 24 }])) },
  }
  const from = vi.fn(() => builder)
  await expect(createApi({ rpc: vi.fn(), from } as never).listProducts()).resolves.toEqual([{ ...COCA, stock: 24 }])
  expect(from).toHaveBeenCalledWith('product_stock')
  expect(calls).toEqual([['select', '*'], ['eq', 'archived', false], ['order', 'name']])
})
