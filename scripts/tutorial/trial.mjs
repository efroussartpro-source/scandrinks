/**
 * trial.mjs — Vidéo d'essai de 10 s : vérifier la lecture HLS sur l'iPhone avant de tourner la vraie vidéo.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§9 « Mise en service », déroulé ; §10)
 *
 * Le fond vert de ScanDrinks, « ScanDrinks — essai de lecture » et un
 * compteur de secondes, encodés comme la vraie vidéo (hls.mjs). Les textes
 * passent par des fichiers : drawtext les lit sans qu'il faille échapper
 * « : » ni « — ». Sorties : dist-tutorial/essai.mp4, puis le HLS et l'image
 * d'attente (prise à 1 s) dans public/tutoriel/video/.
 *
 * Usage : npm run tutorial:trial (lance aussi le contrôle check.mjs --trial).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENCODE_ARGS, encodeHls, extractPoster, ffmpeg, interFont } from './hls.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const MP4 = join(ROOT, 'dist-tutorial', 'essai.mp4')
const VIDEO_DIR = join(ROOT, 'public', 'tutoriel', 'video')

mkdirSync(join(ROOT, 'dist-tutorial'), { recursive: true })
const tmp = mkdtempSync(join(tmpdir(), 'scandrinks-essai-'))
try {
  const title = join(tmp, 'titre.txt')
  const counter = join(tmp, 'compteur.txt')
  writeFileSync(title, 'ScanDrinks — essai de lecture')
  writeFileSync(counter, '%{eif:t:d} s')
  const bold = interFont('bold')
  const text = (file, size, y) => `drawtext=fontfile=${bold}:textfile=${file}:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}`
  const filters = [text(title, 64, 'h*0.36'), text(counter, 240, 'h*0.45')].join(',')
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x1f6f3f:s=1080x1920:r=30:d=10', '-vf', filters, ...ENCODE_ARGS, MP4])
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
encodeHls(MP4, VIDEO_DIR)
extractPoster(MP4, 1, join(VIDEO_DIR, 'poster.jpg'))
console.log(`Essai encodé : ${MP4}, puis ${VIDEO_DIR}`)
