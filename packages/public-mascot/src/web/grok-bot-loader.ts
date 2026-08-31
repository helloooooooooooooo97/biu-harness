const GEO_SRC = '/grok-bot/geometry-data.js'

const CHARACTER_SCRIPTS = [
  '/grok-bot/src/math.js',
  '/grok-bot/src/tables.js',
  '/grok-bot/src/pose.js',
  '/grok-bot/src/tricks.js',
  '/grok-bot/src/fx.js',
  '/grok-bot/src/eyes.js',
  '/grok-bot/src/character.js',
] as const

let geoPromise: Promise<void> | null = null
let characterPromise: Promise<void> | null = null

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

/** Geometry + palette only — enough for static session marks (no RAF). */
export function loadGrokGeo(): Promise<void> {
  if (typeof window !== 'undefined' && window.GROK_GEO) return Promise.resolve()
  if (!geoPromise) {
    geoPromise = injectScript(GEO_SRC).catch((err) => {
      geoPromise = null
      throw err
    })
  }
  return geoPromise
}

/**
 * Full character runtime (springs / RAF). Prefer not to call this on the
 * session-switch hot path — static marks via `loadGrokGeo` are enough.
 */
export function loadGrokBot(): Promise<void> {
  if (typeof window !== 'undefined' && window.GrokCharacter && window.GROK_GEO) {
    return Promise.resolve()
  }
  if (!characterPromise) {
    characterPromise = loadGrokGeo()
      .then(() => CHARACTER_SCRIPTS.reduce((chain, src) => chain.then(() => injectScript(src)), Promise.resolve()))
      .catch((err) => {
        characterPromise = null
        throw err
      })
  }
  return characterPromise
}
