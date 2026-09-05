import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import {
  extractImagePathCandidates,
  findRecentImageFiles,
  ingestSessionImages,
  readArtifactFile,
  resolveArtifactFile,
} from './artifacts.ts'

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test('extractImagePathCandidates finds relative and absolute image paths', () => {
  const text = 'saved shot.png\nalso ./shots/a.jpg and /tmp/out.webp done'
  assert.deepEqual(extractImagePathCandidates(text), ['shot.png', './shots/a.jpg', '/tmp/out.webp'])
})

test('ingestSessionImages copies workspace images into .biu/artifacts', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'biu-art-'))
  const workspace = join(baseDir, 'ws')
  await mkdir(join(workspace, 'shots'), { recursive: true })
  await writeFile(join(workspace, 'shots', 'demo.png'), TINY_PNG)

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
  assert.deepEqual(file.data, TINY_PNG)
})

test('ingestSessionImages accepts absolute paths outside workspace', async () => {
  const baseDir = await mkdtemp(join(tmpdir(), 'cordis-art-abs-'))
  const workspace = join(baseDir, 'ws')
  const outside = join(baseDir, 'outside.png')
  await mkdir(workspace, { recursive: true })
  await writeFile(outside, TINY_PNG)

  const artifacts = await ingestSessionImages({
    sessionId: 'sess-abs',
    candidates: [outside],
    workspaceRoot: workspace,
    baseDir,
  })
  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0]?.name, 'outside.png')
  const file = await readArtifactFile('sess-abs', 'outside.png', baseDir)
  assert.deepEqual(file?.data, TINY_PNG)
})

test('findRecentImageFiles picks up newly written workspace images', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'cordis-art-recent-'))
  const since = Date.now() - 1000
  await writeFile(join(workspace, 'fresh.png'), TINY_PNG)
  const found = await findRecentImageFiles(workspace, since)
  assert.ok(found.some((path) => path.endsWith('fresh.png')))
})

test('resolveArtifactFile rejects path traversal', () => {
  assert.equal(resolveArtifactFile('s1', '../x.png'), null)
  assert.equal(resolveArtifactFile('s1', 'a/b.png'), null)
  assert.equal(resolveArtifactFile('s1', 'ok.png')?.endsWith('ok.png'), true)
})
