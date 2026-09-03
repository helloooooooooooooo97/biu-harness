export const COMPOSER_BLUR_FADE_MS = 1000

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

  const onFocusIn = (event: FocusEvent) => {
    if (!inComposerDock(event.target)) return
    cancelFade()
  }

  const onFocusOut = (event: FocusEvent) => {
    if (!inComposerDock(event.target)) return
    if (inComposerDock(event.relatedTarget)) return
    scheduleFade()
  }

  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  stop = () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    window.clearTimeout(timer)
    reveal()
    installed = false
    stop = null
  }
  return stop
}
