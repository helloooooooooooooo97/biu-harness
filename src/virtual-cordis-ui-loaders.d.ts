/** virtual:cordis-ui-loaders — 由 vite cordis-plugins 插件根据 cordis.plugins.json 生成。 */
declare module 'virtual:cordis-ui-loaders' {
  import type { Plugin } from 'cordis'
  export const uiPackageLoaders: Record<string, () => Promise<Plugin>>
}
