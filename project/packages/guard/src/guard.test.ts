import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardFs, WorkspaceGuard, type FsLike } from './index.ts'

// 本文件测守卫：边界、逃逸、权限、guardFs。

test('工作区内允许、区外与逃逸拒绝', () => {
  const guard = new WorkspaceGuard('/work')
  assert.equal(guard.allow('/work/a.txt', 'read'), true)
  assert.equal(guard.allow('/etc/passwd', 'read'), false)
  assert.equal(guard.allow('/work/../secret', 'read'), false)
})

test('read-only 拒绝写', () => {
  const guard = new WorkspaceGuard('/work', 'read-only')
  assert.equal(guard.allow('/work/a', 'read'), true)
  assert.equal(guard.allow('/work/a', 'write'), false)
})

test('guardFs 区内写成功、区外抛越界', async () => {
  const mem = new Map<string, string>()
  const fs: FsLike = { readFile: async (p) => mem.get(p) ?? '', writeFile: async (p, c) => mem.set(p, c) }
  const guarded = guardFs(fs, new WorkspaceGuard('/work'))
  await guarded.writeFile('/work/a.txt', 'ok')
  await assert.rejects(() => guarded.writeFile('/etc/x', 'bad'), /越界/)
})
