/**
 * ScanTestPage — Page de test du scan (jalon 0, jetable).
 *
 * Référence : docs/jalon-0-test-scan.md (protocole de test en boutique)
 *
 * Le porteur du projet scanne de vrais packs Metro ; chaque lecture affiche
 * le code, son format, l'heure et le nom trouvé par Open Food Facts. Le
 * rapport se copie pour être collé dans la conversation avec Claude.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { lookupProduct, type OffLookupResult } from '../off/openFoodFacts'
import { engineLabel } from '../scan/engine'
import { formatLabel } from '../scan/formats'
import { scannerErrorMessage } from '../scan/scannerErrors'
import { useBarcodeScanner } from '../scan/useBarcodeScanner'
import { codesCountLabel, formatScanReport, formatTime, lookupLabel, type ScanEntry } from './report'
import './ScanTestPage.css'

const HIT_FLASH_MS = 300

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

type CopyState = 'idle' | 'copied' | 'failed'

export default function ScanTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const [hit, setHit] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [reportText, setReportText] = useState('')
  const nextId = useRef(1)
  // Résultats Open Food Facts par code ; une erreur n'est pas gardée, pour réessayer à la lecture suivante.
  const lookups = useRef(new Map<string, OffLookupResult>())
  const pendingLookups = useRef(new Set<string>())
  const hitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (hitTimer.current) clearTimeout(hitTimer.current)
    },
    [],
  )

  const onDetect = useCallback((code: string, format: string) => {
    const cached = lookups.current.get(code)
    const entry: ScanEntry = { id: nextId.current++, code, format, at: new Date(), lookup: cached ?? 'pending' }
    setEntries((current) => [entry, ...current])

    setHit(true)
    if (hitTimer.current) clearTimeout(hitTimer.current)
    hitTimer.current = setTimeout(() => setHit(false), HIT_FLASH_MS)

    if (cached || pendingLookups.current.has(code)) return
    pendingLookups.current.add(code)
    void lookupProduct(code).then((result) => {
      pendingLookups.current.delete(code)
      if (result.status !== 'error') lookups.current.set(code, result)
      setEntries((current) =>
        current.map((e) => (e.code === code && e.lookup === 'pending' ? { ...e, lookup: result } : e)),
      )
    })
  }, [])

  const scanner = useBarcodeScanner({ videoRef, onDetect })
  const running = scanner.status === 'running'
  const starting = scanner.status === 'starting'

  const statusText =
    running && scanner.engine && scanner.resolution
      ? `Lecteur : ${engineLabel(scanner.engine)} · caméra ${scanner.resolution.width}×${scanner.resolution.height} · analyse ${scanner.lastDecodeMs ?? '–'} ms/image`
      : 'Lecteur : non démarré'

  async function copyReport() {
    const text = formatScanReport(entries, {
      now: new Date(),
      engine: scanner.engine,
      width: scanner.resolution?.width ?? null,
      height: scanner.resolution?.height ?? null,
      decodeMs: scanner.lastDecodeMs,
      standalone: isStandalone(),
      userAgent: navigator.userAgent,
    })
    setReportText(text)
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  function clearList() {
    setEntries([])
    setCopyState('idle')
  }

  return (
    <main className="scan-test">
      <header>
        <h1>ScanDrinks</h1>
        <p className="subtitle">Test du scan (jalon 0)</p>
      </header>

      <div className={hit ? 'viewfinder is-hit' : 'viewfinder'}>
        <video ref={videoRef} playsInline muted autoPlay aria-label="Image de la caméra" />
        <div className="aim" aria-hidden="true" />
      </div>

      <p role="status" className="reader">
        {statusText}
      </p>

      <button
        type="button"
        className="primary"
        disabled={starting}
        onClick={() => (running ? scanner.stop() : void scanner.start())}
      >
        {starting ? 'Démarrage…' : running ? 'Arrêter la caméra' : 'Démarrer la caméra'}
      </button>

      <p className="tip">Tiens le téléphone à 20-30 cm du code-barres, avec un bon éclairage.</p>

      {scanner.errorKind && (
        <p role="alert" className="error">
          {scannerErrorMessage(scanner.errorKind)}
        </p>
      )}

      <p className="count">{codesCountLabel(entries.length)}</p>
      <ol aria-label="Codes lus" className="entries">
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="entry-code">
              <strong>{entry.code}</strong> · {formatLabel(entry.format)} · {formatTime(entry.at)}
            </span>
            <span className="entry-name">{lookupLabel(entry.lookup)}</span>
          </li>
        ))}
      </ol>

      <div className="actions">
        <button type="button" onClick={() => void copyReport()}>
          Copier le rapport
        </button>
        <button type="button" onClick={clearList}>
          Effacer la liste
        </button>
      </div>

      {copyState === 'copied' && (
        <p role="status" className="note">
          Rapport copié. Colle-le dans la conversation avec Claude.
        </p>
      )}
      {copyState === 'failed' && (
        <div className="fallback">
          <p>Copie automatique impossible : sélectionne le texte ci-dessous et copie-le.</p>
          <textarea aria-label="Rapport à copier" readOnly rows={8} value={reportText} />
        </div>
      )}
    </main>
  )
}
