import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context, Service } from 'cordis'
import * as tools from '@biu/host-tools'
import { DatabaseService, apply as applyFileSystem } from './index.ts'
import type { CollectionSpec } from '@biu/type-file-system'
import { REQUIRED_RECORD_FIELDS } from '@biu/type-file-system'
import { facetsCollection } from './facets-collection.ts'
import { runWithSession } from '@biu/host-sessions/scope'

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
        ...REQUIRED_RECORD_FIELDS,
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
        ...REQUIRED_RECORD_FIELDS,
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
  assert.equal(stat.schema.fields.tags?.type, 'multi-select')
  assert.equal(stat.schema.fields.tags?.writable, true)
  assert.equal(stat.schema.fields.facet?.type, 'facet')
  assert.equal(stat.schema.fields.facet?.label, '合集')
  assert.equal(stat.schema.fields.facet?.writable, true)
  assert.equal(stat.schema.fields.parentId?.type, 'string')
  assert.equal(stat.schema.fields.parentId?.writable, true)
  assert.equal(stat.schema.fields.parentId?.label, 'Parent ID')
  assert.equal(stat.schema.fields.dependsOn?.type, 'multi-select')
  assert.equal(stat.schema.fields.dependsOn?.writable, true)
  assert.equal(stat.schema.fields.dependsOn?.label, 'Dependency')
  assert.equal(stat.schema.fields.createdBy?.type, 'person')
  assert.equal(stat.schema.fields.createdBy?.writable, true)
  assert.equal(stat.schema.fields.createdBy?.label, '创建人')
  assert.equal(stat.schema.fields.updatedBy?.type, 'person')
  assert.equal(stat.schema.fields.updatedBy?.writable, true)
  assert.equal(stat.schema.fields.updatedBy?.label, '编辑人')
  assert.equal(stat.schema.contentField, 'content')
  const tagged = await db.update('/notes/n1', { facet: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } } })
  assert.deepEqual(tagged.value.facet, { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } })
  db.facets.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  const byLabel = await db.list('/notes', undefined, { q: '动态规划' })
  assert.equal(byLabel.items.length, 1)
  const byFilter = await db.list('/notes', { facet: 'dp' })
  assert.equal(byFilter.items.length, 1)
  await assert.rejects(() => db.update('/notes/n1', { createdAt: Date.now() }), /not writable/)
  await assert.rejects(() => db.update('/notes/n1', { id: 'other' }), /not writable/)
})

test('updates stamp createdBy and updatedBy from the current actor', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const written = await db.update('/notes/n1', { status: 'done' })
  assert.deepEqual(written.value.createdBy, { kind: 'user', name: '用户' })
  assert.deepEqual(written.value.updatedBy, { kind: 'user', name: '用户' })
  const edited = await db.update('/notes/n1', { updatedBy: { kind: 'system', name: '系统' } })
  assert.deepEqual(edited.value.createdBy, { kind: 'user', name: '用户' })
  assert.deepEqual(edited.value.updatedBy, { kind: 'system', name: '系统' })
})

test('person fields accept user system and agent values', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([['n1', { id: 'n1', title: 'a', owner: null }]])
  db.register({
    id: 'people',
    path: '/people',
    schema: {
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string', writable: true },
        owner: { type: 'person', writable: true },
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
  const written = await db.update('/people/n1', { owner: { kind: 'agent', name: '指挥', sessionId: 'sess-1' } })
  assert.deepEqual(written.value.owner, { kind: 'agent', name: '指挥', sessionId: 'sess-1' })
  const system = await db.update('/people/n1', { owner: '系统' })
  assert.deepEqual(system.value.owner, { kind: 'system', name: '系统' })
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
        ...REQUIRED_RECORD_FIELDS,
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
  const bare = await db.update('/media/n1', { link: 'example.com/x' })
  assert.equal(bare.value.link, 'https://example.com/x')
  const emptied = await db.update('/media/n1', { link: '' })
  assert.equal(emptied.value.link, '')
  assert.equal(written.value.cover, 'https://example.com/a.png')
  assert.equal((written.value.file as { name: string }).name, 'a.pdf')
  const local = await db.update('/media/n1', { cover: '/page-covers/red.png' })
  assert.equal(local.value.cover, '/page-covers/red.png')
  const many = await db.update('/media/n1', { cover: ['/page-covers/red.png', 'https://example.com/b.png'] })
  assert.deepEqual(many.value.cover, ['/page-covers/red.png', 'https://example.com/b.png'])
  const manyFiles = await db.update('/media/n1', {
    file: [
      { name: 'a.pdf', href: 'https://cdn.example/a.pdf' },
      { name: 'b.pdf', href: 'https://cdn.example/b.pdf' },
    ],
  })
  assert.equal(Array.isArray(manyFiles.value.file), true)
  const emptyPack = await db.update('/media/n1', { file: '' })
  assert.equal(emptyPack.value.file, '')
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
        ...REQUIRED_RECORD_FIELDS,
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

test('editContent view/str_replace/replace_lines/insert/write', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([
    ['n1', { id: 'n1', title: 'a', content: 'one\ntwo\nthree\nfour' }],
  ])
  db.register({
    id: 'docs',
    path: '/docs',
    schema: {
      fields: {
        ...REQUIRED_RECORD_FIELDS,
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
  const viewed = await db.editContent('/docs/n1', { command: 'view', view_range: [2, 3] })
  assert.equal(viewed.command, 'view')
  assert.equal(viewed.truncated, true)
  assert.match(String(viewed.text), /2\ttwo/)
  assert.equal('value' in viewed, false)
  const replaced = await db.editContent('/docs/n1', { command: 'str_replace', old_str: 'two', new_str: 'TWO' })
  assert.equal(replaced.ok, true)
  assert.equal('value' in replaced, false)
  assert.equal((await db.content('/docs/n1')).value, 'one\nTWO\nthree\nfour')
  await db.editContent('/docs/n1', { command: 'replace_lines', start_line: 3, end_line: 4, new_str: 'C\nD' })
  assert.equal((await db.content('/docs/n1')).value, 'one\nTWO\nC\nD')
  await db.editContent('/docs/n1', { command: 'insert', insert_line: 1, new_str: 'mid' })
  assert.equal((await db.content('/docs/n1')).value, 'one\nmid\nTWO\nC\nD')
  await db.editContent('/docs/n1', { command: 'write', value: 'done' })
  assert.equal((await db.content('/docs/n1')).value, 'done')
})

test('list paginates collection records and reports total', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, { id: string; title: string }>()
  for (let i = 0; i < 60; i++) rows.set(`n${i}`, { id: `n${i}`, title: `笔记 ${String(i).padStart(2, '0')}` })
  db.register({
    id: 'paged',
    path: '/paged',
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string', writable: true } } },
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
  assert.equal(paths.includes('/facets'), true)
})

test('db_list on a table broadcasts inspector working then done', async () => {
  const seen: Array<{ type: string; payload: unknown }> = []
  const ctx = new Context()
  await ctx.plugin(tools)
  class HttpStub extends Service {
    constructor(c: Context) {
      super(c, 'http')
    }
    route() {}
    broadcast(type: string, payload: unknown) {
      seen.push({ type, payload })
    }
  }
  new HttpStub(ctx)
  await ctx.plugin({ inject: ['tools', 'http'], apply: applyFileSystem })
  await runWithSession('s1', () => ctx.tools.invoke('db_list', { path: '/views' }))
  const reveals = seen.filter((item) => {
    const payload = item.payload as { reveal?: { collection?: string }; phase?: string }
    return item.type === 'database' && payload?.reveal?.collection === '/views'
  })
  assert.equal((reveals[0]?.payload as { phase?: string; sessionId?: string }).phase, 'working')
  assert.equal((reveals[0]?.payload as { sessionId?: string }).sessionId, 's1')
  assert.equal((reveals.at(-1)?.payload as { phase?: string; sessionId?: string }).phase, 'done')
  assert.equal((reveals.at(-1)?.payload as { sessionId?: string }).sessionId, 's1')
  const before = seen.length
  await ctx.tools.invoke('db_list', { path: '/' })
  const extra = seen.slice(before).filter((item) => {
    const payload = item.payload as { reveal?: unknown }
    return item.type === 'database' && payload?.reveal
  })
  assert.equal(extra.length, 0)
})

test('db_create /views reveals the source table and view', async () => {
  const seen: Array<{ type: string; payload: unknown }> = []
  const ctx = new Context()
  await ctx.plugin(tools)
  class HttpStub extends Service {
    constructor(c: Context) {
      super(c, 'http')
    }
    route() {}
    broadcast(type: string, payload: unknown) {
      seen.push({ type, payload })
    }
  }
  new HttpStub(ctx)
  await ctx.plugin({ inject: ['tools', 'http'], apply: applyFileSystem })
  const db = ctx.get('database') as DatabaseService
  db.register(notesCollection())
  const created = await runWithSession('s1', () =>
    ctx.tools.invoke('db_create', {
      path: '/views',
      records: [{ tablePath: '/notes', title: '看板', mode: 'graph' }],
    }),
  )
  const row = (created as { items: Array<{ value: { tablePath?: string; viewId?: string; title?: string } }> }).items[0]?.value
  assert.equal(row?.tablePath, '/notes')
  assert.equal(row?.title, '看板')
  assert.equal(typeof row?.viewId, 'string')
  const done = [...seen].reverse().find((item) => {
    const payload = item.payload as { phase?: string; reveal?: { collection?: string; viewId?: string } }
    return item.type === 'database' && payload?.phase === 'done' && payload.reveal?.collection === '/notes'
  })
  const payload = done?.payload as {
    sessionId?: string
    reveal?: { collection?: string; viewId?: string }
    savedView?: { name?: string; mode?: string }
  }
  assert.equal(payload.sessionId, 's1')
  assert.equal(payload.reveal?.viewId, row?.viewId)
  assert.equal(payload.savedView?.name, '看板')
  assert.equal(payload.savedView?.mode, 'graph')
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

test('allowMissing actions can run before the record exists', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, { id: string; title: string }>()
  db.register({
    id: 'notes',
    path: '/notes',
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string' } } },
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
    actions: [
      {
        id: 'seed',
        label: 'seed',
        allowMissing: true,
        run: (id) => {
          rows.set(id, { id, title: 'seeded' })
          return { id }
        },
      },
    ],
  })
  const done = await db.action('/notes/n9', 'seed')
  assert.deepEqual(done.result, { id: 'n9' })
  assert.equal((await db.read('/notes/n9')).kind, 'record')
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
  const pinned = await db.action('/notes/n1', 'pin')
  assert.equal((pinned.value as unknown as { pinned: boolean }).pinned, true)
  await assert.rejects(() => db.action('/notes/n1', 'pin'), /not available/)
})

test('agent-only actions stay in schema but have empty placement', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register({
    ...notesCollection(),
    actions: [
      { id: 'pin', label: '钉住', when: { pinned: false }, run: async () => ({}) },
      { id: 'progress', label: '进度', for: 'agent', run: async () => ({}) },
    ],
  })
  const stat = await db.stat('/notes')
  if (stat.kind !== 'collection') return
  const progress = stat.schema.actions?.find((item) => item.id === 'progress')
  assert.equal(progress?.for, 'agent')
  assert.deepEqual(progress?.placement, [])
  assert.equal(JSON.parse(JSON.stringify(progress)).for, 'agent')
})

test('create and delete follow records caps declared at register', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, { id: string; title: string }>()
  rows.set('n1', { id: 'n1', title: '草稿' })
  db.register({
    id: 'notes',
    path: '/notes',
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string', writable: true } } },
    records: { create: true, delete: true },
    list: () => [...rows.values()],
    get: (id) => rows.get(id) ?? null,
    create: (incoming) =>
      incoming.map((fields) => {
        const id = `n${rows.size + 1}`
        const row = { id, title: typeof fields.title === 'string' ? fields.title : '未命名' }
        rows.set(id, row)
        return row
      }),
    remove: (query) => {
      const ids = query.ids ?? []
      for (const id of ids) {
        if (!rows.delete(id)) throw new Error('unknown')
      }
      return ids
    },
  })
  const stat = await db.stat('/notes')
  assert.equal(stat.kind, 'collection')
  if (stat.kind !== 'collection') return
  assert.equal(stat.schema.records?.create, true)
  assert.equal(stat.schema.records?.delete, true)
  assert.equal((stat.caps as string[]).includes('create'), true)
  assert.equal((stat.caps as string[]).includes('delete'), true)
  const created = await db.create('/notes', [{ title: '新笔记' }, { title: '第二篇' }])
  assert.equal(created.items.length, 2)
  assert.equal(created.items[0]?.value.title, '新笔记')
  const listed = await db.list('/notes')
  if (listed.kind !== 'collection') return
  assert.equal(listed.items.length, 3)
  await db.remove('/notes', { ids: [String(created.items[0]?.value.id)] })
  const afterOne = await db.list('/notes')
  if (afterOne.kind !== 'collection') return
  assert.equal(afterOne.items.length, 2)
  await db.remove('/notes', { q: '第二篇' })
  const after = await db.list('/notes')
  if (after.kind !== 'collection') return
  assert.equal(after.items.length, 1)
  await assert.rejects(() => db.remove('/notes', {}), /delete requires/)
})

test('facet catalog is workspace-wide and collect uses sqlite stamps', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  const pages = new Map<string, Record<string, unknown>>([['p1', { id: 'p1', title: '首页' }]])
  db.register({
    id: 'pages',
    path: '/pages',
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string', writable: true } } },
    records: { update: true },
    list: () => [...pages.values()] as { id: string }[],
    get: (id) => pages.get(id) as { id: string } | undefined,
    update: (id, patch) => {
      const next = { ...pages.get(id), ...patch, id }
      pages.set(id, next)
      return next as { id: string }
    },
  })
  db.facets.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  await db.update('/notes/n1', { facet: { tags: ['dp'], values: {} } })
  await db.update('/pages/p1', { facet: { tags: ['dp'], values: {} } })
  const collected = await db.collectFacet('动态规划')
  assert.equal(collected.facet?.id, 'dp')
  assert.equal(collected.items.length, 2)
  assert.deepEqual(collected.items.map((item) => item.path).sort(), ['/notes/n1', '/pages/p1'])
})

test('listing /facets with tag filter returns stamped records as a table', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(notesCollection())
  db.register(facetsCollection(db.facets, () => [{ id: 'notes', path: '/notes', label: '笔记' }]))
  db.facets.replace([{ id: 'dp', label: '动态规划', fields: [{ key: 'complexity', type: 'string', label: '复杂度' }] }])
  await db.update('/notes/n1', { facet: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } } })
  const listed = await db.list('/facets', { facetId: 'dp' })
  if (listed.kind !== 'collection') return
  assert.equal(listed.items.length, 1)
  assert.equal(listed.items[0]?.id, 'notes::n1')
  assert.equal(listed.items[0]?.table, '笔记')
  assert.equal(listed.items[0]?.sourceId, 'n1')
  assert.equal(listed.items[0]?.complexity, 'O(n)')
  assert.equal(listed.schema.fields.complexity?.label, '复杂度')
  assert.deepEqual(listed.schema.columns, ['title', 'table', 'complexity'])
})

test('facet list filter asks the collection only for stamped ids', async () => {
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
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string', writable: true } } },
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
  const empty = await db.list('/notes', { facet: 'dp' })
  if (empty.kind !== 'collection') return
  assert.equal(empty.items.length, 0)
  assert.equal(listed, undefined)
  db.facets.replace([{ id: 'dp', label: '动态规划', fields: [] }])
  await db.update('/notes/a', { facet: { tags: ['dp'], values: {} } })
  listed = undefined
  const filtered = await db.list('/notes', { facet: 'dp' })
  if (filtered.kind !== 'collection') return
  assert.deepEqual(listed, ['a'])
  assert.equal(filtered.items.length, 1)
  assert.equal(filtered.items[0]?.id, 'a')
})

test('facet schema can be written on tables that cannot update other fields', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([['p1', { id: 'p1', title: 'Demo' }]])
  db.register({
    id: 'plugins',
    path: '/plugins',
    label: '插件',
    schema: { fields: { ...REQUIRED_RECORD_FIELDS, title: { type: 'string' } } },
    records: { update: false, delete: true },
    list: () => [...rows.values()] as { id: string }[],
    get: (id) => (rows.get(id) as { id: string } | undefined) ?? null,
    remove: (query) => query.ids ?? [],
  })
  db.facets.replace([{ id: 'dp', label: '动态规划', fields: [{ key: 'complexity', type: 'string', label: '复杂度' }] }])
  await assert.rejects(() => db.update('/plugins/p1', { title: '改名' }), /cannot update/)
  const written = await db.update('/plugins/p1', { facet: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } } })
  assert.deepEqual((written.value as { facet?: { tags?: string[] } }).facet?.tags, ['dp'])
  const read = await db.read('/plugins/p1')
  if (read.kind !== 'record') return
  assert.equal((read.value.facet as { values?: { dp?: { complexity?: string } } }).values?.dp?.complexity, 'O(n)')
  const listed = await db.list('/plugins')
  if (listed.kind !== 'collection') return
  assert.deepEqual((listed.items[0]?.facet as { tags?: string[] })?.tags, ['dp'])
  const collected = await db.collectFacet('dp')
  assert.equal(collected.items.length, 1)
  assert.equal(collected.items[0]?.path, '/plugins/p1')
  await db.update('/plugins/p1', { emoji: '🔌' })
  const withEmoji = await db.read('/plugins/p1')
  if (withEmoji.kind !== 'record') return
  assert.equal(withEmoji.value.emoji, '🔌')
  assert.deepEqual((withEmoji.value.facet as { tags?: string[] })?.tags, ['dp'])
  await db.update('/plugins/p1', { tags: ['host-ui', 'lab'] })
  const withTags = await db.read('/plugins/p1')
  if (withTags.kind !== 'record') return
  assert.deepEqual(withTags.value.tags, ['host-ui', 'lab'])
  assert.equal(withTags.value.emoji, '🔌')
})

test('writeContent can persist intro on tables that cannot update other fields', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  const rows = new Map<string, Record<string, unknown>>([['p1', { id: 'p1', title: 'Demo', readme: '' }]])
  db.register({
    id: 'plugins',
    path: '/plugins',
    label: '插件',
    schema: {
      contentField: 'readme',
      fields: {
        ...REQUIRED_RECORD_FIELDS,
        title: { type: 'string' },
        readme: { type: 'file', label: '介绍', writable: true },
      },
    },
    records: { update: false, delete: true },
    list: () => [...rows.values()] as { id: string }[],
    get: (id) => (rows.get(id) as { id: string } | undefined) ?? null,
    update: async (id, patch) => {
      const extra = Object.keys(patch).filter((key) => key !== 'readme')
      if (extra.length) throw new Error(`plugin fields not writable: ${extra.join(', ')}`)
      const next = { ...rows.get(id), ...patch, id }
      rows.set(id, next)
      return next as { id: string }
    },
    remove: (query) => query.ids ?? [],
  })
  await assert.rejects(() => db.update('/plugins/p1', { title: '改名' }), /cannot update/)
  const written = await db.writeContent('/plugins/p1', '# Demo\n')
  assert.equal(written.field, 'readme')
  assert.equal(written.value, '# Demo\n')
  const body = await db.content('/plugins/p1')
  assert.equal(body.value, '# Demo\n')
})

test('db_update /facets writes facet field packs', async () => {
  const ctx = new Context()
  const db = new DatabaseService(ctx)
  db.register(facetsCollection(db.facets))
  const created = await db.create('/facets', [{ title: '动态规划' }])
  const id = String(created.items[0]?.value.id)
  const updated = await db.update(`/facets/${id}`, {
    fields: JSON.stringify([{ key: 'complexity', type: 'string', label: '复杂度' }]),
  })
  assert.equal(updated.value.fieldCount, 1)
  assert.equal(db.facets.get(id)?.fields[0]?.key, 'complexity')
  const body = await db.writeContent(`/facets/${id}`, '# 合集说明')
  assert.equal(body.field, 'notes')
  assert.equal(body.value, '# 合集说明')
  const listed = await db.list('/facets')
  if (listed.kind !== 'collection') return
  assert.equal('notes' in listed.items[0]!, false)
  const read = await db.content(`/facets/${id}`)
  assert.equal(read.value, '# 合集说明')
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
  await assert.rejects(() => db.remove('/notes', { ids: ['n1'] }), /cannot delete/)
  assert.throws(
    () =>
      db.register({
        id: 'broken',
        path: '/broken',
        schema: { fields: { ...REQUIRED_RECORD_FIELDS } },
        records: { create: true },
        list: () => [],
        get: () => null,
      }),
    /必须提供 create/,
  )
})
