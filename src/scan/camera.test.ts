import { afterEach, describe, expect, test, vi } from 'vitest'
import { attachCamera, openCamera, stopCamera } from './camera'

// Faux objets du navigateur (caméra et balise vidéo), seule dépendance externe.
class FakeTrack extends EventTarget {
  stopped = false
  constructor(private readonly settings: MediaTrackSettings) {
    super()
  }
  getSettings() {
    return this.settings
  }
  stop() {
    this.stopped = true
  }
}

const fakeStream = (tracks: FakeTrack[]) =>
  ({ getTracks: () => tracks, getVideoTracks: () => tracks }) as unknown as MediaStream

function fakeVideo(videoWidth = 0, videoHeight = 0) {
  return {
    srcObject: null as unknown,
    played: false,
    videoWidth,
    videoHeight,
    async play() {
      this.played = true
    },
  }
}

const asVideo = (video: ReturnType<typeof fakeVideo>) => video as unknown as HTMLVideoElement

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('openCamera', () => {
  test('refuse hors adresse sécurisée (https)', async () => {
    vi.stubGlobal('isSecureContext', false)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
    await expect(openCamera()).rejects.toMatchObject({ name: 'InsecureContextError' })
  })

  test("refuse si le navigateur n'offre pas l'accès caméra", async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', {})
    await expect(openCamera()).rejects.toMatchObject({ name: 'InsecureContextError' })
  })

  test('demande la caméra arrière en 1280×720 et renvoie le flux', async () => {
    const stream = fakeStream([new FakeTrack({})])
    const getUserMedia = vi.fn(async () => stream)
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    await expect(openCamera()).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
  })
})

describe('attachCamera', () => {
  test('branche le flux, lance la lecture et renvoie la taille de la piste', async () => {
    const stream = fakeStream([new FakeTrack({ width: 1280, height: 720 })])
    const video = fakeVideo()
    const size = await attachCamera(asVideo(video), stream)
    expect(video.srcObject).toBe(stream)
    expect(video.played).toBe(true)
    expect(size).toEqual({ width: 1280, height: 720 })
  })

  test('sans taille dans les réglages de la piste, prend celle de la vidéo', async () => {
    const size = await attachCamera(asVideo(fakeVideo(640, 480)), fakeStream([new FakeTrack({})]))
    expect(size).toEqual({ width: 640, height: 480 })
  })

  test("si play() échoue, le flux est arrêté, la vidéo détachée et l'erreur relancée", async () => {
    const track = new FakeTrack({})
    const video = fakeVideo()
    video.play = async () => { throw Object.assign(new Error('refus'), { name: 'NotAllowedError' }) }
    await expect(attachCamera(asVideo(video), fakeStream([track]))).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(track.stopped).toBe(true)
    expect(video.srcObject).toBeNull()
  })
})

describe('stopCamera', () => {
  test('arrête toutes les pistes', () => {
    const a = new FakeTrack({})
    const b = new FakeTrack({})
    stopCamera(fakeStream([a, b]))
    expect([a.stopped, b.stopped]).toEqual([true, true])
  })

  test('sans flux, ne fait rien', () => {
    expect(() => stopCamera(null)).not.toThrow()
  })
})
