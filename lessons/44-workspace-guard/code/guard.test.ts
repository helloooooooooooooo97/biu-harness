import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guardFs, WorkspaceGuard, type FsLike } from './guard.ts'

// 本文件测守卫：① 边界；② 逃逸；③ 权限；④ guardFs 集成。

test('工作区内允许读，工作区外拒绝', () => {
  const guard = new WorkspaceGuard('/work')
  assert.equal(guard.allow('/work/a.txt', 'read'), true)
  assert.equal(guard.allow('/etc/passwd', 'read'), false)
})

test('路径逃逸（..）被规范化并拒绝', () => {
  const guard = new WorkspaceGuard('/work')
  assert.equal(guard.allow('/work/../secret', 'read'), false)
})

test('read-only 拒绝写', () => {
  const guard = new WorkspaceGuard('/work', 'read-only')
  assert.equal(guard.allow('/work/a.txt', 'read'), true)
  assert.equal(guard.allow('/work/a.txt', 'write'), false)
})

test('guardFs 包装：区内写成功、区外抛越界', async () => {
  const mem = new Map<string, string>()
  const fs: FsLike = {
    async readFile(p) {
      return mem.get(p) ?? ''
    },
    async writeFile(p, c) {
      mem.set(p, c)
    },
  }
  const guard = new WorkspaceGuard('/work')
  const guarded = guardFs(fs, guard)
  await guarded.writeFile('/work/a.txt', 'ok')
  assert.equal(mem.get('/work/a.txt'), 'ok')
  await assert.rejects(() => guarded.writeFile('/etc/x', 'bad'), /越界/)
})
