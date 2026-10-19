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

export async function startCamera(
  video: HTMLVideoElement,
): Promise<{ stream: MediaStream; width: number; height: number }> {
  const mediaDevices = globalThis.navigator?.mediaDevices
  if (!globalThis.isSecureContext || !mediaDevices?.getUserMedia) {
    const error = new Error('La caméra exige une adresse sécurisée (https).')
    error.name = 'InsecureContextError'
    throw error
  }

  const stream = await mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
  video.srcObject = stream
  await video.play()

  const settings = stream.getVideoTracks()[0]?.getSettings() ?? {}
  return {
    stream,
    width: settings.width ?? video.videoWidth,
    height: settings.height ?? video.videoHeight,
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}
