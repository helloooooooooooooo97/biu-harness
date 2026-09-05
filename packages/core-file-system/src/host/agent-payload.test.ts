import { test } from 'vitest'
import assert from 'node:assert/strict'
import { REQUIRED_RECORD_FIELDS, withBuiltinFields, type CollectionSchema } from '@biu/type-file-system'
import { compactAgentSchema, compactAgentToolResult, compactAgentWriteResult } from './agent-payload.ts'

function notesSchema(): CollectionSchema {
  const fields = withBuiltinFields({
    ...REQUIRED_RECORD_FIELDS,
    title: { type: 'string', writable: true },
    status: { type: 'string', writable: true, enum: ['open', 'done'] },
    pinned: { type: 'boolean' },
  })
  for (const [key, field] of Object.entries(fields)) {
    fields[key] = field.computed ? { ...field, writable: false } : field
  }
  return {
    labelField: 'title',
    contentField: 'content',
    fields,
    records: { update: true, create: false, delete: false },
    actions: [
      { id: 'pin', label: '钉住', when: { pinned: false } },
      { id: 'uiOnly', label: '仅界面', for: 'user' },
    ],
  }
}

test('compact schema drops identical builtins and user-only actions', () => {
  const compact = compactAgentSchema(notesSchema())
  assert.equal('id' in ((compact.fields as object) ?? {}), false)
  assert.equal('createdAt' in ((compact.fields as object) ?? {}), false)
  assert.equal('facet' in ((compact.fields as object) ?? {}), false)
  assert.equal('title' in ((compact.fields as object) ?? {}), false)
  assert.deepEqual((compact.fields as Record<string, unknown>).status, {
    type: 'string',
    enum: ['open', 'done'],
  })
  assert.deepEqual((compact.fields as Record<string, unknown>).pinned, { type: 'boolean' })
  assert.equal(compact.labelField, undefined)
  assert.equal(compact.contentField, undefined)
  const actions = compact.actions as Array<{ id: string }>
  assert.equal(actions.some((item) => item.id === 'pin'), true)
  assert.equal(actions.some((item) => item.id === 'uiOnly'), false)
})

test('compact schema keeps overrides of builtin labels', () => {
  const fields = withBuiltinFields({
    ...REQUIRED_RECORD_FIELDS,
    parentId: { type: 'ref', label: '父任务', writable: true },
  })
  const compact = compactAgentSchema({
    labelField: 'title',
    contentField: 'description',
    parentField: 'parentId',
    fields: { ...fields, description: { type: 'file', label: '描述', writable: true } },
  })
  assert.equal(compact.contentField, 'description')
  assert.equal(compact.parentField, 'parentId')
  assert.deepEqual((compact.fields as Record<string, unknown>).parentId, { type: 'ref', label: '父任务' })
  assert.deepEqual((compact.fields as Record<string, unknown>).description, { type: 'file', label: '描述' })
})

test('compact list drops schema; compact stat keeps caps and slim schema', () => {
  const listed = compactAgentToolResult({
    kind: 'collection',
    path: '/notes',
    id: 'notes',
    label: '笔记',
    schema: notesSchema(),
    total: 2,
    offset: 0,
    limit: 50,
    items: [{ id: 'n1', title: '草稿' }],
  }) as Record<string, unknown>
  assert.equal('schema' in listed, false)
  assert.equal('items' in listed, false)
  assert.equal(listed.total, 2)
  assert.deepEqual(listed.columns, ['id', 'title'])
  assert.deepEqual(listed.rows, [['n1', '草稿']])

  const stat = compactAgentToolResult({
    kind: 'collection',
    path: '/notes',
    id: 'notes',
    label: '笔记',
    caps: ['list', 'read', 'update', 'content'],
    schema: notesSchema(),
  }) as Record<string, unknown>
  assert.equal(stat.id, undefined)
  assert.equal(stat.label, '笔记')
  assert.deepEqual(stat.caps, ['list', 'read', 'update', 'content'])
  assert.ok(stat.schema)
  assert.equal('records' in (stat.schema as object), false)
})

test('compact record read omits schema', () => {
  const read = compactAgentToolResult({
    kind: 'record',
    path: '/notes/n1',
    schema: notesSchema(),
    value: { id: 'n1', title: '草稿' },
  }) as Record<string, unknown>
  assert.equal('schema' in read, false)
  assert.deepEqual(read.value, { id: 'n1', title: '草稿' })
})

test('compact list uses columns once; drops empty and path/kind', () => {
  const listed = compactAgentToolResult({
    kind: 'collection',
    path: '/notes',
    total: 2,
    items: [
      { id: 'n1', title: '草稿', tags: [], facet: {}, path: '/notes/n1', kind: 'record' },
      { id: 'n2', title: '另一篇', tags: [], path: '/notes/n2', kind: 'record' },
    ],
  }) as Record<string, unknown>
  assert.deepEqual(listed.columns, ['id', 'title'])
  assert.deepEqual(listed.rows, [
    ['n1', '草稿'],
    ['n2', '另一篇'],
  ])
})

test('compact list drops createdAt/people unless those are the projected columns', () => {
  const listed = compactAgentToolResult({
    kind: 'collection',
    path: '/notes',
    items: [
      {
        id: 'n1',
        title: '草稿',
        createdAt: 1,
        updatedAt: 2,
        createdBy: { kind: 'user', name: '用户' },
        path: '/notes/n1',
        kind: 'record',
      },
    ],
  }) as Record<string, unknown>
  assert.deepEqual(listed.columns, ['id', 'title'])

  const times = compactAgentToolResult({
    kind: 'collection',
    path: '/notes',
    items: [{ id: 'n1', createdAt: 1, path: '/notes/n1', kind: 'record' }],
  }) as Record<string, unknown>
  assert.deepEqual(times.columns, ['id', 'createdAt'])
  assert.deepEqual(times.rows, [['n1', 1]])
})

test('compact root drops view chrome; content write is ok only', () => {
  const root = compactAgentToolResult({
    kind: 'root',
    path: '/',
    items: [
      { id: 'notes', path: '/notes', kind: 'collection', label: '笔记', view: { moduleId: 'notes', route: '/notes', title: '笔记' } },
      { id: 'views', path: '/views', kind: 'collection', label: 'views', view: null },
    ],
  }) as Record<string, unknown>
  assert.deepEqual(root, {
    kind: 'root',
    items: [{ path: '/notes', label: '笔记' }, { path: '/views' }],
  })

  const written = compactAgentToolResult({
    kind: 'content',
    path: '/notes/n1',
    field: 'content',
    command: 'write',
    ok: true,
  }) as Record<string, unknown>
  assert.deepEqual(written, { ok: true, path: '/notes/n1' })
})


test('compact write drops full record; create keeps ids', () => {
  const updated = compactAgentWriteResult({
    kind: 'record',
    path: '/notes/n1',
    value: { id: 'n1', title: '草稿', status: 'open', createdAt: 'x' },
  }) as Record<string, unknown>
  assert.deepEqual(updated, { ok: true, path: '/notes/n1' })

  const acted = compactAgentWriteResult({
    kind: 'record',
    path: '/notes/n1',
    value: { id: 'n1', title: '草稿' },
    result: { assigned: true },
  }) as Record<string, unknown>
  assert.deepEqual(acted, { ok: true, path: '/notes/n1', result: { assigned: true } })

  const created = compactAgentWriteResult({
    kind: 'created',
    path: '/notes',
    items: [{ kind: 'record', path: '/notes/n3', value: { id: 'n3', title: '新' } }],
  }) as Record<string, unknown>
  assert.deepEqual(created, { ok: true, path: '/notes', ids: ['n3'] })
})
