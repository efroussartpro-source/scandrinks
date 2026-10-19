/**
 * camera.ts — Ouverture et fermeture de la caméra arrière.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2)
 * 1280×720 : assez fin pour un code-barres de pack à 20-30 cm, assez léger
 * pour que ZXing analyse plusieurs images par seconde sur iPhone.
 */

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
}

// En deux temps (ouvrir, puis brancher sur la vidéo), pour que le contrôleur
// puisse refermer un flux devenu inutile sans jamais l'afficher.
export async function openCamera(): Promise<MediaStream> {
  const mediaDevices = globalThis.navigator?.mediaDevices
  if (!globalThis.isSecureContext || !mediaDevices?.getUserMedia) {
    const error = new Error('La caméra exige une adresse sécurisée (https).')
    error.name = 'InsecureContextError'
    throw error
  }
  return mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
}

// Si la lecture ne démarre pas, la caméra est rendue tout de suite : un flux
// ouvert sans affichage laisserait le voyant allumé.
export async function attachCamera(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<{ width: number; height: number }> {
  try {
    video.srcObject = stream
    await video.play()
  } catch (error) {
    stopCamera(stream)
    detachVideo(video)
    throw error
  }

  const settings = stream.getVideoTracks()[0]?.getSettings() ?? {}
  return {
    width: settings.width ?? video.videoWidth,
    height: settings.height ?? video.videoHeight,
  }
}

export function detachVideo(video: HTMLVideoElement): void {
  video.srcObject = null
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
