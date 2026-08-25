/** virtual:cordis-ui-loaders / virtual:cordis-web-runtime — 由 vite 根据 cordis.plugins.json 生成。 */
declare module 'virtual:cordis-ui-loaders' {
  import type { Plugin } from 'cordis'
  export const uiPackageLoaders: Record<string, () => Promise<Plugin>>
}

declare module 'virtual:cordis-web-runtime' {
  import type { Plugin } from 'cordis'
  export const webRuntimeLoaders: Array<{
    id: string
    load: () => Promise<Plugin>
    config: unknown
  }>
}
