/**
 * jpeg.ts — Conversion d'une image en JPEG de 480 px de côté au plus (navigateur seulement).
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.7, §6.3)
 *
 * Une photo d'iPhone (12 Mpx, HEIC ou JPEG) passe par une balise <img> : le
 * navigateur la décode et la redresse selon son orientation EXIF. La caméra
 * du Scanner donne l'image en cours de sa vidéo. Les deux sont dessinées dans
 * un canvas à la taille réduite, puis enregistrées en JPEG de qualité 0,8.
 * Testé de bout en bout (scénario S), faute de canvas dans les tests unitaires.
 */
import { fitWithin, PHOTO_QUALITY } from './photos'

export async function toJpeg(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const size = fitWithin(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas indisponible')
  context.drawImage(source, 0, 0, size.width, size.height)
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
  if (!jpeg) throw new Error('Conversion en JPEG impossible')
  return jpeg
}

export async function blobToJpeg(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return await toJpeg(image, image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// null tant que la caméra n'a pas encore d'image.
export async function frameToJpeg(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) return null
  return toJpeg(video, video.videoWidth, video.videoHeight)
}
