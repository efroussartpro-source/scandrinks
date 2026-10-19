import { afterEach, describe, expect, test, vi } from 'vitest'
import { formatSuggestedName, lookupProduct, offProductUrl } from './openFoodFacts'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchReturning = (res: Response) => vi.fn<typeof fetch>(() => Promise.resolve(res))
const coca = { product_name_fr: 'Coca-Cola', product_name: 'Coca-Cola Original', quantity: '330 ml', brands: 'COCA-COLA SERVICES SA/NV' }

afterEach(() => { vi.useRealTimers() })

describe('offProductUrl', () => {
  test('URL exacte du cahier des charges', () => {
    expect(offProductUrl('5449000000996')).toBe(
      'https://world.openfoodfacts.org/api/v2/product/5449000000996.json?fields=product_name,product_name_fr,brands,quantity')
  })
})

describe('lookupProduct', () => {
  test('produit trouvé : nom français + contenance', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: coca }))
    expect(await lookupProduct('5449000000996', { fetchImpl })).toEqual(
      { status: 'found', name: 'Coca-Cola', quantity: '330 ml', suggestedName: 'Coca-Cola 330 ml' })
    expect(fetchImpl.mock.calls[0][0]).toBe(offProductUrl('5449000000996'))
  })
  test('sans nom français, prend product_name', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '', product_name: 'Coca-Cola Zero Sugar', quantity: '330 ml' } }))
    expect(await lookupProduct('5449000131805', { fetchImpl })).toMatchObject({ status: 'found', name: 'Coca-Cola Zero Sugar' })
  })
  test('supprime les espaces autour du nom et de la contenance', async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '  Cristaline  ', quantity: ' 1500 ml ' } }))
    expect(await lookupProduct('3274080005003', { fetchImpl })).toEqual(
      { status: 'found', name: 'Cristaline', quantity: '1500 ml', suggestedName: 'Cristaline 1500 ml' })
  })
  test('HTTP 404 (produit inconnu) → not_found', async () => {
    const fetchImpl = fetchReturning(json(404, { status: 0, status_verbose: 'product not found' }))
    expect(await lookupProduct('3000000000017', { fetchImpl })).toEqual({ status: 'not_found' })
  })
  test("noms vides ou composés d'espaces → not_found", async () => {
    const fetchImpl = fetchReturning(json(200, { status: 1, product: { product_name_fr: '   ', product_name: '' } }))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'not_found' })
  })
  test('HTTP 200 avec status 0 → not_found', async () => {
    expect(await lookupProduct('1', { fetchImpl: fetchReturning(json(200, { status: 0 })) })).toEqual({ status: 'not_found' })
  })
  test('HTTP 503 → error', async () => {
    expect(await lookupProduct('1', { fetchImpl: fetchReturning(json(503, {})) })).toEqual({ status: 'error' })
  })
  test('JSON invalide → error', async () => {
    const fetchImpl = fetchReturning(new Response('<html>maintenance</html>', { status: 200 }))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'error' })
  })
  test('réseau coupé → error', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('Load failed')))
    expect(await lookupProduct('1', { fetchImpl })).toEqual({ status: 'error' })
  })
  test('abandon au bout de 3 000 ms exactement → error', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    let settled = false
    const pending = lookupProduct('1', { fetchImpl }).finally(() => { settled = true })
    await vi.advanceTimersByTimeAsync(2999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ status: 'error' })
  })
})

describe('formatSuggestedName', () => {
  test.each([
    ['Coca-Cola', '330 ml', 'Coca-Cola 330 ml'],
    ['Coca-Cola 330 ml', '330 ml', 'Coca-Cola 330 ml'],
    ['Coca-Cola', null, 'Coca-Cola'],
  ])('%s + %s → %s', (name, quantity, expected) => {
    expect(formatSuggestedName(name, quantity)).toBe(expected)
  })
})
