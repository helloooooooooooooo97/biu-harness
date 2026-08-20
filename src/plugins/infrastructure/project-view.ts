import { useSyncExternalStore } from 'react'
import { Service, type Context } from 'cordis'
import {
  canPickDirectory,
  deleteSessionDirHandle,
  listDirectory,
  loadSessionDirHandle,
  pickDirectory,
  readTextFile,
  saveSessionDirHandle,
  syncProjectFiles,
  writeTextFile,
  type DirEntry,
  type FsDirHandle,
} from './session-folder.ts'

export interface SessionProjectMeta {
  name: string
  boundAt: number
}

export interface ProjectViewState {
  sessionId: string | null
  project?: SessionProjectMeta
  handleReady: boolean
  synced: boolean
  syncNote?: string
  entries: DirEntry[]
  expanded: string[]
  children: Record<string, DirEntry[]>
  openPath?: string
  content: string
  dirty: boolean
  busy: boolean
  error?: string
}

const empty: ProjectViewState = {
  sessionId: null,
  handleReady: false,
  synced: false,
  entries: [],
  expanded: [],
  children: {},
  content: '',
  dirty: false,
  busy: false,
}

export class ProjectViewService extends Service {
  private value: ProjectViewState = empty
  private listeners = new Set<() => void>()
  private root: FsDirHandle | null = null

  constructor(ctx: Context) {
    super(ctx, 'projectView')
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get = () => this.value

  /** 跟随当前 chat session；切换时加载绑定与句柄。 */
  async attachSession(sessionId: string | null, project?: SessionProjectMeta) {
    if (this.value.sessionId === sessionId && this.value.project?.name === project?.name && this.root) {
      this.replace({ project, error: undefined })
      return
    }
    this.root = null
    this.replace({
      ...empty,
      sessionId,
      project,
      busy: Boolean(sessionId && project),
    })
    if (!sessionId || !project) return
    try {
      const handle = await loadSessionDirHandle(sessionId)
      if (!handle) {
        this.replace({
          busy: false,
          handleReady: false,
          error: '浏览器尚未授权该文件夹，请重新 Open folder',
        })
        return
      }
      this.root = handle
      const entries = await listDirectory(handle)
      this.replace({
        handleReady: true,
        entries,
        busy: false,
        error: undefined,
        expanded: [],
        children: {},
        openPath: undefined,
        content: '',
        dirty: false,
      })
      await this.syncToHost()
    } catch (error) {
      this.replace({ busy: false, handleReady: false, error: String(error) })
    }
  }

  async openFolderForSession(sessionId: string) {
    this.replace({ busy: true, error: undefined })
    try {
      const handle = await pickDirectory()
      await saveSessionDirHandle(sessionId, handle)
      const res = await fetch(`/api/sessions/${sessionId}/project`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: handle.name }),
      })
      const body = (await res.json()) as { project?: SessionProjectMeta; error?: string }
      if (!res.ok) throw new Error(body.error || `绑定失败：${res.status}`)
      this.root = handle
      const entries = await listDirectory(handle)
      this.replace({
        sessionId,
        project: body.project ?? { name: handle.name, boundAt: Date.now() },
        handleReady: true,
        entries,
        expanded: [],
        children: {},
        openPath: undefined,
        content: '',
        dirty: false,
        busy: false,
        error: undefined,
        synced: false,
      })
      await this.syncToHost()
      return this.value.project
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'AbortError' ? undefined : String(error)
      this.replace({ busy: false, error: message })
      throw error
    }
  }

  /** 把浏览器绑定目录同步到 host，供 Agent 工具读取。 */
  async syncToHost() {
    const sessionId = this.value.sessionId
    if (!sessionId || !this.root) return { written: 0, total: 0 }
    this.replace({ busy: true, error: undefined })
    try {
      const result = await syncProjectFiles(sessionId, this.root)
      this.replace({
        busy: false,
        synced: true,
        syncNote: `已同步 ${result.written} 个文本文件到 Agent 工作区`,
        error: undefined,
      })
      return result
    } catch (error) {
      this.replace({ busy: false, synced: false, error: String(error) })
      throw error
    }
  }

  /** Agent 在 host 改写后，写回本机绑定目录。 */
  async applyHostWrite(sessionId: string, path: string, content: string) {
    if (!this.root || this.value.sessionId !== sessionId) return
    try {
      await writeTextFile(this.root, path, content)
      if (this.value.openPath === path) {
        this.replace({ content, dirty: false })
      }
    } catch (error) {
      this.replace({ error: `写回本机失败：${String(error)}` })
    }
  }

  async unbindFolder() {
    const sessionId = this.value.sessionId
    if (!sessionId) return
    this.replace({ busy: true, error: undefined })
    try {
      await deleteSessionDirHandle(sessionId)
      await fetch(`/api/sessions/${sessionId}/project`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: null }),
      })
      this.root = null
      this.replace({ ...empty, sessionId, busy: false })
    } catch (error) {
      this.replace({ busy: false, error: String(error) })
    }
  }

  async toggleDir(path: string) {
    if (!this.root) return
    const expanded = new Set(this.value.expanded)
    if (expanded.has(path)) {
      expanded.delete(path)
      this.replace({ expanded: [...expanded] })
      return
    }
    expanded.add(path)
    if (!this.value.children[path]) {
      try {
        const parts = path.split('/')
        let dir = this.root
        for (const part of parts) dir = await dir.getDirectoryHandle(part)
        const rows = await listDirectory(dir, path)
        this.replace({ expanded: [...expanded], children: { ...this.value.children, [path]: rows } })
        return
      } catch (error) {
        this.replace({ error: String(error) })
        return
      }
    }
    this.replace({ expanded: [...expanded] })
  }

  async openFile(path: string) {
    if (!this.root) return
    if (this.value.dirty && this.value.openPath && this.value.openPath !== path) {
      if (!window.confirm('当前文件未保存，切换将丢弃修改。继续？')) return
    }
    this.replace({ busy: true, error: undefined })
    try {
      const content = await readTextFile(this.root, path)
      this.replace({ openPath: path, content, dirty: false, busy: false })
    } catch (error) {
      this.replace({ busy: false, error: String(error) })
    }
  }

  setContent(content: string) {
    this.replace({ content, dirty: true })
  }

  async save() {
    if (!this.root || !this.value.openPath) return
    this.replace({ busy: true, error: undefined })
    try {
      await writeTextFile(this.root, this.value.openPath, this.value.content)
      this.replace({ dirty: false, busy: false })
    } catch (error) {
      this.replace({ busy: false, error: String(error) })
    }
  }

  supported() {
    return canPickDirectory()
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
