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

export function matchRegisteredModule(pathname: string, plugins: AppModule[]) {
  const path = normalizePath(pathname)
  return plugins.find((item) => {
    const base = normalizePath(item.path)
    return path === base || path.startsWith(`${base}/`)
  })
}

export class AppModulesService extends Service {
  private extras = new Map<string, AppModule>()
  private listeners = new Set<() => void>()
  private seq = 0

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
  new AppModulesService(ctx)
}
