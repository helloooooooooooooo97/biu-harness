import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

export const SIDEBAR_PROJECT_COLLAPSE_KEY = 'cordis.sidebar.projectCollapsed'

export type SidebarCollapseState = {
  collapsed: Record<string, boolean>
  isCollapsed: (key: string) => boolean
  toggle: (key: string) => void
  setCollapsed: (key: string, collapsed: boolean) => void
  expand: (key: string) => void
}

/** 兼容旧版扁平 `{ [key]: boolean }` 与 zustand persist 包装格式。 */
export function parseSidebarCollapsePersisted(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && 'state' in (parsed as object)) {
      return raw
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ state: { collapsed: parsed }, version: 0 })
    }
  } catch {
    return null
  }
  return null
}

export function createSidebarCollapseStorage(base: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: { name: string; value: string } | null = null
  return {
    getItem: (name) => parseSidebarCollapsePersisted(base.getItem(name)),
    setItem: (name, value) => {
      pending = { name, value }
      if (timer) clearTimeout(timer)
      // 折叠点得很快时合并写盘，避免同步 localStorage 顶掉点击帧
      timer = setTimeout(() => {
        timer = null
        if (!pending) return
        base.setItem(pending.name, pending.value)
        pending = null
      }, 120)
    },
    removeItem: (name) => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pending = null
      base.removeItem(name)
    },
  }
}

export const useSidebarCollapseStore = create<SidebarCollapseState>()(
  persist(
    (set, get) => ({
      collapsed: {},
      isCollapsed: (key) => Boolean(get().collapsed[key]),
      toggle: (key) =>
        set((state) => ({
          collapsed: { ...state.collapsed, [key]: !state.collapsed[key] },
        })),
      setCollapsed: (key, collapsed) =>
        set((state) => ({
          collapsed: { ...state.collapsed, [key]: collapsed },
        })),
      expand: (key) =>
        set((state) => {
          if (!state.collapsed[key]) return state
          return { collapsed: { ...state.collapsed, [key]: false } }
        }),
    }),
    {
      name: SIDEBAR_PROJECT_COLLAPSE_KEY,
      storage: createJSONStorage(() => createSidebarCollapseStorage(localStorage)),
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
)
