/**
 * Thumb.tsx — Photo d'un produit ou d'un code, posée sur sa plaque claire.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.7)
 *
 * L'adresse est src (une image d'Open Food Facts, une photo qui vient d'être
 * prise), sinon le lien signé de path. L'image est toujours entière, jamais
 * coupée, sur la plaque claire, de jour comme de nuit. Sans image, ou si elle
 * ne se charge pas (fichier absent, lien expiré, réseau coupé), la plaque
 * montre une icône de boisson, jamais l'image cassée du navigateur ; sur une
 * grande plaque (emptyLabel), avec « Pas de photo » dessous.
 * Taille : un carré de size pixels, ou toute la place de son parent (fill),
 * qui fixe alors la taille et l'arrondi de la plaque.
 * Décorative : le nom du produit est toujours écrit à côté.
 */
import { useState, type CSSProperties } from 'react'
import { IconCupSoda } from '../ui/icons'
import { usePhotoUrl } from './usePhotoUrl'
import './Photos.css'

interface ThumbProps {
  path?: string | null
  src?: string | null
  // Un carré de cette taille, en pixels.
  size?: number
  // Sans size : la photo prend toute la place de son parent (une plaque).
  fill?: boolean
  // « Pas de photo » sous l'icône, pour une plaque de 100 px de haut au moins (spec §6.7).
  emptyLabel?: boolean
  // Appelé quand l'image ne se charge pas.
  onError?: () => void
}

export default function Thumb({ path = null, src = null, size, fill = false, emptyLabel = false, onError }: ThumbProps) {
  const signed = usePhotoUrl(src ? null : path)
  const url = src || signed
  // Adresse qui n'a pas pu se charger ; une autre adresse (lien renouvelé) est réessayée.
  const [failed, setFailed] = useState<string | null>(null)
  const square = !fill && size !== undefined
  const style: CSSProperties | undefined = square ? { width: size, height: size, borderRadius: size >= 60 ? 14 : 10 } : undefined
  const className = fill ? 'thumb thumb-fill' : 'thumb'

  if (!url || failed === url) {
    return (
      <span className={`${className} thumb-empty`} aria-hidden="true" style={style}>
        <IconCupSoda size={square ? Math.round(size / 2) : 36} strokeWidth={1.8} />
        {emptyLabel && <span className="thumb-empty-label">Pas de photo</span>}
      </span>
    )
  }
  return (
    <img
      className={className}
      src={url}
      alt=""
      width={square ? size : undefined}
      height={square ? size : undefined}
      loading="lazy"
      style={style}
      onError={() => {
        setFailed(url)
        onError?.()
      }}
    />
  )
}
