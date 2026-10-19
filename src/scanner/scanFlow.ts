/**
 * scanFlow.ts — Automate de l'écran Scanner, sans React ni réseau.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §7)
 *
 * L'écran lui envoie les événements (code lu, réponse de la base, appui sur
 * un bouton) et fait les appels qui correspondent à l'étape obtenue. Les
 * identifiants de mouvement et l'heure arrivent avec les événements : la
 * fonction reste pure et testable. Règles tenues ici :
 * - un code n'est pas relu tant qu'une fiche est affichée, ni pendant 2 s
 *   après la validation ;
 * - un double appui sur « Valider » ne fait qu'un envoi ;
 * - « Réessayer » garde le même identifiant : la base ne crée pas de doublon ;
 * - après un échec, la quantité ne change plus (ce qui est réessayé est ce
 *   qui était affiché).
 */
import { normalizeScannedCode } from '../codes/normalize'
import type { LookupResult, Product } from '../data/api'
import { apiErrorMessage, type ApiErrorKind } from '../data/apiErrors'
import { clampQuantity } from '../domain/stock'
import { SCAN_COOLDOWN_MS } from '../scan/deduper'

export const NOT_A_PRODUCT_MESSAGE = "Ce code n'identifie pas un produit (lot, date…)."
export const UNDO_FAILED_MESSAGE = "L'annulation n'a pas pu être faite. Pour corriger, scanne le produit dans l'autre mode."

// code null : saisie manuelle.
export interface ConfirmTarget {
  product: Product
  units: number
  code: string | null
}

export type Notice =
  | { kind: 'saved'; movementId: string; delta: number; productName: string; stock: number; packSize: number }
  | { kind: 'cancelled'; productName: string; stock: number; packSize: number }
  | { kind: 'not_a_product' }
  | { kind: 'error'; message: string }

export type ConfirmState = {
  step: 'confirm'
  target: ConfirmTarget
  quantity: number
  movementId: string
  status: 'idle' | 'saving' | 'failed'
  errorKind: ApiErrorKind | null
}

export type FlowState =
  | { step: 'scanning'; notice: Notice | null; cooldown: { code: string; until: number } | null }
  | { step: 'looking_up'; code: string }
  | ConfirmState
  | { step: 'unknown'; code: string }
  | { step: 'new_product'; code: string }
  // product : choisi d'avance (pack ajouté depuis sa canette).
  | { step: 'attach'; code: string; product: Product | null }
  | { step: 'manual' }

export type FlowEvent =
  | { type: 'code_read'; rawValue: string; format: string; at: number }
  | { type: 'lookup_done'; code: string; result: LookupResult; movementId: string }
  | { type: 'lookup_failed'; code: string; kind: ApiErrorKind }
  | { type: 'set_quantity'; quantity: number }
  | { type: 'validate' }
  | { type: 'save_done'; delta: number; stock: number; at: number }
  | { type: 'save_failed'; kind: ApiErrorKind }
  | { type: 'close' }
  | { type: 'choose_new_product' }
  | { type: 'choose_attach'; product?: Product }
  | { type: 'open_manual' }
  | { type: 'product_ready'; target: ConfirmTarget; movementId: string }
  | { type: 'undo_done'; productName: string; stock: number; packSize: number }
  | { type: 'undo_failed'; kind: ApiErrorKind }
  | { type: 'notice_expired' }

export const initialFlow: FlowState = { step: 'scanning', notice: null, cooldown: null }

const scanningWith = (notice: Notice | null, cooldown: { code: string; until: number } | null = null): FlowState => ({
  step: 'scanning',
  notice,
  cooldown,
})

const confirmFor = (target: ConfirmTarget, movementId: string): ConfirmState => ({
  step: 'confirm',
  target,
  quantity: 1,
  movementId,
  status: 'idle',
  errorKind: null,
})

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'code_read': {
      if (state.step !== 'scanning') return state
      const normalized = normalizeScannedCode(event.rawValue, event.format)
      if (normalized.kind === 'ignored') {
        // Lecture parasite (clé fausse) : ignorée sans message.
        return normalized.reason === 'not_a_product' ? { ...state, notice: { kind: 'not_a_product' } } : state
      }
      if (state.cooldown && state.cooldown.code === normalized.code && event.at < state.cooldown.until) return state
      return { step: 'looking_up', code: normalized.code }
    }
    case 'lookup_done':
      if (state.step !== 'looking_up' || state.code !== event.code) return state
      return event.result.found
        ? confirmFor({ product: event.result.product, units: event.result.units, code: event.code }, event.movementId)
        : { step: 'unknown', code: event.code }
    case 'lookup_failed':
      if (state.step !== 'looking_up' || state.code !== event.code) return state
      return scanningWith({ kind: 'error', message: apiErrorMessage(event.kind) })
    case 'set_quantity':
      if (state.step !== 'confirm' || state.status !== 'idle') return state
      return { ...state, quantity: clampQuantity(event.quantity) }
    case 'validate':
      if (state.step !== 'confirm' || state.status === 'saving') return state
      return { ...state, status: 'saving', errorKind: null }
    case 'save_done':
      if (state.step !== 'confirm' || state.status !== 'saving') return state
      return scanningWith(
        {
          kind: 'saved',
          movementId: state.movementId,
          delta: event.delta,
          productName: state.target.product.name,
          stock: event.stock,
          packSize: state.target.product.packSize,
        },
        state.target.code === null ? null : { code: state.target.code, until: event.at + SCAN_COOLDOWN_MS },
      )
    case 'save_failed':
      if (state.step !== 'confirm' || state.status !== 'saving') return state
      return { ...state, status: 'failed', errorKind: event.kind }
    case 'close':
      if (state.step === 'scanning' || state.step === 'looking_up') return state
      if (state.step === 'confirm' && state.status === 'saving') return state
      return scanningWith(null)
    case 'choose_new_product':
      return state.step === 'unknown' ? { step: 'new_product', code: state.code } : state
    case 'choose_attach':
      return state.step === 'unknown' || state.step === 'new_product'
        ? { step: 'attach', code: state.code, product: event.product ?? null }
        : state
    case 'open_manual':
      return state.step === 'scanning' ? { step: 'manual' } : state
    case 'product_ready':
      return state.step === 'new_product' || state.step === 'attach' || state.step === 'manual'
        ? confirmFor(event.target, event.movementId)
        : state
    case 'undo_done':
      if (state.step !== 'scanning') return state
      return { ...state, notice: { kind: 'cancelled', productName: event.productName, stock: event.stock, packSize: event.packSize } }
    case 'undo_failed':
      return state.step === 'scanning' ? { ...state, notice: { kind: 'error', message: UNDO_FAILED_MESSAGE } } : state
    case 'notice_expired':
      return state.step === 'scanning' && state.notice !== null ? { ...state, notice: null } : state
  }
}
