import { expect, test } from 'vitest'
import { STATUS_BAR } from './appearance'
import fontsCss from './fonts.css?raw'
import tokensCss from './tokens.css?raw'

// Les déclarations « --nom: valeur; » d'un bloc de tokens.css.
function declarations(body: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) values[match[1]] = match[2].trim()
  return values
}

// Le corps du bloc qui suit le sélecteur (les blocs de tokens.css ne contiennent pas d'accolade).
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`bloc absent : ${selector}`)
  const open = css.indexOf('{', start)
  return css.slice(open + 1, css.indexOf('}', open))
}

function parseTokens(css: string) {
  const autoDark = ":root:not([data-theme='light'])"
  if (!/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)\s*\{/.test(css)) {
    throw new Error('la nuit « Automatique » doit suivre prefers-color-scheme')
  }
  return {
    light: declarations(block(css, ':root')),
    autoDark: declarations(block(css, autoDark)),
    dark: declarations(block(css, ":root[data-theme='dark']")),
  }
}

// Luminance relative et contraste du WCAG 2.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const tokens = parseTokens(tokensCss)
const THEMES = [
  ['jour', tokens.light],
  ['nuit', tokens.dark],
] as const

test('la formule de contraste donne les valeurs connues', () => {
  expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
  expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2)
})

test('les trois blocs ont les mêmes variables', () => {
  const names = Object.keys(tokens.light).sort()
  expect(names.length).toBeGreaterThan(20)
  expect(Object.keys(tokens.autoDark).sort()).toEqual(names)
  expect(Object.keys(tokens.dark).sort()).toEqual(names)
})

test('la nuit est la même en Automatique et en Sombre', () => {
  expect(tokens.autoDark).toEqual(tokens.dark)
})

test("la barre d'état prend le fond de chaque thème", () => {
  expect(STATUS_BAR).toEqual({ light: tokens.light.bg, dark: tokens.dark.bg })
})

// Spec §6.7, tableau « Couleurs ».
test.each([
  ['bg', '#F7F7F5', '#0F1110'],
  ['card', '#FFFFFF', '#1A1D1B'],
  ['field', '#FFFFFF', '#1A1D1B'],
  ['track', '#FFFFFF', '#1A1D1B'],
  ['separator', '#E5E6E1', '#2B2F2C'],
  ['field-border', '#D3D5CF', '#3A3F3B'],
  ['text', '#171A18', '#F2F3F1'],
  ['text-2', '#5C625E', '#A3A9A5'],
  ['text-3', '#3B403D', '#D5D8D6'],
  ['chip', '#171A18', '#F2F3F1'],
  ['on-chip', '#FFFFFF', '#171A18'],
  ['green', '#1F6F3F', '#26804A'],
  ['green-text', '#1F6F3F', '#4CD07D'],
  ['green-pale', '#DDF0E4', '#1E3326'],
  ['orange', '#B45309', '#A9520B'],
  ['orange-text', '#A34A07', '#FFA94D'],
  ['orange-pale', '#FFEEDB', '#3A2614'],
  ['blue', '#1D4ED8', '#2F5FE0'],
  ['blue-text', '#1D4ED8', '#7FB2FF'],
  ['blue-pale', '#EEF2FD', '#17233D'],
  ['red', '#C0392B', '#C0392B'],
  ['red-text', '#C0392B', '#FF6961'],
  ['red-pale', '#FDECEA', '#3A1D1B'],
  ['badge', '#D70015', '#D70015'],
  ['tab-bar', '#FFFFFF', '#151816'],
  ['bar-border', '#E5E6E1', '#2B2F2C'],
  ['plate', '#F1F2EE', '#DCDDD8'],
  ['plate-text', '#5C625E', '#4A504C'],
  ['photo-badge', '#FFFFFF', '#FFFFFF'],
  ['photo-badge-text', '#A34A07', '#A34A07'],
  ['stock-chip', '#171A18', '#171A18'],
  ['tile-indigo', '#5856D6', '#5E5CE6'],
  ['tile-gray', '#6C716E', '#636366'],
  ['on-color', '#FFFFFF', '#FFFFFF'],
  ['camera', '#000000', '#000000'],
  ['overlay', 'rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.6)'],
])('couleur de la spec --%s : %s le jour, %s la nuit', (name, day, night) => {
  expect(tokens.light[name]).toBe(day)
  expect(tokens.dark[name]).toBe(night)
})

const TEXT_PAIRS: Array<[string, string]> = [
  ['text', 'bg'], ['text', 'card'], ['text', 'field'], ['text', 'green-pale'], ['text', 'track'],
  ['text-2', 'card'], ['text-2', 'bg'], ['text-2', 'green-pale'], ['text-2', 'tab-bar'], ['text-2', 'field'],
  ['text-3', 'track'],
  ['green-text', 'card'], ['green-text', 'bg'], ['green-text', 'green-pale'], ['green-text', 'track'], ['green-text', 'tab-bar'],
  ['green-text', 'field'],
  ['orange-text', 'card'], ['orange-text', 'track'], ['orange-text', 'orange-pale'],
  ['blue-text', 'card'], ['blue-text', 'track'], ['blue-text', 'blue-pale'],
  ['red-text', 'card'], ['red-text', 'bg'], ['red-text', 'red-pale'],
  ['on-color', 'green'], ['on-color', 'orange'], ['on-color', 'blue'], ['on-color', 'badge'],
  ['on-chip', 'chip'], ['plate-text', 'plate'], ['photo-badge-text', 'photo-badge'], ['on-color', 'red'], ['on-color', 'stock-chip'],
  ['orange-text', 'bg'],
]

const INTERFACE_PAIRS: Array<[string, string]> = [
  ['stock-chip', 'plate'], ['chip', 'track'], ['chip', 'bg'], ['red', 'card'],
  ['on-color', 'tile-indigo'], ['on-color', 'tile-gray'], ['on-color', 'camera'],
  ['green', 'bg'], ['green', 'card'], ['orange', 'bg'], ['orange', 'card'], ['blue', 'bg'], ['blue', 'card'],
]

test.each(THEMES)('textes : 4,5:1 au moins (%s)', (_theme, values) => {
  const tooLow = TEXT_PAIRS.map(([fg, bg]) => [`${fg} sur ${bg}`, contrast(values[fg], values[bg])] as const).filter(([, ratio]) => !(ratio >= 4.5))
  expect(tooLow).toEqual([])
})

test.each(THEMES)("éléments d'interface : 3:1 au moins (%s)", (_theme, values) => {
  const tooLow = INTERFACE_PAIRS.map(([fg, bg]) => [`${fg} sur ${bg}`, contrast(values[fg], values[bg])] as const).filter(
    ([, ratio]) => !(ratio >= 3),
  )
  expect(tooLow).toEqual([])
})

// Sélecteurs et puces : le choix rempli ressort de sa piste, de jour comme de nuit (spec §6.7).
test.each(THEMES)('le choix rempli ressort de sa piste (%s)', (_theme, values) => {
  expect(contrast(values.chip, values.track)).toBeGreaterThanOrEqual(3)
})

// L'en-tête, les modes et la consigne du Scanner sont posés sur la caméra, sur ce voile : devant la scène la plus
// claire (un frigo blanc), leur texte reste lisible.
test.each(THEMES)('le texte posé sur la caméra reste lisible devant une scène blanche (%s)', (_theme, values) => {
  const alpha = Number(/^rgba\(0, 0, 0, ([\d.]+)\)$/.exec(values.overlay)?.[1])
  const channel = Math.round(255 * (1 - alpha)).toString(16).padStart(2, '0').toUpperCase()
  const veiled = `#${channel.repeat(3)}`
  expect(veiled).toBe('#666666')
  expect(contrast(values['on-color'], veiled)).toBeGreaterThanOrEqual(4.5)
})

// La police Plus Jakarta Sans est livrée avec l'app (spec §6.2) : rien n'est demandé à un autre site.
test("la police est livrée avec l'app", () => {
  expect(fontsCss).toContain("font-family: 'Plus Jakarta Sans'")
  expect(fontsCss).toContain('font-display: swap')
  expect(fontsCss).toContain('font-weight: 200 800')
  expect(fontsCss).toContain("url('./fonts/plus-jakarta-sans-latin-wght-normal.woff2') format('woff2')")
  expect(Object.keys(import.meta.glob('./fonts/*.woff2'))).toEqual(['./fonts/plus-jakarta-sans-latin-wght-normal.woff2'])
})

// Une couleur écrite en dur resterait la même de nuit : l'écran deviendrait illisible.
test('aucune couleur écrite en dur hors de tokens.css', () => {
  const sources = import.meta.glob(['../**/*.css', '../**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const files = Object.entries(sources).filter(([path]) => !path.endsWith('/tokens.css'))
  expect(files.length).toBeGreaterThan(10)
  const found = files.flatMap(([path, text]) =>
    [...text.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)].map((match) => `${path} : ${match[0]}`),
  )
  expect(found).toEqual([])
})
