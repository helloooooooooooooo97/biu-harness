/** 服务 key 常量与按 key 寻址的 ServiceRegistry（ctx 的最小形态）。 */

export const SERVICE_KEYS = {
  llm: 'llm',
  sessions: 'sessions',
  tools: 'tools',
  agents: 'agents',
  agentLoop: 'agentLoop',
} as const

export class ServiceRegistry {
  private readonly services = new Map<string, unknown>()

  provide(key: string, impl: unknown): () => void {
    if (this.services.has(key)) throw new Error(`服务已存在: ${key}`)
    this.services.set(key, impl)
    return () => {
      this.services.delete(key)
    }
  }

  get<T>(key: string): T {
    if (!this.services.has(key)) throw new Error(`缺少服务: ${key}`)
    return this.services.get(key) as T
  }

  has(key: string): boolean {
    return this.services.has(key)
  }
}
