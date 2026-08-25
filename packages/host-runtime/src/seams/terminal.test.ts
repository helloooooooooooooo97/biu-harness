import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import '../../types.ts'
import * as tools from '../registry/tools.ts'
import * as fs from './fs.ts'
import * as sandbox from './sandbox.ts'
import * as subprocess from './subprocess.ts'
import * as terminal from './terminal.ts'

test('persistent terminal open/write/read/close', async () => {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'cordis-term-'))
  await ctx.plugin(fs, { root })
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(terminal)
  const opened = (await ctx.tools.invoke('terminal_open')) as { id: string }
  await ctx.tools.invoke('terminal_write', { id: opened.id, data: 'echo term-ok\n' })
  const deadline = Date.now() + 2000
  let output = ''
  while (Date.now() < deadline) {
    output = ((await ctx.tools.invoke('terminal_read', { id: opened.id })) as { output: string }).output
    if (output.includes('term-ok')) break
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  const closed = (await ctx.tools.invoke('terminal_close', { id: opened.id })) as { closed: boolean }
  assert.equal(closed.closed, true)
  assert.match(output, /term-ok/)
})
