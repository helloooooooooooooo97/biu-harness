/** Shape / palette ids from grok_bot-icon-study replica geometry. */
export const GROK_SHAPES = [
  'blob',
  'pebble',
  'bean',
  'egg',
  'squircle',
  'tablet',
  'capsule',
  'cylinder',
  'hex',
  'gem',
  'crystal',
  'wedge',
  'shield',
  'dome',
  'arch',
  'cloud',
  'teardrop',
  'leaf',
] as const

export const GROK_COLORS = [
  'black',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'violet',
  'magenta',
  'gray',
] as const

export type GrokShape = (typeof GROK_SHAPES)[number]
export type GrokColor = (typeof GROK_COLORS)[number]

export type SessionMascotIdentity = {
  shape: GrokShape
  color: GrokColor
}

export type GrokCharacterLike = {
  setShape: (name: string) => void
  setColor: (id: string, scheme?: string) => void
  setState: (name: string, opts?: { resetEyes?: boolean }) => void
  setMode: (mode: string) => void
  setPaused: (v: boolean) => void
  destroy: () => void
}

export type GrokCharacterCtor = new (
  svg: SVGSVGElement,
  opts?: {
    shape?: string
    color?: string
    scheme?: string
    mode?: string
    state?: string
    sizePx?: number | null
    loginWrap?: boolean
    followPointer?: boolean
    paused?: boolean
    eyeColor?: string | null
  },
) => GrokCharacterLike

declare global {
  interface Window {
    GrokCharacter?: GrokCharacterCtor
    GROK_GEO?: {
      Re: number
      viewBox: { minX: number; minY: number; width: number; height: number }
      shapes: Record<string, { path: string; tiltScale?: number }>
      palette: Record<string, { light: string; dark: string }>
    }
  }
}
