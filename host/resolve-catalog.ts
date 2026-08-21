import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'cordis'
import { builtinCatalog, type CatalogEntry } from './catalog.ts'

export interface ExternalPluginConfig {
  id: string
  name: string
  layer: 'web' | 'capability'
  blurb: string
  package: string
  ui?: string
  togglable: boolean
  enabled: boolean
  config?: unknown
}

interface PluginsFile {
  plugins?: ExternalPluginConfig[]
}

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

async function readPluginsFile(): Promise<ExternalPluginConfig[]> {
  const path = join(rootDir, 'cordis.plugins.json')
  try {
    const raw = await readFile(path, 'utf8')
    const body = JSON.parse(raw) as PluginsFile
    return Array.isArray(body.plugins) ? body.plugins : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** 内置 catalog + cordis.plugins.json 声明的独立包（对齐 dsh 配置组合，瘦实现）。 */
export async function resolveCatalog(): Promise<CatalogEntry[]> {
  const external = await readPluginsFile()
  const externalEntries: CatalogEntry[] = []
  const seen = new Set<string>()

  for (const item of external) {
    if (seen.has(item.id)) {
      throw new Error(`duplicate plugin id in cordis.plugins.json: ${item.id}`)
    }
    const mod = (await import(item.package)) as Plugin & { inject?: string[] }
    externalEntries.push({
      id: item.id,
      name: item.name,
      layer: item.layer,
      blurb: item.blurb,
      plugin: mod,
      inject: mod.inject,
      togglable: item.togglable,
      enabled: item.enabled,
      config: item.config,
      ui: item.ui,
      packageName: item.package,
    })
    seen.add(item.id)
  }

  for (const item of builtinCatalog) {
    if (seen.has(item.id)) {
      throw new Error(`duplicate plugin id with cordis.plugins.json: ${item.id}`)
    }
    seen.add(item.id)
  }

  // 包插件插在 dashboard 之后、其余内置之前，保证 greet 等服务先于 uppercase 等依赖方挂载
  const head = builtinCatalog.filter((item) => item.id === 'dashboard')
  const tail = builtinCatalog.filter((item) => item.id !== 'dashboard')
  return [...head, ...externalEntries, ...tail]
}
