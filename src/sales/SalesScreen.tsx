/**
 * SalesScreen.tsx — Onglet « Ventes » : la fin de journée (§4.8).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.8, RG-14, §7)
 *
 * Chaque soir, on reporte les ventes du jour lues sur la caisse : le nombre
 * vendu de chaque boisson, puis le récapitulatif, puis « Enregistrer ». Le
 * jour est aujourd'hui (heure de Paris), ou l'un des 6 jours d'avant pour
 * rattraper un soir oublié. « Déjà saisi » montre les ventes actives du jour :
 * elles ne se saisissent pas deux fois ; pour corriger, on annule la vente
 * dans l'Historique. Chaque ligne envoyée garde son identifiant jusqu'à son
 * enregistrement : « Réessayer » ne compte jamais deux fois. Si un autre
 * téléphone a saisi un produit entre-temps, rien n'est enregistré et la liste
 * est relue. Une réponse arrivée pour un autre jour que celui affiché est
 * ignorée. La saisie en cours est gardée par AppShell : un tour par un autre
 * onglet (« Stock », pour créer une boisson qui manque) ne perd rien,
 * « Réessayer » compris. Au retour dans l'app, si la date a changé, l'écran
 * passe au nouveau jour, sauf pendant une saisie, qui garde le sien.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Catalog } from '../app/useCatalog'
import { selectAllSoon } from '../app/selectAll'
import type { DaySale } from '../data/api'
import { apiErrorMessage, classifyApiError, saveErrorMessage } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { formatClock } from '../domain/movements'
import { formatDrinks, formatSaleDay, NOTHING_SOLD_MESSAGE, parseSold, readEntries, salesDays, SOLD_INVALID_MESSAGE } from '../domain/sales'
import { formatDelta } from '../domain/stock'
import Thumb from '../photos/Thumb'
import { filterProducts } from '../products/search'
import { IconSearch } from '../ui/icons'
import SalesRecap from './SalesRecap'
import './Sales.css'

// Saisie en cours, gardée par AppShell quand on change d'onglet.
export interface SalesDraftState {
  day: string
  entries: Record<string, string>
  lineIds: Map<string, string>
  step: 'entry' | 'recap'
  saveError: string | null
}

interface SalesScreenProps {
  catalog: Catalog
  employee: string
  // Où l'écran range sa saisie en cours, d'une visite de l'onglet à la suivante.
  keep: { current: SalesDraftState | null }
  onCatalogChanged: () => void
  onSessionExpired: () => void
}

// Premier jour de ventes (.env.production : la bascule du 22/10 au soir), ou aucun.
const FIRST_SALES_DAY = import.meta.env.VITE_FIRST_SALES_DAY || null
const SALES_REFUSED = 'Enregistrement refusé : vérifie le jour et les quantités.'
const CHANGE_DAY = 'Changer de jour ? La saisie en cours sera effacée.'

export default function SalesScreen({ catalog, employee, keep, onCatalogChanged, onSessionExpired }: SalesScreenProps) {
  const dayId = useId()
  const [days, setDays] = useState(() => salesDays(new Date(), FIRST_SALES_DAY))
  // La saisie laissée en changeant d'onglet, si son jour est encore proposé.
  const [kept] = useState(() => {
    const previous = keep.current
    return previous !== null && days.some((candidate) => candidate.day === previous.day) ? previous : null
  })
  // Vide avant le premier jour de ventes : il n'y a alors rien à saisir.
  const [day, setDay] = useState(() => kept?.day ?? days[0]?.day ?? '')
  // Ventes actives lues, rangées avec leur jour : celles d'un autre jour ne s'affichent jamais.
  const [loaded, setLoaded] = useState<{ day: string; sales: DaySale[] } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Ce qui est tapé dans chaque case, par produit.
  const [entries, setEntries] = useState<Record<string, string>>(() => kept?.entries ?? {})
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<'entry' | 'recap'>(() => kept?.step ?? 'entry')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(() => kept?.saveError ?? null)
  const [entryError, setEntryError] = useState<string | null>(null)
  // En haut de l'écran : la fin de journée enregistrée, ou une saisie faite ailleurs.
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  // Identifiant de chaque ligne, par jour et par produit, gardé jusqu'à son enregistrement.
  const lineIds = useRef(kept?.lineIds ?? new Map<string, string>())
  const requestId = useRef(0)

  // La saisie en cours suit dans AppShell à chaque changement.
  useEffect(() => {
    keep.current = { day, entries, lineIds: lineIds.current, step, saveError }
  })

  // Lus au moment d'un échec ou d'un retour dans l'app, sans recréer load ni réabonner l'écouteur à chaque frappe.
  const latest = useRef({ onSessionExpired, day, days, entries, step })
  useEffect(() => {
    latest.current = { onSessionExpired, day, days, entries, step }
  })

  const load = useCallback((which: string) => {
    const id = ++requestId.current
    api.listDaySales(which).then(
      (sales) => {
        if (id !== requestId.current) return
        setLoaded({ day: which, sales })
        setLoadError(null)
      },
      (thrown: unknown) => {
        if (id !== requestId.current) return
        const kind = classifyApiError(thrown).kind
        if (kind === 'session') latest.current.onSessionExpired()
        else setLoadError(apiErrorMessage(kind))
      },
    )
  }, [])

  useEffect(() => {
    if (day !== '') load(day)
  }, [day, load])

  // Retour dans l'app : les ventes du jour ont pu être saisies sur un autre téléphone, et la date a pu changer (app
  // restée ouverte jusqu'au lendemain). Sans saisie en cours, l'écran passe au nouveau jour ; une saisie en cours garde
  // le sien, tant qu'il est encore proposé.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const { day: shown, days: offered, entries: typed, step: shownStep } = latest.current
      const fresh = salesDays(new Date(), FIRST_SALES_DAY)
      if (fresh[0]?.day === offered[0]?.day) {
        if (shown !== '') load(shown)
        return
      }
      setDays(fresh)
      const typing = shownStep === 'recap' || Object.values(typed).some((text) => text.trim() !== '')
      const next = typing && fresh.some((candidate) => candidate.day === shown) ? shown : (fresh[0]?.day ?? '')
      if (next !== shown) {
        setEntries({})
        setStep('entry')
        setEntryError(null)
        setSaveError(null)
        setNotice(null)
        setLoadError(null)
        setDay(next)
      } else if (next !== '') {
        load(next)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [load])

  const { products, errorKind, refresh } = catalog
  const sales = loaded !== null && loaded.day === day ? loaded.sales : null
  const active = (products ?? []).filter((product) => !product.archived)
  const soldIds = new Set((sales ?? []).map((sale) => sale.productId))
  const toEnter = active.filter((product) => !soldIds.has(product.id))
  const draft = readEntries(entries, toEnter.map((product) => product.id))
  const savedUnits = (sales ?? []).reduce((sum, sale) => sum + sale.units, 0)

  // Un récapitulatif dont toutes les lignes ont été enregistrées entre-temps (réponse perdue, autre téléphone) : retour
  // à la saisie, où « Déjà saisi » les montre.
  useEffect(() => {
    if (step === 'recap' && draft.lines.length === 0) setStep('entry')
  }, [step, draft.lines.length])

  function lineId(productId: string): string {
    const key = `${day}:${productId}`
    let id = lineIds.current.get(key)
    if (id === undefined) {
      id = crypto.randomUUID()
      lineIds.current.set(key, id)
    }
    return id
  }

  function changeDay(next: string) {
    if (next === day) return
    if (Object.values(entries).some((text) => text.trim() !== '') && !window.confirm(CHANGE_DAY)) return
    setEntries({})
    setStep('entry')
    setEntryError(null)
    setSaveError(null)
    setNotice(null)
    setLoadError(null)
    setDay(next)
  }

  function type(productId: string, text: string) {
    setEntryError(null)
    setEntries((current) => ({ ...current, [productId]: text }))
  }

  function validate() {
    setNotice(null)
    if (draft.invalidIds.length > 0) {
      // La case en rouge est peut-être cachée par la recherche.
      setQuery('')
      setEntryError(SOLD_INVALID_MESSAGE)
      return
    }
    if (draft.lines.length === 0) {
      setEntryError(NOTHING_SOLD_MESSAGE)
      return
    }
    setEntryError(null)
    setSaveError(null)
    setStep('recap')
  }

  async function save() {
    const lines = draft.lines.map((line) => ({ id: lineId(line.productId), productId: line.productId, quantity: line.quantity }))
    setSaving(true)
    setSaveError(null)
    try {
      const result = await api.recordSales({ day, lines, employee })
      if (result.status === 'recorded') {
        for (const line of lines) lineIds.current.delete(`${day}:${line.productId}`)
        setEntries({})
        setNotice({ ok: true, text: `Fin de journée enregistrée : ${formatDrinks(result.units)}.` })
      } else {
        const taken = new Set(result.products)
        const takenIds = new Set(toEnter.filter((product) => taken.has(product.name)).map((product) => product.id))
        setEntries((current) => Object.fromEntries(Object.entries(current).filter(([productId]) => !takenIds.has(productId))))
        setNotice({ ok: false, text: `Déjà saisi pour ce jour : ${result.products.join(', ')}. La liste est relue.` })
      }
      setStep('entry')
      load(day)
      onCatalogChanged()
      window.scrollTo(0, 0)
    } catch (thrown) {
      const kind = classifyApiError(thrown).kind
      if (kind === 'session') onSessionExpired()
      else setSaveError(kind === 'invalid' ? SALES_REFUSED : saveErrorMessage(kind))
    } finally {
      setSaving(false)
    }
  }

  const dayInfo = days.find((candidate) => candidate.day === day)
  if (dayInfo === undefined) {
    return (
      <section className="sales" aria-labelledby="sales-title">
        <h1 id="sales-title">Fin de journée</h1>
        <p className="muted">La fin de journée commence le {formatSaleDay(FIRST_SALES_DAY ?? '')}.</p>
      </section>
    )
  }

  if (step === 'recap' && draft.lines.length > 0) {
    const names = new Map(toEnter.map((product) => [product.id, product.name]))
    return (
      <section className="sales" aria-labelledby="sales-title">
        <h1 id="sales-title">Fin de journée</h1>
        <SalesRecap
          dayShort={dayInfo.short}
          lines={draft.lines.map((line) => ({ productId: line.productId, name: names.get(line.productId) ?? '', quantity: line.quantity }))}
          units={draft.units}
          saving={saving}
          error={saveError}
          onSave={() => void save()}
          onBack={() => {
            setSaveError(null)
            setStep('entry')
          }}
        />
      </section>
    )
  }

  const photoOf = new Map((products ?? []).map((product) => [product.id, product.photoPath]))
  const shown = filterProducts(toEnter, query)
  const ready = products !== null && sales !== null

  return (
    <section className="sales" aria-labelledby="sales-title">
      <h1 id="sales-title">Fin de journée</h1>
      <div className="field sales-day">
        <label htmlFor={dayId}>Jour des ventes</label>
        <select id={dayId} value={day} onChange={(event) => changeDay(event.target.value)}>
          {days.map((option) => (
            <option key={option.day} value={option.day}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'message message-ok' : 'message message-error'}>
          {notice.text}
        </p>
      )}
      {loadError && (
        <div className="message message-error sales-error">
          <p role="alert">{loadError}</p>
          <button type="button" onClick={() => load(day)}>
            Réessayer
          </button>
        </div>
      )}
      {errorKind && (
        <div className="message message-error sales-error">
          <p role="alert">{apiErrorMessage(errorKind)}</p>
          <button type="button" onClick={refresh}>
            Réessayer
          </button>
        </div>
      )}
      {!ready && loadError === null && !(products === null && errorKind !== null) && <p className="muted">Chargement…</p>}
      {ready && (
        <>
          {sales.length > 0 && (
            <>
              <h2 className="section-label">Déjà saisi</h2>
              <ul className="group sales-done" aria-label="Déjà saisi">
                {sales.map((sale) => {
                  const clock = formatClock(new Date(sale.createdAt))
                  return (
                    <li key={sale.id} className="sales-row">
                      <Thumb path={photoOf.get(sale.productId) ?? null} size={44} />
                      <span className="row-text" aria-hidden="true">
                        <span className="product-name">{sale.productName}</span>
                        <span className="sales-meta">{`${sale.employee} · ${clock}`}</span>
                      </span>
                      <span className="sales-amount kind-out" aria-hidden="true">
                        {formatDelta(-sale.units)}
                      </span>
                      <span className="visually-hidden sales-line">{`${sale.productName} : ${formatDrinks(sale.units)}, ${sale.employee}, ${clock}`}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          <h2 className="section-label">À saisir</h2>
          {toEnter.length > 0 && (
            <label className="search">
              <span className="visually-hidden">Rechercher un produit</span>
              <IconSearch size={18} />
              <input type="search" placeholder="Rechercher un produit" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          )}
          {active.length === 0 && <p className="muted">Aucun produit pour l'instant.</p>}
          {active.length > 0 && toEnter.length === 0 && <p className="muted">Tout est saisi pour ce jour.</p>}
          {toEnter.length > 0 && shown.length === 0 && <p className="muted">Aucun produit ne correspond.</p>}
          {shown.length > 0 && (
            <ul className="group sales-entry" aria-label="À saisir">
              {shown.map((product) => {
                const text = entries[product.id] ?? ''
                const invalid = parseSold(text).kind === 'invalid'
                return (
                  <li key={product.id} className="sales-row">
                    <Thumb path={product.photoPath} size={44} />
                    <span className="product-name sales-name">{product.name}</span>
                    <input
                      className="sales-input"
                      aria-label={`Vendus : ${product.name}`}
                      aria-invalid={invalid || undefined}
                      placeholder="vendus"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={text}
                      onFocus={selectAllSoon}
                      onChange={(event) => type(product.id, event.target.value)}
                    />
                  </li>
                )
              })}
            </ul>
          )}
          <p className="note sales-note">Une boisson manque ? « Stock » › « Nouveau produit », puis reviens ici.</p>
          <p className="sales-total">Total du jour : {formatDrinks(savedUnits + draft.units)}</p>
          {entryError && (
            <p role="alert" className="message message-error">
              {entryError}
            </p>
          )}
          {toEnter.length > 0 && (
            <button type="button" className="primary block" onClick={validate}>
              Valider
            </button>
          )}
        </>
      )}
    </section>
  )
}
