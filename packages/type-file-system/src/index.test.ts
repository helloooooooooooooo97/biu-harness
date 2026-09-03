import { test } from 'vitest'
import assert from 'node:assert/strict'
import { asImageSrc, emptySchemaValue, hasCollectionDeleteQuery, normalizeSchemaPack, normalizeSchemaValue, recordBuiltinValues, REQUIRED_RECORD_FIELD_KEYS, REQUIRED_RECORD_FIELDS, schemaSearchHaystack, withBuiltinFields } from './index.ts'

test('asImageSrc keeps http, data:image, and same-origin image paths', () => {
  assert.equal(asImageSrc('https://example.com/a.png'), 'https://example.com/a.png')
  assert.equal(asImageSrc('data:image/svg+xml;base64,QQ=='), 'data:image/svg+xml;base64,QQ==')
  assert.equal(asImageSrc('/page-covers/red.png'), '/page-covers/red.png')
  assert.equal(asImageSrc('/covers/photo.webp?v=1'), '/covers/photo.webp?v=1')
  assert.equal(asImageSrc({ src: '/page-covers/blue.png' }), '/page-covers/blue.png')
})

test('asImageSrc rejects scripts and non-image paths', () => {
  assert.equal(asImageSrc('javascript:alert(1)'), '')
  assert.equal(asImageSrc('//evil.example/x.png'), '')
  assert.equal(asImageSrc('/not-an-image.txt'), '')
  assert.equal(asImageSrc('../secret.png'), '')
})

test('schemaSearchHaystack includes facet labels and field values', () => {
  const text = schemaSearchHaystack(
    { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } },
    [{ id: 'dp', label: '动态规划', fields: [] }],
  )
  assert.match(text, /动态规划/)
  assert.match(text, /O\(n\)/)
})

test('normalizeSchemaPack drops nested facet fields and keeps action', () => {
  const pack = normalizeSchemaPack({
    id: 'dp',
    label: '动态规划',
    fields: [
      { key: 'complexity', type: 'string' },
      { key: 'nested', type: 'facet' },
      { key: 'run', type: 'action' },
    ],
  })
  assert.equal(pack?.id, 'dp')
  assert.deepEqual(pack?.fields.map((field) => field.key), ['complexity', 'run'])
})

test('withBuiltinFields always includes writable facet', () => {
  const fields = withBuiltinFields({ title: { type: 'string', writable: true } })
  assert.equal(fields.facet?.type, 'facet')
  assert.equal(fields.facet?.writable, true)
  assert.equal(fields.facet?.label, '类型')
})

test('recordBuiltinValues fills required record columns', () => {
  assert.deepEqual(recordBuiltinValues({}), {
    createdAt: 0,
    updatedAt: 0,
    emoji: '',
    facet: { tags: [], values: {} },
  })
  assert.equal(recordBuiltinValues({ createdAt: 10, emoji: '📄' }).emoji, '📄')
})

test('required record fields are icon, timestamps, and facet', () => {
  assert.deepEqual([...REQUIRED_RECORD_FIELD_KEYS].sort(), ['createdAt', 'emoji', 'facet', 'updatedAt'])
  assert.equal(REQUIRED_RECORD_FIELDS.emoji.type, 'string')
  assert.equal(REQUIRED_RECORD_FIELDS.facet.type, 'facet')
  assert.equal(REQUIRED_RECORD_FIELDS.createdAt.type, 'datetime')
  assert.equal(REQUIRED_RECORD_FIELDS.updatedAt.type, 'datetime')
})

test('hasCollectionDeleteQuery requires ids, q, or a non-empty filter', () => {
  assert.equal(hasCollectionDeleteQuery({}), false)
  assert.equal(hasCollectionDeleteQuery({ ids: [] }), false)
  assert.equal(hasCollectionDeleteQuery({ ids: ['a'] }), true)
  assert.equal(hasCollectionDeleteQuery({ q: '  x ' }), true)
  assert.equal(hasCollectionDeleteQuery({ filter: { status: 'open' } }), true)
  assert.equal(hasCollectionDeleteQuery({ filter: { status: '' } }), false)
})
