import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from 'cordis'
import type { PluginStoreService } from './index.ts'

export type PluginCreateInput = {
  id: string
  name: string
  blurb?: string
  hostJs?: string
  webJs?: string
}

const HOST_ENTRIES = ['host.ts', 'host.tsx', 'host.js']
const WEB_ENTRIES = ['web.tsx', 'web.ts', 'web.js']

export function findEntry(dir: string, names: string[]) {
  return names.map((name) => join(dir, name)).find((path) => existsSync(path)) ?? null
}

/** 单文件 TS/TSX → ESM（无 bundle）。 */
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
  return finishBundle(result.code, kind)
}

/** 沙箱入口打包：可相对 import 同目录其它文件。 */
export async function bundleStoreEntry(entryFile: string, kind: 'host' | 'web') {
  const { build } = await import('esbuild')
  const result = await build({
    absWorkingDir: dirname(entryFile),
    entryPoints: [entryFile],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    logLevel: 'silent',
  })
  const text = result.outputFiles?.[0]?.text
  if (!text?.trim()) throw new Error(`${kind} bundle is empty`)
  return finishBundle(text, kind)
}

function finishBundle(code: string, kind: 'host' | 'web') {
  let out = code.trim()
  if (kind === 'web' && /React\.createElement/.test(out) && !out.includes('globalThis.React')) {
    out = `const React = globalThis.React\n${out}`
  }
  return out.endsWith('\n') ? out : `${out}\n`
}

export async function readSandboxManifest(dir: string) {
  const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8')) as {
    id?: string
    name?: string
    blurb?: string
  }
  if (!raw.id || !raw.name) throw new Error(`invalid plugin manifest in ${dir}`)
  return { id: raw.id, name: raw.name, blurb: String(raw.blurb ?? '').trim() || raw.name }
}

const PLUGIN_CREATE_DESCRIPTION = [
  '在仓库根 .plugin-dev/<id>/ 开一个插件沙箱（不是最终货架）。用 bash / str_replace_editor 在这个目录里写代码、加文件、相对 import，不要把整份源码塞进本工具参数。',
  '本工具只建/更新沙箱：manifest.json，以及可选写入 host.ts / web.tsx 作为起点。不要改 packages/ 或 cordis.plugins.json。',
  'host 与 web 按需：只要后端就 host.ts，只要前端就 web.tsx，两边都要就两个都有。可以再加 util.ts 等，打包时 esbuild bundle。',
  '调完后必须再调 plugin_pack，才会打进 .plugin/<id>/ 出现在商店。打开/关闭只影响已打包货架；卸载删的是 .plugin/<id>/，沙箱还在。',
  '契约：id 与 export const name 相同。禁止 import npm / react / @biu/*。Web：ctx.slots.place("plugin-store-extras", Comp, { key })。',
].join(' ')

const PLUGIN_PACK_DESCRIPTION = [
  '把 .plugin-dev/<id>/ 沙箱打包进 .plugin/<id>/（manifest.json + 编好的 host.js / web.js）。多文件会 bundle 成各一个入口文件。',
  '入口：host.ts|host.tsx|host.js 与 web.tsx|web.ts|web.js，至少要有一个。调完商店才看得到。已打开的插件会重新挂上。',
].join(' ')

export function registerPluginCreate(ctx: Context, store: PluginStoreService) {
  ctx.tools.register({
    name: 'plugin_create',
    description: PLUGIN_CREATE_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '插件 id：小写字母开头，仅 [a-z0-9-]，最长 41。沙箱目录 .plugin-dev/<id>/。',
        },
        name: { type: 'string', description: '商店卡片标题' },
        blurb: { type: 'string', description: '一行简介' },
        hostJs: {
          type: 'string',
          description: '可选。写入沙箱 host.ts 的起点源码，不是最终货架。大逻辑请用文件工具在沙箱里改。',
        },
        webJs: {
          type: 'string',
          description: '可选。写入沙箱 web.tsx 的起点源码。大逻辑请在沙箱里改。',
        },
      },
      required: ['id', 'name'],
    },
    execute: async (args) => {
      const result = await store.initSandbox({
        id: String(args.id ?? ''),
        name: String(args.name ?? ''),
        blurb: args.blurb != null ? String(args.blurb) : undefined,
        hostJs: args.hostJs != null ? String(args.hostJs) : undefined,
        webJs: args.webJs != null ? String(args.webJs) : undefined,
      })
      return JSON.stringify(result)
    },
  })
  ctx.tools.register({
    name: 'plugin_pack',
    description: PLUGIN_PACK_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要打包的插件 id，对应 .plugin-dev/<id>/' },
      },
      required: ['id'],
    },
    execute: async (args) => JSON.stringify(await store.pack(String(args.id ?? ''))),
  })
}

export { HOST_ENTRIES, WEB_ENTRIES }
