/** tool-echo 插件：往工具注册表贡献 echo 工具（可逆）。 */
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { EchoTool, MemoryTools } from '@mini-dsh/core-tools'

export const plugin: Plugin<unknown> = {
  name: 'tool-echo',
  inject: ['tools'],
  apply(ctx: Context) {
    return (ctx.get('tools') as MemoryTools).register(new EchoTool())
  },
}
