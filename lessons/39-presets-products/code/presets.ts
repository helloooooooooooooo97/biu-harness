/** Agent Presets：会话的能力配方（第 39 课）。 */

export interface AgentPreset {
  name: string
  tools: string[]
  prompt?: string
}

export class PresetRegistry {
  private readonly presets = new Map<string, AgentPreset>()

  constructor(private readonly fallback: AgentPreset) {}

  register(preset: AgentPreset): () => void {
    if (this.presets.has(preset.name)) throw new Error(`preset 已存在: ${preset.name}`)
    this.presets.set(preset.name, preset)
    return () => this.presets.delete(preset.name)
  }

  resolve(name?: string): AgentPreset {
    if (name && this.presets.has(name)) return this.presets.get(name)!
    return this.fallback
  }
}
