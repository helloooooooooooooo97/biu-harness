import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'

export interface SessionProjectMeta {
  name: string
  path: string
  boundAt: number
}

export interface ProjectViewState {
  sessionId: string | null
  project?: SessionProjectMeta
  busy: boolean
  error?: string
}

const empty: ProjectViewState = {
  sessionId: null,
  busy: false,
}

export class ProjectViewService extends Service {
  private value: ProjectViewState = empty
  private listeners = new Set<() => void>()

  constructor(ctx: Context) {
    super(ctx, 'projectView')
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  /** 跟随当前 chat session。 */
  async attachSession(sessionId: string | null, project?: { name: string; path?: string; boundAt: number }) {
    const bound =
      project?.path
        ? { name: project.name, path: project.path, boundAt: project.boundAt }
        : undefined
    this.replace({
      sessionId,
      project: bound,
      busy: false,
      error: undefined,
    })
  }

  /**
   * 对齐 dsh Choose workspace：host 弹出系统选目录对话框，选中后自动绑定为 Session cwd。
   */
  async openFolderForSession(sessionId: string) {
    this.replace({ busy: true, error: undefined })
    try {
      const res = await fetch(`/api/sessions/${sessionId}/project/pick`, { method: 'POST' })
      const body = (await res.json()) as {
        ok?: boolean
        cancelled?: boolean
        project?: SessionProjectMeta
        error?: string
      }
      if (body.cancelled) {
        this.replace({ busy: false, error: undefined })
        return undefined
      }
      if (!res.ok || !body.project) throw new Error(body.error || `打开文件夹失败：${res.status}`)
      this.replace({
        sessionId,
        project: body.project,
        busy: false,
        error: undefined,
      })
      return this.value.project
    } catch (error) {
      this.replace({ busy: false, error: String(error) })
      throw error
    }
  }

  async unbindFolder() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    this.replace({ busy: true, error: undefined })
    try {
      await fetch(`/api/sessions/${sessionId}/project`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: null }),
      })
      this.replace({ ...empty, sessionId, busy: false })
    } catch (error) {
      this.replace({ busy: false, error: String(error) })
    }
  }

  private replace(patch: Partial<ProjectViewState>) {
    this.value = { ...this.value, ...patch }
    for (const listener of this.listeners) listener()
  }
}

export function bindProjectView(service: ProjectViewService) {
  return function useProjectView<T>(selector: (state: ProjectViewState) => T): T {
    return useSyncExternalStore(
      service.subscribe,
      () => selector(service.get()),
      () => selector(service.get()),
    )
  }
}

export const name = 'project-view'
export const inject = []

export function apply(ctx: Context) {
  new ProjectViewService(ctx)
}
