import { expect, test } from 'vitest'
import type { Product } from '../data/api'
import { flowReducer, initialFlow, UNDO_FAILED_MESSAGE, type ConfirmTarget, type FlowState } from './scanFlow'

const lipton: Product = { id: 'p1', name: 'Lipton Pêche 50 cl', packSize: 12, alertThreshold: 12, targetStock: 24, archived: false, stock: 0,
  photoPath: null }
const PACK = '3502110123091'
const scanning = (cooldown: { code: string; until: number } | null = null): FlowState => ({ step: 'scanning', notice: null, cooldown })
const confirmed = () => flowReducer({ step: 'looking_up', code: PACK },
  { type: 'lookup_done', code: PACK, result: { found: true, product: lipton, units: 12, photoPath: null }, movementId: 'm1' })
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
  expect(confirmed()).toEqual({ step: 'confirm', target: { product: lipton, units: 12, code: PACK, photoPath: null }, quantity: 1, movementId: 'm1', status: 'idle', errorKind: null, counted: null })
})
test("product_ready garde l'image du code et l'avertissement d'une photo non enregistrée", () => {
  const saved: ConfirmTarget = { product: lipton, units: 12, code: PACK, photoPath: 'codes/3502110123091/photo.jpg' }
  expect(flowReducer({ step: 'new_product', code: PACK }, { type: 'product_ready', target: saved, movementId: 'm3' }))
    .toMatchObject({ step: 'confirm', target: { photoPath: 'codes/3502110123091/photo.jpg' } })
  const notSaved: ConfirmTarget = { product: lipton, units: 12, code: PACK, photoPath: null, photoWarning: true }
  expect(flowReducer({ step: 'attach', code: PACK, product: lipton }, { type: 'product_ready', target: notSaved, movementId: 'm4' }))
    .toMatchObject({ step: 'confirm', target: { photoPath: null, photoWarning: true } })
})
test("la fiche montre l'image du code scanné, pas celle du produit", () => {
  const withPhotos = { ...lipton, photoPath: 'codes/3502110123091/pack.jpg' }
  const state = flowReducer({ step: 'looking_up', code: '3502110123092' }, { type: 'lookup_done', code: '3502110123092',
    result: { found: true, product: withPhotos, units: 1, photoPath: 'codes/3502110123092/canette.jpg' }, movementId: 'm1' })
  expect(state).toMatchObject({ step: 'confirm', target: { photoPath: 'codes/3502110123092/canette.jpg' } })
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
    notice: { kind: 'saved', movementId: 'm1', delta: 12, productName: 'Lipton Pêche 50 cl', stock: 12, packSize: 12, counted: null } })
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 11_999 })).toBe(done)
  expect(flowReducer(done, { type: 'code_read', rawValue: PACK, format: 'ean_13', at: 12_000 })).toEqual({ step: 'looking_up', code: PACK })
})
test('recherche impossible (réseau) → lecture, avec une notice error', () => {
  expect(flowReducer({ step: 'looking_up', code: '1' }, { type: 'lookup_failed', code: '1', kind: 'network' }))
    .toEqual({ step: 'scanning', notice: { kind: 'error', message: 'Pas de connexion. Réessaie quand le réseau revient.' }, cooldown: null })
})
test('étapes intermédiaires', () => {
  const unknown: FlowState = { step: 'unknown', code: '9002490274658' }
  expect(flowReducer(unknown, { type: 'choose_new_product' })).toEqual({ step: 'new_product', code: '9002490274658' })
  expect(flowReducer(unknown, { type: 'choose_attach' })).toEqual({ step: 'attach', code: '9002490274658', product: null })
  expect(flowReducer({ step: 'new_product', code: '9002490274658' }, { type: 'choose_attach', product: lipton }))
    .toEqual({ step: 'attach', code: '9002490274658', product: lipton })
  expect(flowReducer(initialFlow, { type: 'open_manual' })).toEqual({ step: 'manual' })
  const target = { product: lipton, units: 24, code: '9002490274658', photoPath: null }
  expect(flowReducer({ step: 'attach', code: '9002490274658', product: lipton }, { type: 'product_ready', target, movementId: 'm2' }))
    .toEqual({ step: 'confirm', target, quantity: 1, movementId: 'm2', status: 'idle', errorKind: null, counted: null })
  expect(flowReducer(unknown, { type: 'close' })).toEqual(scanning())
})
test('annulation réussie ou échouée', () => {
  expect(flowReducer(scanning(), { type: 'undo_done', productName: 'Lipton Pêche 50 cl', stock: 0, packSize: 12 }))
    .toMatchObject({ notice: { kind: 'cancelled', stock: 0 } })
  expect(flowReducer(scanning(), { type: 'undo_failed', kind: 'network' }))
    .toMatchObject({ notice: { kind: 'error', message: UNDO_FAILED_MESSAGE } })
})


test('recherche en cours : Annuler revient à la lecture, la réponse tardive est ignorée', () => {
  const closed = flowReducer({ step: 'looking_up', code: PACK }, { type: 'close' })
  expect(closed).toEqual(scanning())
  expect(flowReducer(closed, { type: 'lookup_done', code: PACK, result: { found: true, product: lipton, units: 12, photoPath: null }, movementId: 'm9' })).toBe(closed)
})

test("pendant l'annulation, aucun code n'est relu et le résultat s'affiche toujours", () => {
  const saved = flowReducer(saving(), { type: 'save_done', delta: 12, stock: 12, at: 10_000 })
  const undoing = flowReducer(saved, { type: 'undo_started' })
  expect(undoing).toMatchObject({ step: 'scanning', undoing: true })
  expect(flowReducer(undoing, { type: 'code_read', rawValue: '5449000000996', format: 'ean_13', at: 20_000 })).toBe(undoing)
  expect(flowReducer(undoing, { type: 'open_manual' })).toBe(undoing)
  expect(flowReducer(undoing, { type: 'notice_expired' })).toBe(undoing)
  const failed = flowReducer(undoing, { type: 'undo_failed', kind: 'network' })
  expect(failed).toMatchObject({ notice: { kind: 'error', message: UNDO_FAILED_MESSAGE } })
  expect(failed).not.toHaveProperty('undoing', true)
  const done = flowReducer(undoing, { type: 'undo_done', productName: 'Lipton Pêche 50 cl', stock: 0, packSize: 12 })
  expect(done).toMatchObject({ notice: { kind: 'cancelled' } })
  expect(done).not.toHaveProperty('undoing', true)
})

test("un code de lot n'efface pas le message « enregistré » ni son bouton Annuler", () => {
  const saved = flowReducer(saving(), { type: 'save_done', delta: 12, stock: 12, at: 10_000 })
  expect(flowReducer(saved, { type: 'code_read', rawValue: '902602365', format: 'code_128', at: 10_500 })).toBe(saved)
})

test("Inventaire : le nombre compté est gardé à l'envoi et pour « Réessayer »", () => {
  const sent = flowReducer(confirmed(), { type: 'validate', counted: 53 })
  expect(sent).toMatchObject({ status: 'saving', counted: 53, movementId: 'm1' })
  const failed = flowReducer(sent, { type: 'save_failed', kind: 'network' })
  expect(flowReducer(failed, { type: 'validate', counted: 99 })).toMatchObject({ status: 'saving', counted: 53, movementId: 'm1' })
})

test('Inventaire enregistré : la notice porte le nombre compté', () => {
  const sent = flowReducer(confirmed(), { type: 'validate', counted: 53 })
  expect(flowReducer(sent, { type: 'save_done', delta: 29, stock: 53, at: 10_000 })).toMatchObject({
    notice: { kind: 'saved', movementId: 'm1', delta: 29, productName: 'Lipton Pêche 50 cl', stock: 53, packSize: 12, counted: 53 } })
})

test('produit archivé : réactivation puis fiche de confirmation', () => {
  const archived = flowReducer({ step: 'looking_up', code: PACK },
    { type: 'lookup_done', code: PACK, result: { found: true, product: { ...lipton, archived: true }, units: 12, photoPath: null }, movementId: 'm1' })
  expect(archived).toEqual({ step: 'archived', target: { product: { ...lipton, archived: true }, units: 12, code: PACK, photoPath: null },
    movementId: 'm1', status: 'idle', errorKind: null })
  expect(flowReducer(archived, { type: 'code_read', rawValue: '5449000000996', format: 'ean_13', at: 0 })).toBe(archived)
  const sending = flowReducer(archived, { type: 'reactivate' })
  expect(flowReducer(sending, { type: 'close' })).toBe(sending)
  expect(flowReducer(sending, { type: 'reactivate_done', product: lipton })).toEqual({ step: 'confirm',
    target: { product: lipton, units: 12, code: PACK, photoPath: null }, quantity: 1, movementId: 'm1', status: 'idle', errorKind: null, counted: null })
})

test('réactivation impossible : message, nouvel essai, fermeture', () => {
  const archived = flowReducer({ step: 'looking_up', code: PACK },
    { type: 'lookup_done', code: PACK, result: { found: true, product: { ...lipton, archived: true }, units: 12, photoPath: null }, movementId: 'm1' })
  const failed = flowReducer(flowReducer(archived, { type: 'reactivate' }), { type: 'reactivate_failed', kind: 'network' })
  expect(failed).toMatchObject({ step: 'archived', status: 'failed', errorKind: 'network' })
  expect(flowReducer(failed, { type: 'reactivate' })).toMatchObject({ status: 'saving', errorKind: null })
  expect(flowReducer(failed, { type: 'close' })).toEqual({ step: 'scanning', notice: null, cooldown: null })
})
