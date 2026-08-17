import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MonorepoScaffolder } from './scaffold.ts'

// 本文件测 MonorepoScaffolder（骨架生成器）：
//   ① 真实生成；② dry-run 不落盘；③ 非空目录保护。全部在临时目录中验证，测完清理。

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'scaffold-test-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('生成完整 monorepo 骨架', async () => {
  // 验证 run() 真的生成 packages/apps 结构：package.json、tsconfig、src/index.ts 齐备。
  await withTempDir(async (tmp) => {
    await new MonorepoScaffolder({ dir: join(tmp, 'project') }).run()
    const root = join(tmp, 'project')
    for (const rel of [
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'packages/core-session/src/index.ts',
      'packages/core-session/tsconfig.json',
      'packages/llm-deepseek/src/index.ts',
      'packages/tool-bash/src/index.ts',
      'apps/cli/src/index.ts',
    ]) {
      await assert.doesNotReject(stat(join(root, rel)), `缺少 ${rel}`)
    }
  })
})

test('dry-run 不落盘', async () => {
  // 验证 --dry-run 只打印结构树，不创建任何目录或文件。
  await withTempDir(async (tmp) => {
    const dir = join(tmp, 'dry')
    const scaffolder = new MonorepoScaffolder({ dir, dryRun: true })
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: unknown) => logs.push(String(msg))
    try {
      await scaffolder.run()
    } finally {
      console.log = originalLog
    }
    assert.ok(logs.some((l) => l.includes('core-session')))
    await assert.rejects(stat(dir))
  })
})

test('拒绝覆盖非空目录', async () => {
  // 验证 assertEmpty()：目标目录已有内容时抛"目录非空"，绝不覆盖用户数据。
  await withTempDir(async (tmp) => {
    const dir = join(tmp, 'occupied')
    await mkdir(dir)
    await writeFile(join(dir, 'keep.txt'), 'x')
    await assert.rejects(
      () => new MonorepoScaffolder({ dir }).run(),
      /目录非空/,
    )
  })
})
