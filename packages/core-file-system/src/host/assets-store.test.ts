import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileSystemAssets, assetHref, isAssetFileName } from './assets-store.ts'

test('shared assets live under a single directory and reject path escape', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fs-assets-'))
  const store = new FileSystemAssets(dir)
  const written = await store.write('shot.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  assert.equal(written.name, 'shot.png')
  assert.equal(written.href, assetHref('shot.png'))
  const read = await store.read('shot.png')
  assert.equal(read.type, 'image/png')
  assert.equal(read.bytes[0], 0x89)
  await assert.rejects(() => store.write('../secret.png', 'nope'), /invalid asset/)
  assert.equal(isAssetFileName('ok-file_1.png'), true)
  assert.equal(isAssetFileName('../x'), false)
})

test('asset reads fall back to a legacy folder', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fs-assets-fb-'))
  const shared = join(root, 'shared')
  const legacy = join(root, 'legacy')
  await mkdir(legacy, { recursive: true })
  await writeFile(join(legacy, 'old.png'), 'old')
  const store = new FileSystemAssets(shared)
  const read = await store.read('old.png', [legacy])
  assert.equal(read.bytes.toString(), 'old')
})
