import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FsLocal } from './fs-local.ts'
import { FsRemoteMock } from './fs-remote-mock.ts'

// 本文件测 fs 两个 Provider：本地真实磁盘 + 远程内存 mock。

test('FsLocal 在临时目录写读往返', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fs-local-test-'))
  try {
    const fs = new FsLocal()
    const file = join(dir, 'a.txt')
    await fs.writeFile(file, '你好')
    assert.equal(await fs.readFile(file), '你好')
    assert.ok((await fs.list(dir)).includes('a.txt'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('FsRemoteMock 内存写读与缺失报错', async () => {
  const fs = new FsRemoteMock()
  await fs.writeFile('/remote/a.txt', '远程内容')
  assert.equal(await fs.readFile('/remote/a.txt'), '远程内容')
  assert.deepEqual(await fs.list('/remote'), ['a.txt'])
  await assert.rejects(() => fs.readFile('/remote/nope.txt'), /远程文件不存在/)
})
