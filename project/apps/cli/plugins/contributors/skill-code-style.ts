/** [contributors] skill-code-style：贡献插件——往技能注册表贡献 code-style 技能（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SkillRegistry, type SkillProvider } from '@mini-dsh/skills'

export const plugin: Plugin<unknown> = {
  name: 'skill-code-style',
  inject: ['skills'],
  apply(ctx: Context) {
    const skills = ctx.get('skills') as SkillRegistry
    return skills.register({
      list: async () => [{ name: 'code-style', description: '代码风格规范' }],
      load: async (name) => (name === 'code-style' ? '两空格缩进，使用 const。' : undefined),
    } satisfies SkillProvider)
  },
}
