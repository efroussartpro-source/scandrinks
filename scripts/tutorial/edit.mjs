/**
 * edit.mjs — Montage de la vidéo tuto : cartes, écran de l'app dans son cadre, titres et sous-titres, puis MP4 et HLS.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§6.2, §9 « Mise en service », la vidéo tuto) ;
 * docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 6).
 *
 * Part du tournage (dist-tutorial/raw/app.webm et timeline.json, record.mjs) :
 * 1. rend les trois cartes de cards.html en PNG (dist-tutorial/cards/) ;
 * 2. écrit les titres des chapitres (en haut) et les sous-titres (en bas) en
 *    ASS, police Inter, aux heures du tournage, décalées de la carte de titre ;
 * 3. compose une vidéo verticale de 1080 × 1920 : carte de titre (3 s), écran
 *    de l'app dans son cadre, carte de fin (6 s), puis l'encode pour l'iPhone
 *    (hls.mjs) : dist-tutorial/ScanDrinks-tuto.mp4, remis au porteur du projet ;
 * 4. en tire le HLS et l'image d'attente servis avec l'app (public/tutoriel/video/).
 *
 * Usage : node scripts/tutorial/edit.mjs, après npm run tutorial:record (npm run tutorial fait tout).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { ENCODE_ARGS, encodeHls, extractPoster, ffmpeg, interFont } from './hls.mjs'
import { CHAPTERS, END_CARD, TITLE_CARD } from './storyboard.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const HERE = fileURLToPath(new URL('.', import.meta.url))
const OUT_DIR = join(ROOT, 'dist-tutorial')
const RAW_DIR = join(OUT_DIR, 'raw')
const CARDS_DIR = join(OUT_DIR, 'cards')
const SUBTITLES = join(OUT_DIR, 'subtitles.ass')
const MP4 = join(OUT_DIR, 'ScanDrinks-tuto.mp4')
const VIDEO_DIR = join(ROOT, 'public', 'tutoriel', 'video')
const TITLE_SECONDS = 3
const END_SECONDS = 6
// La fenêtre de l'écran dans le cadre (cards.html, ?card=frame).
const SCREEN = { x: 208, y: 210, width: 664, height: 1437 }

// 1. Les cartes, en PNG de 1080 × 1920 ; le cadre garde sa fenêtre transparente.
async function renderCards() {
  mkdirSync(CARDS_DIR, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
    await page.addInitScript((texts) => {
      window.CARDS = texts
    }, { title: TITLE_CARD, end: END_CARD })
    for (const card of ['title', 'end', 'frame']) {
      await page.goto(`${pathToFileURL(join(HERE, 'cards.html')).href}?card=${card}`)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0))
      await page.screenshot({ path: join(CARDS_DIR, `${card}.png`), omitBackground: card === 'frame', scale: 'css' })
    }
  } finally {
    await browser.close()
  }
}

// Heure ASS (H:MM:SS.cc) d'un instant donné en secondes.
function assTime(seconds) {
  const centiseconds = Math.round(seconds * 100)
  const hours = Math.floor(centiseconds / 360000)
  const minutes = Math.floor((centiseconds % 360000) / 6000)
  const rest = (centiseconds % 6000) / 100
  return `${hours}:${String(minutes).padStart(2, '0')}:${rest.toFixed(2).padStart(5, '0')}`
}

// Le texte d'un sous-titre : les espaces collées aux guillemets et devant « : ? ; ! » deviennent insécables (\h),
// pour qu'aucune ligne ne commence par la ponctuation ni ne sépare un guillemet de son mot.
const assText = (text) =>
  text
    .replace(/« /g, '«\\h')
    .replace(/ »/g, '\\h»')
    .replace(/ ([:?;!])/g, '\\h$1')

// 2. Les titres des chapitres et les sous-titres, aux heures du tournage. Un titre dure jusqu'au chapitre suivant ;
// un sous-titre, jusqu'au suivant ou jusqu'à la fin de son chapitre.
function writeSubtitles({ start, end, events }) {
  const at = (t) => (t - start) / 1000 + TITLE_SECONDS
  const chapters = events.filter((event) => event.kind === 'chapter')
  const chapterEnd = (index) => (index + 1 < chapters.length ? chapters[index + 1].t : end)
  const dialogue = (from, to, style, text) => `Dialogue: 0,${assTime(at(from))},${assTime(at(to))},${style},,0,0,0,,${assText(text)}`
  const lines = []
  chapters.forEach((chapter, index) => {
    lines.push(dialogue(chapter.t, chapterEnd(index), 'Chapitre', chapter.text))
    const captions = events.filter((event) => event.kind === 'caption' && event.key.startsWith(`${chapter.key}.`))
    captions.forEach((caption, captionIndex) => {
      const next = captionIndex + 1 < captions.length ? captions[captionIndex + 1].t : chapterEnd(index)
      lines.push(dialogue(caption.t, next, 'Texte', caption.text))
    })
  })
  const style = 'Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'
  writeFileSync(
    SUBTITLES,
    [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1080',
      'PlayResY: 1920',
      'WrapStyle: 0',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      `Format: ${style}`,
      'Style: Chapitre,Inter,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,60,60,70,1',
      'Style: Texte,Inter,42,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,70,70,60,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ...lines,
      '',
    ].join('\n'),
  )
  return lines.length
}

// 3. La composition : carte de titre, écran de l'app dans son cadre, carte de fin ; puis titres, sous-titres et
// encodage pour l'iPhone.
function compose({ start, end }) {
  const film = (end - start) / 1000
  const card = (name) => join(CARDS_DIR, `${name}.png`)
  const graph = [
    '[0:v]format=yuv420p,setsar=1[title]',
    `[1:v]trim=start=${start / 1000}:end=${end / 1000},setpts=PTS-STARTPTS,fps=30,scale=${SCREEN.width}:${SCREEN.height}:flags=lanczos,setsar=1[app]`,
    `color=c=0x14301f:s=1080x1920:r=30:d=${film}[background]`,
    `[background][app]overlay=${SCREEN.x}:${SCREEN.y}:shortest=1[screen]`,
    '[screen][2:v]overlay=0:0:shortest=1,format=yuv420p,setsar=1[body]',
    '[3:v]format=yuv420p,setsar=1[end]',
    '[title][body][end]concat=n=3:v=1:a=0[joined]',
    `[joined]ass=${SUBTITLES}:fontsdir=${dirname(interFont('regular'))}[out]`,
  ].join(';')
  ffmpeg([
    '-loop', '1', '-framerate', '30', '-t', String(TITLE_SECONDS), '-i', card('title'),
    '-i', join(RAW_DIR, 'app.webm'),
    '-loop', '1', '-framerate', '30', '-i', card('frame'),
    '-loop', '1', '-framerate', '30', '-t', String(END_SECONDS), '-i', card('end'),
    '-filter_complex', graph, '-map', '[out]', ...ENCODE_ARGS, MP4,
  ])
  return TITLE_SECONDS + film + END_SECONDS
}

const timeline = JSON.parse(readFileSync(join(RAW_DIR, 'timeline.json'), 'utf8'))
const titles = timeline.events.filter((event) => event.kind === 'chapter').map((event) => event.text)
if (titles.join('|') !== CHAPTERS.map((chapter) => chapter.title).join('|')) {
  throw new Error('Le tournage ne suit pas le storyboard : relance npm run tutorial:record.')
}
await renderCards()
const dialogues = writeSubtitles(timeline)
const duration = compose(timeline)
// 4. Le HLS et l'image d'attente servis avec l'app (la carte de titre).
encodeHls(MP4, VIDEO_DIR)
extractPoster(MP4, 1.5, join(VIDEO_DIR, 'poster.jpg'))
console.log(`Montage : ${MP4} (${duration.toFixed(1)} s, ${dialogues} titres et sous-titres), HLS dans ${VIDEO_DIR}`)
