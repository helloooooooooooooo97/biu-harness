import { test } from 'vitest'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { behindMain, fetchMain, git, isGitRepo, mergeMain } from './git.ts'

async function initOrigin(dir: string) {
  await git(dir, ['init', '-b', 'main'])
  await git(dir, ['config', 'user.email', 'test@biu.local'])
  await git(dir, ['config', 'user.name', 'biu-test'])
  await writeFile(join(dir, 'README.md'), 'one\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'init'])
}

test('behindMain counts commits on upstream tip not in HEAD', async () => {
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
    await fetchMain(clone, origin, 'main')
    assert.equal(await behindMain(clone), 1)
    await mergeMain(clone)
    assert.equal(await behindMain(clone), 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('fetchMain git-inits a directory that is not a repo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'biu-update-bare-'))
  const origin = join(root, 'origin')
  const dest = join(root, 'dest')
  try {
    await mkdir(origin)
    await initOrigin(origin)
    await mkdir(dest)
    assert.equal(isGitRepo(dest), false)
    await fetchMain(dest, origin, 'main')
    assert.equal(isGitRepo(dest), true)
    assert.ok((await behindMain(dest)) >= 1)
    await mergeMain(dest)
    assert.equal(await behindMain(dest), 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
