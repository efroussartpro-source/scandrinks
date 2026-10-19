/**
 * api.ts — Appels typés vers la base ScanDrinks.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.3)
 *
 * Les noms et paramètres (p_…) sont ceux des fonctions SQL de
 * supabase/migrations/20261019130000_initial_schema.sql. Le client est passé
 * en paramètre : les tests utilisent un faux client, l'app celui de
 * supabaseClient.ts. Toute erreur devient une ApiError (voir apiErrors.ts).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewProductInput } from '../domain/productDraft'
import type { ScanMode } from '../domain/stock'
import { classifyApiError } from './apiErrors'

export interface Product {
  id: string
  name: string
  packSize: number
  alertThreshold: number
  targetStock: number
  archived: boolean
  stock: number
}

export type LookupResult = { found: true; product: Product; units: number } | { found: false }

export type AttachResult = { status: 'attached' } | { status: 'already_attached'; productId: string; productName: string }

export interface MovementInput {
  id: string
  productId: string
  code: string | null
  mode: ScanMode
  units: number
  quantity: number
  employee: string
}

// Lignes telles que la base les renvoie (colonnes de la vue product_stock).
interface ProductRow {
  id: string
  name: string
  pack_size: number
  alert_threshold: number
  target_stock: number
  archived: boolean
  stock: number
}

type AttachRow = { status: 'attached' } | { status: 'already_attached'; product_id: string; product_name: string }

interface QueryResult {
  data: unknown
  error: unknown
  status?: number
}

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  packSize: row.pack_size,
  alertThreshold: row.alert_threshold,
  targetStock: row.target_stock,
  archived: row.archived,
  stock: row.stock,
})

// Attend la réponse et lève une ApiError en cas d'échec. Le statut HTTP de la
// réponse complète l'erreur PostgREST : il distingue session expirée et refus.
async function run<T>(query: PromiseLike<QueryResult>): Promise<T> {
  let result: QueryResult
  try {
    result = await query
  } catch (error) {
    throw classifyApiError(error)
  }
  if (result.error) {
    const error = result.error as Record<string, unknown>
    throw classifyApiError({
      name: error.name,
      message: error.message,
      code: error.code,
      status: typeof error.status === 'number' ? error.status : result.status,
    })
  }
  return result.data as T
}

export function createApi(client: Pick<SupabaseClient, 'rpc' | 'from'>) {
  return {
    async lookupBarcode(code: string): Promise<LookupResult> {
      const row = await run<{ code: string; units: number; product: ProductRow } | null>(client.rpc('lookup_barcode', { p_code: code }))
      return row ? { found: true, product: toProduct(row.product), units: row.units } : { found: false }
    },

    async listProducts(): Promise<Product[]> {
      const rows = await run<ProductRow[] | null>(client.from('product_stock').select('*').eq('archived', false).order('name'))
      return (rows ?? []).map(toProduct)
    },

    async createProduct(input: NewProductInput): Promise<Product> {
      const row = await run<ProductRow>(
        client.rpc('create_product', {
          p_name: input.name,
          p_pack_size: input.packSize,
          p_alert_threshold: input.alertThreshold,
          p_target_stock: input.targetStock,
          p_barcodes: input.barcodes,
        }),
      )
      return toProduct(row)
    },

    async attachBarcode(input: { code: string; productId: string; units: number; move: boolean }): Promise<AttachResult> {
      const row = await run<AttachRow>(
        client.rpc('attach_barcode', { p_code: input.code, p_product_id: input.productId, p_units: input.units, p_move: input.move }),
      )
      return row.status === 'attached'
        ? { status: 'attached' }
        : { status: 'already_attached', productId: row.product_id, productName: row.product_name }
    },

    async recordMovement(input: MovementInput): Promise<{ delta: number; stock: number; duplicate: boolean }> {
      const row = await run<{ movement_id: string; delta: number; stock: number; duplicate: boolean }>(
        client.rpc('record_movement', {
          p_id: input.id,
          p_product_id: input.productId,
          p_code: input.code,
          p_kind: input.mode,
          p_units: input.units,
          p_quantity: input.quantity,
          p_employee: input.employee,
        }),
      )
      return { delta: row.delta, stock: row.stock, duplicate: row.duplicate }
    },

    async cancelMovement(movementId: string, employee: string): Promise<{ stock: number }> {
      const row = await run<{ stock: number; product_id: string }>(
        client.rpc('cancel_movement', { p_movement_id: movementId, p_employee: employee }),
      )
      return { stock: row.stock }
    },

    async listEmployees(): Promise<string[]> {
      return (await run<string[] | null>(client.rpc('list_employees'))) ?? []
    },
  }
}

export type Api = ReturnType<typeof createApi>
