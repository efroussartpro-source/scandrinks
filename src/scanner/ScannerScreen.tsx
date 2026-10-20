/**
 * ScannerScreen.tsx — Écran principal : viseur, modes Entrée/Sortie, fiche et messages.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §7)
 *
 * La logique vit dans scanFlow.ts ; cet écran fait les appels réseau selon
 * l'étape obtenue et affiche le résultat. La caméra tourne en continu tant
 * que l'écran est actif, même pendant qu'une fiche est affichée : le scan
 * suivant est prêt aussitôt. Sur un autre onglet ou dans les Réglages, elle
 * s'arrête, mais l'écran reste monté : la fiche en cours est gardée.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { classifyApiError, type ApiErrorKind } from '../data/apiErrors'
import { api } from '../data/supabaseClient'
import type { ScanMode } from '../domain/stock'
import { lookupProduct, type OffLookupResult } from '../off/openFoodFacts'
import AttachForm from '../products/AttachForm'
import ManualEntry from '../products/ManualEntry'
import NewProductForm from '../products/NewProductForm'
import '../products/Products.css'
import { scannerErrorMessage } from '../scan/scannerErrors'
import { useBarcodeScanner } from '../scan/useBarcodeScanner'
import ConfirmCard from './ConfirmCard'
import { loadMode, saveMode } from './mode'
import Notice from './Notice'
import { flowReducer, initialFlow, type ConfirmTarget, type Notice as FlowNotice } from './scanFlow'
import './Scanner.css'

const NOTICE_MS = 5000

type SavedNotice = Extract<FlowNotice, { kind: 'saved' }>
type CaptureHandler = (rawValue: string, format: string) => void

interface ScannerScreenProps {
  employee: string
  active: boolean
  onSessionExpired: () => void
  onCatalogChanged: () => void
}

export default function ScannerScreen({ employee, active, onSessionExpired, onCatalogChanged }: ScannerScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [flow, dispatch] = useReducer(flowReducer, initialFlow)
  const [mode, setMode] = useState<ScanMode>(() => loadMode())
  const [offResults, setOffResults] = useState<Record<string, OffLookupResult>>({})
  const offRequested = useRef(new Set<string>())

  // Valeurs lues au moment d'un envoi, sans relancer les effets quand elles changent.
  const latest = useRef({ mode, employee, onSessionExpired, onCatalogChanged })
  useEffect(() => {
    latest.current = { mode, employee, onSessionExpired, onCatalogChanged }
  })

  const failWith = useCallback((error: unknown): ApiErrorKind => {
    const kind = classifyApiError(error).kind
    if (kind === 'session') latest.current.onSessionExpired()
    return kind
  }, [])

  // Pendant la capture d'une canette (formulaire « Nouveau produit »), les codes lus vont au formulaire.
  const captureRef = useRef<CaptureHandler | null>(null)
  const setCapture = useCallback((handler: CaptureHandler | null) => {
    captureRef.current = handler
  }, [])

  const onDetect = useCallback((rawValue: string, format: string) => {
    const capture = captureRef.current
    if (capture) capture(rawValue, format)
    else dispatch({ type: 'code_read', rawValue, format, at: Date.now() })
  }, [])
  const scanner = useBarcodeScanner({ videoRef, onDetect })
  const startCamera = scanner.start
  const stopCamera = scanner.stop

  useEffect(() => {
    if (active) void startCamera()
    else stopCamera()
  }, [active, startCamera, stopCamera])

  // Code lu : recherche dans la base.
  const lookupCode = flow.step === 'looking_up' ? flow.code : null
  useEffect(() => {
    if (lookupCode === null) return
    api.lookupBarcode(lookupCode).then(
      (result) => dispatch({ type: 'lookup_done', code: lookupCode, result, movementId: crypto.randomUUID() }),
      (error: unknown) => dispatch({ type: 'lookup_failed', code: lookupCode, kind: failWith(error) }),
    )
  }, [lookupCode, failWith])

  // Code inconnu : nom proposé par Open Food Facts, demandé une fois par code (sauf échec).
  const unknownCode = flow.step === 'unknown' ? flow.code : null
  useEffect(() => {
    if (unknownCode === null || offRequested.current.has(unknownCode)) return
    offRequested.current.add(unknownCode)
    void lookupProduct(unknownCode).then((result) => {
      if (result.status === 'error') offRequested.current.delete(unknownCode)
      setOffResults((current) => ({ ...current, [unknownCode]: result }))
    })
  }, [unknownCode])

  // « Valider » ou « Réessayer » : envoi avec l'identifiant gardé par l'automate.
  const savingRequest = flow.step === 'confirm' && flow.status === 'saving' ? flow : null
  useEffect(() => {
    if (savingRequest === null) return
    const { target, quantity, movementId } = savingRequest
    api
      .recordMovement({
        id: movementId,
        productId: target.product.id,
        code: target.code,
        mode: latest.current.mode,
        units: target.units,
        quantity,
        employee: latest.current.employee,
      })
      .then(
        (result) => {
          dispatch({ type: 'save_done', delta: result.delta, stock: result.stock, at: Date.now() })
          latest.current.onCatalogChanged()
        },
        (error: unknown) => dispatch({ type: 'save_failed', kind: failWith(error) }),
      )
  }, [savingRequest, failWith])

  // Chaque message disparaît au bout de 5 s, sauf pendant une annulation.
  const notice = flow.step === 'scanning' ? flow.notice : null
  const undoing = flow.step === 'scanning' && flow.undoing === true
  useEffect(() => {
    if (notice === null || undoing) return
    const timer = setTimeout(() => dispatch({ type: 'notice_expired' }), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice, undoing])

  // Pendant l'annulation, l'automate ne relit aucun code : son résultat s'affiche toujours.
  const undo = useCallback(
    async (saved: SavedNotice) => {
      dispatch({ type: 'undo_started' })
      try {
        const result = await api.cancelMovement(saved.movementId, latest.current.employee)
        dispatch({ type: 'undo_done', productName: saved.productName, stock: result.stock, packSize: saved.packSize })
        latest.current.onCatalogChanged()
      } catch (error) {
        dispatch({ type: 'undo_failed', kind: failWith(error) })
      }
    },
    [failWith],
  )

  function changeMode(next: ScanMode) {
    setMode(next)
    saveMode(next)
  }

  // Pendant l'envoi ou après un échec, le mode ne change plus : on réessaie ce qui était affiché.
  const modeLocked = flow.step === 'confirm' && flow.status !== 'idle'
  const close = () => dispatch({ type: 'close' })
  const ready = (target: ConfirmTarget) => dispatch({ type: 'product_ready', target, movementId: crypto.randomUUID() })
  const offName = (code: string) => {
    const result = offResults[code]
    return result?.status === 'found' ? result.suggestedName : null
  }

  function renderPanel() {
    switch (flow.step) {
      case 'scanning':
        return (
          <>
            {flow.notice && (
              <Notice
                notice={flow.notice}
                undoing={undoing}
                onUndo={() => {
                  if (flow.notice?.kind === 'saved' && !undoing) void undo(flow.notice)
                }}
              />
            )}
            <p className="muted">Vise le code-barres du pack ou de la bouteille.</p>
            <button type="button" onClick={() => dispatch({ type: 'open_manual' })}>
              Saisie manuelle
            </button>
          </>
        )
      case 'looking_up':
        return (
          <>
            <p className="muted">Recherche du code…</p>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </>
        )
      case 'confirm':
        return (
          <ConfirmCard
            state={flow}
            mode={mode}
            onQuantity={(quantity) => dispatch({ type: 'set_quantity', quantity })}
            onValidate={() => dispatch({ type: 'validate' })}
            onClose={close}
          />
        )
      case 'unknown': {
        const name = offName(flow.code)
        return (
          <section className="card" aria-label="Code inconnu">
            <h2 className="card-title">Code inconnu : {flow.code}</h2>
            {name !== null && <p>Open Food Facts : {name}</p>}
            {offResults[flow.code] === undefined && <p className="muted">Recherche du nom…</p>}
            <button type="button" className="primary" onClick={() => dispatch({ type: 'choose_new_product' })}>
              Nouveau produit
            </button>
            <button type="button" onClick={() => dispatch({ type: 'choose_attach' })}>
              Ajouter à un produit existant
            </button>
            <button type="button" onClick={close}>
              Annuler
            </button>
          </section>
        )
      }
      case 'new_product':
        return (
          <NewProductForm
            code={flow.code}
            off={offResults[flow.code]}
            setCapture={setCapture}
            onReady={ready}
            onAttachToExisting={(product) => dispatch({ type: 'choose_attach', product })}
            onCancel={close}
            onSessionExpired={onSessionExpired}
          />
        )
      case 'attach':
        return (
          <AttachForm
            code={flow.code}
            preselected={flow.product}
            offName={offName(flow.code)}
            onReady={ready}
            onCancel={close}
            onSessionExpired={onSessionExpired}
          />
        )
      case 'manual':
        return <ManualEntry onReady={ready} onCancel={close} onSessionExpired={onSessionExpired} />
    }
  }

  return (
    <section className="scanner">
      <div className="viewfinder">
        <video ref={videoRef} playsInline muted autoPlay aria-label="Image de la caméra" />
        <div className="aim" aria-hidden="true" />
      </div>
      {scanner.status === 'error' && scanner.errorKind && (
        <div className="camera-problem">
          <p role="alert" className="message message-error">
            {scannerErrorMessage(scanner.errorKind)}
          </p>
          <button type="button" onClick={() => void startCamera()}>
            Démarrer la caméra
          </button>
        </div>
      )}
      <div className="modes" role="group" aria-label="Mode">
        <button type="button" className="mode mode-in" aria-pressed={mode === 'in'} disabled={modeLocked} onClick={() => changeMode('in')}>
          Entrée +
        </button>
        <button type="button" className="mode mode-out" aria-pressed={mode === 'out'} disabled={modeLocked} onClick={() => changeMode('out')}>
          Sortie −
        </button>
      </div>
      <div className="panel">{renderPanel()}</div>
    </section>
  )
}
