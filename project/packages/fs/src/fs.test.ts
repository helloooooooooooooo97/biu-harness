import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FsLocal, FsRemoteMock } from './index.ts'

// 本文件测 fs 两个 Provider：本地真实磁盘 + 远程内存 mock。

test('FsLocal 临时目录写读', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fs-pkg-test-'))
  try {
    const fs = new FsLocal()
    await fs.writeFile(join(dir, 'a.txt'), '你好')
    assert.equal(await fs.readFile(join(dir, 'a.txt')), '你好')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('FsRemoteMock 内存写读与缺失报错', async () => {
  const fs = new FsRemoteMock()
  await fs.writeFile('/remote/a.txt', 'x')
  assert.equal(await fs.readFile('/remote/a.txt'), 'x')
  await assert.rejects(() => fs.readFile('/remote/nope'), /远程文件不存在/)
})
