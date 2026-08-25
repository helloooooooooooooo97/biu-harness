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
  web?: string
  packageName?: string
}
