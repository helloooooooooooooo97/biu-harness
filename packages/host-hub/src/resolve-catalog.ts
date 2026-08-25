import type { Plugin } from 'cordis'
import { builtinCatalog, type CatalogEntry } from './catalog.ts'
import {
  importConfiguredPackage,
  readCordisPlugins,
  rootDirFrom,
  type CordisPluginEntry,
} from '../../../host/cordis-plugins.ts'

const rootDir = rootDirFrom()

/** 内置 catalog + cordis.plugins.json（主仓代码不出现具体外部包名）。 */
export async function resolveCatalog(): Promise<CatalogEntry[]> {
  const external = readCordisPlugins(rootDir)
  const externalEntries: CatalogEntry[] = []
  const seen = new Set<string>()

  for (const item of external) {
    if (!item.id || !item.package) {
      throw new Error('cordis.plugins.json entry requires id + package')
    }
    if (seen.has(item.id)) {
      throw new Error(`duplicate plugin id in cordis.plugins.json: ${item.id}`)
    }
    const mod = (await importConfiguredPackage(rootDir, item.package)) as Plugin & { inject?: string[] }
    externalEntries.push(toCatalogEntry(item, mod))
    seen.add(item.id)
  }

  for (const item of builtinCatalog) {
    if (seen.has(item.id)) {
      throw new Error(`duplicate plugin id with cordis.plugins.json: ${item.id}`)
    }
    seen.add(item.id)
  }

  return [...externalEntries, ...builtinCatalog]
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
    ui: item.ui,
    packageName: item.package,
  }
}
