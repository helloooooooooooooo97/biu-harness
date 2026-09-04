import { test } from 'vitest'
import assert from 'node:assert/strict'
import { databaseAllViewPath } from './database-path.ts'
import {
  getInspectorDbPath,
  isInspectorDatabasePath,
  setInspectorDbPath,
  showRecordInInspector,
  showInInspector,
  applyDatabaseReveal,
  applyDatabaseChannelPayload,
  isInspectorAgentWorking,
  setInspectorAgentWorking,
} from './inspector-db-route.ts'

test('inspector database path is set explicitly', () => {
  setInspectorDbPath('')
  setInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
  setInspectorDbPath('/database/tasks')
  assert.equal(getInspectorDbPath(), '/database/tasks')
})

test('chat routes are not inspector database paths', () => {
  setInspectorDbPath('')
  assert.equal(isInspectorDatabasePath('/s/abc'), false)
  assert.equal(isInspectorDatabasePath('/database/pages'), true)
  setInspectorDbPath('/s/abc')
  assert.equal(getInspectorDbPath(), '')
  setInspectorDbPath('/database/pages')
  assert.equal(getInspectorDbPath(), '/database/pages')
})

test('each inspector database pane keeps its own path', () => {
  setInspectorDbPath('database::a', '/database/pages')
  setInspectorDbPath('database::b', '/database/tasks')
  assert.equal(getInspectorDbPath('database::a'), '/database/pages')
  assert.equal(getInspectorDbPath('database::b'), '/database/tasks')
})

test('window reveal event opens the inspector record path', async () => {
  const tabs: string[] = []
  const onTab = (event: Event) => {
    const detail = (event as CustomEvent).detail
    if (typeof detail === 'string') tabs.push(detail)
  }
  window.addEventListener('biu:inspector-tab', onTab)
  const opened = new Promise<void>((resolve) => {
    window.addEventListener('biu:inspector-open', () => resolve(), { once: true })
  })
  window.dispatchEvent(
    new CustomEvent('biu:inspector-reveal', { detail: { collection: '/pages', recordId: 'from-search' } }),
  )
  await opened
  assert.equal(getInspectorDbPath('database:/pages'), '/database/pages/record/from-search')
  assert.deepEqual(tabs, ['database:/pages'])
  window.removeEventListener('biu:inspector-tab', onTab)
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
  showInInspector('/facets', '/database/facets/view/builtin-all:/facets?facetId=dp')
  await opened
  assert.equal(getInspectorDbPath('database:/facets'), '/database/facets/view/builtin-all:/facets?facetId=dp')
  assert.deepEqual(tabs, ['database:/facets'])
  window.removeEventListener('biu:inspector-tab', onTab)
})

test('applyDatabaseReveal opens the table, or the record when an id is present', () => {
  applyDatabaseReveal({ collection: '/tasks' })
  assert.equal(getInspectorDbPath('database:/tasks'), databaseAllViewPath('/tasks'))
  applyDatabaseReveal({ collection: '/tasks', recordId: 't9' })
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks/record/t9')
  applyDatabaseReveal({ collection: '/' })
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks/record/t9')
})

test('applyDatabaseChannelPayload marks the table as agent-working until done', () => {
  setInspectorAgentWorking('/tasks', false)
  applyDatabaseChannelPayload(
    { phase: 'working', sessionId: 'main', reveal: { collection: '/tasks' } },
    'main',
  )
  assert.equal(isInspectorAgentWorking('/tasks'), true)
  applyDatabaseChannelPayload(
    { phase: 'done', sessionId: 'main', reveal: { collection: '/tasks', recordId: 't1' } },
    'main',
  )
  assert.equal(isInspectorAgentWorking('/tasks'), false)
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks/record/t1')
})

test('applyDatabaseChannelPayload ignores other sessions and unsigned broadcasts', () => {
  setInspectorDbPath('database:/tasks', '/database/tasks')
  setInspectorAgentWorking('/tasks', false)
  applyDatabaseChannelPayload(
    { phase: 'working', sessionId: 'other', reveal: { collection: '/tasks', recordId: 'x' } },
    'main',
  )
  applyDatabaseChannelPayload({ phase: 'working', reveal: { collection: '/tasks', recordId: 'y' } }, 'main')
  applyDatabaseChannelPayload(
    { phase: 'working', sessionId: 'main', reveal: { collection: '/tasks', recordId: 'z' } },
    null,
  )
  assert.equal(isInspectorAgentWorking('/tasks'), false)
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks')
})

test('applyDatabaseReveal opens a saved view when viewId is present', () => {
  applyDatabaseReveal({ collection: '/tasks', viewId: 'board-1' })
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks/view/board-1')
})

test('applyDatabaseChannelPayload upserts a created view then opens it', () => {
  const mem: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => mem[key] ?? null,
      setItem: (key: string, value: string) => {
        mem[key] = value
      },
      removeItem: (key: string) => {
        delete mem[key]
      },
      key: (index: number) => Object.keys(mem)[index] ?? null,
      get length() {
        return Object.keys(mem).length
      },
    },
  })
  applyDatabaseChannelPayload(
    {
      phase: 'done',
      sessionId: 'main',
      reveal: { collection: '/tasks', viewId: 'board-1' },
      savedView: { id: 'board-1', name: '看板', mode: 'board', filters: { status: 'doing' } },
    },
    'main',
  )
  assert.equal(getInspectorDbPath('database:/tasks'), '/database/tasks/view/board-1')
  assert.equal(isInspectorAgentWorking('/tasks'), false)
  const stored = JSON.parse(mem['fsdb.views:/tasks'] ?? '[]') as Array<{ id: string; name: string; mode: string }>
  assert.equal(stored[0]?.id, 'board-1')
  assert.equal(stored[0]?.name, '看板')
  assert.equal(stored[0]?.mode, 'board')
})
