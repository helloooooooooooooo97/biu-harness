/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from 'cordis'
import { PluginStoreService } from './index.ts'
import { compileStoreModule } from './plugin-create.ts'

test('create compiles TypeScript into sqlite instead of catalog files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plugin-create-'))
  try {
    const ctx = new Context()
    ;(ctx as unknown as { hub: unknown }).hub = {
      adopt: async () => {},
      drop: async () => {},
      snapshot: () => ({ plugins: [] }),
    }
    const store = new PluginStoreService(ctx, join(dir, 'plugins.sqlite')).open()
    const result = await store.create({
      id: 'store-echo',
      name: 'Echo',
      blurb: '回声',
      hostJs: `export const name = 'store-echo'\nexport function apply(ctx: { ok: boolean }) { return ctx.ok }`,
    })
    assert.equal(result.id, 'store-echo')
    const listed = await store.list()
    assert.equal(listed[0]?.id, 'store-echo')
    assert.equal(listed[0]?.name, 'Echo')
    await store.install('store-echo')
    const hostJs = await store.readInstalledFile('store-echo', 'host.js')
    assert.match(hostJs, /\bapply\b/)
    assert.doesNotMatch(hostJs, /ctx: \{/)
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
