/** 应用级模块：Agent 只是其中之一，路由决定当前模块。 */
export type AppModuleId = 'agent' | 'workspace'

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
    description: 'Session chat, tools, and trajectory ledger',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    path: '/workspace',
    description: 'Project files and context (placeholder)',
  },
]

export function moduleById(id: AppModuleId): AppModule {
  return APP_MODULES.find((item) => item.id === id) ?? APP_MODULES[0]!
}

/** Agent 相关 path（含历史 `/s/:id`）→ agent；其余按模块 path。 */
export function moduleIdFromPath(pathname: string): AppModuleId {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/workspace' || path.startsWith('/workspace/')) return 'workspace'
  return 'agent'
}

export function isAgentPath(pathname: string) {
  return moduleIdFromPath(pathname) === 'agent'
}
