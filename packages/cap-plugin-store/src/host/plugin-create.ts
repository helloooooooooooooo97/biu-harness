import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from 'cordis'

export type PluginCreateInput = {
  id: string
  name: string
  blurb?: string
  hostJs: string
  webJs?: string
}

/** 当前进程内把 TS/TSX 编成 ESM 字符串。不 spawn vite/tsc，不 watch，不重启 host。 */
export async function compileStoreModule(source: string, kind: 'host' | 'web') {
  const trimmed = source.trim()
  if (!trimmed) throw new Error(`${kind} source is empty`)
  const { transform } = await import('esbuild')
  const result = await transform(trimmed, {
    loader: kind === 'web' ? 'tsx' : 'ts',
    format: 'esm',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    sourcemap: false,
  })
  let code = result.code.trim()
  if (kind === 'web' && /React\.createElement/.test(code) && !code.includes('globalThis.React')) {
    code = `const React = globalThis.React\n${code}`
  }
  return code.endsWith('\n') ? code : `${code}\n`
}

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

export function catalogSlug(id: string) {
  return id.replace(/^store-/, '')
}

/** 把商店插件三件套写进仓库根 .biu/plugin-catalog/<slug>/（没有 .biu 则创建）。 */
export async function writePluginToCatalog(catalogDir: string, input: PluginCreateInput) {
  const id = String(input.id ?? '').trim()
  const name = String(input.name ?? '').trim()
  const hostJs = String(input.hostJs ?? '').trim()
  if (!isSafeId(id)) throw new Error(`invalid plugin id: ${id}`)
  if (!name) throw new Error('plugin name required')
  if (!hostJs) throw new Error('host.js is empty')
  const dest = join(catalogDir, catalogSlug(id))
  await mkdir(dest, { recursive: true })
  await writeFile(
    join(dest, 'manifest.json'),
    `${JSON.stringify({ id, name, blurb: String(input.blurb ?? '').trim() || name }, null, 2)}\n`,
  )
  await writeFile(join(dest, 'host.js'), await compileStoreModule(hostJs, 'host'))
  const webJs = input.webJs != null ? String(input.webJs).trim() : ''
  if (webJs) {
    await writeFile(join(dest, 'web.js'), await compileStoreModule(webJs, 'web'))
  }
  return { id, catalogPath: dest }
}

export function registerPluginCreate(ctx: Context, catalogDir: string) {
  ctx.tools.register({
    name: 'plugin_create',
    description:
      '把插件写进仓库根目录 .biu/plugin-catalog（manifest.json、host.js，可选 web.js）。没有 .biu 时商店显示没有插件；本工具会按需创建该目录。可交 TypeScript/TSX，在当前 host 进程内编成 ESM 再落盘，不重启主进程、不跑 Vite。写完会出现在插件商店，再点安装。必须 export function apply(ctx)。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '插件 id，小写 kebab-case，如 echo' },
        name: { type: 'string', description: '商店显示名' },
        blurb: { type: 'string', description: '一行简介' },
        hostJs: { type: 'string', description: 'Host 源码（TS 或 ESM JS），进程内编成 host.js' },
        webJs: { type: 'string', description: '可选 Web 源码（TSX/JS），进程内编成 web.js' },
      },
      required: ['id', 'name', 'hostJs'],
    },
    execute: async (args) => {
      const result = await writePluginToCatalog(catalogDir, {
        id: String(args.id ?? ''),
        name: String(args.name ?? ''),
        blurb: args.blurb != null ? String(args.blurb) : undefined,
        hostJs: String(args.hostJs ?? ''),
        webJs: args.webJs != null ? String(args.webJs) : undefined,
      })
      return JSON.stringify(result)
    },
  })
}
