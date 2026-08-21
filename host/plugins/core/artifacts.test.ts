import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  extractImagePathCandidates,
  ingestSessionImages,
  readArtifactFile,
  resolveArtifactFile,
} from './artifacts.ts'

test('extractImagePathCandidates finds relative and absolute image paths', () => {
  const text = 'saved shot.png\nalso ./shots/a.jpg and /tmp/out.webp done'
  assert.deepEqual(extractImagePathCandidates(text), ['shot.png', './shots/a.jpg', '/tmp/out.webp'])
})

test('ingestSessionImages copies workspace images into .cordis/artifacts', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'cordis-art-'))
  const workspace = join(baseDir, 'ws')
  await mkdir(join(workspace, 'shots'), { recursive: true })
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  )
  await writeFile(join(workspace, 'shots', 'demo.png'), png)

  const artifacts = await ingestSessionImages({
    sessionId: 'sess-1',
    candidates: ['shots/demo.png', '../escape.png', 'missing.png'],
    workspaceRoot: workspace,
    baseDir,
  })
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0]?.name, 'demo.png')
  assert.equal(artifacts[0]?.mime, 'image/png')
  assert.equal(artifacts[0]?.url, '/api/sessions/sess-1/artifacts/demo.png')

  const file = await readArtifactFile('sess-1', 'demo.png', baseDir)
  assert.ok(file)
  assert.equal(file.mime, 'image/png')
  assert.deepEqual(file.data, png)
})

test('resolveArtifactFile rejects path traversal', () => {
  assert.equal(resolveArtifactFile('s1', '../x.png'), null)
  assert.equal(resolveArtifactFile('s1', 'a/b.png'), null)
  assert.equal(resolveArtifactFile('s1', 'ok.png')?.endsWith('ok.png'), true)
})
