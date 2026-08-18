/** [registry] skills：注册类插件——提供技能注册表（空容器）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { SkillRegistry } from '@mini-dsh/skills'

export const plugin: Plugin<unknown> = {
  name: 'skills',
  provide: 'skills',
  apply(ctx: Context) {
    ctx.provide('skills', new SkillRegistry())
  },
}
