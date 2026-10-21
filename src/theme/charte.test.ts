import { expect, test } from 'vitest'
import { STATUS_BAR } from './appearance'
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
  ['bg', '#F2F2F7', '#000000'],
  ['card', '#FFFFFF', '#1C1C1E'],
  ['field', '#F2F2F7', '#2C2C2E'],
  ['track', '#E3E3E8', '#2C2C2E'],
  ['separator', '#E5E5EA', '#38383A'],
  ['text', '#1C1C1E', '#FFFFFF'],
  ['text-2', '#6C6C70', '#98989F'],
  ['green', '#1F6F3F', '#26804A'],
  ['green-text', '#1F6F3F', '#4CD07D'],
  ['green-pale', '#E7F1EB', '#1E3326'],
  ['orange', '#B45309', '#A9520B'],
  ['orange-text', '#A34A07', '#FFA94D'],
  ['blue', '#1D4ED8', '#2F5FE0'],
  ['blue-text', '#1D4ED8', '#7FB2FF'],
  ['red-text', '#C0392B', '#FF6961'],
  ['red-pale', '#FDECEA', '#3A1D1B'],
  ['badge', '#D70015', '#D70015'],
  ['tab-bar', '#F9F9F9', '#121214'],
])('couleur de la spec --%s : %s le jour, %s la nuit', (name, day, night) => {
  expect(tokens.light[name]).toBe(day)
  expect(tokens.dark[name]).toBe(night)
})

const TEXT_PAIRS: Array<[string, string]> = [
  ['text', 'bg'], ['text', 'card'], ['text', 'field'], ['text', 'green-pale'],
  ['text-2', 'card'], ['text-2', 'bg'], ['text-2', 'green-pale'], ['text-2', 'tab-bar'],
  ['text-3', 'track'], ['text-3', 'pill'],
  ['green-text', 'card'], ['green-text', 'bg'], ['green-text', 'green-pale'], ['green-text', 'track'], ['green-text', 'tab-bar'],
  ['orange-text', 'card'], ['orange-text', 'track'], ['orange-text', 'orange-pale'],
  ['blue-text', 'card'], ['blue-text', 'track'], ['blue-text', 'blue-pale'],
  ['red-text', 'card'], ['red-text', 'bg'], ['red-text', 'red-pale'],
  ['on-color', 'green'], ['on-color', 'orange'], ['on-color', 'blue'], ['on-color', 'badge'],
]

const INTERFACE_PAIRS: Array<[string, string]> = [
  ['text-2', 'thumb'],
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
