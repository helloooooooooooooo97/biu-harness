import type { Plugin } from 'cordis'

export interface CatalogEntry {
  id: string
  name: string
  layer: 'web' | 'capability'
  blurb: string
  plugin: Plugin
  inject?: string[]
  togglable: boolean
  enabled: boolean
  config?: unknown
  ui?: string
  packageName?: string
}

/** 能力插件只来自 cordis.plugins.json；此文件不再静态 import 任何插件。 */
export const builtinCatalog: CatalogEntry[] = []
