export const COMPOSER_BLUR_FADE_MS = 1000
export const COMPOSER_BOTTOM_HOT_PX = 120

let installed = false
let timer = 0
let stop: (() => void) | null = null

function docks() {
  return document.querySelectorAll('.chat-composer-dock')
}

function reveal() {
  docks().forEach((node) => node.classList.remove('is-composer-faded'))
}

function fade() {
  docks().forEach((node) => node.classList.add('is-composer-faded'))
}

function inComposerDock(node: EventTarget | null) {
  return node instanceof Element && Boolean(node.closest('.chat-composer-dock'))
}

function inComposerHit(node: EventTarget | null) {
  return node instanceof Element && Boolean(node.closest('.chat-composer-dock, .session-composer-host'))
}

function nearComposerHotZone(clientY: number) {
  return clientY >= window.innerHeight - COMPOSER_BOTTOM_HOT_PX
}

function scheduleFade() {
  window.clearTimeout(timer)
  timer = window.setTimeout(fade, COMPOSER_BLUR_FADE_MS)
}

function cancelFade() {
  window.clearTimeout(timer)
  reveal()
}

export function ensureComposerDockFade() {
  if (installed || typeof document === 'undefined') return stop ?? (() => undefined)
  installed = true

  let inHotZone = false

  const onFocusIn = (event: FocusEvent) => {
    if (!inComposerDock(event.target)) return
    cancelFade()
  }

  const onFocusOut = (event: FocusEvent) => {
    if (!inComposerDock(event.target)) return
    if (inComposerDock(event.relatedTarget)) return
    scheduleFade()
  }

  const onPointerMove = (event: PointerEvent) => {
    const hot = nearComposerHotZone(event.clientY) || inComposerHit(event.target)
    if (hot) {
      inHotZone = true
      cancelFade()
      return
    }
    if (!inHotZone) return
    inHotZone = false
    if (!inComposerDock(document.activeElement)) scheduleFade()
  }

  const onPointerOver = (event: PointerEvent) => {
    if (!inComposerHit(event.target)) return
    cancelFade()
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!inComposerHit(event.target)) return
    cancelFade()
    if (inComposerDock(document.activeElement)) return
    window.dispatchEvent(new Event('biu:composer-focus'))
  }

  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerover', onPointerOver, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  stop = () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerover', onPointerOver, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    window.clearTimeout(timer)
    reveal()
    installed = false
    stop = null
  }
  return stop
}
