/** 按人脸颜色 / 外形 / 眼睛取的会话小名。 */
export const MASCOT_COLOR_NAME: Record<string, string> = {
  black: '墨',
  brown: '栗',
  red: '赤',
  orange: '橙',
  yellow: '金',
  green: '翠',
  cyan: '青',
  blue: '蓝',
  violet: '紫',
  magenta: '玫',
  gray: '灰',
}

/** 外形字：团、石、云、叶等，对应 grok 形状。 */
export const MASCOT_SHAPE_NAME: Record<string, string> = {
  blob: '团',
  pebble: '石',
  bean: '豆',
  egg: '蛋',
  squircle: '方',
  tablet: '板',
  capsule: '囊',
  cylinder: '柱',
  hex: '晶',
  gem: '宝',
  crystal: '璃',
  wedge: '角',
  shield: '盾',
  dome: '圆',
  arch: '拱',
  cloud: '云',
  teardrop: '露',
  leaf: '叶',
}

/** 眼睛字：爱、美、新这类称呼，按 rest eye 帧取。 */
export const MASCOT_EYE_NAME = [
  '爱',
  '美',
  '新',
  '灵',
  '闪',
  '笑',
  '圆',
  '星',
  '月',
  '风',
  '暖',
  '安',
  '宁',
  '欢',
  '巧',
  '真',
  '亮',
  '软',
  '糯',
  '萌',
  '宝',
  '喜',
  '乐',
  '盼',
  '安',
] as const

export function nameFromSessionMascot(mascot: { shape: string; color: string; eye?: number }): string {
  const color = MASCOT_COLOR_NAME[mascot.color] ?? '灰'
  const shape = MASCOT_SHAPE_NAME[mascot.shape] ?? '团'
  const eyeIndex =
    typeof mascot.eye === 'number' && Number.isFinite(mascot.eye)
      ? Math.abs(Math.trunc(mascot.eye)) % MASCOT_EYE_NAME.length
      : 0
  const eye = MASCOT_EYE_NAME[eyeIndex] ?? '爱'
  return `小${color}${shape}${eye}`
}
