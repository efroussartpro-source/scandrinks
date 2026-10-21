/**
 * Thumb.tsx — Vignette carrée de l'image d'un produit ou d'un code.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.7)
 *
 * L'adresse est src (une image d'Open Food Facts, une photo qui vient d'être
 * prise), sinon le lien signé de path. Sans image, ou si elle ne se charge pas
 * (fichier absent, lien expiré, réseau coupé), la vignette montre l'icône
 * grise du produit, jamais l'image cassée du navigateur (maquette I-stock).
 * Décorative : le nom du produit est toujours écrit à côté.
 */
import { useState, type CSSProperties } from 'react'
import { IconPackage } from '../ui/icons'
import { usePhotoUrl } from './usePhotoUrl'
import './Photos.css'

interface ThumbProps {
  path?: string | null
  src?: string | null
  size: number
  // Appelé quand l'image ne se charge pas.
  onError?: () => void
}

export default function Thumb({ path = null, src = null, size, onError }: ThumbProps) {
  const signed = usePhotoUrl(src ? null : path)
  const url = src || signed
  // Adresse qui n'a pas pu se charger ; une autre adresse (lien renouvelé) est réessayée.
  const [failed, setFailed] = useState<string | null>(null)
  const style: CSSProperties = { width: size, height: size, borderRadius: size >= 60 ? 12 : 10 }

  if (!url || failed === url) {
    return (
      <span className="thumb thumb-empty" aria-hidden="true" style={style}>
        <IconPackage size={Math.round(size / 2)} strokeWidth={1.8} />
      </span>
    )
  }
  return (
    <img
      className="thumb"
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={style}
      onError={() => {
        setFailed(url)
        onError?.()
      }}
    />
  )
}
