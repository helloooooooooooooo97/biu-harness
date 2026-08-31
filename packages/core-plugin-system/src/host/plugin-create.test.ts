/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { PluginStoreService } from './index.ts'
import { compileStoreModule, registerPluginCreate } from './plugin-create.ts'

function stubHub(ctx: Context) {
  ;(ctx as unknown as { hub: unknown }).hub = {
    adopt: async () => {},
    drop: async () => {},
    snapshot: () => ({ plugins: [] }),
  }
}

test('create compiles host source straight into .plugin/<id>/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-create-small-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const pluginDir = join(dir, '.plugin')
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    await store.create({
      id: 'store-echo',
      name: 'Echo',
      tags: ['tool', 'demo'],
      author: 'Biu',
      authorUrl: 'https://example.com',
      hostJs: `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    })
    const manifest = JSON.parse(await readFile(join(pluginDir, 'store-echo', 'manifest.json'), 'utf8')) as {
      tags: string[]
      author: string
      createdAt: number
    }
    assert.deepEqual(manifest.tags, ['tool', 'demo'])
    assert.equal(manifest.author, 'Biu')
    assert.ok(manifest.createdAt > 0)
    const listed = await store.list()
    assert.equal(listed[0]?.createdAt, manifest.createdAt)
    assert.equal(listed[0]?.lastRunAt, null)
    assert.deepEqual(listed[0]?.shell, {
      width: 480,
      height: 360,
      minWidth: 200,
      minHeight: 160,
      resizable: true,
    })
    const hostJs = await readFile(join(pluginDir, 'store-echo', 'host.js'), 'utf8')
    assert.match(hostJs, /\bapply\b/)
    assert.doesNotMatch(hostJs, /ctx: \{/)
    await assert.rejects(
      () => store.create({ id: 'store-empty', name: 'Empty' }),
      /hostJs and\/or webJs/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('create writes manifest.shell from input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-shell-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const pluginDir = join(dir, '.plugin')
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), join(dir, '.plugin-dev')).open()
    await store.create({
      id: 'store-game',
      name: 'Game',
      shell: { width: 640, height: 480, resizable: false },
      webJs: `export const name = 'store-game'\nexport function apply() {}`,
    })
    const manifest = JSON.parse(await readFile(join(pluginDir, 'store-game', 'manifest.json'), 'utf8')) as {
      shell: { width: number; height: number; resizable: boolean }
    }
    assert.equal(manifest.shell.width, 640)
    assert.equal(manifest.shell.height, 480)
    assert.equal(manifest.shell.resizable, false)
    const listed = await store.list()
    assert.equal(listed[0]?.shell.width, 640)
    assert.equal(listed[0]?.shell.resizable, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('initSandbox writes source; pack bundles into .plugin/<id>/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-create-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const pluginDir = join(dir, '.plugin')
    const sandboxDir = join(dir, '.plugin-dev')
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'store.json'), sandboxDir).open()
    const result = await store.initSandbox({
      id: 'store-echo',
      name: 'Echo',
      blurb: '回声',
      hostJs: `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    })
    assert.equal(result.sandboxPath, join(sandboxDir, 'store-echo'))
    const packed = await store.pack('store-echo')
    assert.equal(packed.pluginPath, join(pluginDir, 'store-echo'))
    const manifest = JSON.parse(await readFile(join(pluginDir, 'store-echo', 'manifest.json'), 'utf8')) as {
      id: string
      name: string
    }
    assert.equal(manifest.id, 'store-echo')
    const hostJs = await readFile(join(pluginDir, 'store-echo', 'host.js'), 'utf8')
    assert.match(hostJs, /\bapply\b/)
    assert.doesNotMatch(hostJs, /ctx: \{/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('pack bundles relative imports from sandbox', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-pack-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(
      ctx,
      join(dir, '.plugin'),
      join(dir, 'store.json'),
      join(dir, '.plugin-dev'),
    ).open()
    await store.initSandbox({ id: 'store-math', name: 'Math' })
    const sandbox = join(dir, '.plugin-dev', 'store-math')
    await writeFile(join(sandbox, 'util.ts'), `export const ping = 'pong'\n`)
    await writeFile(
      join(sandbox, 'host.ts'),
      `import { ping } from './util.ts'\nexport const name = 'store-math'\nexport function apply() { return ping }\n`,
    )
    await store.pack('store-math')
    const hostJs = await readFile(join(dir, '.plugin', 'store-math', 'host.js'), 'utf8')
    assert.match(hostJs, /pong/)
    assert.doesNotMatch(hostJs, /from ['"]\.\/util/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('registers plugin_create, plugin_sandbox, plugin_pack', () => {
  const ctx = new Context()
  const names: string[] = []
  ;(ctx as unknown as { tools: { register: (spec: { name: string }) => void } }).tools = {
    register(spec) {
      names.push(spec.name)
    },
  }
  const store = new PluginStoreService(
    ctx,
    '/tmp/plugin-store-tools/.plugin',
    '/tmp/plugin-store-tools/store.json',
    '/tmp/plugin-store-tools/.plugin-dev',
  )
  registerPluginCreate(ctx, store)
  assert.deepEqual(names, ['plugin_create', 'plugin_sandbox', 'plugin_pack'])
})

test('compileStoreModule strips TypeScript in-process', async () => {
  const code = await compileStoreModule(
    `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    'host',
  )
  assert.match(code, /\bapply\b/)
  assert.doesNotMatch(code, /ctx: \{/)
})
