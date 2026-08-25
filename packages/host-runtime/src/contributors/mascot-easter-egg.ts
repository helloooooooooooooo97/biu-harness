import type { Context } from 'cordis'
import '../../types.ts'

export const name = 'mascot-easter-egg'
export const inject = ['tools', 'http']

/**
 * 彩蛋工具：让所有 session 的 mascot 一起跳舞。
 * 通过 WebSocket 广播 'mascot' 频道事件，web 端订阅后让侧栏所有 mascot 播放庆祝动画。
 */
export function apply(ctx: Context) {
  const DANCE_DEFAULT_MS = 8000

  ctx.tools.register({
    name: 'mascot_dance',
    description:
      '彩蛋：让所有 session 对应的 mascot（吉祥物）一起跳舞动起来。可选 durationMs 控制跳舞/庆祝时长（默认 8000ms）。',
    parameters: {
      type: 'object',
      properties: {
        durationMs: {
          type: 'number',
          description: '跳舞持续时长（毫秒），默认 8000。',
        },
        shape: {
          type: 'string',
          enum: ['heart', 'circle', 'square', 'row', 'biu'],
          description: '跳舞队形：heart=心形、circle=圆形、square=方形、row=一排、biu=拼出产品名"biu"。默认 circle。',
        },
      },
    },
    execute: (args) => {
      const durationMs =
        typeof args.durationMs === 'number' && Number.isFinite(args.durationMs) && args.durationMs > 0
          ? Math.min(Math.round(args.durationMs), 60_000)
          : DANCE_DEFAULT_MS
      const rawShape = (args as { shape?: string }).shape
      const shape: 'heart' | 'circle' | 'square' | 'row' | 'biu' =
        rawShape === 'heart' || rawShape === 'circle' || rawShape === 'square' || rawShape === 'row' || rawShape === 'biu'
          ? rawShape
          : 'circle'
      ctx.http.broadcast('mascot', { action: 'dance', durationMs, shape })
      return `已让所有 mascot 开始跳舞，持续 ${durationMs}ms，队形：${shape}。`
    },
  })
}
