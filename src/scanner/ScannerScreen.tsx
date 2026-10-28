/**
 * ScannerScreen.tsx — Écran principal : modes Entrée/Sortie/Inventaire, caméra, fiche et messages.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §6.7, §7)
 *
 * La logique vit dans scanFlow.ts ; cet écran fait les appels réseau selon
 * l'étape obtenue et affiche le résultat. La caméra tourne en continu tant
 * que l'écran est actif, même pendant qu'une fiche est affichée : le scan
 * suivant est prêt aussitôt. Sur un autre onglet ou dans les Réglages, elle
 * s'arrête, mais l'écran reste monté : la fiche en cours est gardée.
 * Design « Vitrine » (§6.7, maquettes C2) : la caméra occupe le haut de
 * l'écran, l'en-tête et le sélecteur de mode sont posés dessus, sur le voile
 * sombre ; tout ce qui suit un scan s'ouvre dans le panneau blanc du bas. La
 * caméra est pleine au scan, à moitié pour une fiche courte, petite pour une
 * fiche à remplir (data-size).
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
import { frameToJpeg } from '../photos/jpeg'
import { scannerErrorMessage } from '../scan/scannerErrors'
import { useBarcodeScanner } from '../scan/useBarcodeScanner'
import { useScreenWakeLock } from '../scan/useScreenWakeLock'
import { IconBarcode, IconKeyboard, IconPlus } from '../ui/icons'
import ArchivedCard from './ArchivedCard'
import ConfirmCard from './ConfirmCard'
import CountCard from './CountCard'
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
  // Photo d'un code, prise avec la caméra du Scanner : l'image en cours de la vidéo.
  const takeFrame = useCallback(() => frameToJpeg(videoRef.current), [])
  const startCamera = scanner.start
  const stopCamera = scanner.stop

  useEffect(() => {
    if (active) void startCamera()
    else stopCamera()
  }, [active, startCamera, stopCamera])

  // L'écran reste allumé tant que le Scanner est à l'écran et que la caméra tourne.
  useScreenWakeLock(active && scanner.status === 'running')

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

  // « Valider » ou « Réessayer » : envoi avec l'identifiant gardé par l'automate. Le mode ne
  // change pas pendant l'envoi : en Inventaire, le nombre compté est celui retenu à l'envoi.
  const savingRequest = flow.step === 'confirm' && flow.status === 'saving' ? flow : null
  useEffect(() => {
    if (savingRequest === null) return
    const { target, quantity, movementId, counted } = savingRequest
    const { mode: currentMode, employee: currentEmployee } = latest.current
    if (currentMode === 'inventory' && counted === null) {
      // Ne devrait pas arriver : « Valider » attend un comptage valide.
      dispatch({ type: 'save_failed', kind: 'invalid' })
      return
    }
    const request =
      currentMode === 'inventory'
        ? api.recordInventory({ id: movementId, productId: target.product.id, counted: counted ?? 0, employee: currentEmployee })
        : api.recordMovement({
            id: movementId,
            productId: target.product.id,
            code: target.code,
            mode: currentMode,
            units: target.units,
            quantity,
            employee: currentEmployee,
          })
    request.then(
        (result) => {
          dispatch({ type: 'save_done', delta: result.delta, stock: result.stock, at: Date.now() })
          latest.current.onCatalogChanged()
        },
        (error: unknown) => dispatch({ type: 'save_failed', kind: failWith(error) }),
      )
  }, [savingRequest, failWith])

  // Produit archivé : réactivation, puis fiche de confirmation (RG-11).
  const reactivating = flow.step === 'archived' && flow.status === 'saving' ? flow : null
  useEffect(() => {
    if (reactivating === null) return
    api.setArchived(reactivating.target.product.id, false).then(
      (product) => {
        dispatch({ type: 'reactivate_done', product })
        latest.current.onCatalogChanged()
      },
      (error: unknown) => dispatch({ type: 'reactivate_failed', kind: failWith(error) }),
    )
  }, [reactivating, failWith])

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
  // Fiche créée ou code ajouté : le catalogue a changé.
  const readyAfterChange = (target: ConfirmTarget) => {
    ready(target)
    onCatalogChanged()
  }
  const offName = (code: string) => {
    const result = offResults[code]
    return result?.status === 'found' ? result.suggestedName : null
  }
  const offImage = (code: string) => {
    const result = offResults[code]
    return result?.status === 'found' ? result.imageUrl : null
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
            <button type="button" className="plain block with-icon" onClick={() => dispatch({ type: 'open_manual' })}>
              <IconKeyboard size={20} />
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
        return mode === 'inventory' ? (
          <CountCard key={flow.movementId} state={flow} onValidate={(counted) => dispatch({ type: 'validate', counted })} onClose={close} />
        ) : (
          <ConfirmCard
            state={flow}
            mode={mode}
            onQuantity={(quantity) => dispatch({ type: 'set_quantity', quantity })}
            onValidate={() => dispatch({ type: 'validate' })}
            onClose={close}
          />
        )
      case 'archived':
        return <ArchivedCard state={flow} onReactivate={() => dispatch({ type: 'reactivate' })} onClose={close} />
      case 'unknown': {
        const name = offName(flow.code)
        return (
          <section className="card unknown-card" aria-label="Code inconnu">
            <div className="unknown-head">
              <span className="unknown-icon tile-plate" aria-hidden="true">
                <IconBarcode size={28} />
              </span>
              <h2 className="card-title">Code inconnu : {flow.code}</h2>
            </div>
            {name !== null && <p className="off-name">Open Food Facts : {name}</p>}
            {offResults[flow.code] === undefined && <p className="muted">Recherche du nom…</p>}
            <button type="button" className="primary block with-icon" onClick={() => dispatch({ type: 'choose_new_product' })}>
              <IconPlus size={20} strokeWidth={2.4} />
              Nouveau produit
            </button>
            <button type="button" className="plain block" onClick={() => dispatch({ type: 'choose_attach' })}>
              Ajouter à un produit existant
            </button>
            <button type="button" className="link" onClick={close}>
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
            takeFrame={takeFrame}
            setCapture={setCapture}
            onReady={readyAfterChange}
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
            photo={{ offImageUrl: offImage(flow.code), takeFrame }}
            onReady={readyAfterChange}
            onCancel={close}
            onSessionExpired={onSessionExpired}
          />
        )
      case 'manual':
        return <ManualEntry mode={mode} onReady={ready} onCancel={close} onSessionExpired={onSessionExpired} />
    }
  }

  // Taille de la caméra (§6.7) : pleine au scan ; à moitié pour une fiche courte ; petite pour une fiche à remplir,
  // qui laisse ainsi la place à ses champs.
  const size =
    flow.step === 'scanning'
      ? 'full'
      : flow.step === 'new_product' || flow.step === 'attach' || flow.step === 'manual' || (flow.step === 'confirm' && mode === 'inventory')
        ? 'small'
        : 'half'

  return (
    <section className="scanner" data-size={size}>
      <div className="viewfinder" data-size={size}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Image de la caméra" />
        <div className="segmented modes" role="group" aria-label="Mode">
          <button type="button" className="mode mode-in" aria-pressed={mode === 'in'} disabled={modeLocked} onClick={() => changeMode('in')}>
            Entrée +
          </button>
          <button type="button" className="mode mode-out" aria-pressed={mode === 'out'} disabled={modeLocked} onClick={() => changeMode('out')}>
            Sortie −
          </button>
          <button
            type="button"
            className="mode mode-inv"
            aria-pressed={mode === 'inventory'}
            disabled={modeLocked}
            onClick={() => changeMode('inventory')}
          >
            Inventaire =
          </button>
        </div>
        <span className="corner corner-tl" aria-hidden="true" />
        <span className="corner corner-tr" aria-hidden="true" />
        <span className="corner corner-bl" aria-hidden="true" />
        <span className="corner corner-br" aria-hidden="true" />
        {flow.step === 'scanning' && <p className="aim-hint">Vise le code-barres du pack ou de la bouteille.</p>}
      </div>
      <div className="panel">
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
        {renderPanel()}
      </div>
    </section>
  )
}
