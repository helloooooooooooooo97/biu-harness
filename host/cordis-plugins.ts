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

export type CordisConfig = {
  host?: CordisPluginEntry[]
  web?: CordisPluginEntry[]
  plugins?: CordisPluginEntry[]
}

const VIRTUAL_UI = 'virtual:cordis-ui-loaders'
const RESOLVED_UI = `\0${VIRTUAL_UI}`
const VIRTUAL_WEB = 'virtual:cordis-web-runtime'
const RESOLVED_WEB = `\0${VIRTUAL_WEB}`

export function rootDirFrom(metaUrl = import.meta.url) {
  return join(dirname(fileURLToPath(metaUrl)), '..')
}

export function splitPackageRef(specifier: string): { name: string; subpath: string } {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/')
    if (parts.length <= 2) return { name: specifier, subpath: '.' }
    return { name: `${parts[0]}/${parts[1]}`, subpath: `./${parts.slice(2).join('/')}` }
  }
  const slash = specifier.indexOf('/')
  if (slash === -1) return { name: specifier, subpath: '.' }
  return { name: specifier.slice(0, slash), subpath: `.${specifier.slice(slash)}` }
}

export function readCordisConfig(root: string): CordisConfig {
  const path = join(root, 'cordis.plugins.json')
  if (!existsSync(path)) return {}
  const body = JSON.parse(readFileSync(path, 'utf8')) as CordisConfig
  return {
    host: Array.isArray(body.host) ? body.host : [],
    web: Array.isArray(body.web) ? body.web : [],
    plugins: Array.isArray(body.plugins) ? body.plugins : [],
  }
}

/** 可热插拔能力插件（hub / ui-hub）。 */
export function readCordisPlugins(root: string): CordisPluginEntry[] {
  return readCordisConfig(root).plugins ?? []
}

export function allConfiguredEntries(root: string): CordisPluginEntry[] {
  const config = readCordisConfig(root)
  return [...(config.host ?? []), ...(config.web ?? []), ...(config.plugins ?? [])]
}

/** 按 package.json name 在 packages/* 里找目录；主仓不写死任何插件包名。 */
export function findWorkspacePackageDir(root: string, packageName: string): string | null {
  const { name } = splitPackageRef(packageName)
  const base = join(root, 'packages')
  if (!existsSync(base)) return null
  for (const dir of readdirSync(base)) {
    const pkgFile = join(base, dir, 'package.json')
    if (!existsSync(pkgFile)) continue
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as { name?: string }
      if (pkg.name === name) return join(base, dir)
    } catch {
      /* skip */
    }
  }
  return null
}

function exportRel(
  exp: string | { default?: string; import?: string } | undefined,
  fallback: string,
) {
  if (typeof exp === 'string') return exp
  if (exp && typeof exp === 'object') return exp.import || exp.default || fallback
  return fallback
}

export function packageEntryFile(pkgDir: string, specifier = '.'): string {
  const { subpath } = specifier.startsWith('.') || specifier === '.' ? { subpath: specifier } : splitPackageRef(specifier)
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
    exports?: Record<string, string | { default?: string; import?: string }>
    main?: string
  }
  const key = subpath === '.' ? '.' : subpath
  const rel = exportRel(pkg.exports?.[key], pkg.main || 'src/index.ts')
  return join(pkgDir, rel)
}

export async function importConfiguredPackage(root: string, packageName: string) {
  const dir = findWorkspacePackageDir(root, packageName)
  if (dir) {
    const entry = packageEntryFile(dir, packageName)
    return import(pathToFileURL(entry).href)
  }
  return import(packageName)
}

export function linkConfiguredPackages(root: string) {
  const names = new Set<string>()
  for (const item of allConfiguredEntries(root)) {
    if (item.package) names.add(splitPackageRef(item.package).name)
    if (item.ui) names.add(splitPackageRef(item.ui).name)
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

function posix(path: string) {
  return path.replace(/\\/g, '/')
}

/** Vite：能力 UI loaders + web 内核加载列表。主仓源码不出现具体包名。 */
export function cordisPluginsVite(root = process.cwd()): VitePlugin {
  return {
    name: 'cordis-plugins',
    resolveId(id) {
      if (id === VIRTUAL_UI) return RESOLVED_UI
      if (id === VIRTUAL_WEB) return RESOLVED_WEB
    },
    load(id) {
      if (id === RESOLVED_UI) {
        const lines: string[] = []
        for (const item of readCordisPlugins(root)) {
          if (!item.ui) continue
          const dir = findWorkspacePackageDir(root, item.ui)
          if (!dir) {
            console.warn(`[cordis-plugins] ui package missing: ${item.ui}`)
            continue
          }
          const entry = posix(packageEntryFile(dir, item.ui))
          lines.push(`  ${JSON.stringify(item.ui)}: () => import(${JSON.stringify(entry)}),`)
        }
        return `export const uiPackageLoaders = {\n${lines.join('\n')}\n}\n`
      }
      if (id === RESOLVED_WEB) {
        const lines: string[] = []
        for (const item of readCordisConfig(root).web ?? []) {
          if (!item.package) continue
          const dir = findWorkspacePackageDir(root, item.package)
          if (!dir) {
            console.warn(`[cordis-plugins] web package missing: ${item.package}`)
            continue
          }
          const entry = posix(packageEntryFile(dir, item.package))
          lines.push(
            `  { id: ${JSON.stringify(item.id)}, load: () => import(${JSON.stringify(entry)}), config: ${JSON.stringify(item.config ?? null)} },`,
          )
        }
        return `export const webRuntimeLoaders = [\n${lines.join('\n')}\n]\n`
      }
      return null
    },
  }
}
