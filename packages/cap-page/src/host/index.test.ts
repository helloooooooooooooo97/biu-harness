import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import { asImageSrc, type CollectionSpec, type FieldType } from '@biu/type-file-system'
import * as page from './index.ts'

const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'boolean',
  'select',
  'multi-select',
  'datetime',
  'bytes',
  'url',
  'image',
  'attachment',
  'file',
  'string[]',
]

test('page plugin registers every field type on /pages without a web module', async () => {
  const ctx = new Context()
  const registered: CollectionSpec[] = []
  class FakeDb extends Service {
    constructor(c: Context) {
      super(c, 'database')
    }
    register(spec: CollectionSpec) {
      registered.push(spec)
    }
  }
  new FakeDb(ctx)
  await ctx.plugin(page)
  assert.equal(page.name, 'page')
  assert.equal(registered[0]?.path, '/pages')
  assert.equal(registered[0]?.view?.route, '/pages')
  assert.equal(registered[0]?.view?.moduleId, 'page')
  const types = new Set(Object.values(registered[0]!.schema.fields).map((field) => field.type))
  for (const type of FIELD_TYPES) assert.equal(types.has(type), true, type)
  const listed = await registered[0]!.list()
  assert.equal(listed.length, page.ROW_COUNT)
  assert.equal(String(listed[0]?.cover).startsWith('data:image/svg+xml;base64,'), true)
  assert.ok(asImageSrc(listed[0]?.cover))
  const written = await registered[0]!.write!('p000', { enabled: false })
  assert.equal(written.enabled, false)
  assert.equal(written.score, listed[0]?.score)
})
