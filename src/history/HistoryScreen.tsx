/**
 * HistoryScreen.tsx — Onglet Historique : tous les mouvements, du plus récent au plus ancien.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.5, RG-9)
 *
 * Chaque ligne montre le produit et la quantité dans la couleur du type, puis
 * le type, le moment et le prénom (maquette J-historique) ; VoiceOver lit la
 * phrase entière. Par pages de 50, avec « Voir plus ». La première page est relue à
 * l'ouverture de l'onglet et au retour dans l'app : la liste repart alors du
 * haut. Une réponse arrivée après une relecture plus récente est ignorée, et
 * une page suivante ne s'ajoute que si elle suit la liste affichée.
 * Toute ligne active s'annule, après confirmation. La base garde le premier
 * auteur : si un autre téléphone a annulé juste avant, c'est son prénom qui
 * s'affiche.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage, classifyApiError } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import { historyLine, historyParts, type HistoryMovement } from '../domain/movements'
import { appendHistoryPage, markCancelled, type HistoryState } from './historyList'
import './History.css'

interface HistoryScreenProps {
  employee: string
  onCatalogChanged: () => void
  onSessionExpired: () => void
}

export default function HistoryScreen({ employee, onCatalogChanged, onSessionExpired }: HistoryScreenProps) {
  const [history, setHistory] = useState<HistoryState | null>(null)
  // Première page illisible, ou échec de « Voir plus » ou d'une annulation.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const requestId = useRef(0)

  // Lu au moment d'un échec, sans recréer reload quand il change.
  const latest = useRef({ onSessionExpired })
  useEffect(() => {
    latest.current = { onSessionExpired }
  })

  const fail = useCallback((thrown: unknown, show: (message: string) => void) => {
    const kind = classifyApiError(thrown).kind
    if (kind === 'session') latest.current.onSessionExpired()
    else show(apiErrorMessage(kind))
  }, [])

  // Première page : la liste repart du haut.
  const reload = useCallback(() => {
    const id = ++requestId.current
    api.listHistory(null).then(
      (page) => {
        if (id !== requestId.current) return
        setHistory({ movements: page.movements, next: page.next })
        setLoadError(null)
        setError(null)
      },
      (thrown: unknown) => {
        if (id === requestId.current) fail(thrown, setLoadError)
      },
    )
  }, [fail])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [reload])

  function loadMore() {
    const cursor = history?.next ?? null
    if (cursor === null || loadingMore) return
    setLoadingMore(true)
    setError(null)
    api.listHistory(cursor).then(
      (page) => {
        setLoadingMore(false)
        setHistory((current) => current && appendHistoryPage(current, cursor, page))
      },
      (thrown: unknown) => {
        setLoadingMore(false)
        fail(thrown, setError)
      },
    )
  }

  async function cancel(movement: HistoryMovement, line: string) {
    if (!window.confirm(`Annuler ce mouvement ?\n${line}\nLe stock sera recalculé.`)) return
    setCancelling(true)
    setError(null)
    try {
      const result = await api.cancelMovement(movement.id, employee)
      setHistory(
        (current) => current && { ...current, movements: markCancelled(current.movements, movement.id, result.cancelledAt, result.cancelledBy) },
      )
      onCatalogChanged()
    } catch (thrown) {
      fail(thrown, setError)
    } finally {
      setCancelling(false)
    }
  }

  const movements = history?.movements ?? null
  const next = history?.next ?? null
  const now = new Date()

  return (
    <section className="history" aria-labelledby="history-title">
      <h1 id="history-title">Historique</h1>
      {loadError && (
        <div className="message message-error history-error">
          <p role="alert">{loadError}</p>
          <button type="button" onClick={reload}>
            Réessayer
          </button>
        </div>
      )}
      {movements === null && loadError === null && <p className="muted">Chargement…</p>}
      {movements !== null && movements.length === 0 && <p className="muted">Aucun mouvement pour l'instant.</p>}
      {movements !== null && movements.length > 0 && (
        <ul className="group history-list" aria-label="Historique">
          {movements.map((movement) => {
            const line = historyLine(movement, now)
            const { title, amount, meta } = historyParts(movement, now)
            const cancelled = movement.cancelledAt !== null
            return (
              <li key={movement.id} className={cancelled ? 'cancelled' : undefined}>
                <span className="history-visual" aria-hidden="true">
                  <span className="history-top">
                    <span className="history-title">{title}</span>
                    <span className={`history-amount kind-${movement.kind}`}>{amount}</span>
                  </span>
                  <span className="history-meta">{meta}</span>
                </span>
                <span className="visually-hidden history-line">{line}</span>
                {!cancelled && (
                  <button
                    type="button"
                    className="link"
                    aria-label={`Annuler : ${line}`}
                    disabled={cancelling}
                    onClick={() => void cancel(movement, line)}
                  >
                    Annuler
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="message message-error">
          {error}
        </p>
      )}
      {next !== null && (
        <button type="button" className="block" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? 'Chargement…' : 'Voir plus'}
        </button>
      )}
    </section>
  )
}
