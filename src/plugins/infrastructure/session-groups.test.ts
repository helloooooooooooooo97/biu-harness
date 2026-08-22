import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  UNGROUPED_PROJECT_KEY,
  folderNameFromPath,
  groupSessionsByProject,
  readCollapsedProjects,
  writeCollapsedProjects,
} from './session-groups.ts'
import type { SessionListItem } from './session-view.ts'

function item(partial: Partial<SessionListItem> & { id: string }): SessionListItem {
  return {
    title: partial.title ?? partial.id,
    eventCount: partial.eventCount ?? 1,
    updatedAt: partial.updatedAt ?? 0,
    ...partial,
  }
}

test('groupSessionsByProject groups by path and puts bare chats in Ungrouped', () => {
  const groups = groupSessionsByProject([
    item({
      id: 'a',
      updatedAt: 10,
      project: { name: 'alpha', path: '/tmp/alpha', boundAt: 1 },
    }),
    item({ id: 'b', updatedAt: 30 }),
    item({
      id: 'c',
      updatedAt: 20,
      project: { name: 'alpha', path: '/tmp/alpha', boundAt: 2 },
    }),
    item({
      id: 'd',
      updatedAt: 40,
      project: { name: 'beta', path: '/tmp/beta', boundAt: 3 },
    }),
  ])

  assert.equal(groups.length, 3)
  assert.equal(groups[0]?.key, '/tmp/beta')
  assert.equal(groups[0]?.label, 'beta')
  assert.deepEqual(
    groups[0]?.sessions.map((row) => row.id),
    ['d'],
  )
  assert.equal(groups[1]?.key, '/tmp/alpha')
  assert.deepEqual(
    groups[1]?.sessions.map((row) => row.id),
    ['c', 'a'],
  )
  assert.equal(groups[2]?.key, UNGROUPED_PROJECT_KEY)
  assert.equal(groups[2]?.label, '未分组')
  assert.deepEqual(
    groups[2]?.sessions.map((row) => row.id),
    ['b'],
  )
})

test('folderNameFromPath takes the last segment', () => {
  assert.equal(folderNameFromPath('/Users/me/work/cordis-web/'), 'cordis-web')
  assert.equal(folderNameFromPath('C:\\repos\\demo'), 'demo')
})

test('collapsed project map round-trips through storage', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  }
  writeCollapsedProjects({ '/tmp/a': true }, storage)
  assert.deepEqual(readCollapsedProjects(storage), { '/tmp/a': true })
})
