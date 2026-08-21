import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Context } from 'cordis'
import * as http from './plugins/registry/http.ts'
import * as sessionStore from './plugins/storage/session-store.ts'
import * as sessions from './plugins/core/sessions.ts'
import * as tools from './plugins/registry/tools.ts'
import * as systemPrompt from './plugins/core/system-prompt.ts'
import * as llm from './plugins/orchestration/llm.ts'
import * as fs from './plugins/seams/fs.ts'
import * as sandbox from './plugins/seams/sandbox.ts'
import * as subprocess from './plugins/seams/subprocess.ts'
import * as shell from './plugins/seams/shell.ts'
import * as jobs from './plugins/seams/jobs.ts'
import * as mcp from './plugins/seams/mcp.ts'
import * as terminal from './plugins/seams/terminal.ts'
import * as lsp from './plugins/seams/lsp.ts'
import * as approvals from './plugins/orchestration/approvals.ts'
import * as agentLoop from './plugins/orchestration/agent-loop.ts'
import * as agents from './plugins/orchestration/agents.ts'
import * as subagents from './plugins/seams/subagents.ts'
import * as liveSessions from './plugins/seams/live-sessions.ts'
import * as hub from './plugins/registry/hub.ts'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public')
const port = Number(process.env.PORT ?? 3141)

const ctx = new Context()
ctx.logger.exporter({
  export(message) {
    const time = new Date(message.ts).toISOString().slice(11, 23)
    const args = message.args.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' ')
    console.log(`${time} ${message.type.padEnd(5)} ${message.name} ${args}`)
  },
})
ctx.on('http/ready', ({ port: ready }) => {
  ctx.logger('boot').info(`api http://127.0.0.1:${ready}  ·  ui http://127.0.0.1:5173`)
})

async function boot() {
  // 按依赖顺序 await，避免 inject 读到未 ACTIVE 的服务
  await ctx.plugin(http, { port, publicDir })
  await ctx.plugin(sessionStore)
  await ctx.plugin(sessions)
  await ctx.plugin(tools)
  await ctx.plugin(systemPrompt)
  await ctx.plugin(llm)
  await ctx.plugin(fs)
  await ctx.plugin(sandbox)
  await ctx.plugin(subprocess)
  await ctx.plugin(shell)
  await ctx.plugin(jobs)
  await ctx.plugin(mcp)
  await ctx.plugin(terminal)
  await ctx.plugin(lsp)
  await ctx.plugin(approvals)
  await ctx.plugin(agentLoop)
  await ctx.plugin(agents)
  await ctx.plugin(subagents)
  await ctx.plugin(liveSessions)
  await ctx.plugin(hub)
}

boot().catch((error) => {
  console.error('boot failed', error)
  process.exit(1)
})
