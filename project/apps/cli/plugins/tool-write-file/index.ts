/** tool-write-file 插件：贡献受限的写文件工具（可逆）。 */
import { readFile, writeFile } from 'node:fs/promises'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import { MemoryTools } from '@mini-dsh/core-tools'
import { guardFs, WorkspaceGuard } from '@mini-dsh/guard'

export const plugin: Plugin<unknown> = {
  name: 'tool-write-file',
  inject: ['tools', 'guard'],
  apply(ctx: Context) {
    return (ctx.get('tools') as MemoryTools).register({
      name: 'write_file',
      description: '写入文件（限工作区内）',
      async execute(args) {
        const fs = guardFs({ readFile: (p) => readFile(p, 'utf8'), writeFile }, ctx.get('guard') as WorkspaceGuard)
        await fs.writeFile(String(args.path ?? ''), String(args.content ?? ''))
        return 'ok'
      },
    })
  },
}
