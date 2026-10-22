/**
 * packs.mjs — Illustrations des packs de la vidéo tuto, dans le style des maquettes (docs/maquettes/I-stock.dc.html).
 *
 * Les « photos de l'équipe » des codes du catalogue fictif : une rangée de
 * canettes ou de bouteilles devant une autre, plus sombre, sur un plateau de
 * carton, une couleur par produit. record.mjs les rend en JPEG de 480 × 360
 * avec Chromium, au début du tournage. Aucune marque n'est reproduite : des
 * couleurs seulement.
 */

// Couleurs des produits, reprises des maquettes : le corps, la rangée du fond, une bande, le haut des canettes.
export const PACK_STYLES = {
  coca: { shape: 'can', front: '#C8102E', back: '#9E0C22', band: null, top: '#C9CCD2' },
  lipton: { shape: 'can', front: '#E8B500', back: '#B98F00', band: '#2E7D32', top: '#C9CCD2' },
  redbull: { shape: 'can', front: '#233E8B', back: '#18306E', band: '#C9CED6', top: '#C9CCD2' },
  evian: { shape: 'bottle', front: '#CFE6F5', back: '#A9CDE6', band: '#E58FAA', top: '#E58FAA' },
}

const WIDTH = 480
const HEIGHT = 360

// Une canette ou une bouteille, en x (bord gauche), y (haut), de largeur w et de hauteur h.
function item(style, x, y, w, h, body) {
  if (style.shape === 'bottle') {
    const neck = w * 0.4
    return [
      `<rect x="${x + (w - neck) / 2}" y="${y}" width="${neck}" height="${h * 0.12}" rx="${neck * 0.2}" fill="${style.top}"/>`,
      `<path d="M${x + (w - neck) / 2} ${y + h * 0.12}h${neck}l${(w - neck) / 2} ${h * 0.14}v${h * 0.7}a${w * 0.12} ${w * 0.12} 0 0 1 -${w * 0.12} ${w * 0.12}h-${w * 0.76}a${w * 0.12} ${w * 0.12} 0 0 1 -${w * 0.12} -${w * 0.12}v-${h * 0.7}z" fill="${body}"/>`,
      `<rect x="${x}" y="${y + h * 0.5}" width="${w}" height="${h * 0.2}" fill="#FFFFFF"/>`,
      `<rect x="${x}" y="${y + h * 0.56}" width="${w}" height="${h * 0.07}" fill="${style.band}"/>`,
    ].join('')
  }
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.2}" fill="${body}"/>`,
    `<rect x="${x + w * 0.04}" y="${y - h * 0.04}" width="${w * 0.92}" height="${h * 0.1}" rx="${h * 0.05}" fill="${style.top}"/>`,
    style.band ? `<rect x="${x}" y="${y + h * 0.42}" width="${w}" height="${h * 0.2}" fill="${style.band}"/>` : '',
  ].join('')
}

/** Le pack, en SVG de 480 × 360 : deux rangées de quatre, sur un plateau de carton. */
export function packSvg(style) {
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="#ECECF0"/>`]
  for (let i = 0; i < 4; i++) parts.push(item(style, 108 + i * 76, 70, 64, 170, style.back))
  for (let i = 0; i < 4; i++) parts.push(item(style, 76 + i * 84, 110, 72, 190, style.front))
  parts.push(`<rect x="56" y="250" width="368" height="72" rx="10" fill="#B88A55"/>`)
  parts.push(`<rect x="56" y="250" width="368" height="10" fill="#A0763F"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`
}
