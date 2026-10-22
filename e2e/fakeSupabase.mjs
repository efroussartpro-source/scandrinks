/**
 * fakeSupabase.mjs — Backend simulé pour le test de bout en bout (Playwright).
 *
 * Intercepte les appels de l'app vers le projet factice de .env.e2e et y
 * répond comme Supabase : connexion, sessions et mot de passe (Auth),
 * fonctions SQL, vue product_stock et tables barcodes et movements
 * (PostgREST), avec les mêmes formes de réponse que les migrations de
 * supabase/migrations/. Comme private.is_allowed(), un jeton dont la session
 * est fermée est refusé (401, PT401), lectures comprises. Simule aussi le
 * stockage des images (compartiment privé « photos », liens signés) et Open
 * Food Facts, images comprises. Aucune requête ne sort vers Internet.
 */
import { PHOTO_JPEG } from './jpeg.mjs'

export const SUPABASE_URL = 'https://e2e-scandrinks.supabase.co'
export const GOOD_PASSWORD = 'bon-mot-de-passe'
export const COCA_CODE = '5449000000996'
// L'image du Coca chez Open Food Facts (adresse de la vraie base, servie ici par PHOTO_JPEG).
export const OFF_COCA_IMAGE = 'https://images.openfoodfacts.org/images/products/544/900/000/0996/front_fr.4.400.jpg'

// Codes du catalogue « tutoriel » (la vidéo tuto) : des EAN-13 à clé valide, vérifiés le 21/10/2026.
export const TUTORIAL_CODES = {
  coca: COCA_CODE,
  lipton: '3502110123091',
  oasisPack: '3124480191182',
  oasisCan: '3124480191014',
  redbull: '9002490100070',
  evian: '3068320114491',
}

// Photos de l'équipe des codes du catalogue « tutoriel » : la vidéo y range ses illustrations de packs (option photos).
export const TUTORIAL_PHOTOS = {
  coca: `codes/${TUTORIAL_CODES.coca}/7c0ca000-0000-4000-8000-000000000001.jpg`,
  lipton: `codes/${TUTORIAL_CODES.lipton}/7110a000-0000-4000-8000-000000000002.jpg`,
  redbull: `codes/${TUTORIAL_CODES.redbull}/7eedb000-0000-4000-8000-000000000003.jpg`,
  evian: `codes/${TUTORIAL_CODES.evian}/7e1a0000-0000-4000-8000-000000000004.jpg`,
}

// Catalogue « images » : le Coca a une photo de l'équipe, présente au stockage ; celle du Lipton (Open Food Facts) manque.
const IMAGES_COCA_PHOTO = 'codes/5449000000996/11111111-1111-4111-8111-111111111111.jpg'
const IMAGES_LIPTON_PHOTO = 'codes/3502110123091/22222222-2222-4222-8222-222222222222.jpg'
const PHOTO_NAME = /^codes\/([0-9]{8,14})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/

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

// Session portée par le jeton de la requête (null sans jeton de connexion).
function sessionOf(request) {
  const token = (request.headers().authorization ?? '').replace(/^Bearer /, '')
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).session_id ?? null
  } catch {
    return null
  }
}

// Le compte du tabac, tel que Supabase Auth le renvoie.
const USER = { id: '00000000-0000-4000-8000-0000000000a1', aud: 'authenticated', role: 'authenticated',
  email: 'tabac.e2e@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-19T08:00:00Z' }

// Seuil d'un pack Metro et stock idéal de deux packs, sauf valeurs données.
function productRow(id, name, packSize, extra = {}) {
  return { id, name, pack_size: packSize, alert_threshold: packSize, target_stock: 2 * packSize, archived: false,
    created_at: '2026-10-19T08:00:00Z', updated_at: '2026-10-19T08:00:00Z', ...extra }
}

// saleDay : le jour des ventes (AAAA-MM-JJ) d'une vente de fin de journée, une sortie ; vide sinon.
function movementRow(productId, kind, delta, employee, createdAt, counted = null, saleDay = null) {
  return { product_id: productId, kind, delta, counted, employee, created_at: createdAt, cancelled_at: null, cancelled_by: null,
    sale_day: saleDay }
}

// Le jour du calendrier de Paris (AAAA-MM-JJ) d'une date, comme (now() at time zone 'Europe/Paris')::date dans la base.
const parisDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(date)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const barcodeRow = (productId, units, createdAt = '2026-10-19T08:00:00Z', photo = { photo_path: null, photo_source: null }) => ({
  product_id: productId,
  units,
  created_at: createdAt,
  ...photo,
})

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
  if (name === 'images') {
    products.set('p-coca', productRow('p-coca', 'Coca-Cola 33 cl', 24))
    products.set('p-lipton', productRow('p-lipton', 'Lipton Pêche 50 cl', 12))
    products.set('p-evian', productRow('p-evian', 'Évian 50 cl', 24))
    barcodes.set(COCA_CODE, barcodeRow('p-coca', 24, undefined, { photo_path: IMAGES_COCA_PHOTO, photo_source: 'equipe' }))
    barcodes.set('3502110123091', barcodeRow('p-lipton', 12, undefined, { photo_path: IMAGES_LIPTON_PHOTO, photo_source: 'off' }))
    movements.set('m-i1', movementRow('p-coca', 'in', 10, 'Sam', '2026-10-19T08:00:00Z'))
    movements.set('m-i2', movementRow('p-lipton', 'in', 6, 'Sam', '2026-10-19T08:05:00Z'))
    movements.set('m-i3', movementRow('p-evian', 'in', 30, 'Sam', '2026-10-19T08:10:00Z'))
  }
  // La vidéo tuto, filmée le lundi 26/10/2026 : une semaine déjà commencée, en heures de Paris (UTC+2 jusqu'au 25/10).
  // Les sorties de samedi sont des ventes de fin de journée (jalon 5). L'erreur que le chapitre 8 annule : l'entrée de
  // Red Bull de samedi 18:30, qui était une casse.
  if (name === 'tutoriel') {
    const teamPhoto = (product) => ({ photo_path: TUTORIAL_PHOTOS[product], photo_source: 'equipe' })
    products.set('p-coca', productRow('p-coca', 'Coca-Cola 33 cl', 24))
    products.set('p-lipton', productRow('p-lipton', 'Lipton Pêche 50 cl', 12))
    products.set('p-redbull', productRow('p-redbull', 'Red Bull 25 cl', 24))
    products.set('p-evian', productRow('p-evian', 'Évian 50 cl', 24))
    barcodes.set(TUTORIAL_CODES.coca, barcodeRow('p-coca', 24, undefined, teamPhoto('coca')))
    barcodes.set(TUTORIAL_CODES.lipton, barcodeRow('p-lipton', 12, undefined, teamPhoto('lipton')))
    barcodes.set(TUTORIAL_CODES.redbull, barcodeRow('p-redbull', 24, undefined, teamPhoto('redbull')))
    barcodes.set(TUTORIAL_CODES.evian, barcodeRow('p-evian', 24, undefined, teamPhoto('evian')))
    movements.set('m-t1', movementRow('p-coca', 'in', 48, 'Léa', '2026-10-23T07:05:00Z'))
    movements.set('m-t2', movementRow('p-coca', 'out', -24, 'Sam', '2026-10-24T15:40:00Z', null, '2026-10-24'))
    movements.set('m-t3', movementRow('p-lipton', 'in', 24, 'Léa', '2026-10-23T07:10:00Z'))
    movements.set('m-t4', movementRow('p-lipton', 'out', -14, 'Léa', '2026-10-24T16:05:00Z', null, '2026-10-24'))
    movements.set('m-t5', movementRow('p-redbull', 'in', 48, 'Léa', '2026-10-23T07:15:00Z'))
    movements.set('m-t6', movementRow('p-redbull', 'in', 24, 'Léa', '2026-10-24T16:30:00Z'))
    movements.set('m-t7', movementRow('p-evian', 'in', 24, 'Léa', '2026-10-23T07:20:00Z'))
    movements.set('m-t8', movementRow('p-evian', 'out', -18, 'Sam', '2026-10-24T14:00:00Z', null, '2026-10-24'))
  }
  return { products, barcodes, movements }
}

// Entrées de +1 sur le Lipton, plus anciennes que le catalogue, une par minute : de quoi remplir plusieurs pages d'Historique.
function addExtraMovements(db, count) {
  if (count > 0 && !db.products.has('p-lipton')) throw new Error('extraMovements : il faut un catalogue avec le Lipton')
  for (let i = 1; i <= count; i++) {
    const createdAt = new Date(Date.parse('2026-10-17T07:00:00Z') - i * 60_000).toISOString().replace('.000Z', 'Z')
    db.movements.set(`m-x${String(i).padStart(2, '0')}`, movementRow('p-lipton', 'in', 1, 'Sam', createdAt))
  }
}

const invalid = (field) => ({ status: 400, body: { code: 'P0001', message: `invalid_input:${field}`, details: null, hint: null } })

/**
 * Installe le faux backend sur une page.
 * options.catalogue : 'coca_with_code' (par défaut), 'coca_without_code', 'coca_archived', 'pilotage', 'images', 'tutoriel'
 *   (la vidéo tuto : prénoms Sam et Léa, photos de l'équipe sur les codes, TUTORIAL_PHOTOS) ou 'empty'.
 * options.now : l'horloge des dates enregistrées (created_at, cancelled_at), par défaut l'heure réelle ; la vidéo la
 *   cale sur l'horloge fixée de la page.
 * options.failNextRecord : coupe le premier record_movement (réseau perdu).
 * options.failFirst : fonctions SQL (record_sales…) dont le premier appel est coupé avant d'atteindre la base (réseau perdu).
 * options.expireSessionOn : nom de la fonction SQL qui répond « jeton expiré » (401).
 * options.hangFirst : nom de la fonction SQL dont le premier appel ne reçoit jamais de réponse.
 * options.failLogout : coupe la déconnexion (/auth/v1/logout), comme sans réseau.
 * options.loseFirst : fonctions SQL (create_product, record_inventory, record_sales…) dont le premier appel est enregistré,
 *   mais sa réponse se perd ; 'auth:user' fait de même pour le changement de mot de passe.
 * options.extraMovements : nombre d'entrées de +1 sur le Lipton ajoutées avant le catalogue, une par minute (Historique).
 * options.longNames : chaque nom de produit reçoit la suite « — édition limitée, format familial » (rien ne doit déborder).
 * options.photos : images déjà au stockage, { chemin: octets } (la vidéo du jalon 4 s'en sert).
 * options.offImage : false retire l'image du Coca de la réponse d'Open Food Facts.
 * options.failPhotoUpload : le premier envoi d'image est coupé (réseau perdu).
 * options.hangPhotoUpload : le premier envoi d'image ne reçoit jamais de réponse (réseau bloqué).
 * options.cutReads : 'movements' ou 'barcodes' : les lectures de cette table sont coupées (réseau perdu) jusqu'à
 *   restoreReads(). Une seule coupure ne suffit pas : supabase-js relance seul une lecture jusqu'à trois fois.
 * options.corruptHistory : la première page de list_history commence par un mouvement daté « pas une date », une
 *   réponse abîmée que l'Historique ne sait pas afficher (le filet de sécurité doit la rattraper).
 * Renvoie { calls, authCalls, storageCalls, photos, addMovement, revokeAllSessions, cancelElsewhere, restoreReads } :
 * - calls : appels des fonctions SQL ; authCalls : 'token', 'user' et 'logout:<portée>', dans l'ordre ;
 * - storageCalls : { kind: 'upload' | 'sign' | 'get', paths, contentType? }, dans l'ordre ; photos : chemin → octets ;
 * - addMovement et cancelElsewhere simulent un mouvement ou une annulation faits sur un autre téléphone ; addMovement accepte
 *   saleDay, pour une vente de fin de journée ;
 * - revokeAllSessions ferme toutes les sessions, comme un changement de mot de passe sur un autre téléphone ;
 * - restoreReads rétablit les lectures coupées par cutReads.
 */
export async function installFakeSupabase(page, options = {}) {
  const { catalogue = 'coca_with_code', failNextRecord = false, failFirst = [], expireSessionOn = null, hangFirst = null, failLogout = false,
    loseFirst = [], extraMovements = 0, cutReads = null, longNames = false, photos: givenPhotos = {}, offImage = true,
    failPhotoUpload = false, hangPhotoUpload = false, corruptHistory = false, now: clock = () => new Date() } = options
  const db = initialCatalogue(catalogue)
  const photos = new Map(Object.entries(givenPhotos))
  if (catalogue === 'images' && !photos.has(IMAGES_COCA_PHOTO)) photos.set(IMAGES_COCA_PHOTO, PHOTO_JPEG)
  if (catalogue === 'tutoriel') {
    for (const path of Object.values(TUTORIAL_PHOTOS)) if (!photos.has(path)) photos.set(path, PHOTO_JPEG)
  }
  const storageCalls = []
  let uploadFailuresLeft = failPhotoUpload ? 1 : 0
  let uploadHangsLeft = hangPhotoUpload ? 1 : 0
  addExtraMovements(db, extraMovements)
  if (longNames) for (const product of db.products.values()) product.name += ' — édition limitée, format familial'
  const calls = []
  const authCalls = []
  // Sessions ouvertes (une par connexion) et mot de passe du moment.
  const sessions = new Set()
  let sessionCount = 0
  let currentPassword = GOOD_PASSWORD
  let recordFailuresLeft = failNextRecord ? 1 : 0
  let readsCut = cutReads !== null
  let hangLeft = hangFirst ? 1 : 0
  const responsesToLose = new Set(loseFirst)
  const callsToFail = new Set(failFirst)
  let createdCount = 0
  let otherPhoneCount = 0

  const now = () => clock().toISOString()
  const stockOf = (productId) =>
    [...db.movements.values()].filter((m) => m.product_id === productId && m.cancelled_at === null).reduce((sum, m) => sum + m.delta, 0)
  // Image du produit, comme la vue product_stock : celle du code du pack Metro, sinon la première par date puis par code.
  const photoOf = (product) =>
    [...db.barcodes.entries()]
      .filter(([, b]) => b.product_id === product.id && b.photo_path !== null)
      .sort(([codeA, a], [codeB, b]) => Number(b.units === product.pack_size) - Number(a.units === product.pack_size)
        || a.created_at.localeCompare(b.created_at) || codeA.localeCompare(codeB))[0]?.[1].photo_path ?? null
  const withStock = (product) => ({ ...product, stock: stockOf(product.id), photo_path: photoOf(product) })
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr')

  // Comme Supabase Auth : trop court d'abord (moins de 8 caractères), puis identique à l'actuel.
  const updatePassword = (next) => {
    if (next.length < 8) {
      return [422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters.', weak_password: { reasons: ['length'] } }]
    }
    if (next === currentPassword) {
      return [422, { code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }]
    }
    currentPassword = next
    return [200, USER]
  }

  // Déconnexion : 'global' ferme toutes les sessions, 'others' toutes sauf la sienne, 'local' la sienne.
  const closeSessions = (scope, own) => {
    for (const session of [...sessions]) {
      if (scope === 'global' || (scope === 'others' ? session !== own : session === own)) sessions.delete(session)
    }
  }

  const rpc = {
    lookup_barcode: ({ p_code }) => {
      const barcode = db.barcodes.get(p_code)
      return barcode
        ? { code: p_code, units: barcode.units, photo_path: barcode.photo_path, photo_source: barcode.photo_source,
            product: withStock(db.products.get(barcode.product_id)) }
        : null
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
      // Comme la base : rattacher un code garde son image.
      db.barcodes.set(p_code, barcodeRow(p_product_id, p_units, current?.created_at ?? now(),
        { photo_path: current?.photo_path ?? null, photo_source: current?.photo_source ?? null }))
      return { status: 'attached' }
    },
    // Mêmes contrôles, dans le même ordre, que la base : code, provenance, chemin, puis fichier au stockage.
    set_barcode_photo: ({ p_code, p_path, p_source }) => {
      const barcode = db.barcodes.get(p_code)
      if (!barcode) return invalid('code')
      if (p_source !== 'off' && p_source !== 'equipe') return invalid('source')
      if (PHOTO_NAME.exec(p_path ?? '')?.[1] !== p_code) return invalid('path')
      if (!photos.has(p_path)) return invalid('photo')
      Object.assign(barcode, { photo_path: p_path, photo_source: p_source })
      return { code: p_code, photo_path: p_path, photo_source: p_source }
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
      return { stock: stockOf(movement.product_id), product_id: movement.product_id, cancelled_at: movement.cancelled_at,
        cancelled_by: movement.cancelled_by }
    },
    // Même tri et même curseur que la base : date puis identifiant, du plus récent au plus ancien, archivés compris.
    list_history: ({ p_before_created_at = null, p_before_id = null, p_limit = 50 }) => {
      if (!(p_limit >= 1 && p_limit <= 100)) return invalid('limit')
      if ((p_before_created_at === null) !== (p_before_id === null)) return invalid('cursor')
      const at = (row) => Date.parse(row.created_at)
      const newestFirst = (a, b) => at(b) - at(a) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
      const cursor = Date.parse(p_before_created_at)
      const beforeCursor = (row) => at(row) < cursor || (at(row) === cursor && row.id < p_before_id)
      const page = [...db.movements.entries()]
        .map(([id, m]) => ({ id, kind: m.kind, delta: m.delta, counted: m.counted, employee: m.employee, created_at: m.created_at,
          cancelled_at: m.cancelled_at, cancelled_by: m.cancelled_by, product_id: m.product_id,
          product_name: db.products.get(m.product_id).name, sale_day: m.sale_day }))
        .filter((row) => p_before_created_at === null || beforeCursor(row))
        .sort(newestFirst)
        .slice(0, p_limit)
      if (!corruptHistory || p_before_created_at !== null || page.length === 0) return page
      return [{ ...page[0], id: '00000000-0000-4000-8000-0000000000bd', created_at: 'pas une date' }, ...page.slice(0, p_limit - 1)]
    },
    // Fin de journée, avec les règles de la base (20261022130000_fin_de_journee.sql) : 7 derniers jours de Paris, de 1 à 999
    // par produit, une ligne par produit ; rejouée, une ligne compte ce qui avait été enregistré ; un produit qui a déjà sa
    // vente active ce jour-là sous un autre identifiant : rien n'est enregistré, et les produits sont nommés.
    record_sales: ({ p_day = null, p_lines = null, p_employee = '' }) => {
      const employee = (p_employee ?? '').trim()
      if (employee.length < 1 || employee.length > 30) return invalid('employee')
      const today = parisDay(clock())
      const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / 86_400_000
      if (typeof p_day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p_day) || p_day > today || dayNumber(today) - dayNumber(p_day) > 6) {
        return invalid('day')
      }
      if (!Array.isArray(p_lines) || p_lines.length < 1 || p_lines.length > 200
        || p_lines.some((line) => typeof line !== 'object' || line === null || Array.isArray(line))) return invalid('lines')
      const ids = p_lines.map((line) => line.id ?? null)
      const products = p_lines.map((line) => line.product_id ?? null)
      const distinct = (values) => new Set(values.filter((value) => value !== null)).size === values.filter((value) => value !== null).length
      if (!distinct(ids) || !distinct(products)) return invalid('lines')
      if (ids.some((id) => id === null || !UUID.test(id))) return invalid('id')
      if (products.some((id) => id === null || !db.products.has(id))) return invalid('product')
      if (p_lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 999)) return invalid('quantity')
      const replayed = p_lines.filter((line) => db.movements.has(line.id))
      if (replayed.some((line) => {
        const sale = db.movements.get(line.id)
        return sale.kind !== 'out' || sale.sale_day !== p_day || sale.product_id !== line.product_id
      })) return invalid('id')
      const fresh = p_lines.filter((line) => !db.movements.has(line.id))
      const conflicts = fresh
        .filter((line) => [...db.movements.values()].some((m) => m.product_id === line.product_id && m.sale_day === p_day && m.cancelled_at === null))
        .map((line) => db.products.get(line.product_id).name)
      if (conflicts.length > 0) return { status: 'already_recorded', products: conflicts }
      for (const line of fresh) {
        db.movements.set(line.id, movementRow(line.product_id, 'out', -line.quantity, employee, now(), null, p_day))
      }
      const units = p_lines.reduce((sum, line) => sum - db.movements.get(line.id).delta, 0)
      return { status: 'recorded', units, duplicate: fresh.length === 0 }
    },
    // La vidéo montre les prénoms déjà utilisés ; ailleurs, la liste reste vide, comme pour un premier téléphone.
    list_employees: () =>
      catalogue === 'tutoriel'
        ? [...new Set([...db.movements.values()].map((m) => m.employee))].sort((a, b) => a.localeCompare(b, 'fr'))
        : [],
  }

  // Lectures PostgREST : filtres product_id=eq.…, sale_day=eq.… et cancelled_at=is.null, ordre et limite.
  const productIdOf = (url) => url.searchParams.get('product_id')?.replace(/^eq\./, '') ?? null
  const saleDayOf = (url) => url.searchParams.get('sale_day')?.replace(/^eq\./, '') ?? null

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const reply = (status, body) =>
      route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const signedIn = () => sessions.has(sessionOf(request))
    const revoked = () => reply(401, { code: 'PT401', message: 'session_revoked', details: null, hint: null })

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })

    if (url.pathname === '/auth/v1/token') {
      authCalls.push('token')
      const { password } = request.postDataJSON()
      if (password !== currentPassword) return reply(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
      const session = `session-${++sessionCount}`
      sessions.add(session)
      const nowSeconds = Math.floor(Date.now() / 1000)
      return reply(200, {
        access_token: unsignedJwt({ sub: USER.id, role: 'authenticated', aud: 'authenticated', exp: nowSeconds + YEAR_SECONDS,
          session_id: session }),
        token_type: 'bearer',
        expires_in: YEAR_SECONDS,
        expires_at: nowSeconds + YEAR_SECONDS,
        refresh_token: 'refresh-e2e',
        user: USER,
      })
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'PUT') {
      authCalls.push('user')
      const [status, body] = signedIn()
        ? updatePassword(request.postDataJSON()?.password ?? '')
        : [403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }]
      if (responsesToLose.has('auth:user')) {
        // Le changement est traité, puis la réponse se perd (réseau coupé au retour).
        responsesToLose.delete('auth:user')
        return route.abort('internetdisconnected')
      }
      return reply(status, body)
    }
    if (url.pathname === '/auth/v1/logout') {
      const scope = url.searchParams.get('scope') ?? 'global'
      authCalls.push(`logout:${scope}`)
      if (failLogout) return route.abort('internetdisconnected')
      closeSessions(scope, sessionOf(request))
      return route.fulfill({ status: 204, headers: CORS })
    }

    const read = url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/')
    if (read && !signedIn()) return revoked()
    if (read && readsCut && url.pathname === `/rest/v1/${cutReads}`) return route.abort('internetdisconnected')

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
        .map(([code, b]) => ({ code, units: b.units, photo_path: b.photo_path, photo_source: b.photo_source }))
      return reply(200, rows)
    }

    if (url.pathname === '/rest/v1/movements') {
      const productId = productIdOf(url)
      const saleDay = saleDayOf(url)
      const activeOnly = url.searchParams.get('cancelled_at') === 'is.null'
      // Le nom du produit, quand la lecture le demande (product:products(name)), comme une jointure PostgREST.
      const withProduct = (url.searchParams.get('select') ?? '').includes('product:products(name)')
      const limit = Number(url.searchParams.get('limit') ?? 1000)
      const rows = [...db.movements.entries()]
        .filter(([, m]) => (productId === null || m.product_id === productId) && (saleDay === null || m.sale_day === saleDay)
          && (!activeOnly || m.cancelled_at === null))
        .sort(([, a], [, b]) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(([id, m]) => ({ id, product_id: m.product_id, kind: m.kind, delta: m.delta, counted: m.counted, employee: m.employee,
          created_at: m.created_at, cancelled_at: m.cancelled_at, cancelled_by: m.cancelled_by, sale_day: m.sale_day,
          ...(withProduct ? { product: { name: db.products.get(m.product_id).name } } : {}) }))
      return reply(200, rows)
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const fn = url.pathname.slice('/rest/v1/rpc/'.length)
      const body = request.postDataJSON() ?? {}
      calls.push({ fn, body })
      if (fn === expireSessionOn) return reply(401, { code: 'PGRST303', message: 'JWT expired', details: null, hint: null })
      if (!signedIn()) return revoked()
      if (fn === hangFirst && hangLeft > 0) {
        // Réseau bloqué : la requête reste sans réponse, jusqu'à ce que l'app l'abandonne.
        hangLeft -= 1
        return
      }
      if (fn === 'record_movement' && recordFailuresLeft > 0) {
        recordFailuresLeft -= 1
        return route.abort('internetdisconnected')
      }
      if (callsToFail.has(fn)) {
        callsToFail.delete(fn)
        return route.abort('internetdisconnected')
      }
      const handler = rpc[fn]
      if (!handler) return reply(404, { code: 'PGRST202', message: `Could not find the function public.${fn}` })
      if (responsesToLose.has(fn)) {
        // La base enregistre, puis la réponse se perd (réseau coupé au retour).
        responsesToLose.delete(fn)
        handler(body)
        return route.abort('internetdisconnected')
      }
      const result = handler(body)
      if (result && typeof result === 'object' && 'status' in result && 'body' in result) return reply(result.status, result.body)
      return reply(200, result)
    }

    // Stockage : envoi d'une image (octets bruts), liens signés, puis lecture par un lien signé.
    const uploadPrefix = '/storage/v1/object/photos/'
    const signedPrefix = '/storage/v1/object/sign/photos/'
    if (request.method() === 'POST' && url.pathname.startsWith(uploadPrefix)) {
      const path = decodeURIComponent(url.pathname.slice(uploadPrefix.length))
      const contentType = request.headers()['content-type']
      storageCalls.push({ kind: 'upload', paths: [path], contentType })
      if (uploadFailuresLeft > 0) {
        uploadFailuresLeft -= 1
        return route.abort('internetdisconnected')
      }
      if (uploadHangsLeft > 0) {
        // Réseau bloqué : la requête reste sans réponse, jusqu'à ce que l'app l'abandonne.
        uploadHangsLeft -= 1
        return
      }
      if (!signedIn()) return reply(400, { statusCode: '403', error: 'Unauthorized', message: 'Invalid JWT' })
      if (contentType !== 'image/jpeg') return reply(400, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${contentType} is not supported` })
      if (!PHOTO_NAME.test(path)) return reply(400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
      if (photos.has(path)) return reply(409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
      photos.set(path, request.postDataBuffer())
      return reply(200, { Id: crypto.randomUUID(), Key: `photos/${path}` })
    }
    if (request.method() === 'POST' && url.pathname === '/storage/v1/object/sign/photos') {
      const paths = request.postDataJSON()?.paths ?? []
      storageCalls.push({ kind: 'sign', paths })
      if (!signedIn()) return reply(400, { statusCode: '403', error: 'Unauthorized', message: 'Invalid JWT' })
      return reply(200, paths.map((path) => photos.has(path)
        ? { path, signedURL: `/object/sign/photos/${path}?token=e2e`, error: null }
        : { path, signedURL: null, error: 'Either the object does not exist or you do not have access to it' }))
    }
    if (request.method() === 'GET' && url.pathname.startsWith(signedPrefix)) {
      const path = decodeURIComponent(url.pathname.slice(signedPrefix.length))
      storageCalls.push({ kind: 'get', paths: [path] })
      const bytes = photos.get(path)
      if (!bytes) return reply(400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' }, body: bytes })
    }

    return reply(404, { message: `Route simulée inconnue : ${url.pathname}` })
  })

  // Open Food Facts connaît le Coca (avec son image) et la canette d'Oasis Tropical (sans image) ; rien d'autre.
  const offProducts = {
    [COCA_CODE]: { product_name_fr: 'Coca-Cola', quantity: '330 ml', ...(offImage ? { image_front_url: OFF_COCA_IMAGE } : {}) },
    [TUTORIAL_CODES.oasisCan]: { product_name_fr: 'Oasis Tropical', quantity: '33 cl' },
  }
  await page.route('https://world.openfoodfacts.org/**', (route) => {
    const code = new URL(route.request().url()).pathname.match(/\/product\/(\d+)\.json$/)?.[1]
    const product = code ? offProducts[code] : undefined
    return route.fulfill({
      status: product ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(product ? { status: 1, product } : { status: 0 }),
    })
  })
  // Les images d'Open Food Facts : toujours la même photo de test, lisible depuis l'app (CORS).
  await page.route('https://images.openfoodfacts.org/**', (route) =>
    route.fulfill({ status: 200, headers: { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' }, body: PHOTO_JPEG }))

  const addMovement = ({ productId, kind, delta, employee, saleDay = null }) => {
    db.movements.set(`m-other-${++otherPhoneCount}`, movementRow(productId, kind, delta, employee, now(), null, saleDay))
  }

  const cancelElsewhere = (id, employee) => {
    const movement = db.movements.get(id)
    if (movement.cancelled_at === null) Object.assign(movement, { cancelled_at: now(), cancelled_by: employee })
  }

  const revokeAllSessions = () => sessions.clear()

  const restoreReads = () => {
    readsCut = false
  }

  return { calls, authCalls, storageCalls, photos, addMovement, revokeAllSessions, cancelElsewhere, restoreReads }
}
