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

const PLUGIN_CREATE_DESCRIPTION = [
  '把 Cordis 商店插件写入仓库根 .biu/plugin-catalog/<slug>/（manifest.json + host.js，可选 web.js）。不要用 fs_write/bash 改 packages/ 或 cordis.plugins.json。',
  '没有 .biu/plugin-catalog 时商店显示「没有插件」。本工具会建目录。可交 TS/TSX：当前 host 进程内 esbuild.transform 成 ESM 再落盘，不重启主进程、不跑 Vite。',
  '写完出现在商店，需用户点「安装」才会 hub.adopt 运行。「卸载」只停运行副本（.biu/plugin-store），原文件留在 plugin-catalog。',
  '契约：id 与 export const name 必须相同。Host inject 只能写真正用到的服务（http 等）。Web inject 一般是 ["slots"]。',
  '副作用必须走 ctx，这样卸载时 fiber.dispose 会拆掉。Host：ctx.http.route。Web：ctx.slots.place("plugin-store-extras", Comp, { key: 唯一且稳定 })。禁止 document/window 全局挂载、禁止 setInterval 不清理、禁止 import "react" / "@biu/..." / 相对路径。',
  'Host 最小示例：export const name = "store-echo"; export const inject = ["http"]; export function apply(ctx) { ctx.http.route("GET", "/api/store-echo", (route) => { route.send(200, { ok: true }); }); }',
  'Web 最小示例：export const name = "store-echo-web"; export const inject = ["slots"]; function Banner() { return <div>echo 已运行</div>; } export function apply(ctx) { ctx.slots.place("plugin-store-extras", Banner, { key: "store-echo-banner", order: 10 }); }',
].join(' ')

export function registerPluginCreate(ctx: Context, catalogDir: string) {
  ctx.tools.register({
    name: 'plugin_create',
    description: PLUGIN_CREATE_DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '插件 id：小写字母开头，仅 [a-z0-9-]，最长 41。建议 store-foo。不要用大写或路径。',
        },
        name: { type: 'string', description: '商店卡片标题，给人看的短名' },
        blurb: { type: 'string', description: '一行简介，出现在卡片上' },
        hostJs: {
          type: 'string',
          description:
            'Host 半边完整源码（可 TS）。必须是单一 ESM 文件：export const name（等于 id）、export const inject（数组，只用到的服务如 http）、export function apply(ctx)。副作用只能挂在 ctx 上（如 ctx.http.route）。禁止 import 相对路径、禁止 import react、禁止 import @biu/*。',
        },
        webJs: {
          type: 'string',
          description:
            '可选 Client 半边（可 TSX）。export const name、export const inject=[\'slots\']、export function apply(ctx)。UI 必须 ctx.slots.place(\'plugin-store-extras\', Component, { key })，卸载才能收回。JSX 可用；不要 import react 或任何 npm 包。禁止直接 document.body.append。',
        },
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
