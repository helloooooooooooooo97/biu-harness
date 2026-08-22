/** 应用级模块：Agent 只是其中之一，路由决定当前模块。 */
export type AppModuleId = 'agent' | 'dashboard'

export interface AppModule {
  id: AppModuleId
  label: string
  /** 模块首页 path */
  path: string
  description: string
}

export const APP_MODULES: AppModule[] = [
  {
    id: 'agent',
    label: 'Agent',
    path: '/',
    description: 'Session chat, tools, and debug event log',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    description: 'Usage and project overview console',
  },
]

export function moduleById(id: AppModuleId): AppModule {
  return APP_MODULES.find((item) => item.id === id) ?? APP_MODULES[0]!
}

/** Agent 相关 path（含历史 `/s/:id`）；旧 `/workspace` 收成 agent。 */
export function moduleIdFromPath(pathname: string): AppModuleId {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return 'dashboard'
  return 'agent'
}

export function isAgentPath(pathname: string) {
  return moduleIdFromPath(pathname) === 'agent'
}
