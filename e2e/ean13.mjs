/**
 * ean13.mjs — Image d'un code-barres EAN-13 pour la fausse caméra de Chromium.
 *
 * Chromium lit une vidéo Y4M à la place de la caméra
 * (--use-file-for-fake-video-capture). Une seule trame suffit : il la répète.
 */

// Tables d'encodage EAN-13 (norme GS1).
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = L.map((c) => [...c].map((b) => (b === '0' ? '1' : '0')).join(''))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLG', 'LGLGGL', 'LGLGLG', 'LGGLGL']

/** Les 95 modules du code (1 = barre noire). */
export function ean13Modules(code) {
  const digits = [...code].map(Number)
  let modules = '101'
  for (let i = 1; i <= 6; i++) modules += (PARITY[digits[0]][i - 1] === 'L' ? L : G)[digits[i]]
  modules += '01010'
  for (let i = 7; i <= 12; i++) modules += R[digits[i]]
  return modules + '101'
}

/** Une trame Y4M (YUV 4:2:0) : code-barres noir sur fond clair, centré, de 30 % à 70 % de la hauteur. */
export function ean13Y4m(code, width = 1280, height = 720, moduleWidth = 6) {
  const modules = ean13Modules(code)
  const luma = new Uint8Array(width * height).fill(235)
  const x0 = Math.floor((width - modules.length * moduleWidth) / 2)
  const y0 = Math.floor(height * 0.3)
  const y1 = Math.floor(height * 0.7)
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] !== '1') continue
    for (let row = y0; row < y1; row++) {
      const start = row * width + x0 + m * moduleWidth
      luma.fill(16, start, start + moduleWidth)
    }
  }
  const chroma = new Uint8Array((width / 2) * (height / 2) * 2).fill(128)
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F30:1 Ip A1:1 C420jpeg\nFRAME\n`)
  return Buffer.concat([header, Buffer.from(luma), Buffer.from(chroma)])
}
