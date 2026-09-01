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

test('create with web rejects missing shell size', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-shell-required-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(
      ctx,
      join(dir, '.plugin'),
      join(dir, 'store.json'),
      join(dir, '.plugin-dev'),
    ).open()
    await assert.rejects(
      () =>
        store.create({
          id: 'store-game',
          name: 'Game',
          webJs: `export const name = 'store-game'\nexport function apply() {}`,
        }),
      /shell\.width and shell\.height/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('pack with web rejects sandbox manifest without shell size', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-pack-shell-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(
      ctx,
      join(dir, '.plugin'),
      join(dir, 'store.json'),
      join(dir, '.plugin-dev'),
    ).open()
    await store.initSandbox({ id: 'store-ui', name: 'UI' })
    const sandbox = join(dir, '.plugin-dev', 'store-ui')
    await writeFile(
      join(sandbox, 'web.tsx'),
      `export const name = 'store-ui'\nexport function apply() {}\n`,
    )
    await assert.rejects(() => store.pack('store-ui'), /shell\.width and shell\.height/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('create and pack allow web without shell when headless', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-headless-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(
      ctx,
      join(dir, '.plugin'),
      join(dir, 'store.json'),
      join(dir, '.plugin-dev'),
    ).open()
    await store.create({
      id: 'store-skin',
      name: 'Skin',
      headless: true,
      webJs: `export const name = 'store-skin'\nexport function apply() {}`,
    })
    const created = JSON.parse(await readFile(join(dir, '.plugin', 'store-skin', 'manifest.json'), 'utf8')) as {
      headless?: boolean
      shell?: unknown
    }
    assert.equal(created.headless, true)
    assert.equal(created.shell, undefined)
    const listed = await store.list()
    assert.equal(listed[0]?.headless, true)
    assert.equal(listed[0]?.shell, undefined)

    await store.initSandbox({ id: 'store-skin-src', name: 'Skin Src', headless: true })
    const sandbox = join(dir, '.plugin-dev', 'store-skin-src')
    await writeFile(join(sandbox, 'web.tsx'), `export const name = 'store-skin-src'\nexport function apply() {}\n`)
    await store.pack('store-skin-src')
    const packed = JSON.parse(await readFile(join(dir, '.plugin', 'store-skin-src', 'manifest.json'), 'utf8')) as {
      headless?: boolean
      shell?: unknown
    }
    assert.equal(packed.headless, true)
    assert.equal(packed.shell, undefined)
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
  const descriptions: string[] = []
  ;(ctx as unknown as { tools: { register: (spec: { name: string; description?: string }) => void } }).tools = {
    register(spec) {
      names.push(spec.name)
      if (spec.description) descriptions.push(spec.description)
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
  assert.match(descriptions.join('\n'), /storeShellFromRecord/)
  assert.match(descriptions.join('\n'), /listing\.shell/)
  assert.match(descriptions.join('\n'), /shellWidth/)
  assert.match(descriptions.join('\n'), /无头/)
})

test('pack web jsx uses globalThis.React instead of bundling npm react', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-pack-jsx-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const store = new PluginStoreService(
      ctx,
      join(dir, '.plugin'),
      join(dir, 'store.json'),
      join(dir, '.plugin-dev'),
    ).open()
    await store.initSandbox({
      id: 'store-jsx',
      name: 'JSX',
      shell: { width: 320, height: 200 },
    })
    const sandbox = join(dir, '.plugin-dev', 'store-jsx')
    await writeFile(
      join(sandbox, 'web.tsx'),
      `export const name = 'store-jsx'\nexport const inject = ['slots']\nfunction Hi() { return <div data-testid="hi">hi</div> }\nexport function apply(ctx: { slots: { place: (name: string, Comp: unknown, opt: unknown) => void } }) {\n  ctx.slots.place('plugin-store-extras', Hi, { key: 'store-jsx' })\n}\n`,
    )
    await store.pack('store-jsx')
    const webJs = await readFile(join(dir, '.plugin', 'store-jsx', 'web.js'), 'utf8')
    assert.match(webJs, /globalThis\.React/)
    assert.match(webJs, /createElement/)
    assert.doesNotMatch(webJs, /node_modules\/react/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('compileStoreModule strips TypeScript in-process', async () => {
  const code = await compileStoreModule(
    `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    'host',
  )
  assert.match(code, /\bapply\b/)
  assert.doesNotMatch(code, /ctx: \{/)
})
