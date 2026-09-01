import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import * as tools from '@biu/host-tools'
import { DatabaseService, apply as applyFileSystem } from './index.ts'
import type { CollectionSpec } from '@biu/type-file-system'
import { superTagsCollection } from './super-tags-collection.ts'

function notesCollection(): CollectionSpec {
  const rows = new Map<string, { id: string; title: string; status: string; pinned: boolean }>()
  rows.set('n1', { id: 'n1', title: '草稿', status: 'open', pinned: false })
  return {
    id: 'notes',
    path: '/notes',
    label: '笔记',
    view: { moduleId: 'notes-2', route: '/notes-2', title: '笔记2号', order: 40 },
    schema: {
      labelField: 'title',
      fields: {
        title: { type: 'string', writable: true },
        status: { type: 'string', writable: true, enum: ['open', 'done'] },
        pinned: { type: 'boolean' },
      },
    },
    records: { update: true },
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
    update: (id, patch) => {
      const current = rows.get(id)
      if (!current) throw new Error('unknown note')
      const next = { ...current, ...patch, id }
      rows.set(id, next)
      return next
    },
    actions: [
      {
        id: 'pin',
        label: '钉住',
        when: { pinned: false },
        run: (id) => {
          const current = rows.get(id)
          if (!current) throw new Error('unknown note')
          rows.set(id, { ...current, pinned: true })
        },
      },
    ],
  }
}

test('root lists registered collections; record read/update follows schema', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())

  const root = await db.list('/')
  assert.equal(root.kind, 'root')
  assert.deepEqual(
    root.items.map((item) => item.path),
    ['/notes'],
  )
  assert.equal(root.items[0]?.view?.moduleId, 'notes-2')

  const listed = await db.list('/notes')
  assert.equal(listed.kind, 'collection')
  if (listed.kind !== 'collection') return
  assert.equal(listed.items.length, 1)
  assert.equal(listed.items[0]?.title, '草稿')

  const read = await db.read('/notes/n1')
  assert.equal(read.kind, 'record')
  if (read.kind !== 'record') return
  assert.equal(read.value.status, 'open')

  const written = await db.update('/notes/n1', { status: 'done' })
  assert.equal(written.value.status, 'done')
  await assert.rejects(() => db.update('/notes/n1', { pinned: true }), /not writable/)
  await assert.rejects(() => db.update('/notes/n1', { nope: 1 }), /unknown field/)
})

test('computed fields come from list and cannot be written', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register({
    id: 'stats',
    path: '/stats',
    schema: {
      fields: {
        title: { type: 'string', writable: true },
        score: { type: 'number', computed: true },
      },
    },
    list: () => [{ id: 'n1', title: 'a', score: 9 }],
    get: () => ({ id: 'n1', title: 'a', score: 9 }),
    records: { update: true },
    update: (id, patch) => ({ id, title: 'a', score: 9, ...patch }),
  })
  const listed = await db.list('/stats')
  assert.equal(listed.kind, 'collection')
  if (listed.kind !== 'collection') return
  assert.equal(listed.schema.fields.score?.computed, true)
  assert.equal(listed.schema.fields.score?.writable, false)
  assert.equal(listed.items[0]?.score, 9)
  await assert.rejects(() => db.update('/stats/n1', { score: 1 }), /not writable/)
})

test('stat returns schema; list can filter by any field', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const stat = await db.stat('/notes')
  assert.equal(stat.kind, 'collection')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.fields.status?.enum?.[0], 'open')
  const filtered = await db.list('/notes', { status: 'open' })
  assert.equal(filtered.items.length, 1)
  const empty = await db.list('/notes', { status: 'done' })
  assert.equal(empty.items.length, 0)
})

test('every collection schema includes id, title, createdAt and updatedAt', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const stat = await db.stat('/notes')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.labelField, 'title')
  assert.ok(stat.schema.fields.title)
  assert.equal(stat.schema.fields.id?.type, 'string')
  assert.equal(stat.schema.fields.id?.writable, false)
  assert.equal(stat.schema.fields.createdAt?.type, 'datetime')
  assert.equal(stat.schema.fields.updatedAt?.label, '更新时间')
  assert.equal(stat.schema.fields.content?.type, 'file')
  assert.equal(stat.schema.fields.emoji?.writable, true)
  assert.equal(stat.schema.fields.schema?.type, 'schema')
  assert.equal(stat.schema.fields.schema?.writable, true)
  assert.equal(stat.schema.contentField, 'content')
  const tagged = await db.update('/notes/n1', { schema: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } } })
  assert.deepEqual(tagged.value.schema, { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } })
  db.schemaTags.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  const byLabel = await db.list('/notes', undefined, { q: '动态规划' })
  assert.equal(byLabel.items.length, 1)
  const byFilter = await db.list('/notes', { schema: 'dp' })
  assert.equal(byFilter.items.length, 1)
  await assert.rejects(() => db.update('/notes/n1', { createdAt: Date.now() }), /not writable/)
  await assert.rejects(() => db.update('/notes/n1', { id: 'other' }), /not writable/)
})

test('update accepts url image and attachment values', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([
    ['n1', { id: 'n1', title: 'a', link: '', cover: '', file: '' }],
  ])
  db.register({
    id: 'media',
    path: '/media',
    schema: {
      fields: {
        title: { type: 'string', writable: true },
        link: { type: 'url', writable: true },
        cover: { type: 'image', writable: true },
        file: { type: 'attachment', writable: true },
      },
    },
    list: () => [...rows.values()] as { id: string }[],
    get: (id) => rows.get(id) as { id: string } | undefined,
    records: { update: true },
    update: (id, patch) => {
      const next = { ...rows.get(id), ...patch, id }
      rows.set(id, next)
      return next as { id: string }
    },
  })
  const written = await db.update('/media/n1', {
    link: 'https://example.com',
    cover: 'https://example.com/a.png',
    file: { name: 'a.pdf', href: 'https://example.com/a.pdf' },
  })
  assert.equal(written.value.link, 'https://example.com')
  assert.equal(written.value.cover, 'https://example.com/a.png')
  assert.equal((written.value.file as { name: string }).name, 'a.pdf')
  const local = await db.update('/media/n1', { cover: '/page-covers/red.png' })
  assert.equal(local.value.cover, '/page-covers/red.png')
  await assert.rejects(() => db.update('/media/n1', { link: 'javascript:alert(1)' }), /expected url/)
  await assert.rejects(() => db.update('/media/n1', { cover: 'javascript:alert(1)' }), /expected image/)
})

test('content is omitted from list/read and served on its own path', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([
    ['n1', { id: 'n1', title: 'a', content: { kind: 'note', body: { a: 1 } } }],
  ])
  db.register({
    id: 'docs',
    path: '/docs',
    schema: {
      fields: {
        title: { type: 'string', writable: true },
        content: { type: 'file', writable: true },
      },
    },
    list: () => [...rows.values()] as { id: string }[],
    get: (id) => rows.get(id) as { id: string } | undefined,
    records: { update: true },
    update: (id, patch) => {
      const next = { ...rows.get(id), ...patch, id }
      rows.set(id, next)
      return next as { id: string }
    },
  })
  const listed = await db.list('/docs')
  assert.equal('content' in (listed as { items: Array<Record<string, unknown>> }).items[0]!, false)
  const read = await db.read('/docs/n1')
  assert.equal(read.kind, 'record')
  if (read.kind !== 'record') return
  assert.equal('content' in read.value, false)
  const body = await db.content('/docs/n1')
  assert.deepEqual(body.value, { kind: 'note', body: { a: 1 } })
  const written = await db.writeContent('/docs/n1', { kind: 'note', body: { a: 2 } })
  assert.deepEqual(written.value, { kind: 'note', body: { a: 2 } })
})

test('list paginates collection records and reports total', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, { id: string; title: string }>()
  for (let i = 0; i < 60; i++) rows.set(`n${i}`, { id: `n${i}`, title: `笔记 ${String(i).padStart(2, '0')}` })
  db.register({
    id: 'paged',
    path: '/paged',
    schema: { fields: { title: { type: 'string', writable: true } } },
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
  })
  const first = await db.list('/paged')
  assert.equal(first.kind, 'collection')
  if (first.kind !== 'collection') return
  assert.equal(first.total, 60)
  assert.equal(first.limit, 50)
  assert.equal(first.offset, 0)
  assert.equal(first.items.length, 50)
  const second = await db.list('/paged', undefined, { limit: 20, offset: 50, sortField: 'title', sortDir: 'asc' })
  assert.equal(second.kind, 'collection')
  if (second.kind !== 'collection') return
  assert.equal(second.items.length, 10)
  assert.equal(second.total, 60)
  const found = await db.list('/paged', undefined, { q: '笔记 07', limit: 20 })
  assert.equal(found.kind, 'collection')
  if (found.kind !== 'collection') return
  assert.equal(found.total, 1)
  assert.equal(found.items[0]?.id, 'n7')
})

test('apply registers db_* tools', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  class HttpStub extends Service {
    constructor(c: Context) {
      super(c, 'http')
    }
    route() {}
  }
  new HttpStub(ctx)
  await ctx.plugin({ inject: ['tools', 'http'], apply: applyFileSystem })
  const names = ctx.tools.names()
  for (const name of ['db_list', 'db_read', 'db_update', 'db_create', 'db_delete', 'db_stat', 'db_action', 'db_content']) {
    assert.equal(names.includes(name), true, name)
  }
  const listed = await ctx.tools.invoke('db_list', { path: '/' })
  assert.equal((listed as { kind: string }).kind, 'root')
  const paths = ((listed as { items: Array<{ path: string }> }).items ?? []).map((item) => item.path)
  assert.equal(paths.includes('/views'), true)
  assert.equal(paths.includes('/supertags'), true)
})

test('register rejects duplicate view route and nav title', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const dupRoute = notesCollection()
  dupRoute.id = 'notes-b'
  dupRoute.path = '/notes-b'
  dupRoute.view = { ...dupRoute.view!, moduleId: 'notes-b' }
  assert.throws(() => db.register(dupRoute), /路由重复/)
  const dupName = notesCollection()
  dupName.id = 'notes-c'
  dupName.path = '/notes-c'
  dupName.view = { moduleId: 'notes-c', route: '/notes-c', title: '笔记2号' }
  assert.throws(() => db.register(dupName), /名称重复/)
})

test('registered actions run when when-clause matches', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const stat = await db.stat('/notes')
  assert.equal(stat.kind, 'collection')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.actions?.[0]?.id, 'pin')
  assert.equal('run' in (stat.schema.actions?.[0] ?? {}), false)
  const done = await db.action('/notes/n1', 'pin')
  assert.equal((done.value as unknown as { pinned: boolean }).pinned, true)
  await assert.rejects(() => db.action('/notes/n1', 'pin'), /not available/)
})

test('create and delete follow records caps declared at register', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, { id: string; title: string }>()
  rows.set('n1', { id: 'n1', title: '草稿' })
  db.register({
    id: 'notes',
    path: '/notes',
    schema: { fields: { title: { type: 'string', writable: true } } },
    records: { create: true, delete: true },
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
    create: (fields = {}) => {
      const id = `n${rows.size + 1}`
      const row = { id, title: typeof fields.title === 'string' ? fields.title : '未命名' }
      rows.set(id, row)
      return row
    },
    remove: (id) => {
      if (!rows.delete(id)) throw new Error('unknown')
    },
  })
  const stat = await db.stat('/notes')
  assert.equal(stat.kind, 'collection')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.records?.create, true)
  assert.equal(stat.schema.records?.delete, true)
  assert.equal((stat.caps as string[]).includes('create'), true)
  assert.equal((stat.caps as string[]).includes('delete'), true)
  const created = await db.create('/notes', { title: '新笔记' })
  assert.equal(created.value.title, '新笔记')
  const listed = await db.list('/notes')
  if (listed.kind !== 'collection') return
  assert.equal(listed.items.length, 2)
  await db.remove(`${created.path}`)
  const after = await db.list('/notes')
  if (after.kind !== 'collection') return
  assert.equal(after.items.length, 1)
})

test('SuperTag catalog is workspace-wide and collect uses sqlite stamps', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const pages = new Map<string, Record<string, unknown>>([['p1', { id: 'p1', title: '首页' }]])
  db.register({
    id: 'pages',
    path: '/pages',
    schema: { fields: { title: { type: 'string', writable: true } } },
    records: { update: true },
    list: () => [...pages.values()] as { id: string }[],
    get: (id) => pages.get(id) as { id: string } | undefined,
    update: (id, patch) => {
      const next = { ...pages.get(id), ...patch, id }
      pages.set(id, next)
      return next as { id: string }
    },
  })
  db.schemaTags.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  await db.update('/notes/n1', { schema: { tags: ['dp'], values: {} } })
  await db.update('/pages/p1', { schema: { tags: ['dp'], values: {} } })
  const collected = await db.collectSuperTag('动态规划')
  assert.equal(collected.tag?.id, 'dp')
  assert.equal(collected.items.length, 2)
  assert.deepEqual(collected.items.map((item) => item.path).sort(), ['/notes/n1', '/pages/p1'])
})

test('listing /supertags with tag filter returns stamped records as a table', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  db.register(superTagsCollection(db.schemaTags, () => [{ id: 'notes', path: '/notes', label: '笔记' }]))
  db.schemaTags.replace([{ id: 'dp', label: '动态规划', fields: [{ key: 'complexity', type: 'string', label: '复杂度' }] }])
  await db.update('/notes/n1', { schema: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } } })
  const listed = await db.list('/supertags', { tag: 'dp' })
  if (listed.kind !== 'collection') return
  assert.equal(listed.items.length, 1)
  assert.equal(listed.items[0]?.id, 'notes::n1')
  assert.equal(listed.items[0]?.table, '笔记')
  assert.equal(listed.items[0]?.sourceId, 'n1')
  assert.equal(listed.items[0]?.complexity, 'O(n)')
  assert.equal(listed.schema.fields.complexity?.label, '复杂度')
  assert.deepEqual(listed.schema.columns, ['title', 'table', 'complexity'])
})

test('SuperTag list filter asks the collection only for stamped ids', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([
    ['a', { id: 'a', title: 'A' }],
    ['b', { id: 'b', title: 'B' }],
  ])
  let listed: string[] | undefined
  db.register({
    id: 'notes',
    path: '/notes',
    schema: { fields: { title: { type: 'string', writable: true } } },
    records: { update: true },
    list: (query) => {
      listed = query?.ids
      if (query?.ids) return query.ids.map((id) => rows.get(id)).filter(Boolean) as { id: string }[]
      return [...rows.values()] as { id: string }[]
    },
    get: (id) => rows.get(id) as { id: string } | undefined,
    update: (id, patch) => {
      const next = { ...rows.get(id), ...patch, id }
      rows.set(id, next)
      return next as { id: string }
    },
  })
  const empty = await db.list('/notes', { schema: 'dp' })
  if (empty.kind !== 'collection') return
  assert.equal(empty.items.length, 0)
  assert.equal(listed, undefined)
  db.schemaTags.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  await db.update('/notes/a', { schema: { tags: ['dp'], values: {} } })
  listed = undefined
  const filtered = await db.list('/notes', { schema: 'dp' })
  if (filtered.kind !== 'collection') return
  assert.deepEqual(listed, ['a'])
  assert.equal(filtered.items.length, 1)
  assert.equal(filtered.items[0]?.id, 'a')
})

test('tables without records.create/delete reject create and delete', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const stat = await db.stat('/notes')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.records?.create, false)
  assert.equal(stat.schema.records?.delete, false)
  await assert.rejects(() => db.create('/notes'), /cannot create/)
  await assert.rejects(() => db.remove('/notes/n1'), /cannot delete/)
  assert.throws(
    () =>
      db.register({
        id: 'broken',
        path: '/broken',
        schema: { fields: {} },
        records: { create: true },
        list: () => [],
        get: () => null,
      }),
    /必须提供 create/,
  )
})
