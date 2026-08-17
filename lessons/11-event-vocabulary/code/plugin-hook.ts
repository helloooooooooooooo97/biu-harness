/**
 * 声明合并示例：插件向 SessionEventMap 追加自己的事件类型。
 * 运行时不产生任何代码；tsc --noEmit 会验证合并后的类型。
 */
import type { SessionEventMap } from './events.ts'

declare module './events.ts' {
  interface SessionEventMap {
    'hook/invoked': { hook: string; args: unknown; at: string }
  }
}

export const HOOK_INVOKED = 'hook/invoked'
