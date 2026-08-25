import type { Plugin } from 'cordis'
import type { CatalogEntry } from './catalog.ts'
import {
  findRepoRoot,
  importConfiguredPackage,
  pluginWebSpecifier,
  readCordisPlugins,
  type CordisPluginEntry,
} from '@biu/host-plugin-loader'

const rootDir = findRepoRoot()

/** 只读 cordis.plugins.json 的 plugins 表。 */
export async function resolveCatalog(): Promise<CatalogEntry[]> {
  const external = readCordisPlugins(rootDir)
  const entries: CatalogEntry[] = []
  const seen = new Set<string>()

  for (const item of external) {
    if (!item.id || !item.package) {
      throw new Error('cordis.plugins.json entry requires id + package')
    }
    if (seen.has(item.id)) {
      throw new Error(`duplicate plugin id in cordis.plugins.json: ${item.id}`)
    }
    const mod = (await importConfiguredPackage(rootDir, item.package)) as Plugin & { inject?: string[] }
    entries.push(toCatalogEntry(item, mod))
    seen.add(item.id)
  }

  return entries
}

function toCatalogEntry(item: CordisPluginEntry, mod: Plugin & { inject?: string[] }): CatalogEntry {
  return {
    id: item.id,
    name: item.name || item.id,
    layer: item.layer === 'web' ? 'web' : 'capability',
    blurb: item.blurb || '',
    plugin: mod,
    inject: mod.inject,
    togglable: item.togglable !== false,
    enabled: item.enabled !== false,
    config: item.config,
    web: pluginWebSpecifier(item),
    packageName: item.package,
  }
}
