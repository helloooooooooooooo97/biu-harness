/** [contributors] tool-skill：贡献插件——把技能注册表包成 skill 工具贡献给工具表（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { MemoryTools } from '@mini-dsh/core-tools'
import { SkillRegistry, SkillTool } from '@mini-dsh/skills'

export const plugin: Plugin<unknown> = {
  name: 'tool-skill',
  inject: ['tools', 'skills'],
  apply(ctx: Context) {
    return (ctx.get('tools') as MemoryTools).register(new SkillTool(ctx.get('skills') as SkillRegistry))
  },
}
