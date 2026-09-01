import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  getInspectorDbPath,
  isInspectorDatabasePath,
  seedInspectorDbPath,
  setInspectorDbPath,
  showRecordInInspector,
  showInInspector,
} from './inspector-db-route.ts'

test('inspector database path does not overwrite after first seed', () => {
  setInspectorDbPath('')
  seedInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
  seedInspectorDbPath('/database/tasks')
  assert.equal(getInspectorDbPath(), '/database/pages')
  setInspectorDbPath('/database/tasks')
  assert.equal(getInspectorDbPath(), '/database/tasks')
})

test('chat routes are not seeded as inspector database paths', () => {
  setInspectorDbPath('')
  assert.equal(isInspectorDatabasePath('/s/abc'), false)
  assert.equal(isInspectorDatabasePath('/database/pages'), true)
  seedInspectorDbPath('/s/abc')
  assert.equal(getInspectorDbPath(), '')
  seedInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
})

test('each inspector database pane keeps its own path', () => {
  setInspectorDbPath('database::a', '/database/pages')
  setInspectorDbPath('database::b', '/database/tasks')
  assert.equal(getInspectorDbPath('database::a'), '/database/pages')
  assert.equal(getInspectorDbPath('database::b'), '/database/tasks')
  seedInspectorDbPath('database::a', '/database/events')
  assert.equal(getInspectorDbPath('database::a'), '/database/pages')
})

test('showRecordInInspector opens the inspector on this record', async () => {
  const tabs: string[] = []
  const onTab = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (typeof detail === 'string') tabs.push(detail)
  }
  window.addEventListener('biu:inspector-tab', onTab)
  const opened = new Promise<void>((resolve) => {
    window.addEventListener('biu:inspector-open', () => resolve(), { once: true })
  })
  showRecordInInspector('/pages', 'p1')
  await opened
  assert.equal(getInspectorDbPath('database:/pages'), '/database/pages/record/p1')
  assert.deepEqual(tabs, ['database:/pages'])
  window.removeEventListener('biu:inspector-tab', onTab)
})

test('showInInspector opens a collection href in the inspector', async () => {
  const tabs: string[] = []
  const onTab = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (typeof detail === 'string') tabs.push(detail)
  }
  window.addEventListener('biu:inspector-tab', onTab)
  const opened = new Promise<void>((resolve) => {
    window.addEventListener('biu:inspector-open', () => resolve(), { once: true })
  })
  showInInspector('/supertags', '/database/supertags/view/builtin-all:/supertags?tag=dp')
  await opened
  assert.equal(getInspectorDbPath('database:/supertags'), '/database/supertags/view/builtin-all:/supertags?tag=dp')
  assert.deepEqual(tabs, ['database:/supertags'])
  window.removeEventListener('biu:inspector-tab', onTab)
})
