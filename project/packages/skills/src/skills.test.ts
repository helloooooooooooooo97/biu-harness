import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesystemSkillProvider, SkillRegistry, SkillTool } from './index.ts'

// 本文件测 skills：文件系统 provider、聚合、skill 工具。

test('FilesystemSkillProvider 列出并加载目录技能', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skills-'))
  try {
    await writeFile(join(dir, 'code-style.md'), '两空格缩进')
    const provider = new FilesystemSkillProvider(dir)
    assert.deepEqual((await provider.list()).map((s) => s.name), ['code-style'])
    assert.equal(await provider.load('code-style'), '两空格缩进')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('SkillTool list 与 load', async () => {
  const registry = new SkillRegistry()
  registry.register({ list: async () => [{ name: 'x', description: 'X' }], load: async (n) => (n === 'x' ? 'X 内容' : undefined) })
  const tool = new SkillTool(registry)
  assert.match(await tool.execute({ action: 'list' }), /- x: X/)
  assert.equal(await tool.execute({ action: 'load', name: 'x' }), 'X 内容')
})
