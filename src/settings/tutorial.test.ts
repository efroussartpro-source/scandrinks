import { expect, test } from 'vitest'
import page from '../../public/tutoriel/index.html?raw'
import playlist from '../../public/tutoriel/video/tutoriel.m3u8?raw'
import { TUTORIAL_LENGTH_NOTE, TUTORIAL_LOAD_ERROR, TUTORIAL_PLAYLIST, TUTORIAL_POSTER } from './tutorial'

// Les segments présents dans le dossier de la vidéo, par leur nom (seg-000.m4s…).
const segmentFiles = Object.keys(import.meta.glob('../../public/tutoriel/video/*.m4s'))
  .map((path) => path.split('/').pop() ?? path)
  .sort()

test("la page /tutoriel/ est en français et lit la vidéo de l'app sans rien charger avant le toucher", () => {
  expect(page).toContain('<html lang="fr">')
  expect(page).toContain(`src="${TUTORIAL_PLAYLIST}"`)
  expect(page).toContain(`poster="${TUTORIAL_POSTER}"`)
  expect(page).toContain('preload="none"')
  expect(page).toContain('playsinline')
  expect(page).toContain(TUTORIAL_LENGTH_NOTE)
})

test("la page /tutoriel/ mène à l'app et prévoit ses deux messages", () => {
  expect(page).toMatch(/<a href="\/">Ouvrir ScanDrinks<\/a>/)
  expect(page).toContain('Ouvre cette page sur un iPhone pour voir la vidéo.')
  expect(page).toContain(TUTORIAL_LOAD_ERROR)
})

test("la liste HLS est une vidéo complète, avec son segment d'initialisation", () => {
  expect(playlist).toContain('#EXT-X-PLAYLIST-TYPE:VOD')
  expect(playlist).toContain('#EXT-X-MAP:URI="init.mp4"')
  expect(playlist).toContain('#EXT-X-ENDLIST')
})

test('la liste HLS cite exactement les segments présents', () => {
  const listed = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^seg-\d{3}\.m4s$/.test(line))
    .sort()
  expect(listed.length).toBeGreaterThan(0)
  expect(listed).toEqual(segmentFiles)
})
