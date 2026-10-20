import { expect, test } from 'vitest'
import html from '../../index.html?raw'
import appleTouchIcon from '../../public/apple-touch-icon.png?inline'
import icon192 from '../../public/icon-192.png?inline'
import icon512 from '../../public/icon-512.png?inline'
import manifestText from '../../public/manifest.webmanifest?raw'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// Largeur et hauteur d'un PNG, lues dans l'en-tête IHDR qui suit la signature.
function pngSize(dataUrl: string): [number, number] {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (char) => char.charCodeAt(0))
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  expect(String.fromCharCode(...bytes.subarray(12, 16))).toBe('IHDR')
  const view = new DataView(bytes.buffer)
  return [view.getUint32(16), view.getUint32(20)]
}

test.each([
  ["apple-touch-icon.png (écran d'accueil de l'iPhone)", appleTouchIcon, 180],
  ['icon-192.png', icon192, 192],
  ['icon-512.png', icon512, 512],
])('%s mesure %i px de côté', (_name, dataUrl, size) => expect(pngSize(dataUrl)).toEqual([size, size]))

test('le manifeste déclare les icônes de 192 et 512 px', () => {
  expect(JSON.parse(manifestText).icons).toEqual([
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ])
})

test("index.html déclare l'icône et le nom de l'écran d'accueil de l'iPhone", () => {
  expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
  expect(html).toContain('<meta name="apple-mobile-web-app-title" content="ScanDrinks" />')
})
