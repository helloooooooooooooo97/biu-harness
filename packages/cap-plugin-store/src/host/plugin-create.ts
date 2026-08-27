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

function isSafeId(id: string) {
  return /^[a-z][a-z0-9-]{1,40}$/.test(id)
}

export function catalogSlug(id: string) {
  return id.replace(/^store-/, '')
}

/** 把商店插件三件套写进 cap-plugin-store/fixtures/<slug>/，list() 会自己扫到。 */
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
  await writeFile(join(dest, 'host.js'), hostJs.endsWith('\n') ? hostJs : `${hostJs}\n`)
  const webJs = input.webJs != null ? String(input.webJs).trim() : ''
  if (webJs) {
    await writeFile(join(dest, 'web.js'), webJs.endsWith('\n') ? webJs : `${webJs}\n`)
  }
  return { id, catalogPath: dest }
}

export function registerPluginCreate(ctx: Context, catalogDir: string) {
  ctx.tools.register({
    name: 'plugin_create',
    description:
      '把插件写进商店货架 packages/cap-plugin-store/fixtures（manifest.json、host.js，可选 web.js）。写完会出现在插件商店，再点安装。hostJs 必须是 ESM：export const name、export function apply(ctx)。web 里 React 用 globalThis.React。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '插件 id，小写 kebab-case，如 echo' },
        name: { type: 'string', description: '商店显示名' },
        blurb: { type: 'string', description: '一行简介' },
        hostJs: { type: 'string', description: 'host.js（ESM JavaScript）' },
        webJs: { type: 'string', description: '可选 web.js' },
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
