import { expect, test } from 'vitest'
import { fitWithin, isOffImageUrl, photoPath, photoSourceLabel } from './photos'

test('photoPath : une image par nom, dans le dossier de son code', () => {
  expect(photoPath('5449000000996', 'abc')).toBe('codes/5449000000996/abc.jpg')
})

// 480 px de côté au plus, sans jamais agrandir ; proportions gardées, côtés arrondis, 1 px au moins.
test.each([
  [1280, 720, 480, 270], [600, 400, 480, 320], [400, 600, 320, 480], [16, 16, 16, 16], [4000, 1, 480, 1],
])('fitWithin(%i, %i) = %i × %i', (width, height, fittedWidth, fittedHeight) => {
  expect(fitWithin(width, height)).toEqual({ width: fittedWidth, height: fittedHeight })
})

test("isOffImageUrl : seulement les images d'Open Food Facts, en https", () => {
  expect(isOffImageUrl('https://images.openfoodfacts.org/images/products/544/900/000/0996/front_fr.4.400.jpg')).toBe(true)
  expect(['http://images.openfoodfacts.org/images/x.jpg', 'https://images.openfoodfacts.org.evil.example/x.jpg',
    'https://example.org/x.jpg', 42].map((url) => isOffImageUrl(url))).toEqual([false, false, false, false])
})

test("photoSourceLabel : d'où vient l'image d'un code", () => {
  expect([photoSourceLabel('off'), photoSourceLabel('equipe')]).toEqual(['Image : Open Food Facts', "photo de l'équipe"])
})
