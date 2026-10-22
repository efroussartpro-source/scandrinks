import { expect, test } from 'vitest'
import page from '../../public/tutoriel/index.html?raw'
import playlist from '../../public/tutoriel/video/tutoriel.m3u8?raw'
import storyboard from '../../scripts/tutorial/storyboard.mjs?raw'
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

// La vidéo servie est la vraie, d'environ 3 minutes (mêmes bornes que scripts/tutorial/check.mjs) : npm run
// tutorial:trial la remplace par l'essai de 10 s, et rien d'autre ne le verrait.
test("la liste HLS est la vraie vidéo, de 150 à 240 s, et non la vidéo d'essai", () => {
  const seconds = [...playlist.matchAll(/^#EXTINF:([\d.]+),/gm)].reduce((total, match) => total + Number(match[1]), 0)
  expect(seconds).toBeGreaterThanOrEqual(150)
  expect(seconds).toBeLessThanOrEqual(240)
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

// Une ligne d'« À racheter » ne s'en va que si une entrée fait passer le stock au-dessus du seuil (§4.3, RG-5) :
// un seul pack reçu pour un produit épuisé la laisse dans la liste, et le film le montre (l'Oasis).
test("la vidéo tuto dit quand une ligne d'« À racheter » disparaît, comme la spec", () => {
  expect(storyboard).toContain("disparait: 'Une ligne disparaît quand une entrée fait passer le stock au-dessus du seuil.',")
  expect(storyboard).not.toContain("dès que l'entrée du produit est scannée")
})

test('le chapitre 3 de la vidéo montre la fin de journée et le nouveau rôle de « Sortie − » (jalon 5)', () => {
  const entree = storyboard.indexOf("key: 'entree'")
  const ventes = storyboard.indexOf("key: 'ventes',\n    title: 'Le soir : la fin de journée',")
  const nouveau = storyboard.indexOf("key: 'nouveau'")
  expect(entree).toBeGreaterThan(-1)
  expect(ventes).toBeGreaterThan(entree)
  expect(nouveau).toBeGreaterThan(ventes)
  expect(storyboard).toContain("sortie: 'Un pack porté au frigo ne se scanne plus. « Sortie − » : casse, périmé ou boisson offerte.',")
  expect(storyboard).not.toContain('sors un pack de la réserve')
})
