export const COMPOSER_SCROLL_FADE_MS = 220

export function bindChatScrollFade(stage: HTMLElement) {
  let timer = 0
  let prev = stage.scrollTop
  const docks = () => document.querySelectorAll('.chat-composer-dock')
  const fade = () => {
    docks().forEach((node) => node.classList.add('is-scroll-faded'))
  }
  const reveal = () => {
    docks().forEach((node) => node.classList.remove('is-scroll-faded'))
  }
  const onScroll = () => {
    const next = stage.scrollTop
    const dy = Math.abs(next - prev)
    prev = next
    if (dy < 1) return
    if (dy > Math.max(80, stage.clientHeight * 0.45)) return
    fade()
    window.clearTimeout(timer)
    timer = window.setTimeout(reveal, COMPOSER_SCROLL_FADE_MS)
  }
  stage.addEventListener('scroll', onScroll, { passive: true })
  return () => {
    stage.removeEventListener('scroll', onScroll)
    window.clearTimeout(timer)
    reveal()
  }
}
