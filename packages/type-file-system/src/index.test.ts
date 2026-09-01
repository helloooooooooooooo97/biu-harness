import { test } from 'vitest'
import assert from 'node:assert/strict'
import { asImageSrc, emptySchemaValue, normalizeSchemaPack, normalizeSchemaValue, withBuiltinFields } from './index.ts'

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

test('normalizeSchemaValue keeps tags and per-tag values', () => {
  assert.deepEqual(normalizeSchemaValue(null), emptySchemaValue())
  assert.deepEqual(normalizeSchemaValue(['dp', 'io', 'dp']), { tags: ['dp', 'io'], values: {} })
  assert.deepEqual(
    normalizeSchemaValue({ tags: ['dp'], values: { dp: { complexity: 'O(n)' }, skip: 1 } }),
    { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } },
  )
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

test('withBuiltinFields always includes writable schema', () => {
  const fields = withBuiltinFields({ title: { type: 'string', writable: true } })
  assert.equal(fields.schema?.type, 'schema')
  assert.equal(fields.schema?.writable, true)
})
