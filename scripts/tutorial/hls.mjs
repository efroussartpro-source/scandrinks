/**
 * hls.mjs — Encodage commun de la vidéo tuto : H.264 pour l'iPhone, découpe HLS, image d'attente, police Inter.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §9 « Mise en service »)
 *
 * Cloudflare Pages ne répond pas aux demandes partielles, dont un iPhone a
 * besoin pour lire un MP4 : la vidéo est servie en HLS, en segments fMP4 de
 * 6 s, chacun lu en entier. Une image clé toutes les 2 s (-g 60 à 30 images/s)
 * permet de couper juste. Utilisé par trial.mjs (essai de lecture) et par le
 * montage de la vraie vidéo.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// H.264 High en yuv420p, 30 images/s, une image clé toutes les 2 s, sans piste son.
export const ENCODE_ARGS = [
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-keyint_min', '60',
  '-sc_threshold', '0', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-an',
]

// Lance ffmpeg sans bavardage ; une erreur arrête le script, avec le message de ffmpeg.
export function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

// Découpe le MP4 en HLS dans outDir (tutoriel.m3u8, init.mp4, seg-NNN.m4s), sans réencoder.
// Les anciens fichiers HLS sont retirés d'abord : aucun segment d'une version précédente ne reste.
export function encodeHls(mp4Path, outDir) {
  mkdirSync(outDir, { recursive: true })
  for (const name of readdirSync(outDir)) {
    if (name.endsWith('.m3u8') || name.endsWith('.m4s') || name === 'init.mp4') rmSync(join(outDir, name))
  }
  ffmpeg([
    '-i', mp4Path, '-c', 'copy', '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4',
    '-hls_fmp4_init_filename', 'init.mp4', '-hls_segment_filename', join(outDir, 'seg-%03d.m4s'), join(outDir, 'tutoriel.m3u8'),
  ])
}

// L'image d'attente : l'image de la vidéo à atSeconds, en JPEG.
export function extractPoster(mp4Path, atSeconds, outFile) {
  ffmpeg(['-ss', String(atSeconds), '-i', mp4Path, '-frames:v', '1', '-q:v', '3', outFile])
}

// Le fichier de la police Inter, donné par fc-match. Si fc-match propose une autre police (Inter absente), tout s'arrête.
export function interFont(weight) {
  const style = weight === 'bold' ? 'Bold' : 'Regular'
  const [family, file] = execFileSync('fc-match', ['-f', '%{family}\n%{file}', `Inter:style=${style}`], { encoding: 'utf8' }).split('\n')
  if (!family.split(',').includes('Inter')) {
    throw new Error(`Police Inter introuvable (fc-match propose « ${family} ») : installe-la, par exemple avec le paquet fonts-inter.`)
  }
  return file
}
