import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MiniDshWorkspace } from './workspace.ts'

// 本文件测 MiniDshWorkspace：① 生成 6 包 + cli；② llm-deepseek 声明真实 cordis 依赖。

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'workspace-test-'))
  try {
    await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('生成 6 个包 + apps/cli 的完整 workspace', async () => {
  // 验证布局：packages/* 与 apps/cli 的 package.json、tsconfig、src 齐备。
  await withTempDir(async (tmp) => {
    await new MiniDshWorkspace(tmp).scaffold()
    for (const rel of [
      'pnpm-workspace.yaml',
      'packages/llm/src/index.ts',
      'packages/llm-deepseek/src/index.ts',
      'packages/core-session/src/index.ts',
      'packages/core-tools/src/index.ts',
      'packages/core-agent-loop/src/index.ts',
      'packages/core-system-prompt/src/index.ts',
      'apps/cli/src/index.ts',
    ]) {
      await assert.doesNotReject(stat(join(tmp, rel)), `缺少 ${rel}`)
    }
  })
})

test('llm-deepseek 声明 @deepseek-ai/cordis 依赖（换装真实 cordis）', async () => {
  // 验证换装：实现包依赖真实 cordis，mini 内核由此退役。
  await withTempDir(async (tmp) => {
    await new MiniDshWorkspace(tmp).scaffold()
    const pkg = JSON.parse(await readFile(join(tmp, 'packages/llm-deepseek/package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    assert.ok(pkg.dependencies['@deepseek-ai/cordis'])
  })
})
