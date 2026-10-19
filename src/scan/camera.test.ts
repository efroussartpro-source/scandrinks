import { afterEach, describe, expect, test, vi } from 'vitest'
import { startCamera, stopCamera } from './camera'

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

describe('startCamera', () => {
  test('refuse hors adresse sécurisée (https)', async () => {
    vi.stubGlobal('isSecureContext', false)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } })
    await expect(startCamera(asVideo(fakeVideo()))).rejects.toMatchObject({ name: 'InsecureContextError' })
  })

  test("refuse si le navigateur n'offre pas l'accès caméra", async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', {})
    await expect(startCamera(asVideo(fakeVideo()))).rejects.toMatchObject({ name: 'InsecureContextError' })
  })

  test('demande la caméra arrière en 1280×720, branche le flux et renvoie sa taille', async () => {
    const track = new FakeTrack({ width: 1280, height: 720 })
    const getUserMedia = vi.fn(async () => fakeStream([track]))
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    const video = fakeVideo()
    const result = await startCamera(asVideo(video))
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    })
    expect(video.srcObject).toBe(result.stream)
    expect(video.played).toBe(true)
    expect([result.width, result.height]).toEqual([1280, 720])
  })

  test('sans taille dans les réglages de la piste, prend celle de la vidéo', async () => {
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => fakeStream([new FakeTrack({})]) } })
    const result = await startCamera(asVideo(fakeVideo(640, 480)))
    expect([result.width, result.height]).toEqual([640, 480])
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
