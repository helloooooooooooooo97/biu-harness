/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { PluginStoreService } from './index.ts'
import { compileStoreModule } from './plugin-create.ts'

function stubHub(ctx: Context) {
  ;(ctx as unknown as { hub: unknown }).hub = {
    adopt: async () => {},
    drop: async () => {},
    snapshot: () => ({ plugins: [] }),
  }
}

test('initSandbox writes source; pack bundles into .plugin/<id>/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-create-'))
  try {
    const ctx = new Context()
    stubHub(ctx)
    const pluginDir = join(dir, '.plugin')
    const sandboxDir = join(dir, '.plugin-dev')
    const store = new PluginStoreService(ctx, pluginDir, join(dir, 'plugins.sqlite'), sandboxDir).open()
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
      join(dir, 'plugins.sqlite'),
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

test('compileStoreModule strips TypeScript in-process', async () => {
  const code = await compileStoreModule(
    `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    'host',
  )
  assert.match(code, /\bapply\b/)
  assert.doesNotMatch(code, /ctx: \{/)
})
