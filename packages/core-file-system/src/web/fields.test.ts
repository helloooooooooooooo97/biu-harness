import { test } from 'vitest'
import assert from 'node:assert/strict'
import type { CollectionSchema } from '@biu/type-file-system'
import { defaultColumnKeys, pinLabelColumn, contentFieldKey, flattenTree, formatField, groupField, groupRecords, matchActionWhen, matchesFilters, parentFieldKey, resolveFieldType, sortRows } from './fields'

const schema: CollectionSchema = {
  labelField: 'title',
  fields: {
    title: { type: 'string' },
    status: { type: 'select', enum: ['todo', 'doing', 'done'] },
    tags: { type: 'multi-select' },
    dueAt: { type: 'datetime' },
    size: { type: 'bytes' },
  },
}

test('resolveFieldType maps legacy aliases', () => {
  assert.equal(resolveFieldType({ type: 'string[]' }), 'multi-select')
  assert.equal(resolveFieldType({ type: 'string', enum: ['a'] }), 'select')
  assert.equal(resolveFieldType({ type: 'number', format: 'datetime' }), 'datetime')
  assert.equal(resolveFieldType({ type: 'number', format: 'bytes' }), 'bytes')
  assert.equal(resolveFieldType({ type: 'string', format: 'url' }), 'url')
  assert.equal(resolveFieldType({ type: 'image' }), 'image')
  assert.equal(resolveFieldType({ type: 'attachment' }), 'attachment')
})

test('formatField renders datetime bytes tags and media', () => {
  assert.equal(formatField(schema.fields.size, 2048).endsWith('KB'), true)
  assert.equal(formatField(schema.fields.tags, ['a', 'b']), 'a, b')
  assert.equal(formatField(schema.fields.dueAt, 0), '—')
  assert.equal(formatField({ type: 'url' }, 'https://example.com/x'), 'https://example.com/x')
  assert.equal(formatField({ type: 'url' }, 'javascript:alert(1)'), '—')
  assert.equal(formatField({ type: 'attachment' }, { name: 'a.pdf', href: 'https://cdn.example/a.pdf' }), 'a.pdf')
})

test('filters and sort follow declared column types', () => {
  const rows = [
    { id: '2', title: 'b', status: 'todo', tags: ['x'], dueAt: 20 },
    { id: '1', title: 'a', status: 'doing', tags: ['x', 'y'], dueAt: 10 },
  ]
  assert.equal(matchesFilters(rows[1]!, { status: 'doing' }, schema), true)
  assert.equal(matchesFilters(rows[0]!, { tags: 'y' }, schema), false)
  assert.deepEqual(
    sortRows(rows, schema, 'status', 'asc').map((row) => row.id),
    ['2', '1'],
  )
})

test('matchActionWhen uses field equality including booleans', () => {
  assert.equal(matchActionWhen({ id: '1', enabled: false }, { enabled: false }), true)
  assert.equal(matchActionWhen({ id: '1', enabled: true }, { enabled: false }), false)
})

test('default columns skip id and timestamps unless schema.columns lists them; title stays first', () => {
  const keys = ['id', 'title', 'status', 'createdAt', 'updatedAt', 'content']
  assert.deepEqual(defaultColumnKeys(schema, keys), ['title', 'status'])
  assert.deepEqual(defaultColumnKeys({ ...schema, columns: ['status', 'createdAt'] }, keys), ['title', 'status', 'createdAt'])
  assert.deepEqual(pinLabelColumn(schema, ['status', 'title']), ['title', 'status'])
})

test('contentFieldKey prefers content then contentField then notes', () => {
  assert.equal(contentFieldKey(schema), null)
  assert.equal(
    contentFieldKey({
      labelField: 'title',
      fields: { title: { type: 'string' }, content: { type: 'file' } },
    }),
    'content',
  )
  assert.equal(
    contentFieldKey({
      labelField: 'title',
      contentField: 'notes',
      fields: { title: { type: 'string' }, notes: { type: 'string' } },
    }),
    'notes',
  )
})

test('groupField only groups when a select/multi-select key is chosen', () => {
  assert.equal(groupField(schema), null)
  assert.equal(groupField(schema, 'status')?.key, 'status')
  assert.equal(groupField(schema, 'tags')?.key, 'tags')
  assert.equal(groupField(schema, 'title'), null)
})

test('groupRecords without a field keeps a single bucket', () => {
  const grouped = groupRecords([{ id: '1', title: 'a', status: 'todo' }], schema)
  assert.deepEqual(
    grouped.map((item) => [item.label, item.rows.map((row) => row.id)]),
    [['全部', ['1']]],
  )
})

test('groupRecords puts multi-select rows in every matching column', () => {
  const rows = [
    { id: '1', title: 'a', tags: ['game', 'web'] },
    { id: '2', title: 'b', tags: [] },
  ]
  const grouped = groupRecords(
    rows,
    {
      labelField: 'title',
      fields: { title: { type: 'string' }, tags: { type: 'multi-select', enum: ['game', 'web'] } },
    },
    'tags',
  )
  assert.deepEqual(
    grouped.map((item) => [item.label, item.rows.map((row) => row.id)]),
    [
      ['game', ['1']],
      ['web', ['1']],
      ['未填', ['2']],
    ],
  )
})

test('parentFieldKey reads schema then parentId then data links', () => {
  assert.equal(parentFieldKey(schema), null)
  assert.equal(
    parentFieldKey({
      labelField: 'title',
      parentField: 'owner',
      fields: { title: { type: 'string' }, owner: { type: 'string' } },
    }),
    'owner',
  )
  assert.equal(
    parentFieldKey({
      labelField: 'title',
      fields: { title: { type: 'string' }, parentId: { type: 'string' } },
    }),
    'parentId',
  )
  assert.equal(
    parentFieldKey(
      { labelField: 'title', fields: { title: { type: 'string' }, folder: { type: 'string' } } },
      [
        { id: 'a', title: 'root', folder: '' },
        { id: 'b', title: 'child', folder: 'a' },
      ],
    ),
    'folder',
  )
})

test('flattenTree keeps sibling order, indents children, and hides collapsed subtrees', () => {
  const rows = [
    { id: 'p', title: 'parent' },
    { id: 'c2', title: 'second', parentId: 'p' },
    { id: 'c1', title: 'first', parentId: 'p' },
    { id: 'g', title: 'grand', parentId: 'c1' },
  ]
  assert.deepEqual(
    flattenTree(rows, 'parentId').map((item) => [item.row.id, item.depth, item.hasKids, item.kidCount]),
    [
      ['p', 0, true, 3],
      ['c2', 1, false, 0],
      ['c1', 1, true, 1],
      ['g', 2, false, 0],
    ],
  )
  assert.deepEqual(
    flattenTree(rows, 'parentId', { p: true }).map((item) => item.row.id),
    ['p'],
  )
})

test('defaultColumnKeys omits parentId', () => {
  const treeSchema: CollectionSchema = {
    labelField: 'title',
    fields: { title: { type: 'string' }, parentId: { type: 'string' }, status: { type: 'select' } },
  }
  assert.deepEqual(defaultColumnKeys(treeSchema, ['title', 'parentId', 'status', 'createdAt']), ['title', 'status'])
})

