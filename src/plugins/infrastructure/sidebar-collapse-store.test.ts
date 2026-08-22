import { test } from 'vitest'
import assert from 'node:assert/strict'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
  SIDEBAR_PROJECT_COLLAPSE_KEY,
  createSidebarCollapseStorage,
  parseSidebarCollapsePersisted,
  type SidebarCollapseState,
} from './sidebar-collapse-store.ts'

test('parseSidebarCollapsePersisted migrates flat legacy map', () => {
  const migrated = parseSidebarCollapsePersisted(JSON.stringify({ '/tmp/a': true }))
  assert.ok(migrated)
  const parsed = JSON.parse(migrated!) as { state: { collapsed: Record<string, boolean> } }
  assert.deepEqual(parsed.state.collapsed, { '/tmp/a': true })
})

test('parseSidebarCollapsePersisted keeps zustand envelope', () => {
  const raw = JSON.stringify({ state: { collapsed: { x: true } }, version: 0 })
  assert.equal(parseSidebarCollapsePersisted(raw), raw)
})

test('zustand persist round-trips collapse map via custom storage', async () => {
  const mem = new Map<string, string>()
  const base = {
    getItem: (key: string) => mem.get(key) ?? null,
    setItem: (key: string, value: string) => {
      mem.set(key, value)
    },
    removeItem: (key: string) => {
      mem.delete(key)
    },
  }
  // seed legacy flat format
  base.setItem(SIDEBAR_PROJECT_COLLAPSE_KEY, JSON.stringify({ '/tmp/legacy': true }))

  const useStore = create<SidebarCollapseState>()(
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
        storage: createJSONStorage(() => createSidebarCollapseStorage(base)),
        partialize: (state) => ({ collapsed: state.collapsed }),
      },
    ),
  )

  await new Promise<void>((resolve) => {
    const unsub = useStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    useStore.persist.rehydrate()
  })

  assert.equal(useStore.getState().isCollapsed('/tmp/legacy'), true)
  useStore.getState().toggle('/tmp/b')
  assert.equal(useStore.getState().isCollapsed('/tmp/b'), true)
  useStore.getState().expand('/tmp/legacy')
  assert.equal(useStore.getState().isCollapsed('/tmp/legacy'), false)

  const saved = JSON.parse(mem.get(SIDEBAR_PROJECT_COLLAPSE_KEY)!) as {
    state: { collapsed: Record<string, boolean> }
  }
  assert.equal(saved.state.collapsed['/tmp/b'], true)
  assert.equal(saved.state.collapsed['/tmp/legacy'], false)
})
