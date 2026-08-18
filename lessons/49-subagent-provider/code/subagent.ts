/** 子代理能力缝：Definition + 注册表（第 49 课）。 */

export interface SubagentHandle {
  id: string
  result: Promise<string>
}

export interface SubagentProvider {
  name: string
  spawn(prompt: string, options?: { maxSteps?: number }): SubagentHandle
}

export class SubagentRegistry {
  private readonly providers = new Map<string, SubagentProvider>()

  register(provider: SubagentProvider): () => void {
    if (this.providers.has(provider.name)) throw new Error(`provider 已存在: ${provider.name}`)
    this.providers.set(provider.name, provider)
    return () => this.providers.delete(provider.name)
  }

  get(name: string): SubagentProvider {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`未知 provider: ${name}`)
    return provider
  }
}
