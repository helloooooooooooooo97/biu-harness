import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REFACTOR_MAP, RefactorChecker } from './refactor.ts'

// 本文件测重构清单与校验：① 目标路径唯一且落在 packages/；② checker 检测缺失。

test('REFACTOR_MAP 的目标路径唯一且都在 packages/ 下', () => {
  // 验证映射质量：没有重复目标、没有越界路径。
  const targets = REFACTOR_MAP.map((step) => step.to)
  assert.equal(new Set(targets).size, targets.length)
  for (const target of targets) {
    assert.ok(target.startsWith('packages/'), `目标必须落在 packages/: ${target}`)
  }
})

test('RefactorChecker 报告缺失文件，补齐后为空', async () => {
  // 验证校验器：文件没搬 → missing 列出；搬了 → missing 清空。
  const dir = await mkdtemp(join(tmpdir(), 'refactor-test-'))
  try {
    const checker = new RefactorChecker(dir)
    assert.equal(checker.missing().length, REFACTOR_MAP.length)
    for (const step of REFACTOR_MAP) {
      const file = join(dir, step.to)
      const parent = file.slice(0, file.lastIndexOf('/'))
      await import('node:fs/promises').then(({ mkdir }) => mkdir(parent, { recursive: true }))
      await writeFile(file, '// moved')
    }
    assert.deepEqual(checker.missing(), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
