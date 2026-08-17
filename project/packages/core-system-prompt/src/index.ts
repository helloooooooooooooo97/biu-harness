/** core-system-prompt：系统提示词组装（第 20 课）。 */

export interface AssembleContext {
  agentId?: string
  variables: Record<string, string>
}

export type TextProvider = string | ((ctx: AssembleContext) => string)

export interface PromptSection {
  name: string
  order: number
  text: TextProvider
  complete?: boolean
}

export interface PromptContext {
  name: string
  order: number
  text: TextProvider
}

export const SECTION_ORDER = {
  HARNESS_IDENTITY: -100,
  PERSONA: 0,
  TOOL_GUIDANCE: 100,
  RUNTIME_CONTEXT: 200,
} as const

export class SystemPromptAssembler {
  private readonly sections = new Map<string, PromptSection>()
  private readonly contexts = new Map<string, PromptContext>()

  section(section: PromptSection): () => void {
    if (this.sections.has(section.name)) throw new Error(`重复的 section: ${section.name}`)
    this.sections.set(section.name, section)
    return () => this.sections.delete(section.name)
  }

  context(entry: PromptContext): () => void {
    if (this.contexts.has(entry.name)) throw new Error(`重复的 context: ${entry.name}`)
    this.contexts.set(entry.name, entry)
    return () => this.contexts.delete(entry.name)
  }

  assemble(ctx: AssembleContext): string {
    const complete = [...this.sections.values()].filter((s) => s.complete)
    if (complete.length > 1) throw new Error('存在多个 complete section')
    if (complete.length === 1) return this.resolve(complete[0].text, ctx)
    const parts = [
      ...[...this.sections.values()].sort((a, b) => a.order - b.order).map((s) => this.resolve(s.text, ctx)),
      ...[...this.contexts.values()].sort((a, b) => a.order - b.order).map((c) => this.resolve(c.text, ctx)),
    ]
    return parts.filter(Boolean).join('\n\n')
  }

  render(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '')
  }

  private resolve(provider: TextProvider, ctx: AssembleContext): string {
    return typeof provider === 'function' ? provider(ctx) : provider
  }
}
