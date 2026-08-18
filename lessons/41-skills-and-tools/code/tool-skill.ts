/** 模型面 skill 工具：list / load（第 41 课）。 */
import type { SkillRegistry } from './skills.ts'

export class SkillTool {
  readonly name = 'skill'
  readonly description = '列出可用技能或加载技能内容'

  constructor(private readonly registry: SkillRegistry) {}

  async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action ?? 'list')
    if (action === 'list') {
      const skills = await this.registry.list()
      return skills.map((s) => `- ${s.name}: ${s.description}`).join('\n') || '(无技能)'
    }
    const name = String(args.name ?? '')
    const content = await this.registry.load(name)
    return content ?? `技能不存在: ${name}`
  }
}
