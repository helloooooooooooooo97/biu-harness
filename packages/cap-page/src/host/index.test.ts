import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context, Service } from 'cordis'
import { asImageSrc, type CollectionSpec, type FieldType } from '@biu/type-file-system'
import * as tools from '@biu/host-tools'
import * as fsPlugin from '@biu/host-fs'
import * as page from './index.ts'
import { dumpMarkdown, splitMarkdown } from './markdown.ts'
import { ASSET_GC_GRACE_MS, PAGE_ASSETS, PAGE_ROOT, PagesStore, collectPageAssetNames } from './store.ts'

const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'boolean',
  'select',
  'multi-select',
  'datetime',
  'url',
  'image',
  'attachment',
  'file',
  'string[]',
]

test('markdown frontmatter roundtrips YAML properties and body', () => {
  const raw = dumpMarkdown({ title: '首页', tags: ['red', 'prod'], enabled: true }, '正文第一段\n')
  assert.match(raw, /^---\n/)
  const { matter, body } = splitMarkdown(raw)
  assert.equal(matter.title, '首页')
  assert.deepEqual(matter.tags, ['red', 'prod'])
  assert.equal(matter.enabled, true)
  assert.equal(body, '正文第一段\n')
})

test('page plugin stores markdown under .page and assets for images', async () => {
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
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'page-md-'))
  await ctx.plugin(fsPlugin, { root })
  await ctx.plugin(page)

  assert.equal(page.name, 'page')
  assert.equal(registered[0]?.path, '/pages')
  assert.equal(registered[0]?.view?.route, '/pages')
  assert.equal(registered[0]?.view?.moduleId, 'page')
  assert.equal(registered[0]?.view?.icon, 'document')
  const types = new Set(Object.values(registered[0]!.schema.fields).map((field) => field.type))
  for (const type of FIELD_TYPES) assert.equal(types.has(type), true, type)
  assert.deepEqual(registered[0]?.records, { update: true, create: true, delete: true })

  const spec = registered[0]!
  assert.equal((await spec.list()).length, 0)

  await mkdir(join(root, PAGE_ASSETS), { recursive: true })
  await writeFile(join(root, PAGE_ASSETS, 'hero.png'), 'fake-png', 'utf8')

  const created = await spec.create!([{
    title: '新页面',
    notes: '# 标题\n内容',
    cover: 'assets/hero.png',
    tags: ['blue'],
  }])
  assert.equal(created[0]?.title, '新页面')
  assert.equal(created[0]?.notes, '# 标题\n内容')
  assert.equal(created[0]?.cover, '/api/page/file/hero.png')
  assert.equal(asImageSrc(created[0]?.cover), '/api/page/file/hero.png')

  const disk = await readFile(join(root, PAGE_ROOT, `${created[0]!.id}.md`), 'utf8')
  assert.match(disk, /^---\n/)
  assert.match(disk, /title: 新页面/)
  assert.match(disk, /cover: assets\/hero.png/)
  assert.match(disk, /# 标题\n内容/)

  const written = await spec.update!(created[0]!.id, {
    enabled: false,
    schema: { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } },
  })
  assert.equal(written.enabled, false)
  assert.deepEqual(written.schema, { tags: ['dp'], values: { dp: { complexity: 'O(n)' } } })
  const again = await readFile(join(root, PAGE_ROOT, `${created[0]!.id}.md`), 'utf8')
  assert.match(again, /enabled: false/)
  assert.match(again, /complexity: O\(n\)/)

  await spec.remove!({ ids: [created[0]!.id] })
  assert.equal((await spec.list()).length, 0)

  const store = new PagesStore(ctx.fs.workspace as never)
  const asset = await store.writeAsset('board.json', '{\n  "elements": []\n}\n')
  assert.equal(asset.name, 'board.json')
  const diskAsset = await readFile(join(root, PAGE_ASSETS, 'board.json'), 'utf8')
  assert.match(diskAsset, /elements/)
  const read = await store.readAsset('board.json')
  assert.equal(read.type, 'application/json; charset=utf-8')
  await assert.rejects(() => store.writeAsset('../secret.json', '{}'), /invalid asset/)
})

test('PagesStore reads existing markdown files from .page', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'page-store-'))
  await ctx.plugin(fsPlugin, { root })
  await mkdir(join(root, PAGE_ROOT), { recursive: true })
  await writeFile(
    join(root, PAGE_ROOT, 'home.md'),
    dumpMarkdown({ title: 'Home', status: 'live', parentId: null }, 'hello\n'),
    'utf8',
  )
  const store = new PagesStore(ctx.fs)
  const listed = await store.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0]?.id, 'home')
  assert.equal(listed[0]?.title, 'Home')
  assert.equal(listed[0]?.notes, 'hello\n')
  await writeFile(join(root, PAGE_ROOT, 'other.md'), dumpMarkdown({ title: 'Other' }, ''), 'utf8')
  const onlyHome = await store.list(['home'])
  assert.equal(onlyHome.length, 1)
  assert.equal(onlyHome[0]?.id, 'home')
})

test('collectPageAssetNames picks page asset pointers', () => {
  const names = collectPageAssetNames(
    'cover: assets/hero.png\n',
    ':::pageBlock {kind=excalidraw}\n{"file":"assets/excalidraw-aa.json"}\n:::\n',
    { href: '/api/page/file/pack.zip' },
  )
  assert.equal(names.has('hero.png'), true)
  assert.equal(names.has('excalidraw-aa.json'), true)
  assert.equal(names.has('pack.zip'), true)
  assert.equal(collectPageAssetNames('assets/画板-ab.json').has('画板-ab.json'), true)
  assert.equal(ASSET_GC_GRACE_MS, 24 * 60 * 60 * 1000)
})

test('gcAssets deletes unreferenced files after one day', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'page-gc-'))
  await ctx.plugin(fsPlugin, { root })
  const store = new PagesStore(ctx.fs.workspace as never)
  const a = await store.create({
    title: 'A',
    notes: ':::pageBlock {kind=excalidraw}\n{"file":"assets/excalidraw-keep.json"}\n:::\n',
  })
  const b = await store.create({
    title: 'B',
    notes: ':::pageBlock {kind=excalidraw}\n{"file":"assets/excalidraw-drop.json"}\n:::\n',
  })
  await store.writeAsset('excalidraw-keep.json', '{"ok":1}')
  await store.writeAsset('excalidraw-drop.json', '{"ok":2}')
  await store.writeAsset('orphan.json', '{"ok":3}')
  const stale = Date.now() / 1000 - 2 * 24 * 60 * 60
  await utimes(join(root, PAGE_ASSETS, 'excalidraw-drop.json'), stale, stale)
  await utimes(join(root, PAGE_ASSETS, 'orphan.json'), stale, stale)

  await store.update(b.id, { notes: 'gone\n' })
  await store.gcAssets({ now: Date.now() })

  const dropGone = await readFile(join(root, PAGE_ASSETS, 'excalidraw-drop.json'), 'utf8').then(
    () => false,
    () => true,
  )
  const orphanGone = await readFile(join(root, PAGE_ASSETS, 'orphan.json'), 'utf8').then(
    () => false,
    () => true,
  )
  const kept = await readFile(join(root, PAGE_ASSETS, 'excalidraw-keep.json'), 'utf8')
  assert.equal(dropGone, true)
  assert.equal(orphanGone, true)
  assert.match(kept, /ok/)

  await store.writeAsset('fresh-orphan.json', '{}')
  await store.gcAssets()
  const fresh = await readFile(join(root, PAGE_ASSETS, 'fresh-orphan.json'), 'utf8')
  assert.equal(fresh, '{}')
  assert.equal(a.title, 'A')
})
