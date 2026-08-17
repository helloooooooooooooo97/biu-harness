import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MonorepoScaffolder } from './scaffold.ts'

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'scaffold-test-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('生成完整 monorepo 骨架', async () => {
  await withTempDir(async (tmp) => {
    await new MonorepoScaffolder({ dir: join(tmp, 'project') }).run()
    const root = join(tmp, 'project')
    for (const rel of [
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.base.json',
      'packages/core-session/src/index.ts',
      'packages/llm-deepseek/src/index.ts',
      'packages/tool-bash/src/index.ts',
      'apps/cli/src/index.ts',
    ]) {
      await assert.doesNotReject(stat(join(root, rel)), `缺少 ${rel}`)
    }
  })
})

test('dry-run 不落盘', async () => {
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
