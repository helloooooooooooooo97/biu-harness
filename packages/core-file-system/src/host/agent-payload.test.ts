import { test } from 'vitest'
import assert from 'node:assert/strict'
import { REQUIRED_RECORD_FIELDS, withBuiltinFields, type CollectionSchema } from '@biu/type-file-system'
import { compactAgentSchema, compactAgentToolResult } from './agent-payload.ts'

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
  assert.equal(listed.total, 2)
  assert.deepEqual(listed.items, [{ id: 'n1', title: '草稿' }])

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
