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
  pathInput: string
  busy: boolean
  error?: string
}

const empty: ProjectViewState = {
  sessionId: null,
  pathInput: '',
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
      pathInput: bound?.path ?? '',
      busy: false,
      error: undefined,
    })
  }

  setPathInput(pathInput: string) {
    this.replace({ pathInput })
  }

  /** 对齐 dsh：把 host 本机绝对路径绑到 Session，Agent 工具直接以此为 cwd。 */
  async bindHostPath(sessionId: string, path = this.value.pathInput) {
    this.replace({ busy: true, error: undefined })
    try {
      const res = await fetch(`/api/sessions/${sessionId}/project`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: path.trim() }),
      })
      const body = (await res.json()) as { project?: SessionProjectMeta; error?: string }
      if (!res.ok) throw new Error(body.error || `绑定失败：${res.status}`)
      this.replace({
        sessionId,
        project: body.project,
        pathInput: body.project?.path ?? path.trim(),
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
