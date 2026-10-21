/**
 * tutorial.ts — La vidéo tuto : ses adresses et ses textes.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.6, §6.2, §7, §9 « Mise en service »)
 *
 * La vidéo est servie avec l'app, au format HLS (public/tutoriel/video/) :
 * Cloudflare Pages ne répond pas aux demandes partielles, dont un iPhone a
 * besoin pour lire un MP4. La page /tutoriel/ (public/tutoriel/index.html)
 * reprend les mêmes adresses et les mêmes textes ; tutorial.test.ts vérifie
 * qu'ils restent d'accord.
 */
export const TUTORIAL_PLAYLIST = '/tutoriel/video/tutoriel.m3u8'
export const TUTORIAL_POSTER = '/tutoriel/video/poster.jpg'
export const TUTORIAL_LENGTH_NOTE = 'Environ 3 minutes, sans le son : tout est écrit.'
export const TUTORIAL_ROW_NOTE = 'Vidéo de 3 minutes'
export const TUTORIAL_LOAD_ERROR = 'La vidéo ne se charge pas. Vérifie la connexion, puis réessaie.'
