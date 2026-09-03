export const COMPOSER_BLUR_FADE_MS = 1000

export function bindComposerBlurFade(dock: HTMLElement) {
  let timer = 0
  const reveal = () => {
    window.clearTimeout(timer)
    dock.classList.remove('is-blur-faded')
  }
  const scheduleHide = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (dock.contains(document.activeElement)) return
      dock.classList.add('is-blur-faded')
    }, COMPOSER_BLUR_FADE_MS)
  }
  const onFocusIn = () => reveal()
  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget
    if (next instanceof Node && dock.contains(next)) return
    scheduleHide()
  }
  dock.addEventListener('focusin', onFocusIn)
  dock.addEventListener('focusout', onFocusOut)
  return () => {
    dock.removeEventListener('focusin', onFocusIn)
    dock.removeEventListener('focusout', onFocusOut)
    window.clearTimeout(timer)
    reveal()
  }
}
