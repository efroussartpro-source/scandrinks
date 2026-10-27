/**
 * api.ts — Appels typés vers la base ScanDrinks.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.3)
 *
 * Les noms et paramètres (p_…) sont ceux des fonctions SQL de
 * supabase/migrations/ (schéma initial, pilotage, suivi, images, fin de journée, puis suppression). Le client est passé
 * en paramètre : les tests utilisent un faux client, l'app celui de
 * supabaseClient.ts. Toute erreur devient une ApiError (voir apiErrors.ts).
 * Les listes de produits sont triées dans l'ordre alphabétique français.
 * Un produit et chacun de ses codes donnent le chemin de leur image, ou null.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { HistoryMovement, Movement, MovementKind } from '../domain/movements'
import { compareNames, sortByName } from '../domain/names'
import type { NewProductInput } from '../domain/productDraft'
import type { MoveMode } from '../domain/stock'
import type { PhotoSource } from '../photos/photos'
import { classifyApiError } from './apiErrors'

export interface Product {
  id: string
  name: string
  packSize: number
  alertThreshold: number
  targetStock: number
  archived: boolean
  stock: number
  // Image du produit : celle du code de son pack Metro, sinon celle d'un autre code (vue product_stock).
  photoPath: string | null
}

// photoPath : l'image du code lu, qui peut différer de celle du produit.
export type LookupResult = { found: true; product: Product; units: number; photoPath: string | null } | { found: false }

export type AttachResult = { status: 'attached' } | { status: 'already_attached'; productId: string; productName: string }

export interface BarcodeEntry {
  code: string
  units: number
  photoPath: string | null
  photoSource: PhotoSource | null
}

export interface ProductDetail {
  barcodes: BarcodeEntry[]
  movements: Movement[]
}

export interface ProductFieldsInput {
  id: string
  name: string
  packSize: number
  alertThreshold: number
  targetStock: number
}

export interface InventoryInput {
  id: string
  productId: string
  counted: number
  employee: string
}

export interface InventoryResult {
  delta: number
  stock: number
  counted: number
  duplicate: boolean
}

// Une page de l'Historique (§4.5).
export const HISTORY_PAGE_SIZE = 50

// Dernière ligne affichée : la page suivante part d'elle. La date reste le texte
// reçu de la base, à la microseconde : arrondie, elle ferait sauter des lignes.
export interface HistoryCursor {
  createdAt: string
  id: string
}

export interface HistoryPage {
  movements: HistoryMovement[]
  next: HistoryCursor | null
}

export interface CancelResult {
  stock: number
  cancelledAt: string
  cancelledBy: string
}

// Vente active d'un jour (fin de journée, §4.8) : units est la quantité vendue, positive.
export interface DaySale {
  id: string
  productId: string
  productName: string
  units: number
  employee: string
  createdAt: string
}

// Une ligne de fin de journée ; l'identifiant vient du téléphone et reste le même à chaque nouvel essai.
export interface SaleLine {
  id: string
  productId: string
  quantity: number
}

export interface SalesInput {
  day: string
  lines: SaleLine[]
  employee: string
}

// Déjà saisi ailleurs : rien n'est enregistré, et les produits concernés sont nommés.
export type RecordSalesResult = { status: 'recorded'; units: number; duplicate: boolean } | { status: 'already_recorded'; products: string[] }

export interface MovementInput {
  id: string
  productId: string
  code: string | null
  mode: MoveMode
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
  // Absente des réponses de l'app des jalons 1 à 3, avant la migration des images.
  photo_path?: string | null
}

interface BarcodeRow {
  code: string
  units: number
  photo_path: string | null
  photo_source: PhotoSource | null
}

type AttachRow = { status: 'attached' } | { status: 'already_attached'; product_id: string; product_name: string }

interface MovementRow {
  id: string
  kind: MovementKind
  delta: number
  counted: number | null
  employee: string
  created_at: string
  cancelled_at: string | null
  cancelled_by: string | null
  // Absent des réponses d'avant la migration de la fin de journée (jalon 5).
  sale_day?: string | null
}

interface HistoryRow extends MovementRow {
  product_id: string
  product_name: string
}

interface DaySaleRow {
  id: string
  product_id: string
  delta: number
  employee: string
  created_at: string
  product: { name: string }
}

interface QueryResult {
  data: unknown
  error: unknown
  status?: number
}

const toMovement = (row: MovementRow): Movement => ({
  id: row.id,
  kind: row.kind,
  delta: row.delta,
  counted: row.counted,
  employee: row.employee,
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at,
  cancelledBy: row.cancelled_by,
  saleDay: row.sale_day ?? null,
})

const toHistoryMovement = (row: HistoryRow): HistoryMovement => ({
  ...toMovement(row),
  productId: row.product_id,
  productName: row.product_name,
})

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  packSize: row.pack_size,
  alertThreshold: row.alert_threshold,
  targetStock: row.target_stock,
  archived: row.archived,
  stock: row.stock,
  photoPath: row.photo_path ?? null,
})

const toBarcodeEntry = (row: BarcodeRow): BarcodeEntry => ({
  code: row.code,
  units: row.units,
  photoPath: row.photo_path,
  photoSource: row.photo_source,
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
      const row = await run<{ code: string; units: number; photo_path?: string | null; product: ProductRow } | null>(
        client.rpc('lookup_barcode', { p_code: code }),
      )
      return row ? { found: true, product: toProduct(row.product), units: row.units, photoPath: row.photo_path ?? null } : { found: false }
    },

    async listProducts(): Promise<Product[]> {
      const rows = await run<ProductRow[] | null>(client.from('product_stock').select('*').eq('archived', false).order('name'))
      return sortByName((rows ?? []).map(toProduct))
    },

    // Tous les produits, archivés compris : liste du stock, badge et À racheter.
    async listCatalog(): Promise<Product[]> {
      const rows = await run<ProductRow[] | null>(client.from('product_stock').select('*').order('name'))
      return sortByName((rows ?? []).map(toProduct))
    },

    async getProductDetail(productId: string): Promise<ProductDetail> {
      const [barcodes, movements] = await Promise.all([
        run<BarcodeRow[] | null>(
          client.from('barcodes').select('code, units, photo_path, photo_source').eq('product_id', productId).order('created_at'),
        ),
        run<MovementRow[] | null>(
          client
            .from('movements')
            .select('id, kind, delta, counted, employee, created_at, cancelled_at, cancelled_by, sale_day')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(20),
        ),
      ])
      return { barcodes: (barcodes ?? []).map(toBarcodeEntry), movements: (movements ?? []).map(toMovement) }
    },

    // L'identifiant vient du téléphone : une création rejouée renvoie la fiche déjà créée.
    async createProduct(input: NewProductInput & { id: string }): Promise<Product> {
      const row = await run<ProductRow>(
        client.rpc('create_product', {
          p_name: input.name,
          p_pack_size: input.packSize,
          p_alert_threshold: input.alertThreshold,
          p_target_stock: input.targetStock,
          p_barcodes: input.barcodes,
          p_id: input.id,
        }),
      )
      return toProduct(row)
    },

    async updateProduct(input: ProductFieldsInput): Promise<Product> {
      const row = await run<ProductRow>(
        client.rpc('update_product', {
          p_id: input.id,
          p_name: input.name,
          p_pack_size: input.packSize,
          p_alert_threshold: input.alertThreshold,
          p_target_stock: input.targetStock,
        }),
      )
      return toProduct(row)
    },

    async setArchived(productId: string, archived: boolean): Promise<Product> {
      const row = await run<ProductRow>(client.rpc('set_product_archived', { p_product_id: productId, p_archived: archived }))
      return toProduct(row)
    },

    // Une fois le fichier envoyé dans « photos » : il devient l'image du code. Rejouable.
    async setBarcodePhoto(input: { code: string; path: string; source: PhotoSource }): Promise<void> {
      await run<{ code: string; photo_path: string; photo_source: PhotoSource }>(
        client.rpc('set_barcode_photo', { p_code: input.code, p_path: input.path, p_source: input.source }),
      )
    },

    async detachBarcode(code: string): Promise<void> {
      await run<{ status: 'detached' }>(client.rpc('detach_barcode', { p_code: code }))
    },

    // RG-15 : le produit, ses codes et tous ses mouvements, pour de bon. Rejouable : un produit déjà supprimé répond pareil.
    async deleteProduct(productId: string): Promise<void> {
      await run<{ status: 'deleted' }>(client.rpc('delete_product', { p_product_id: productId }))
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

    async recordInventory(input: InventoryInput): Promise<InventoryResult> {
      const row = await run<{ movement_id: string; delta: number; stock: number; counted: number; duplicate: boolean }>(
        client.rpc('record_inventory', {
          p_id: input.id,
          p_product_id: input.productId,
          p_counted: input.counted,
          p_employee: input.employee,
        }),
      )
      return { delta: row.delta, stock: row.stock, counted: row.counted, duplicate: row.duplicate }
    },

    // Déjà annulé sur un autre téléphone : la base renvoie le premier auteur et son heure.
    async cancelMovement(movementId: string, employee: string): Promise<CancelResult> {
      const row = await run<{ stock: number; product_id: string; cancelled_at: string; cancelled_by: string }>(
        client.rpc('cancel_movement', { p_movement_id: movementId, p_employee: employee }),
      )
      return { stock: row.stock, cancelledAt: row.cancelled_at, cancelledBy: row.cancelled_by }
    },

    // Du plus récent au plus ancien, tous produits confondus. Une page pleine a peut-être une suite.
    async listHistory(cursor: HistoryCursor | null): Promise<HistoryPage> {
      const rows =
        (await run<HistoryRow[] | null>(
          client.rpc('list_history', {
            p_before_created_at: cursor?.createdAt ?? null,
            p_before_id: cursor?.id ?? null,
            p_limit: HISTORY_PAGE_SIZE,
          }),
        )) ?? []
      const last = rows[rows.length - 1]
      return {
        movements: rows.map(toHistoryMovement),
        next: rows.length === HISTORY_PAGE_SIZE ? { createdAt: last.created_at, id: last.id } : null,
      }
    },

    // Fin de journée : l'identifiant de chaque ligne rend l'envoi rejouable sans doublon.
    async recordSales(input: SalesInput): Promise<RecordSalesResult> {
      const row = await run<{ status: 'recorded'; units: number; duplicate: boolean } | { status: 'already_recorded'; products: string[] }>(
        client.rpc('record_sales', {
          p_day: input.day,
          p_lines: input.lines.map((line) => ({ id: line.id, product_id: line.productId, quantity: line.quantity })),
          p_employee: input.employee,
        }),
      )
      return row.status === 'recorded'
        ? { status: 'recorded', units: row.units, duplicate: row.duplicate }
        : { status: 'already_recorded', products: [...row.products].sort(compareNames) }
    },

    // Les ventes actives d'un jour, avec le nom du produit (archivé compris), dans l'ordre alphabétique français.
    async listDaySales(day: string): Promise<DaySale[]> {
      const rows =
        (await run<DaySaleRow[] | null>(
          client
            .from('movements')
            .select('id, product_id, delta, employee, created_at, product:products(name)')
            .eq('sale_day', day)
            .is('cancelled_at', null),
        )) ?? []
      return rows
        .map((row) => ({
          id: row.id,
          productId: row.product_id,
          productName: row.product.name,
          units: -row.delta,
          employee: row.employee,
          createdAt: row.created_at,
        }))
        .sort((a, b) => compareNames(a.productName, b.productName))
    },

    async listEmployees(): Promise<string[]> {
      return (await run<string[] | null>(client.rpc('list_employees'))) ?? []
    },
  }
}

export type Api = ReturnType<typeof createApi>
