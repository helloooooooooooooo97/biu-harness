import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { Context } from 'cordis'
import * as tools from '@biu/host-tools'
import * as fs from '@biu/host-fs'
import * as sandbox from './index.ts'
import * as subprocess from '@biu/host-subprocess'
import * as shell from '@biu/host-shell'
import * as jobs from '@biu/host-jobs'
import * as lsp from '@biu/host-lsp'
import * as terminal from '@biu/host-terminal'
import * as sessionStore from '@biu/host-session-store'
import * as sessions from '@biu/host-sessions'
import * as systemPrompt from '@biu/host-system-prompt'
import * as llm from '@biu/host-llm'
import * as agentLoop from '@biu/host-agent-loop'
import * as agents from '@biu/host-agents'
import * as subagents from '@biu/host-subagents'

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
