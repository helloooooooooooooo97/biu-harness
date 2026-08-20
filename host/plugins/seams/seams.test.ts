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
import * as lsp from './lsp.ts'
import * as terminal from './terminal.ts'
import * as sessionStore from '../storage/session-store.ts'
import * as sessions from '../core/sessions.ts'
import * as systemPrompt from '../core/system-prompt.ts'
import * as llm from '../orchestration/llm.ts'
import * as agentLoop from '../orchestration/agent-loop.ts'
import * as agents from '../orchestration/agents.ts'
import * as subagents from './subagents.ts'

test('bash runs inside the sandbox workspace', async () => {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'cordis-sh-'))
  await ctx.plugin(tools)
  await ctx.plugin(fs, { root })
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(shell)
  const result = (await ctx.tools.invoke('bash', { command: 'echo hi' })) as { stdout: string; code: number | null }
  assert.equal(result.code, 0)
  assert.match(result.stdout, /hi/)
})

test('jobs start and collect a process', async () => {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'cordis-job-'))
  await ctx.plugin(tools)
  await ctx.plugin(fs, { root })
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(jobs)
  const started = (await ctx.tools.invoke('job_start', { argv: ['/bin/echo', 'job'] })) as { id: string }
  for (let i = 0; i < 40; i++) {
    const collected = (await ctx.tools.invoke('job_collect', { id: started.id })) as { status: string; result?: { stdout: string } }
    if (collected.status === 'done') {
      assert.match(collected.result?.stdout ?? '', /job/)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail('job did not finish')
})

test('lsp hover falls back to the file line', async () => {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'cordis-lsp-'))
  await ctx.plugin(tools)
  await ctx.plugin(fs, { root })
  await ctx.plugin(lsp)
  await ctx.fs.write('a.ts', 'const n = 1\n')
  const hover = (await ctx.tools.invoke('lsp_hover', { path: 'a.ts', line: 0 })) as { fallback?: boolean; contents: Array<{ value: string }> }
  assert.equal(hover.fallback, true)
  assert.match(hover.contents[0]?.value ?? '', /const n/)
})

test('persistent terminal opens and closes', async () => {
  const ctx = new Context()
  const root = await mkdtemp(join(tmpdir(), 'cordis-term-'))
  await ctx.plugin(tools)
  await ctx.plugin(fs, { root })
  await ctx.plugin(sandbox)
  await ctx.plugin(terminal)
  const opened = (await ctx.tools.invoke('terminal_open')) as { id: string }
  ctx.terminals.write(opened.id, 'echo t\n')
  await new Promise((resolve) => setTimeout(resolve, 80))
  const read = (await ctx.tools.invoke('terminal_read', { id: opened.id })) as { output: string }
  assert.equal(typeof read.output, 'string')
  ctx.terminals.close(opened.id)
})

test('subagent writes its own session', async () => {
  const ctx = new Context()
  await ctx.plugin(sessionStore, { driver: 'memory' })
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(subagents)
  ctx.agents.configure({ provider: 'deepseek', apiKey: '', model: 'x' })
  const result = (await ctx.tools.invoke('subagent_spawn', { prompt: 'child' })) as { sessionId: string; text: string }
  assert.match(result.text, /本地回声：child/)
  assert.equal((await ctx.sessions.require(result.sessionId)).events.some((item) => item.type === 'user/message'), true)
})
