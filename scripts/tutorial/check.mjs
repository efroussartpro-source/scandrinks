/**
 * check.mjs — Contrôle de la vidéo tuto : la vidéo servie avec l'app, ou le tournage brut.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §6.5, §9 « Mise en service »)
 *
 * Sans option ou avec --trial, la vidéo servie (public/tutoriel/video/) :
 * - la liste HLS : vidéo complète (VOD), segment d'initialisation et fin ;
 * - chaque segment cité existe, et aucun segment n'est orphelin ;
 * - l'image d'attente poster.jpg ;
 * - les tailles : moins de 25 Mo par fichier (limite de Cloudflare Pages) et
 *   moins de 20 Mo pour le dossier, en ligne pour tous ;
 * - avec ffprobe, du H.264 en 1080 × 1920, et la durée : de 9,5 à 10,5 s pour
 *   l'essai (--trial), de 150 à 240 s pour la vraie vidéo (sans option).
 *
 * Avec --raw, le tournage (dist-tutorial/raw/) : les neuf chapitres du
 * storyboard dans l'ordre, chaque sous-titre une seule fois, et un
 * enregistrement de 140 à 240 s.
 *
 * Usage : node scripts/tutorial/check.mjs [--trial | --raw]
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const VIDEO_DIR = join(ROOT, 'public', 'tutoriel', 'video')
const RAW_DIR = join(ROOT, 'dist-tutorial', 'raw')
const MB = 1024 * 1024
const DURATIONS = { trial: [9.5, 10.5], full: [150, 240], raw: [140, 240] }

// Durée d'un fichier vidéo, en secondes. Un WebM de Playwright n'en donne pas toujours dans son en-tête :
// on prend alors l'heure du dernier paquet vidéo.
function durationOf(file) {
  const probe = (args) => execFileSync('ffprobe', ['-v', 'error', ...args, file], { encoding: 'utf8' }).trim()
  const declared = Number(probe(['-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1']))
  if (Number.isFinite(declared) && declared > 0) return declared
  const times = probe(['-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0'])
    .split('\n')
    .map(Number)
    .filter(Number.isFinite)
  return Math.max(...times)
}

function checkServedVideo([minSeconds, maxSeconds]) {
  // 1. La liste HLS.
  const playlistPath = join(VIDEO_DIR, 'tutoriel.m3u8')
  assert.ok(existsSync(playlistPath), `liste absente : ${playlistPath}`)
  const playlist = readFileSync(playlistPath, 'utf8')
  for (const tag of ['#EXT-X-PLAYLIST-TYPE:VOD', '#EXT-X-MAP:URI="init.mp4"', '#EXT-X-ENDLIST']) {
    assert.ok(playlist.includes(tag), `la liste ne contient pas ${tag}`)
  }

  // 2. Les segments : ceux de la liste, exactement ceux du dossier.
  const listed = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
  const files = readdirSync(VIDEO_DIR)
  assert.ok(listed.length > 0, 'la liste ne cite aucun segment')
  for (const segment of listed) assert.ok(files.includes(segment), `segment cité mais absent : ${segment}`)
  for (const file of files.filter((name) => name.endsWith('.m4s'))) assert.ok(listed.includes(file), `segment orphelin : ${file}`)
  assert.ok(files.includes('init.mp4'), "segment d'initialisation absent : init.mp4")

  // 3. L'image d'attente.
  assert.ok(files.includes('poster.jpg'), "image d'attente absente : poster.jpg")

  // 4. Les tailles.
  let total = 0
  for (const file of files) {
    const size = statSync(join(VIDEO_DIR, file)).size
    assert.ok(size < 25 * MB, `${file} fait ${(size / MB).toFixed(1)} Mo : plus que les 25 Mo de Cloudflare Pages`)
    total += size
  }
  assert.ok(total < 20 * MB, `le dossier fait ${(total / MB).toFixed(1)} Mo : plus que 20 Mo`)

  // 5. Le flux vidéo et la durée, lus par ffprobe dans la liste.
  const probe = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration', '-of', 'json', playlistPath], {
      encoding: 'utf8',
    }),
  )
  const video = probe.streams.find((stream) => stream.codec_type === 'video')
  assert.ok(video, 'aucun flux vidéo')
  assert.equal(video.codec_name, 'h264', 'codec vidéo')
  assert.deepEqual([video.width, video.height], [1080, 1920], 'dimensions de la vidéo')
  const duration = Number(probe.format.duration)
  assert.ok(duration >= minSeconds && duration <= maxSeconds, `durée de ${duration} s, attendu de ${minSeconds} à ${maxSeconds} s`)

  console.log(`Vidéo OK : ${duration.toFixed(1)} s, ${(total / MB).toFixed(2)} Mo`)
}

async function checkRecording() {
  const { CHAPTERS } = await import('./storyboard.mjs')
  const timelinePath = join(RAW_DIR, 'timeline.json')
  const webmPath = join(RAW_DIR, 'app.webm')
  assert.ok(existsSync(timelinePath), `chronologie absente : ${timelinePath}`)
  assert.ok(existsSync(webmPath), `enregistrement absent : ${webmPath}`)
  const { start, end, events } = JSON.parse(readFileSync(timelinePath, 'utf8'))

  const titles = events.filter((event) => event.kind === 'chapter').map((event) => event.text)
  assert.deepEqual(titles, CHAPTERS.map((chapter) => chapter.title), "les neuf chapitres, dans l'ordre du storyboard")
  const captions = events.filter((event) => event.kind === 'caption').map((event) => event.text)
  const expected = CHAPTERS.flatMap((chapter) => Object.values(chapter.captions))
  for (const text of expected) assert.equal(captions.filter((caption) => caption === text).length, 1, `sous-titre filmé une fois : « ${text} »`)
  assert.equal(captions.length, expected.length, 'aucun sous-titre en plus du storyboard')
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && start < end, `début et fin du film : ${start}, ${end}`)
  assert.ok(events.every((event) => event.t >= start && event.t <= end), 'chaque titre et chaque sous-titre entre le début et la fin')

  const [minSeconds, maxSeconds] = DURATIONS.raw
  const duration = durationOf(webmPath)
  assert.ok(duration >= minSeconds && duration <= maxSeconds, `tournage de ${duration.toFixed(1)} s, attendu de ${minSeconds} à ${maxSeconds} s`)
  console.log(`Tournage OK : ${titles.length} chapitres, ${captions.length} sous-titres, ${Math.round(duration)} s`)
}

const option = process.argv[2]
if (option === '--raw') await checkRecording()
else if (option === undefined || option === '--trial') checkServedVideo(DURATIONS[option === '--trial' ? 'trial' : 'full'])
else throw new Error(`Option inconnue : ${option} (attendu : --trial, --raw, ou rien)`)
