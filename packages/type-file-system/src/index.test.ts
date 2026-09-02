import { test } from 'vitest'
import assert from 'node:assert/strict'
import { asImageSrc, emptySchemaValue, normalizeSchemaPack, normalizeSchemaValue, recordBuiltinValues, REQUIRED_RECORD_FIELD_KEYS, REQUIRED_RECORD_FIELDS, schemaSearchHaystack, withBuiltinFields } from './index.ts'

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

test('schemaSearchHaystack includes SuperTag labels and field values', () => {
  const text = schemaSearchHaystack(
    { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } },
    [{ id: 'dp', label: '动态规划', fields: [] }],
  )
  assert.match(text, /动态规划/)
  assert.match(text, /O\(n\)/)
})

test('normalizeSchemaPack drops nested schema fields', () => {
  const pack = normalizeSchemaPack({
    id: 'dp',
    label: '动态规划',
    fields: [
      { key: 'complexity', type: 'string' },
      { key: 'nested', type: 'schema' },
    ],
  })
  assert.equal(pack?.id, 'dp')
  assert.deepEqual(pack?.fields.map((field) => field.key), ['complexity'])
})

test('withBuiltinFields always includes writable SuperTag schema', () => {
  const fields = withBuiltinFields({ title: { type: 'string', writable: true } })
  assert.equal(fields.schema?.type, 'schema')
  assert.equal(fields.schema?.writable, true)
  assert.equal(fields.schema?.label, 'SuperTag')
})

test('recordBuiltinValues fills required record columns', () => {
  assert.deepEqual(recordBuiltinValues({}), {
    createdAt: 0,
    updatedAt: 0,
    emoji: '',
    schema: { tags: [], values: {} },
  })
  assert.equal(recordBuiltinValues({ createdAt: 10, emoji: '📄' }).emoji, '📄')
})

test('required record fields are icon, timestamps, and SuperTag', () => {
  assert.deepEqual([...REQUIRED_RECORD_FIELD_KEYS].sort(), ['createdAt', 'emoji', 'schema', 'updatedAt'])
  assert.equal(REQUIRED_RECORD_FIELDS.emoji.type, 'string')
  assert.equal(REQUIRED_RECORD_FIELDS.schema.type, 'schema')
  assert.equal(REQUIRED_RECORD_FIELDS.createdAt.type, 'datetime')
  assert.equal(REQUIRED_RECORD_FIELDS.updatedAt.type, 'datetime')
})
