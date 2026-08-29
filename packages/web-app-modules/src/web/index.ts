import { useSyncExternalStore, type ComponentType } from 'react'
import { Service, type Context } from 'cordis'

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '') || '/'
}

/** 壳只内置 Agent。其它页面（Dashboard / Tasks / Channels…）由插件 register。 */
export type AppModule = {
  id: string
  label: string
  path: string
  /** 额外路径也点亮同一颗图标（例如 File System 各表的旧路由）。 */
  aliases?: string[]
  description?: string
  order?: number
  Icon?: ComponentType<{ className?: string }>
}

const AGENT: AppModule = {
  id: 'agent',
  label: 'Agent',
  path: '/',
  description: 'Session chat, tools, and debug event log',
  order: 0,
}

export const BUILTIN_MODULES: AppModule[] = [AGENT]

function moduleBases(item: AppModule) {
  return [item.path, ...(item.aliases ?? [])].map((entry) => normalizePath(entry)).filter((entry) => entry !== '/')
}

export function matchRegisteredModule(pathname: string, plugins: AppModule[]) {
  const path = normalizePath(pathname)
  const hits = plugins.flatMap((item) =>
    moduleBases(item)
      .filter((base) => path === base || path.startsWith(`${base}/`))
      .map((base) => ({ item, base })),
  )
  hits.sort((a, b) => b.base.length - a.base.length)
  return hits[0]?.item
}

export class AppModulesService extends Service {
  private extras = new Map<string, AppModule>()
  private listeners = new Set<() => void>()
  private seq = 0
  private navReady = false

  constructor(ctx: Context) {
    super(ctx, 'appModules')
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  version = () => this.seq

  plugins(): AppModule[] {
    return [...this.extras.values()].sort(
      (a, b) => (a.order ?? 50) - (b.order ?? 50) || a.id.localeCompare(b.id),
    )
  }

  list(): AppModule[] {
    return [AGENT, ...this.plugins()]
  }

  isNavReady() {
    return this.navReady
  }

  /** 左侧栏等齐：File System 表入口和其它模块一起亮。 */
  markNavReady() {
    if (this.navReady) return
    this.navReady = true
    this.bump()
  }

  register(mod: AppModule) {
    if (!mod.id || !mod.path || !mod.label) throw new Error('appModules.register requires id, path, label')
    const path = normalizePath(mod.path)
    if (path === '/' || path === '/s') throw new Error(`reserved module path: ${mod.path}`)
    return this.ctx.effect(() => {
      this.extras.set(mod.id, { ...mod, path })
      this.bump()
      return () => {
        this.extras.delete(mod.id)
        this.bump()
      }
    }, `appModules.register ${mod.id}`)
  }

  private bump() {
    this.seq += 1
    for (const fn of this.listeners) fn()
  }
}

export function bindAppModules(source: AppModulesService) {
  return function useAppModules(): AppModule[] {
    useSyncExternalStore(source.subscribe, source.version, source.version)
    return source.list()
  }
}

export function bindAppModulesNavReady(source: AppModulesService) {
  return function useAppModulesNavReady(): boolean {
    useSyncExternalStore(source.subscribe, source.version, source.version)
    return source.isNavReady()
  }
}

export function moduleById(id: string, modules: AppModule[] = BUILTIN_MODULES): AppModule {
  return modules.find((item) => item.id === id) ?? AGENT
}

export function moduleIdFromPath(pathname: string, plugins: AppModule[] = []): string {
  const path = normalizePath(pathname)
  const hit = matchRegisteredModule(path, plugins)
  if (hit) return hit.id
  return 'agent'
}

export function isAgentPath(pathname: string, plugins: AppModule[] = []) {
  return moduleIdFromPath(pathname, plugins) === 'agent'
}

export const name = 'appModules'
export const inject = [] as const

export function apply(ctx: Context) {
  const svc = new AppModulesService(ctx)
  ctx.effect(() => {
    const timer = setTimeout(() => svc.markNavReady(), 2500)
    return () => clearTimeout(timer)
  }, 'appModules.navReady.timeout')
}
