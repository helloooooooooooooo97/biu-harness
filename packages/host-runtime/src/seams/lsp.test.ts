import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as fs from './fs.ts'
import * as lsp from './lsp.ts'

test('lsp_hover falls back to the line when no server is started', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'cordis-lsp-'))
  await ctx.plugin(fs, { root })
  await ctx.plugin(lsp)
  await ctx.fs.write('a.ts', 'hello\nworld')
  const hover = (await ctx.tools.invoke('lsp_hover', { path: 'a.ts', line: 1 })) as { fallback: boolean; contents: Array<{ value: string }> }
  assert.equal(hover.fallback, true)
  assert.equal(hover.contents[0]?.value, 'world')
})
