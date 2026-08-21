const SCRIPTS = [
  '/grok-bot/geometry-data.js',
  '/grok-bot/src/math.js',
  '/grok-bot/src/tables.js',
  '/grok-bot/src/pose.js',
  '/grok-bot/src/tricks.js',
  '/grok-bot/src/fx.js',
  '/grok-bot/src/eyes.js',
  '/grok-bot/src/character.js',
] as const

let loadPromise: Promise<void> | null = null

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-grok-bot="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true })
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.dataset.grokBot = src
    el.addEventListener(
      'load',
      () => {
        el.dataset.loaded = '1'
        resolve()
      },
      { once: true },
    )
    el.addEventListener('error', () => reject(new Error(`failed to load ${src}`)), { once: true })
    document.head.appendChild(el)
  })
}

/** Load IIFE replica scripts once; exposes `window.GrokCharacter` + `window.GROK_GEO`. */
export function loadGrokBot(): Promise<void> {
  if (typeof window !== 'undefined' && window.GrokCharacter && window.GROK_GEO) {
    return Promise.resolve()
  }
  if (!loadPromise) {
    loadPromise = SCRIPTS.reduce((chain, src) => chain.then(() => injectScript(src)), Promise.resolve()).catch(
      (err) => {
        loadPromise = null
        throw err
      },
    )
  }
  return loadPromise
}
