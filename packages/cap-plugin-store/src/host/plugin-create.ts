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

const CONTRACT = [
  '契约：id 与 export const name 相同。禁止 import npm / react / @biu/*。不要改 packages/ 或 cordis.plugins.json。',
  'host 与 web 按需，至少一侧。Web：ctx.slots.place("plugin-store-extras", Comp, { key })。货架会给 extras 套 macOS 窗口框（关/缩/全屏），key 尽量用插件 id。',
].join(' ')

const PLUGIN_CREATE_DESCRIPTION = [
  '直写货架：单文件小插件。把 host/web 源码放进本工具参数，立刻编译进 .plugin/<id>/，商店就能看到。',
  '适合一两百行、无相对 import、无多文件。更大或要拆文件请改用 plugin_sandbox + plugin_pack。',
  CONTRACT,
].join(' ')

const PLUGIN_SANDBOX_DESCRIPTION = [
  '开沙箱：多文件/大插件。只建/更新 .plugin-dev/<id>/（manifest.json，可选起点 host.ts / web.tsx），不进货架。',
  '然后用 bash / 文件工具在沙箱里写代码、相对 import。调完必须 plugin_pack 才会打进 .plugin/<id>/。',
  '卸载删货架目录，沙箱还在。',
  CONTRACT,
].join(' ')

const PLUGIN_PACK_DESCRIPTION = [
  '把 .plugin-dev/<id>/ 沙箱打包进 .plugin/<id>/（manifest.json + bundle 后的 host.js / web.js）。',
  '入口：host.ts|tsx|js 与 web.tsx|ts|js，至少要有一个。已打开的插件会重新挂上。',
].join(' ')

function createArgs(args: Record<string, unknown>): PluginCreateInput {
  return {
    id: String(args.id ?? ''),
    name: String(args.name ?? ''),
    blurb: args.blurb != null ? String(args.blurb) : undefined,
    hostJs: args.hostJs != null ? String(args.hostJs) : undefined,
    webJs: args.webJs != null ? String(args.webJs) : undefined,
  }
}

const ID_NAME_BLURB = {
  id: {
    type: 'string',
    description: '插件 id：小写字母开头，仅 [a-z0-9-]，最长 41。',
  },
  name: { type: 'string', description: '商店卡片标题' },
  blurb: { type: 'string', description: '一行简介' },
}

export function registerPluginCreate(ctx: Context, store: PluginStoreService) {
  ctx.tools.register({
    name: 'plugin_create',
    description: PLUGIN_CREATE_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        ...ID_NAME_BLURB,
        hostJs: {
          type: 'string',
          description: 'host.ts 源码，编译成 .plugin/<id>/host.js。可与 webJs 二选一或都给。',
        },
        webJs: {
          type: 'string',
          description: 'web.tsx 源码，编译成 .plugin/<id>/web.js。可与 hostJs 二选一或都给。',
        },
      },
      required: ['id', 'name'],
    },
    execute: async (args) => JSON.stringify(await store.create(createArgs(args))),
  })
  ctx.tools.register({
    name: 'plugin_sandbox',
    description: PLUGIN_SANDBOX_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        ...ID_NAME_BLURB,
        hostJs: {
          type: 'string',
          description: '可选。写入沙箱 host.ts 的起点，大逻辑请在沙箱目录里改。',
        },
        webJs: {
          type: 'string',
          description: '可选。写入沙箱 web.tsx 的起点。',
        },
      },
      required: ['id', 'name'],
    },
    execute: async (args) => JSON.stringify(await store.initSandbox(createArgs(args))),
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
