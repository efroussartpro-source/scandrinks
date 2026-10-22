/**
 * page-helpers.js — Les trucages du tournage de la vidéo tuto, injectés dans la page filmée (page.addInitScript).
 *
 * Référence : docs/superpowers/plans/2026-10-21-jalon-4-mise-en-service.md (Tâche 5)
 *
 * Chaque fonction est autonome : Playwright envoie son texte à la page, sans
 * rien de ce module autour. L'app n'en contient aucun.
 * - installCamera : une fausse caméra (un canvas à la place de getUserMedia),
 *   qui montre l'étiquette d'un code-barres ou un pack au moment voulu ;
 * - installTouchMarker : un rond marque chaque toucher ;
 * - installConfirmDialog : la confirmation de l'Historique est dessinée dans la
 *   page, façon iOS, puis acceptée ;
 * - installRepaintPulse : un point invisible fait redessiner l'écran à chaque
 *   image, pour que la capture n'en perde aucune.
 */

export function installCamera() {
  const WIDTH = 1280
  const HEIGHT = 720
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  // Ce que la caméra montre : rien (le fond), l'étiquette d'un code, ou un pack avec son étiquette.
  let scene = null

  // Chiffres d'un EAN-13 tels qu'imprimés sous les barres : « 5 449000 000996 ».
  const printed = (digits) => (digits.length === 13 ? `${digits[0]}  ${digits.slice(1, 7)}  ${digits.slice(7)}` : digits)

  // Étiquette blanche centrée en (centerX, centerY) : les barres (1 = barre noire), puis les chiffres dessous.
  function drawLabel(centerX, centerY, modules, digits, moduleWidth, barHeight) {
    const quiet = 11 * moduleWidth
    const fontSize = Math.round(barHeight * 0.16)
    const width = modules.length * moduleWidth + 2 * quiet
    const height = barHeight + fontSize * 2.2
    const left = centerX - width / 2
    const top = centerY - height / 2
    context.fillStyle = '#FFFFFF'
    context.fillRect(left, top, width, height)
    context.fillStyle = '#111111'
    for (let i = 0; i < modules.length; i++) {
      if (modules[i] === '1') context.fillRect(left + quiet + i * moduleWidth, top + fontSize * 0.5, moduleWidth, barHeight)
    }
    context.font = `${fontSize}px monospace`
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillText(printed(digits), centerX, top + barHeight + fontSize * 0.7)
  }

  // Un pack de six canettes vu de face : trois devant, trois derrière (plus sombres), sur un plateau de carton.
  function drawPack(color, modules, digits) {
    const canWidth = 150
    const canHeight = 360
    const left = WIDTH / 2 - (3 * canWidth + 2 * 18) / 2
    context.filter = 'brightness(0.7)'
    context.fillStyle = color
    for (let i = 0; i < 3; i++) roundedRect(left + 40 + i * (canWidth + 18), 130, canWidth, canHeight, 22)
    context.filter = 'none'
    for (let i = 0; i < 3; i++) {
      const x = left + i * (canWidth + 18)
      context.fillStyle = color
      roundedRect(x, 170, canWidth, canHeight, 22)
      context.fillStyle = '#C9CCD2'
      roundedRect(x + 8, 158, canWidth - 16, 24, 12)
    }
    context.fillStyle = 'rgba(255, 255, 255, 0.18)'
    context.fillRect(left - 24, 150, 3 * canWidth + 2 * 18 + 48, 420)
    drawLabel(WIDTH / 2, 470, modules, digits, 3, 90)
  }

  function roundedRect(x, y, width, height, radius) {
    context.beginPath()
    context.roundRect(x, y, width, height, radius)
    context.fill()
  }

  function draw() {
    context.fillStyle = '#6E6E73'
    context.fillRect(0, 0, WIDTH, HEIGHT)
    if (scene?.kind === 'code') drawLabel(WIDTH / 2, HEIGHT / 2, scene.modules, scene.digits, 6, Math.round(HEIGHT * 0.4))
    if (scene?.kind === 'pack') drawPack(scene.color, scene.modules, scene.digits)
    requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)

  window.__tutorialCamera = {
    show(modules, digits) {
      scene = { kind: 'code', modules, digits }
    },
    showPack(color, modules, digits) {
      scene = { kind: 'pack', color, modules, digits }
    },
    hide() {
      scene = null
    },
  }
  // Chaque ouverture de la caméra reçoit un nouveau flux du canvas : un flux arrêté ne repart pas.
  navigator.mediaDevices.getUserMedia = async () => canvas.captureStream(30)
}

export function installTouchMarker() {
  let lastTouch = 0
  function mark(x, y) {
    const dot = document.createElement('div')
    dot.setAttribute('aria-hidden', 'true')
    Object.assign(dot.style, {
      position: 'fixed',
      left: `${x - 23}px`,
      top: `${y - 23}px`,
      width: '46px',
      height: '46px',
      boxSizing: 'border-box',
      borderRadius: '50%',
      background: 'rgba(255, 204, 0, 0.45)',
      border: '3px solid #FF9500',
      pointerEvents: 'none',
      zIndex: '2147483647',
      transition: 'opacity 600ms ease-out',
    })
    document.documentElement.append(dot)
    setTimeout(() => {
      dot.style.opacity = '0'
    }, 30)
    setTimeout(() => dot.remove(), 700)
  }
  addEventListener(
    'touchstart',
    (event) => {
      lastTouch = Date.now()
      const touch = event.touches[0]
      if (touch) mark(touch.clientX, touch.clientY)
    },
    { capture: true, passive: true },
  )
  // Les événements de souris qui suivent un toucher ne font pas un second rond.
  addEventListener(
    'mousedown',
    (event) => {
      if (Date.now() - lastTouch > 800) mark(event.clientX, event.clientY)
    },
    { capture: true },
  )
}

export function installRepaintPulse() {
  // La capture CDP n'envoie une image que quand l'écran change, et saute un changement qui arrive avant que
  // l'image précédente soit reçue : le dernier état d'une suite rapide (l'alerte qui se ferme, puis la ligne qui
  // se barre) n'était jamais filmé. Un point d'un pixel, presque transparent, qui pulse sans fin fait redessiner
  // l'écran à chaque image : la capture suit l'écran sans trou.
  const attach = () => {
    const dot = document.createElement('div')
    dot.setAttribute('aria-hidden', 'true')
    Object.assign(dot.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '1px',
      height: '1px',
      background: '#000000',
      opacity: '0.01',
      pointerEvents: 'none',
      zIndex: '2147483647',
    })
    document.documentElement.append(dot)
    dot.animate([{ opacity: 0.01 }, { opacity: 0.02 }], { duration: 500, iterations: Infinity, direction: 'alternate' })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach)
  else attach()
}

export function installConfirmDialog() {
  // La vraie boîte du navigateur ne se filme pas : une alerte façon iOS est dessinée pendant 1,8 s, avec un rond sur
  // « OK », puis retirée. La réponse est « OK » tout de suite : c'est le tournage qui fait attendre l'effet.
  window.confirm = (message) => {
    const [title, ...details] = String(message).split('\n')
    const backdrop = document.createElement('div')
    backdrop.setAttribute('aria-hidden', 'true')
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.35)',
      pointerEvents: 'none',
      font: '17px -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    })
    const box = document.createElement('div')
    Object.assign(box.style, {
      width: '270px',
      borderRadius: '14px',
      overflow: 'hidden',
      background: 'rgba(242, 242, 247, 0.97)',
      color: '#000000',
      textAlign: 'center',
    })
    const text = document.createElement('div')
    Object.assign(text.style, { padding: '18px 16px 16px' })
    const heading = document.createElement('div')
    Object.assign(heading.style, { fontWeight: '600', marginBottom: '4px' })
    heading.textContent = title
    text.append(heading)
    for (const line of details) {
      const detail = document.createElement('div')
      Object.assign(detail.style, { fontSize: '13px', lineHeight: '1.35' })
      detail.textContent = line
      text.append(detail)
    }
    const buttons = document.createElement('div')
    Object.assign(buttons.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid rgba(60, 60, 67, 0.29)' })
    const button = (label, bold) => {
      const cell = document.createElement('div')
      Object.assign(cell.style, { position: 'relative', padding: '11px 0', color: '#007AFF', fontWeight: bold ? '600' : '400' })
      cell.textContent = label
      return cell
    }
    const cancel = button('Annuler', false)
    cancel.style.borderRight = '1px solid rgba(60, 60, 67, 0.29)'
    const ok = button('OK', true)
    buttons.append(cancel, ok)
    box.append(text, buttons)
    backdrop.append(box)
    document.documentElement.append(backdrop)
    // Le toucher sur « OK », un peu après l'ouverture.
    setTimeout(() => {
      const dot = document.createElement('div')
      Object.assign(dot.style, {
        position: 'absolute',
        left: 'calc(50% - 23px)',
        top: 'calc(50% - 23px)',
        width: '46px',
        height: '46px',
        boxSizing: 'border-box',
        borderRadius: '50%',
        background: 'rgba(255, 204, 0, 0.45)',
        border: '3px solid #FF9500',
      })
      ok.append(dot)
    }, 900)
    setTimeout(() => backdrop.remove(), 1800)
    return true
  }
}
