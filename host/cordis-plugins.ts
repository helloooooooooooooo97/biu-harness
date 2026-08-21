import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Plugin as VitePlugin } from 'vite'

export interface CordisPluginEntry {
  id: string
  name?: string
  package?: string
  ui?: string
  layer?: string
  blurb?: string
  togglable?: boolean
  enabled?: boolean
  config?: unknown
}

const VIRTUAL = 'virtual:cordis-ui-loaders'
const RESOLVED = `\0${VIRTUAL}`

export function rootDirFrom(metaUrl = import.meta.url) {
  return join(dirname(fileURLToPath(metaUrl)), '..')
}

export function readCordisPlugins(root: string): CordisPluginEntry[] {
  const path = join(root, 'cordis.plugins.json')
  if (!existsSync(path)) return []
  const body = JSON.parse(readFileSync(path, 'utf8')) as { plugins?: CordisPluginEntry[] }
  return Array.isArray(body.plugins) ? body.plugins : []
}

/** 按 package.json name 在 packages/* 里找目录；主仓不写死任何插件包名。 */
export function findWorkspacePackageDir(root: string, packageName: string): string | null {
  const base = join(root, 'packages')
  if (!existsSync(base)) return null
  for (const dir of readdirSync(base)) {
    const pkgFile = join(base, dir, 'package.json')
    if (!existsSync(pkgFile)) continue
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { name?: string }
      if (pkg.name === packageName) return join(base, dir)
    } catch {
      /* skip */
    }
  }
  return null
}

export function packageEntryFile(pkgDir: string): string {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
    exports?: { '.'?: string | { default?: string; import?: string } }
    main?: string
  }
  const exp = pkg.exports?.['.']
  const rel =
    typeof exp === 'string'
      ? exp
      : typeof exp === 'object'
        ? exp.import || exp.default
        : pkg.main
  return join(pkgDir, rel || 'src/index.ts')
}

/** Node：按配置里的包名动态 import（先扫 packages/*，再 fallback bare specifier）。 */
export async function importConfiguredPackage(root: string, packageName: string) {
  const dir = findWorkspacePackageDir(root, packageName)
  if (dir) {
    const entry = packageEntryFile(dir)
    return import(pathToFileURL(entry).href)
  }
  return import(packageName)
}

/**
 * 把 cordis.plugins.json 里出现的包链到 node_modules，无需在根 package.json 写死依赖名。
 * postinstall / 开发启动前调用。
 */
export function linkConfiguredPackages(root: string) {
  const names = new Set<string>()
  for (const item of readCordisPlugins(root)) {
    if (item.package) names.add(item.package)
    if (item.ui) names.add(item.ui)
  }
  for (const name of names) {
    const dir = findWorkspacePackageDir(root, name)
    if (!dir) {
      console.warn(`[cordis-plugins] package not found under packages/*: ${name}`)
      continue
    }
    const linkPath = join(root, 'node_modules', ...name.split('/'))
    mkdirSync(dirname(linkPath), { recursive: true })
    if (existsSync(linkPath)) {
      try {
        if (lstatSync(linkPath).isSymbolicLink()) rmSync(linkPath)
        else continue
      } catch {
        continue
      }
    }
    symlinkSync(dir, linkPath, 'dir')
  }
}

/** Vite：从配置生成 virtual:cordis-ui-loaders，主仓源码不出现具体 ui 包名。 */
export function cordisPluginsVite(root = process.cwd()): VitePlugin {
  return {
    name: 'cordis-plugins',
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED
    },
    load(id) {
      if (id !== RESOLVED) return null
      const lines: string[] = []
      for (const item of readCordisPlugins(root)) {
        if (!item.ui) continue
        const dir = findWorkspacePackageDir(root, item.ui)
        if (!dir) {
          console.warn(`[cordis-plugins] ui package missing: ${item.ui}`)
          continue
        }
        const entry = packageEntryFile(dir).replace(/\\/g, '/')
        lines.push(`  ${JSON.stringify(item.ui)}: () => import(${JSON.stringify(entry)}),`)
      }
      return `export const uiPackageLoaders = {\n${lines.join('\n')}\n}\n`
    },
    config() {
      const alias: Record<string, string> = {}
      for (const item of readCordisPlugins(root)) {
        for (const name of [item.package, item.ui]) {
          if (!name || alias[name]) continue
          const dir = findWorkspacePackageDir(root, name)
          if (!dir) continue
          alias[name] = packageEntryFile(dir)
        }
      }
      return { resolve: { alias } }
    },
  }
}
