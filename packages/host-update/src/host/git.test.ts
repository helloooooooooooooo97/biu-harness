import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { behindMain, fetchMain, git, mergeMain } from './git.ts'

async function initOrigin(dir: string) {
  await git(dir, ['init', '-b', 'main'])
  await git(dir, ['config', 'user.email', 'test@biu.local'])
  await git(dir, ['config', 'user.name', 'biu-test'])
  await writeFile(join(dir, 'README.md'), 'one\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'init'])
}

test('behindMain counts commits on origin/main not in HEAD', async () => {
  const root = await mkdtemp(join(tmpdir(), 'biu-update-'))
  const origin = join(root, 'origin')
  const clone = join(root, 'clone')
  try {
    await mkdir(origin)
    await initOrigin(origin)
    await git(root, ['clone', origin, clone])
    await writeFile(join(origin, 'README.md'), 'two\n')
    await git(origin, ['add', '.'])
    await git(origin, ['commit', '-m', 'ahead'])
    await fetchMain(clone)
    assert.equal(await behindMain(clone), 1)
    await mergeMain(clone)
    assert.equal(await behindMain(clone), 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
