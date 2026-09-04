export const COMPOSER_BLUR_FADE_MS = 1000

let installed = false
let stop: (() => void) | null = null
const fadeTimers = new WeakMap<Element, number>()

function zoneFrom(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  return node.closest('.composer-dock-zone')
}

function dockFromZone(zone: Element | null): Element | null {
  if (!zone) return null
  return zone.querySelector('.chat-composer-dock')
}

function dockFrom(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  const zone = zoneFrom(node)
  if (zone) return dockFromZone(zone)
  return node.closest('.chat-composer-dock')
}

function revealDock(dock: Element) {
  dock.classList.remove('is-composer-faded')
  const timer = fadeTimers.get(dock)
  if (timer != null) {
    window.clearTimeout(timer)
    fadeTimers.delete(dock)
  }
}

function fadeDock(dock: Element) {
  dock.classList.add('is-composer-faded')
  fadeTimers.delete(dock)
}

function scheduleFadeDock(dock: Element) {
  const prev = fadeTimers.get(dock)
  if (prev != null) window.clearTimeout(prev)
  fadeTimers.set(
    dock,
    window.setTimeout(() => fadeDock(dock), COMPOSER_BLUR_FADE_MS),
  )
}

function focusComposerInDock(dock: Element) {
  const editor = dock.querySelector('.ProseMirror')
  if (editor instanceof HTMLElement) {
    editor.focus()
  }
}

export function ensureComposerDockFade() {
  if (installed || typeof document === 'undefined') return stop ?? (() => undefined)
  installed = true

  const onFocusIn = (event: FocusEvent) => {
    const dock = dockFrom(event.target)
    if (!dock) return
    revealDock(dock)
  }

  const onFocusOut = (event: FocusEvent) => {
    const dock = dockFrom(event.target)
    if (!dock) return
    if (dockFrom(event.relatedTarget) === dock) return
    scheduleFadeDock(dock)
  }

  const onMouseOver = (event: MouseEvent) => {
    const zone = zoneFrom(event.target)
    if (!zone) return
    const dock = dockFromZone(zone)
    if (!dock) return
    revealDock(dock)
  }

  const onMouseOut = (event: MouseEvent) => {
    const zone = zoneFrom(event.target)
    if (!zone) return
    const related = event.relatedTarget
    if (related instanceof Node && zone.contains(related)) return
    const dock = dockFromZone(zone)
    if (!dock) return
    if (dock.contains(document.activeElement)) return
    scheduleFadeDock(dock)
  }

  const onPointerDown = (event: PointerEvent) => {
    const dock = dockFrom(event.target)
    if (!dock) return
    revealDock(dock)
    if (dock.contains(document.activeElement)) return
    focusComposerInDock(dock)
  }

  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('mouseover', onMouseOver, true)
  document.addEventListener('mouseout', onMouseOut, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  stop = () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('mouseout', onMouseOut, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    for (const dock of document.querySelectorAll('.chat-composer-dock.is-composer-faded')) {
      dock.classList.remove('is-composer-faded')
    }
    installed = false
    stop = null
  }
  return stop
}
