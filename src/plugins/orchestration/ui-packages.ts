import type { Plugin } from 'cordis'

/**
 * Vite 需要静态可分析的动态 import。
 * cordis.plugins.json 里的 ui 包名必须在此登记（对齐 dsh client 包清单，瘦实现）。
 */
export const uiPackageLoaders: Record<string, () => Promise<Plugin>> = {
  '@hmr/greeter-ui': async () => import('@hmr/greeter-ui'),
}
