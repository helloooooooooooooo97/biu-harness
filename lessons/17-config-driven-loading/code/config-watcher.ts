/**
 * ConfigWatcher：配置热重载的入口。
 * 真实场景由文件监听（chokidar）触发；本课用 push(text) 模拟变更。
 */
import type { ConfigLoader } from './loader.ts'

export class ConfigWatcher {
  private onChange: (() => void) | null = null
  private onError: ((error: unknown) => void) | null = null

  constructor(private readonly loader: ConfigLoader) {}

  /** 订阅变更/失败通知；返回取消函数。 */
  subscribe(onChange: () => void, onError?: (error: unknown) => void): () => void {
    this.onChange = onChange
    this.onError = onError ?? null
    return () => {
      this.onChange = null
      this.onError = null
    }
  }

  /** 模拟配置文件变更：装载成功通知 onChange，失败通知 onError（旧树保留）。 */
  push(text: string): void {
    try {
      this.loader.applyConfig(text)
      this.onChange?.()
    } catch (error) {
      this.onError?.(error)
    }
  }
}
