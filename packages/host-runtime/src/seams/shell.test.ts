import { mkdtemp, writeFile } from 'node:fs/promises'
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
import { runWithSession } from '../core/session-scope.ts'
import { readArtifactFile } from '../core/artifacts.ts'

async function runtime(root?: string) {
  const ctx = new Context()
  await ctx.plugin(tools)
  const workspace = root ?? (await mkdtemp(join(tmpdir(), 'cordis-sh-')))
  await ctx.plugin(fs, { root: workspace })
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(shell)
  await ctx.plugin(jobs)
  return { ctx, workspace }
}

test('bash and jobs run inside sandbox', async () => {
  const { ctx } = await runtime()
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
  const { ctx } = await runtime()
  ctx.shell.setRunner(async () => ({ code: 0, stdout: 'swapped\n', stderr: '' }))
  const bash = (await ctx.tools.invoke('bash', { command: 'ignored' })) as { stdout: string }
  assert.match(bash.stdout, /swapped/)
})

test('bash copies printed image paths into session artifacts', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cordis-sh-art-'))
  const prev = process.cwd()
  process.chdir(base)
  try {
    const { ctx, workspace } = await runtime(join(base, 'ws'))
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    await writeFile(join(workspace, 'shot.png'), png)
    const result = await runWithSession('sess-shot', () =>
      ctx.tools.invoke('bash', { command: 'printf "%s\\n" shot.png' }),
    )
    const bash = result as {
      code: number | null
      stdout: string
      artifacts?: Array<{ name: string; url: string; mime: string }>
    }
    assert.equal(bash.code, 0)
    assert.equal(bash.artifacts?.length, 1)
    assert.equal(bash.artifacts?.[0]?.name, 'shot.png')
    assert.equal(bash.artifacts?.[0]?.url, '/api/sessions/sess-shot/artifacts/shot.png')
    const file = await readArtifactFile('sess-shot', 'shot.png', base)
    assert.ok(file)
    assert.deepEqual(file.data, png)
  } finally {
    process.chdir(prev)
  }
})

test('bash ingests silently written workspace screenshots without printing path', async () => {
  const base = await mkdtemp(join(tmpdir(), 'cordis-sh-silent-'))
  const prev = process.cwd()
  process.chdir(base)
  try {
    const { ctx, workspace } = await runtime(join(base, 'ws'))
    const result = await runWithSession('sess-silent', () =>
      ctx.tools.invoke('bash', {
        command:
          'python3 -c "import base64,pathlib; pathlib.Path(\'silent.png\').write_bytes(base64.b64decode(\'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==\'))"',
      }),
    )
    const bash = result as { artifacts?: Array<{ name: string; url: string }> }
    assert.ok(bash.artifacts?.some((item) => item.name === 'silent.png'))
    const file = await readArtifactFile('sess-silent', 'silent.png', base)
    assert.ok(file)
    assert.equal(file.data.byteLength > 0, true)
    void workspace
  } finally {
    process.chdir(prev)
  }
})
