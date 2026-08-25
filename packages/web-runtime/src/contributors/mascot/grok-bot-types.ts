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

/** 静止态可用的眼睛 morph 帧（避开过闭眼/睡眠帧，便于区分角色） */
export const GROK_REST_EYES = [
  0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24,
] as const

export const GROK_EYE_FRAME_COUNT = 25

export type SessionMascotIdentity = {
  shape: GrokShape
  color: GrokColor
  /** 默认静止表情帧（0..24），按 session 稳定分配 */
  eye: number
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
      G9e?: number
      VJt?: number
      viewBox: { minX: number; minY: number; width: number; height: number }
      shapes: Record<
        string,
        {
          path: string
          tiltScale?: number
          face?: { x?: number; y?: number; sx?: number; sy?: number; eye?: number; leftDX?: number }
        }
      >
      palette: Record<string, { light: string; dark: string }>
      /** 各 morph 帧的左右眼多边形 */
      eyes?: number[][][][]
    }
  }
}
