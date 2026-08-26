import type { SessionListItem } from './index.ts'

export const UNGROUPED_PROJECT_KEY = '__ungrouped__'
export const UNGROUPED_TAG_KEY = '__untagged__'
export const PINNED_GROUP_KEY = '__pinned__'

export type SidebarGroupKind = 'pinned' | 'project' | 'tag' | 'ungrouped'
export type SidebarGroupBy = 'project' | 'tag'

export interface SessionSidebarGroup {
  key: string
  label: string
  path?: string
  sessions: SessionListItem[]
  updatedAt: number
  kind: SidebarGroupKind
}

export function compareSessionRows(a: SessionListItem, b: SessionListItem) {
  const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
  if (pin) return pin
  return b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)
}

function sortGroupSessions(group: SessionSidebarGroup) {
  group.sessions.sort(compareSessionRows)
  group.updatedAt = group.sessions.reduce((max, item) => Math.max(max, item.updatedAt), 0)
}

/** 按绑定文件夹 path 分组；无 path 归入 Ungrouped。组内置顶优先，其余按 updatedAt 降序。 */
export function groupSessionsByProject(sessions: SessionListItem[]): SessionSidebarGroup[] {
  const map = new Map<string, SessionSidebarGroup>()
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
        kind: path ? 'project' : 'ungrouped',
      }
      map.set(key, group)
    }
    group.sessions.push(item)
  }

  const groups = [...map.values()]
  for (const group of groups) sortGroupSessions(group)
  groups.sort((a, b) => {
    if (a.key === UNGROUPED_PROJECT_KEY) return 1
    if (b.key === UNGROUPED_PROJECT_KEY) return -1
    return b.updatedAt - a.updatedAt || a.label.localeCompare(b.label)
  })
  return groups
}

/** 按标签分组；一条会话可出现在多个标签下，无标签归入未标签。 */
export function groupSessionsByTag(sessions: SessionListItem[]): SessionSidebarGroup[] {
  const map = new Map<string, SessionSidebarGroup>()
  const untagged: SessionListItem[] = []
  for (const item of sessions) {
    const tags = (item.tags ?? []).map((tag) => tag.trim()).filter(Boolean)
    if (!tags.length) {
      untagged.push(item)
      continue
    }
    for (const tag of tags) {
      const key = `tag:${tag}`
      let group = map.get(key)
      if (!group) {
        group = { key, label: tag, sessions: [], updatedAt: 0, kind: 'tag' }
        map.set(key, group)
      }
      group.sessions.push(item)
    }
  }
  const groups = [...map.values()]
  for (const group of groups) sortGroupSessions(group)
  groups.sort((a, b) => b.updatedAt - a.updatedAt || a.label.localeCompare(b.label))
  if (untagged.length) {
    const group: SessionSidebarGroup = {
      key: UNGROUPED_TAG_KEY,
      label: '未标签',
      sessions: untagged,
      updatedAt: 0,
      kind: 'ungrouped',
    }
    sortGroupSessions(group)
    groups.push(group)
  }
  return groups
}

export function buildSidebarGroups(sessions: SessionListItem[], groupBy: SidebarGroupBy): SessionSidebarGroup[] {
  const rest = groupBy === 'tag' ? groupSessionsByTag(sessions) : groupSessionsByProject(sessions)
  const pinned = sessions.filter((item) => item.pinned).sort(compareSessionRows)
  if (!pinned.length) return rest
  return [
    {
      key: PINNED_GROUP_KEY,
      label: '置顶',
      sessions: pinned,
      updatedAt: pinned[0]?.updatedAt ?? 0,
      kind: 'pinned',
    },
    ...rest,
  ]
}

export function folderNameFromPath(path: string) {
  const cleaned = path.replace(/[\\/]+$/, '')
  const parts = cleaned.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) || path
}

/** @deprecated 使用 SessionSidebarGroup */
export type SessionProjectGroup = SessionSidebarGroup
