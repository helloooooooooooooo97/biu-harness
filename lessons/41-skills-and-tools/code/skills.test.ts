import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesystemSkillProvider, SkillRegistry, type SkillProvider } from './skills.ts'
import { SkillTool } from './tool-skill.ts'

// 本文件测 Skills：① 文件系统 provider；② 聚合；③ skill 工具。

test('FilesystemSkillProvider 列出并加载目录技能', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skills-test-'))
  try {
    await writeFile(join(dir, 'code-style.md'), '代码风格：两空格缩进')
    const provider = new FilesystemSkillProvider(dir)
    const skills = await provider.list()
    assert.deepEqual(skills.map((s) => s.name), ['code-style'])
    assert.equal(await provider.load('code-style'), '代码风格：两空格缩进')
    assert.equal(await provider.load('missing'), undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('SkillRegistry 聚合多个 provider', async () => {
  const one: SkillProvider = {
    list: async () => [{ name: 'a', description: 'A' }],
    load: async (n) => (n === 'a' ? 'A 内容' : undefined),
  }
  const two: SkillProvider = {
    list: async () => [{ name: 'b', description: 'B' }],
    load: async (n) => (n === 'b' ? 'B 内容' : undefined),
  }
  const registry = new SkillRegistry()
  registry.register(one)
  registry.register(two)
  assert.deepEqual((await registry.list()).map((s) => s.name).sort(), ['a', 'b'])
  assert.equal(await registry.load('b'), 'B 内容')
})

test('skill 工具 list 与 load', async () => {
  const registry = new SkillRegistry()
  registry.register({
    list: async () => [{ name: 'x', description: 'X' }],
    load: async (n) => (n === 'x' ? 'X 内容' : undefined),
  })
  const tool = new SkillTool(registry)
  assert.match(await tool.execute({ action: 'list' }), /- x: X/)
  assert.equal(await tool.execute({ action: 'load', name: 'x' }), 'X 内容')
})
