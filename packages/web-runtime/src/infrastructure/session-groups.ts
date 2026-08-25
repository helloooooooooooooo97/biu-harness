import type { SessionListItem } from './session-view.ts'

export const UNGROUPED_PROJECT_KEY = '__ungrouped__'

export interface SessionProjectGroup {
  key: string
  /** 展示名：文件夹名，或 Ungrouped */
  label: string
  path?: string
  sessions: SessionListItem[]
  updatedAt: number
}

/** 按绑定文件夹 path 分组；无 path 归入 Ungrouped。组内与组间均按 updatedAt 降序。 */
export function groupSessionsByProject(sessions: SessionListItem[]): SessionProjectGroup[] {
  const map = new Map<string, SessionProjectGroup>()
  for (const item of sessions) {
    const path = item.project?.path?.trim()
    const key = path || UNGROUPED_PROJECT_KEY
    const label = path ? item.project?.name?.trim() || folderNameFromPath(path) : '未分组'
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        label,
        ...(path ? { path } : {}),
        sessions: [],
        updatedAt: 0,
      }
      map.set(key, group)
    }
    group.sessions.push(item)
    if (item.updatedAt > group.updatedAt) group.updatedAt = item.updatedAt
  }

  const groups = [...map.values()]
  for (const group of groups) {
    group.sessions.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  }
  groups.sort((a, b) => {
    if (a.key === UNGROUPED_PROJECT_KEY) return 1
    if (b.key === UNGROUPED_PROJECT_KEY) return -1
    return b.updatedAt - a.updatedAt || a.label.localeCompare(b.label)
  })
  return groups
}

export function folderNameFromPath(path: string) {
  const cleaned = path.replace(/[\\/]+$/, '')
  const parts = cleaned.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) || path
}
