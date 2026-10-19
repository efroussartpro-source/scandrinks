import { expect, test } from 'vitest'
import type { Product } from '../data/api'
import { flowReducer, initialFlow, UNDO_FAILED_MESSAGE, type FlowState } from './scanFlow'

const lipton: Product = { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0 }
const PACK = '3502110123091'
const scanning = (cooldown: { code: string; until: number } | null = null): FlowState => ({ step: 'scanning', notice: null, cooldown })
const confirmed = () => flowReducer({ step: 'looking_up', code: PACK },
  { type: 'lookup_done', code: PACK, result: { found: true, product: lipton, units: 12 }, movementId: 'm1' })
const saving = () => flowReducer(confirmed(), { type: 'validate' })

test('code long GS1 du pack Lipton → recherche du code normalisé', () => {
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '0103502110123091152706202000100000208663', format: 'code_128', at: 0 }))
    .toEqual({ step: 'looking_up', code: PACK })
})
test('code de lot → notice not_a_product ; clé de contrôle fausse → ignoré sans message', () => {
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '902602365', format: 'code_128', at: 0 }))
    .toEqual({ step: 'scanning', notice: { kind: 'not_a_product' }, cooldown: null })
  expect(flowReducer(initialFlow, { type: 'code_read', rawValue: '3502110123092', format: 'ean_13', at: 0 })).toBe(initialFlow)
})
test('code connu → fiche de confirmation, quantité 1', () => {
  expect(confirmed()).toEqual({ step: 'confirm', target: { product: lipton, units: 12, code: PACK }, quantity: 1, movementId: 'm1', status: 'idle', errorKind: null })
})
test('réponse arrivée pour un autre code : ignorée', () => {
  const s: FlowState = { step: 'looking_up', code: PACK }
  expect(flowReducer(s, { type: 'lookup_done', code: '5449000000996', result: { found: false }, movementId: 'm9' })).toBe(s)
})
test('code inconnu → étape unknown', () => {
  expect(flowReducer({ step: 'looking_up', code: '9002490274658' }, { type: 'lookup_done', code: '9002490274658', result: { found: false }, movementId: 'm9' }))
    .toEqual({ step: 'unknown', code: '9002490274658' })
})
test('fiche affichée : un nouveau code lu est ignoré', () => {
  const s = confirmed()
  expect(flowReducer(s, { type: 'code_read', rawValue: '5449000000996', format: 'ean_13', at: 0 })).toBe(s)
})
test('quantité bornée de 1 à 99', () => {
  expect(flowReducer(confirmed(), { type: 'set_quantity', quantity: 150 })).toMatchObject({ quantity: 99 })
  expect(flowReducer(confirmed(), { type: 'set_quantity', quantity: 0 })).toMatchObject({ quantity: 1 })
})
test("double appui sur Valider : un seul enregistrement, fermeture impossible pendant l'envoi", () => {
  const s = saving()
  expect(s).toMatchObject({ status: 'saving' })
  expect(flowReducer(s, { type: 'validate' })).toBe(s)
  expect(flowReducer(s, { type: 'close' })).toBe(s)
})
test('coupure réseau : Réessayer garde le même identifiant, la quantité est verrouillée', () => {
  const failed = flowReducer(saving(), { type: 'save_failed', kind: 'network' })
  expect(failed).toMatchObject({ status: 'failed', errorKind: 'network', movementId: 'm1' })
  expect(flowReducer(failed, { type: 'set_quantity', quantity: 5 })).toBe(failed)
  expect(flowReducer(failed, { type: 'validate' })).toMatchObject({ status: 'saving', movementId: 'm1', errorKind: null })
})
test('enregistré → lecture avec la notice saved, et le même code ignoré pendant 2 s', () => {
  const done = flowReducer(saving(), { type: 'save_done', delta: 12, stock: 12, at: 10_000 })
  expect(done).toEqual({ step: 'scanning', cooldown: { code: PACK, until: 12_000 },
    notice: { kind: 'saved', movementId: 'm1', delta: 12, productName: 'Lipton Pêche 50 cl', stock: 12, packSize: 12 } })
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 11_999 })).toBe(done)
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 12_000 })).toEqual({ step: 'looking_up', code: PACK })
})
test('recherche impossible (réseau) → lecture, avec une notice error', () => {
  expect(flowReducer({ step: 'looking_up', code: '1' }, { type: 'lookup_failed', code: '1', kind: 'network' }))
    .toEqual({ step: 'scanning', notice: { kind: 'error', message: "Pas de connexion, rien n'a été enregistré." }, cooldown: null })
})
test('étapes intermédiaires', () => {
  const unknown: FlowState = { step: 'unknown', code: '9002490274658' }
  expect(flowReducer(unknown, { type: 'choose_new_product' })).toEqual({ step: 'new_product', code: '9002490274658' })
  expect(flowReducer(unknown, { type: 'choose_attach' })).toEqual({ step: 'attach', code: '9002490274658', product: null })
  expect(flowReducer({ step: 'new_product', code: '9002490274658' }, { type: 'choose_attach', product: lipton }))
    .toEqual({ step: 'attach', code: '9002490274658', product: lipton })
  expect(flowReducer(initialFlow, { type: 'open_manual' })).toEqual({ step: 'manual' })
  const target = { product: lipton, units: 24, code: '9002490274658' }
  expect(flowReducer({ step: 'attach', code: '9002490274658', product: lipton }, { type: 'product_ready', target, movementId: 'm2' }))
    .toEqual({ step: 'confirm', target, quantity: 1, movementId: 'm2', status: 'idle', errorKind: null })
  expect(flowReducer(unknown, { type: 'close' })).toEqual(scanning())
})
test('annulation réussie ou échouée', () => {
  expect(flowReducer(scanning(), { type: 'undo_done', productName: 'Lipton Pêche 50 cl', stock: 0, packSize: 12 }))
    .toMatchObject({ notice: { kind: 'cancelled', stock: 0 } })
  expect(flowReducer(scanning(), { type: 'undo_failed', kind: 'network' }))
    .toMatchObject({ notice: { kind: 'error', message: UNDO_FAILED_MESSAGE } })
})

