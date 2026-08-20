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
import * as shell from './shell.ts'
import * as jobs from './jobs.ts'

async function runtime() {
  const ctx = new Context()
  await ctx.plugin(tools)
  const root = await mkdtemp(join(tmpdir(), 'cordis-sh-'))
  await ctx.plugin(fs, { root })
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(shell)
  await ctx.plugin(jobs)
  return ctx
}

test('bash and jobs run inside sandbox', async () => {
  const ctx = await runtime()
  const bash = (await ctx.tools.invoke('bash', { command: 'echo hi' })) as { stdout: string; code: number | null }
  assert.equal(bash.code, 0)
  assert.match(bash.stdout, /hi/)
  const started = (await ctx.tools.invoke('job_start', { argv: ['/bin/echo', 'job'] })) as { id: string }
  const deadline = Date.now() + 3000
  let collected: { status: string; result?: { stdout: string } } | undefined
  while (Date.now() < deadline) {
    collected = (await ctx.tools.invoke('job_collect', { id: started.id })) as typeof collected
    if (collected?.status === 'done') break
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.match(collected?.result?.stdout ?? '', /job/)
})

test('shell seam runner can be swapped without changing the bash tool', async () => {
  const ctx = await runtime()
  ctx.shell.setRunner(async () => ({ code: 0, stdout: 'swapped\n', stderr: '' }))
  const bash = (await ctx.tools.invoke('bash', { command: 'ignored' })) as { stdout: string }
  assert.match(bash.stdout, /swapped/)
})
