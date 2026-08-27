/** @vitest-environment node */
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileStoreModule, writePluginToCatalog } from './plugin-create.ts'

test('writePluginToCatalog dumps hello-shaped files into fixtures dir', async () => {
  const catalogDir = await mkdtemp(join(tmpdir(), 'plugin-fixtures-'))
  try {
    const result = await writePluginToCatalog(catalogDir, {
      id: 'store-echo',
      name: 'Echo',
      blurb: '回声',
      hostJs: `export const name = 'store-echo'\nexport function apply() {}`,
    })
    assert.equal(result.id, 'store-echo')
    assert.equal(result.catalogPath, join(catalogDir, 'echo'))
    const manifest = JSON.parse(await readFile(join(catalogDir, 'echo', 'manifest.json'), 'utf8')) as {
      id: string
      name: string
    }
    assert.equal(manifest.id, 'store-echo')
    assert.equal(manifest.name, 'Echo')
    assert.match(await readFile(join(catalogDir, 'echo', 'host.js'), 'utf8'), /\bapply\b/)
  } finally {
    await rm(catalogDir, { recursive: true, force: true })
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
