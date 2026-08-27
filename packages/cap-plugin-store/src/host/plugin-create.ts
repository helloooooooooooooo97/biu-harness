import type { Context } from 'cordis'
import type { PluginStoreService } from './index.ts'

export type PluginCreateInput = {
  id: string
  name: string
  blurb?: string
  hostJs?: string
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

const PLUGIN_CREATE_DESCRIPTION = [
  '把 Cordis 商店插件写入仓库根 .plugin/<id>/（manifest.json，以及按需的 host.js / web.js）。不要用 fs_write/bash 改 packages/ 或 cordis.plugins.json，也不要写 .biu 或 plugin-catalog。',
  'hostJs 与 webJs 按需二选一：只要后端就只交 hostJs；只要前端就只交 webJs；两边都要才两个都交。至少交一个。',
  '没有 .plugin 或目录为空时商店显示「没有插件」。本工具会建 .plugin/<id>/。可交 TS/TSX：当前 host 进程内 esbuild.transform 成 ESM 再落盘。',
  '打开把 enabled 置 1 并运行；关闭停运行并保留 .plugin/<id>/。「卸载」才会删掉 .plugin/<id>/ 代码。没有「安装」。',
  '契约：id 与 export const name 必须相同。副作用必须走 ctx。Host：ctx.http.route。Web：ctx.slots.place("plugin-store-extras", Comp, { key })。',
  'Host 最小示例：export const name = "store-echo"; export const inject = ["http"]; export function apply(ctx) { ctx.http.route("GET", "/api/store-echo", (route) => { route.send(200, { ok: true }); }); }',
  'Web 最小示例：export const name = "store-echo-web"; export const inject = ["slots"]; function Banner() { return <div>echo 已运行</div>; } export function apply(ctx) { ctx.slots.place("plugin-store-extras", Banner, { key: "store-echo-banner", order: 10 }); }',
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
          description: '插件 id：小写字母开头，仅 [a-z0-9-]，最长 41。建议 store-foo。目录就是 .plugin/<id>/。',
        },
        name: { type: 'string', description: '商店卡片标题，给人看的短名' },
        blurb: { type: 'string', description: '一行简介，出现在卡片上' },
        hostJs: {
          type: 'string',
          description:
            '可选。需要后端时交 Host 源码（可 TS）：export const name（等于 id）、export const inject、export function apply(ctx)。不要为了凑数写空 host。',
        },
        webJs: {
          type: 'string',
          description:
            "可选。需要前端时交 Client 源码（可 TSX）：export const name、export const inject=['slots']、export function apply(ctx)。UI 必须 ctx.slots.place('plugin-store-extras', Component, { key })。不要为了凑数写空 web。",
        },
      },
      required: ['id', 'name'],
    },
    execute: async (args) => {
      const result = await store.create({
        id: String(args.id ?? ''),
        name: String(args.name ?? ''),
        blurb: args.blurb != null ? String(args.blurb) : undefined,
        hostJs: args.hostJs != null ? String(args.hostJs) : undefined,
        webJs: args.webJs != null ? String(args.webJs) : undefined,
      })
      return JSON.stringify(result)
    },
  })
}
